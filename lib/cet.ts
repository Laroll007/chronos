// Règles d'alimentation du CET (guide APORTT « Gestion du temps de travail »).
//
// Deux contraintes que l'app ignorait complètement et qui conditionnent l'épargne :
//
// 1. Épargner des CA suppose d'avoir DÉJÀ pris l'essentiel de ses congés dans
//    l'année — « au moins 20 jours de congés annuels (CA, HP, CAA, HPA et CAM
//    compris) ou 4/5e de leur dotation pour les cycliques ». Les deux formulations
//    coïncident : 4/5 de la dotation hebdo (25 j) valent précisément 20.
//
// 2. « L'alimentation du CET s'effectue entre le 1er et le 31 janvier pour les
//    congés de l'année précédente. » Le reste de l'année, l'épargne se PRÉPARE
//    (cf. `counters.caReservesCET`) mais ne se fait pas.

import { Counters, CycleConfig, HistoryEntry, CounterType, CETProjection } from './types';
import { getCATotalForCycle, getRTCLibres } from './calculations';
import {
  CET_PLAFOND,
  CET_APPORT_ANNUEL_MAX,
  CA_MAX_VERS_CET,
  HS_MAX_VERS_CET,
  HS_COUT_PAR_JOUR_CET,
  RTC_MAX_JOURS_CET,
  RTC_COUT_PAR_JOUR_CET,
  RTC_GAIN_PAR_JOUR,
  HEURES_PAR_JOUR,
} from './constants';

/** Mois d'alimentation du CET (0 = janvier). */
export const CET_ALIMENTATION_MOIS = 0;

/** Fraction de la dotation annuelle de CA à avoir consommée pour pouvoir épargner. */
export const CET_FRACTION_CA_REQUISE = 4 / 5;

/** Types de congés comptant dans le seuil (CA, HP, CAA, HPA). */
const TYPES_CA: CounterType[] = ['ca', 'caHP', 'caAnterieur', 'caHPAnterieur'];

/** Sommes-nous dans la fenêtre d'alimentation (1er → 31 janvier) ? */
export function isPeriodeAlimentationCET(date: Date = new Date()): boolean {
  return date.getMonth() === CET_ALIMENTATION_MOIS;
}

/**
 * Nombre de jours de congés annuels à avoir pris dans l'année pour pouvoir
 * épargner des CA. Arrondi au jour supérieur : les congés se posent par journées
 * entières, et « au moins 4/5e » de 18 jours (14,4) impose donc d'en avoir pris 15.
 */
export function getSeuilCAPourEpargne(cycleConfig: CycleConfig): number {
  return Math.ceil(getCATotalForCycle(cycleConfig) * CET_FRACTION_CA_REQUISE);
}

/**
 * Jours de congés annuels réellement posés sur l'année civile, tous types
 * confondus (CA, CA HP, et leurs reports). Lu depuis l'historique plutôt que
 * depuis `caConsommes`, qui ne compte que les CA ordinaires.
 */
export function countCAPosesAnnee(
  history: HistoryEntry[],
  annee: number = new Date().getFullYear()
): number {
  return history
    .filter((e) => e.action === 'pose' && !e.partialDay && TYPES_CA.includes(e.type))
    .filter((e) => new Date(e.date).getFullYear() === annee)
    .reduce((total, e) => total + e.amount, 0);
}

export interface EpargneCAVerdict {
  ok: boolean;
  /** Motif du refus, formulé pour l'agent. */
  raison?: string;
  /** Jours de CA déjà posés cette année. */
  poses: number;
  /** Seuil à atteindre. */
  seuil: number;
  /** Fenêtre d'alimentation ouverte ? */
  fenetreOuverte: boolean;
}

/**
 * L'agent peut-il épargner des CA sur son CET maintenant ?
 *
 * Les deux conditions du guide sont vérifiées séparément pour pouvoir expliquer
 * précisément ce qui bloque — un simple « impossible » n'aiderait personne.
 */
export function canEpargnerCA(
  cycleConfig: CycleConfig,
  history: HistoryEntry[],
  date: Date = new Date()
): EpargneCAVerdict {
  const seuil = getSeuilCAPourEpargne(cycleConfig);
  // En janvier, on épargne au titre de l'ANNÉE PRÉCÉDENTE : c'est donc sur
  // celle-ci que le seuil se mesure.
  const anneeDeReference = date.getFullYear() - 1;
  const poses = countCAPosesAnnee(history, anneeDeReference);
  const fenetreOuverte = isPeriodeAlimentationCET(date);

  if (!fenetreOuverte) {
    return {
      ok: false,
      fenetreOuverte,
      poses,
      seuil,
      raison:
        "L'alimentation du CET n'est possible qu'entre le 1er et le 31 janvier, au titre des congés de l'année précédente. D'ici là, vous pouvez sécuriser les jours que vous comptez y verser.",
    };
  }

  if (poses < seuil) {
    return {
      ok: false,
      fenetreOuverte,
      poses,
      seuil,
      raison: `Il faut avoir pris au moins ${seuil} jours de congés annuels en ${anneeDeReference} pour pouvoir en épargner (vous en avez posé ${poses}).`,
    };
  }

  return { ok: true, fenetreOuverte, poses, seuil };
}

