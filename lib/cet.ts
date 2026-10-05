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

import { Counters, CycleConfig, HistoryEntry, CounterType, CETProjection, UserData } from './types';
import { getCATotalForCycle, getCETApportMaxAnnee } from './calculations';
import {
  CET_PLAFOND,
  CA_HP_BONUS,
  CA_MAX_VERS_CET,
  HS_MAX_VERS_CET,
  HS_COUT_PAR_JOUR_CET,
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

export interface RepartitionCET {
  /** Jours que le CET peut conserver sans indemnisation (cf. getCETApportMaxAnnee). */
  capacite: number;
  /** Versement conseillé : remplit la capacité, dans l'ordre le plus avantageux. */
  apport: ApportCET;
  /** Tout ce qui peut être versé (limites par source du guide). */
  maximum: ApportCET;
  /** Jours du maximum qui ne pourraient pas rester sur le CET : indemnisés ou RAFP. */
  indemnises: number;
}

const total = (a: Omit<ApportCET, 'total'>): ApportCET => ({ ...a, total: a.rtc + a.caHP + a.ca + a.hs });

/**
 * Répartit l'épargne CET entre les sources éligibles.
 *
 * ⚠️ Source de vérité UNIQUE (Projection, bilan de fin d'année, « Mon épargne CET »).
 *
 * Limites par source (guide APORTT) : tous les RTC restants (8h21 le jour),
 * 5 CA, 2 CA HP, 5 jours d'HS. Il n'y a pas de plafond annuel au versement :
 * la limite des 10 jours porte sur ce que le CET CONSERVE au-delà de 15 jours
 * (`capacite`). Le surplus d'un versement maximal est indemnisé ou versé à la RAFP.
 *
 * Le versement conseillé remplit la capacité dans l'ordre : l'intention
 * explicite de l'agent (CA sécurisés), puis RTC (8h21 payés pour une journée
 * entière), CA HP, CA restants, HS.
 */
export function repartirApportCET(counters: Counters): RepartitionCET {
  const vide = total({ rtc: 0, caHP: 0, ca: 0, hs: 0 });
  // Au-delà de 60 jours (relèvement COVID/JOP), le CET est gelé : aucun versement.
  if (counters.cet > CET_PLAFOND) return { capacite: 0, apport: vide, maximum: vide, indemnises: 0 };

  const maximum = total({
    rtc: Math.floor(Math.max(0, counters.rtc) / RTC_COUT_PAR_JOUR_CET),
    caHP: Math.min(CA_HP_BONUS, Math.max(0, counters.caHP)),
    ca: Math.min(CA_MAX_VERS_CET, Math.max(0, counters.ca)),
    hs: Math.min(HS_MAX_VERS_CET, Math.floor(Math.max(0, counters.hs) / HS_COUT_PAR_JOUR_CET)),
  });

  const capacite = getCETApportMaxAnnee(counters.cet);
  let reste = capacite;
  const prendre = (dispo: number) => {
    const n = Math.max(0, Math.min(dispo, reste));
    reste -= n;
    return n;
  };
  const caSecurises = prendre(Math.min(Math.max(0, counters.caReservesCET ?? 0), maximum.ca));
  const rtc = prendre(maximum.rtc);
  const caHP = prendre(maximum.caHP);
  const ca = caSecurises + prendre(maximum.ca - caSecurises);
  const hs = prendre(maximum.hs);
  const apport = total({ rtc, caHP, ca, hs });

  return { capacite, apport, maximum, indemnises: Math.max(0, maximum.total - capacite) };
}

/** Projection CET affichée dans le Profil, bâtie sur la répartition commune. */
export function calculateOptimalCETStrategy(counters: Counters): CETProjection {
  const { capacite, apport } = repartirApportCET(counters);
  const gainNetRTC = apport.rtc * RTC_GAIN_PAR_JOUR;

  // Perdus au 31/12 s'ils ne sont ni posés ni versés : les CA au-delà des 5
  // versables. Les RTC peuvent tous partir au CET (au pire indemnisés).
  const caExcedentaires = Math.max(0, counters.ca - CA_MAX_VERS_CET);

  return {
    apportCET: { rtc: apport.rtc, caHP: apport.caHP, ca: apport.ca, hs: apport.hs },
    totalApport: apport.total,
    cetFinal: counters.cet + apport.total,
    gainNetRTC,
    joursEconomises: Math.floor(gainNetRTC / HEURES_PAR_JOUR),
    joursPerdus: caExcedentaires,
    isOptimal: apport.total >= capacite,
  };
}


// ============================================
// PLAN D'ÉPARGNE : « combien, et quels congés ? »
// ============================================

export interface PlanEpargneCET {
  /**
   * 'janvier' : fenêtre ouverte, plan réel sur les reliquats de l'année écoulée
   * (RTC mémorisés à la bascule, CA/CA HP antérieurs, HS).
   * 'estimation' : le reste de l'année, projection sur les soldes actuels.
   */
  mode: 'janvier' | 'estimation';
  /** Année des congés versés. */
  anneeConges: number;
  /** Année du versement (janvier). */
  anneeVersement: number;
  /** Jours que le CET peut conserver (au-delà : indemnisation ou RAFP). */
  capacite: number;
  /** Versement conseillé, sans indemnisation. */
  apport: ApportCET;
  /** Versement maximal (limites par source). */
  maximum: ApportCET;
  /** Jours du versement maximal indemnisés ou versés à la RAFP. */
  indemnises: number;
  /** Coût en minutes des jours de RTC / HS versés (8h21 le jour), versement conseillé. */
  rtcMinutes: number;
  hsMinutes: number;
  /** Seuil de congés pris requis pour verser des CA (et CA HP). */
  conditionCA: { ok: boolean; poses: number; seuil: number };
  /** Janvier sans relevé des RTC de l'an dernier (inscription récente…). */
  reliquatRTCInconnu: boolean;
}

export function planEpargneCET(data: UserData, date: Date = new Date()): PlanEpargneCET {
  const { counters, cycleConfig, history } = data;
  const seuil = getSeuilCAPourEpargne(cycleConfig);

  if (isPeriodeAlimentationCET(date)) {
    const anneeConges = date.getFullYear() - 1;
    const reliquat = data.reliquatCET?.annee === anneeConges ? data.reliquatCET : null;
    const poses = countCAPosesAnnee(history, anneeConges);
    const caOk = poses >= seuil;
    // Ce qui peut encore partir : les reports de l'année écoulée, jamais la
    // nouvelle dotation (bug de l'ancien bouton « Épargner », qui prélevait
    // sur les CA de l'année qui commence).
    const sources: Counters = {
      ...counters,
      rtc: reliquat?.rtc ?? 0,
      ca: caOk ? counters.caAnterieur : 0,
      caHP: caOk ? counters.caHPAnterieur : 0,
      caReservesCET: caOk ? reliquat?.caReserves ?? 0 : 0,
    };
    const { capacite, apport, maximum, indemnises } = repartirApportCET(sources);
    return {
      mode: 'janvier',
      anneeConges,
      anneeVersement: date.getFullYear(),
      capacite,
      apport,
      maximum,
      indemnises,
      rtcMinutes: apport.rtc * RTC_COUT_PAR_JOUR_CET,
      hsMinutes: apport.hs * HS_COUT_PAR_JOUR_CET,
      conditionCA: { ok: caOk, poses, seuil },
      reliquatRTCInconnu: !reliquat && counters.hasRTC !== false,
    };
  }

  const anneeConges = date.getFullYear();
  const poses = countCAPosesAnnee(history, anneeConges);
  const { capacite, apport, maximum, indemnises } = repartirApportCET(counters);
  return {
    mode: 'estimation',
    anneeConges,
    anneeVersement: anneeConges + 1,
    capacite,
    apport,
    maximum,
    indemnises,
    rtcMinutes: apport.rtc * RTC_COUT_PAR_JOUR_CET,
    hsMinutes: apport.hs * HS_COUT_PAR_JOUR_CET,
    conditionCA: { ok: poses >= seuil, poses, seuil },
    reliquatRTCInconnu: false,
  };
}