/**
 * Jours de CA réellement épargnables, une fois les deux conditions vérifiées.
 * 0 si l'épargne n'est pas ouverte.
 */
export function getCAEpargnablesMaintenant(
  counters: Counters,
  cycleConfig: CycleConfig,
  history: HistoryEntry[],
  date: Date = new Date()
): number {
  if (!canEpargnerCA(cycleConfig, history, date).ok) return 0;
  return counters.ca;
}


// ============================================
// RÉPARTITION DE L'APPORT CET
// ============================================

export interface ApportCET {
  rtc: number;
  caHP: number;
  ca: number;
  hs: number;
  total: number;
}

/**
 * Répartit les places disponibles au CET entre les sources éligibles.
 *
 * ⚠️ Source de vérité UNIQUE. Cette logique existait en deux exemplaires — un
 * dans la Projection du Profil, un dans le bilan de fin d'année — et les deux
 * divergeaient : seul le second respectait les CA que l'agent avait sécurisés.
 * Les deux écrans annonçaient donc des répartitions différentes pour les mêmes
 * données.
 *
 * Ordre : l'intention explicite de l'agent d'abord (CA sécurisés), puis l'ordre
 * avantageux — RTC (8h21 payés pour 12h08 de valeur), CA HP, CA restants, HS.
 */
export function repartirApportCET(counters: Counters): { capacite: number; apport: ApportCET } {
  const capacite = Math.max(0, Math.min(CET_PLAFOND - counters.cet, CET_APPORT_ANNUEL_MAX));
  const apport: ApportCET = { rtc: 0, caHP: 0, ca: 0, hs: 0, total: 0 };
  let reste = capacite;

  const reserve = Math.max(0, counters.caReservesCET ?? 0);
  apport.ca = Math.min(reserve, CA_MAX_VERS_CET, counters.ca, reste);
  reste -= apport.ca;

  if (reste > 0) {
    apport.rtc = Math.min(RTC_MAX_JOURS_CET, Math.floor(counters.rtc / RTC_COUT_PAR_JOUR_CET), reste);
    reste -= apport.rtc;
  }
  if (reste > 0) {
    apport.caHP = Math.min(counters.caHP, reste);
    reste -= apport.caHP;
  }
  if (reste > 0) {
    const encoreCA = Math.max(0, CA_MAX_VERS_CET - apport.ca);
    const supplement = Math.min(encoreCA, counters.ca - apport.ca, reste);
    apport.ca += supplement;
    reste -= supplement;
  }
  if (reste > 0) {
    apport.hs = Math.min(HS_MAX_VERS_CET, Math.floor(counters.hs / HS_COUT_PAR_JOUR_CET), reste);
    reste -= apport.hs;
  }

  apport.total = apport.rtc + apport.caHP + apport.ca + apport.hs;
  return { capacite, apport };
}

/** Projection CET affichée dans le Profil, bâtie sur la répartition commune. */
export function calculateOptimalCETStrategy(counters: Counters): CETProjection {
  const { capacite, apport } = repartirApportCET(counters);
  const gainNetRTC = apport.rtc * RTC_GAIN_PAR_JOUR;

  const caExcedentaires = Math.max(0, counters.ca - CA_MAX_VERS_CET - apport.ca);
  const rtcLibresRestants = Math.max(0, getRTCLibres(counters.rtc) - apport.rtc * RTC_COUT_PAR_JOUR_CET);
  const rtcJoursPerdus = Math.floor(rtcLibresRestants / HEURES_PAR_JOUR);

  return {
    apportCET: { rtc: apport.rtc, caHP: apport.caHP, ca: apport.ca, hs: apport.hs },
    totalApport: apport.total,
    cetFinal: counters.cet + apport.total,
    gainNetRTC,
    joursEconomises: Math.floor(gainNetRTC / HEURES_PAR_JOUR),
    joursPerdus: caExcedentaires + rtcJoursPerdus,
    isOptimal: apport.total >= capacite,
  };
}
