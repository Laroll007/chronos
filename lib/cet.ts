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

/** Types de congés comptant dans le seuil (CA, HP, CAA, HPA et CAM, guide APORTT). */
const TYPES_CA: CounterType[] = ['ca', 'caHP', 'caAnterieur', 'caHPAnterieur', 'caReporte'];

/** Sommes-nous dans la fenêtre d'alimentation (1er → 31 janvier) ? */
export function isPeriodeAlimentationCET(date: Date = new Date()): boolean {
  return date.getMonth() === CET_ALIMENTATION_MOIS;
}

/**
 * Nombre de jours de congés annuels à avoir pris dans l'année pour pouvoir
 * épargner des CA (« 4 semaines »). Arrondi au jour INFÉRIEUR, comme le tableau
 * du guide CET 2026 du ministère (déc. 2025, p. 7) : 14 pour 18 CA (2/2, 3/3,
 * 2/2/3), 18 pour 23 CA (4/2), 16 pour 20 CA (vacation forte), 20 pour 25 CA.
 */
export function getSeuilCAPourEpargne(cycleConfig: CycleConfig): number {
  return Math.floor(getCATotalForCycle(cycleConfig) * CET_FRACTION_CA_REQUISE);
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
  /** ARTT et RTT (régime hebdomadaire), en jours : versables en totalité, comme les RTC. */
  artt: number;
  rtt: number;
  caHP: number;
  ca: number;
  hs: number;
  total: number;
}

export interface RepartitionCET {
  /** Jours que le CET peut conserver sans indemnisation (cf. getCETApportMaxAnnee). */
  capacite: number;
  /**
   * Versement retenu : celui que l'agent a choisi ligne par ligne s'il l'a fait
   * (peut dépasser la capacité : le surplus est payé ou RAFP), sinon le conseillé.
   */
  apport: ApportCET;
  /** Versement conseillé : remplit la capacité, dans l'ordre le plus avantageux. */
  conseille: ApportCET;
  /** L'agent a choisi son versement (sinon : conseillé automatique). */
  choisi: boolean;
  /** Tout ce qui peut être versé (limites par source du guide). */
  maximum: ApportCET;
  /** Jours du maximum qui ne pourraient pas rester sur le CET : indemnisés ou RAFP. */
  indemnises: number;
}

const total = (a: Omit<ApportCET, 'total'>): ApportCET => ({ ...a, total: a.rtc + a.artt + a.rtt + a.caHP + a.ca + a.hs });

/** Sources épargnables, dans l'ordre du versement conseillé. */
export const SOURCES_CET = ['rtc', 'artt', 'rtt', 'caHP', 'ca', 'hs'] as const;
export type SourceCET = (typeof SOURCES_CET)[number];

/**
 * Demi-journée de RTC ou d'HS versable : la moitié de 8h21, arrondie à la
 * minute supérieure (4h11) pour ne jamais compter une demi-journée que GesTT
 * refuserait. Le guide autorise à « cumuler des ½ journées, de natures
 * différentes, pour former un ou plusieurs jours d'épargne ».
 */
export const DEMI_JOURNEE_CET = Math.ceil(RTC_COUT_PAR_JOUR_CET / 2);

/** Jours (demi-journées comprises) que représentent des minutes, à 8h21 le jour. */
export function joursCETDepuisMinutes(minutes: number, coutJour: number = RTC_COUT_PAR_JOUR_CET): number {
  const m = Math.max(0, minutes);
  const entiers = Math.floor(m / coutJour);
  return entiers + (m - entiers * coutJour >= DEMI_JOURNEE_CET ? 0.5 : 0);
}

/** Minutes que coûtent des jours de RTC / HS versés (demi-journée = 4h11). */
export function minutesPourJoursCET(jours: number, coutJour: number = RTC_COUT_PAR_JOUR_CET): number {
  const entiers = Math.floor(Math.max(0, jours));
  return entiers * coutJour + (jours - entiers >= 0.5 ? DEMI_JOURNEE_CET : 0);
}

/** Arrondi à la demi-journée inférieure (soldes en jours). */
const demiInf = (n: number) => Math.floor(Math.max(0, n) * 2) / 2;

/**
 * Un versement doit former des jours entiers : une demi-journée isolée est
 * complétée par la demi-journée d'une autre source si la place le permet,
 * sinon retirée (en commençant par la fin de l'ordre de versement).
 */
function arrondirAuJour(
  a: Omit<ApportCET, 'total'>,
  max: Omit<ApportCET, 'total'>,
  place: number
): Omit<ApportCET, 'total'> {
  const r = { ...a };
  const somme = () => SOURCES_CET.reduce((s, k) => s + r[k], 0);
  if (Number.isInteger(somme())) return r;
  const completer = SOURCES_CET.find((k) => max[k] - r[k] >= 0.5);
  if (completer && somme() + 0.5 <= place) {
    r[completer] += 0.5;
    return r;
  }
  const retirer = [...SOURCES_CET].reverse().find((k) => !Number.isInteger(r[k]));
  if (retirer) r[retirer] -= 0.5;
  return r;
}

/** Remplit la place dans l'ordre conseillé (bouton « Épargner le max sans me faire payer »). */
export function remplirSansPaiement(maximum: ApportCET, capacite: number): ApportCET {
  let reste = capacite;
  const r = { rtc: 0, artt: 0, rtt: 0, caHP: 0, ca: 0, hs: 0 };
  for (const k of SOURCES_CET) {
    r[k] = Math.max(0, Math.min(maximum[k], demiInf(reste)));
    reste -= r[k];
  }
  return total(arrondirAuJour(r, maximum, capacite));
}

/** Tout ce qui peut être versé, en jours entiers (bouton « … en me faisant payer »). */
export function remplirMaximum(maximum: ApportCET): ApportCET {
  return total(arrondirAuJour(maximum, maximum, maximum.total));
}

/**
 * Répartit l'épargne CET entre les sources éligibles.
 *
 * ⚠️ Source de vérité UNIQUE (Projection, bilan de fin d'année, « Mon épargne CET »).
 *
 * Limites par source (guide APORTT) : tous les RTC restants (8h21 le jour),
 * tous les ARTT et RTT (« tous les jours ou heures ARTT peuvent alimenter le
 * CET »), 5 CA, 2 CA HP, 5 jours d'HS. Il n'y a pas de plafond annuel au versement :
 * la limite des 10 jours porte sur ce que le CET CONSERVE au-delà de 15 jours
 * (`capacite`). Le surplus d'un versement maximal est indemnisé ou versé à la RAFP.
 *
 * Le versement conseillé remplit la capacité dans l'ordre : CA sécurisés, RTC
 * (8h21 payés pour une journée entière ; plafonnés au nombre choisi par
 * l'agent s'il en a fixé un), ARTT et RTT (perdus au 31/12 sinon), HS gardées
 * par l'agent, CA HP, CA restants, HS.
 */
export function repartirApportCET(counters: Counters, anneeConges: number = new Date().getFullYear()): RepartitionCET {
  const vide = total({ rtc: 0, artt: 0, rtt: 0, caHP: 0, ca: 0, hs: 0 });
  // Au-delà de 60 jours (relèvement COVID/JOP), le CET est gelé : aucun versement.
  if (counters.cet > CET_PLAFOND) {
    return { capacite: 0, apport: vide, conseille: vide, choisi: false, maximum: vide, indemnises: 0 };
  }

  // Demi-journées admises (cumulables entre compteurs pour former des jours).
  const maximum = total({
    rtc: joursCETDepuisMinutes(counters.rtc),
    artt: counters.hasARTT ? demiInf(counters.artt ?? 0) : 0,
    rtt: counters.hasRTT ? demiInf(counters.rtt ?? 0) : 0,
    caHP: Math.min(CA_HP_BONUS, demiInf(counters.caHP)),
    ca: Math.min(CA_MAX_VERS_CET, demiInf(counters.ca)),
    hs: Math.min(HS_MAX_VERS_CET, joursCETDepuisMinutes(counters.hs, HS_COUT_PAR_JOUR_CET)),
  });

  const capacite = getCETApportMaxAnnee(counters.cet);
  let reste = capacite;
  const prendre = (dispo: number) => {
    const n = Math.max(0, Math.min(dispo, reste));
    reste -= n;
    return n;
  };
  // Choix de l'agent (« je garde 9 RTC, 2 jours d'HS ») : pris en priorité,
  // et les RTC plafonnés à son choix. Sans choix : RTC jusqu'à remplir la place.
  const rtcChoisi = counters.rtcJoursCET;
  const hsChoisi = Math.max(0, counters.hsJoursCET ?? 0);
  const caSecurises = prendre(Math.min(Math.max(0, counters.caReservesCET ?? 0), maximum.ca));
  const rtc = prendre(rtcChoisi !== undefined ? Math.min(maximum.rtc, Math.max(0, rtcChoisi)) : maximum.rtc);
  const artt = prendre(maximum.artt);
  const rtt = prendre(maximum.rtt);
  const hsSecurises = prendre(Math.min(hsChoisi, maximum.hs));
  const caHP = prendre(maximum.caHP);
  const ca = caSecurises + prendre(maximum.ca - caSecurises);
  const hs = hsSecurises + prendre(maximum.hs - hsSecurises);
  const conseille = total(arrondirAuJour({ rtc, artt, rtt, caHP, ca, hs }, maximum, capacite));

  // Versement choisi ligne par ligne (« Mon épargne CET ») : chaque ligne bornée
  // à son maximum, la capacité peut être dépassée (surplus payé ou RAFP).
  const choix = counters.choixCET?.annee === anneeConges ? counters.choixCET : undefined;
  const apport = choix
    ? total({
        rtc: Math.min(maximum.rtc, demiInf(choix.rtc)),
        artt: Math.min(maximum.artt, demiInf(choix.artt)),
        rtt: Math.min(maximum.rtt, demiInf(choix.rtt)),
        caHP: Math.min(maximum.caHP, demiInf(choix.caHP)),
        ca: Math.min(maximum.ca, demiInf(choix.ca)),
        hs: Math.min(maximum.hs, demiInf(choix.hs)),
      })
    : conseille;

  return {
    capacite,
    apport,
    conseille,
    choisi: Boolean(choix),
    maximum,
    indemnises: Math.max(0, remplirMaximum(maximum).total - capacite),
  };
}

/** Projection CET affichée dans le Profil, bâtie sur la répartition commune. */
export function calculateOptimalCETStrategy(counters: Counters): CETProjection {
  const { capacite, apport } = repartirApportCET(counters);
  const gainNetRTC = apport.rtc * RTC_GAIN_PAR_JOUR;

  // Perdus au 31/12 s'ils ne sont ni posés ni versés : les CA au-delà des 5
  // versables. Les RTC peuvent tous partir au CET (au pire indemnisés).
  const caExcedentaires = Math.max(0, counters.ca - CA_MAX_VERS_CET);

  return {
    apportCET: { rtc: apport.rtc, artt: apport.artt, rtt: apport.rtt, caHP: apport.caHP, ca: apport.ca, hs: apport.hs },
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
  /** Versement retenu : choisi par l'agent, sinon le conseillé. */
  apport: ApportCET;
  /** Versement conseillé, sans indemnisation. */
  conseille: ApportCET;
  /** L'agent a choisi son versement ligne par ligne. */
  choisi: boolean;
  /** Versement maximal (limites par source). */
  maximum: ApportCET;
  /** Jours du versement maximal indemnisés ou versés à la RAFP. */
  indemnises: number;
  /** Coût en minutes des jours de RTC / HS versés (8h21 le jour), versement conseillé. */
  rtcMinutes: number;
  hsMinutes: number;
  /** Soldes d'où part le versement (RTC et HS en minutes, le reste en jours). */
  soldes: { rtc: number; artt: number; rtt: number; caHP: number; ca: number; hs: number };
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
      artt: reliquat?.artt ?? 0,
      rtt: reliquat?.rtt ?? 0,
      ca: caOk ? counters.caAnterieur : 0,
      caHP: caOk ? counters.caHPAnterieur : 0,
      caReservesCET: caOk ? reliquat?.caReserves ?? 0 : 0,
    };
    const { capacite, apport, conseille, choisi, maximum, indemnises } = repartirApportCET(sources, anneeConges);
    return {
      mode: 'janvier',
      anneeConges,
      anneeVersement: date.getFullYear(),
      capacite,
      apport,
      conseille,
      choisi,
      maximum,
      indemnises,
      rtcMinutes: minutesPourJoursCET(apport.rtc),
      hsMinutes: minutesPourJoursCET(apport.hs, HS_COUT_PAR_JOUR_CET),
      soldes: { rtc: sources.rtc, artt: sources.artt ?? 0, rtt: sources.rtt ?? 0, caHP: counters.caHPAnterieur, ca: counters.caAnterieur, hs: counters.hs },
      conditionCA: { ok: caOk, poses, seuil },
      reliquatRTCInconnu: !reliquat && counters.hasRTC !== false,
    };
  }

  const anneeConges = date.getFullYear();
  const poses = countCAPosesAnnee(history, anneeConges);
  const { capacite, apport, conseille, choisi, maximum, indemnises } = repartirApportCET(counters, anneeConges);
  return {
    mode: 'estimation',
    anneeConges,
    anneeVersement: anneeConges + 1,
    capacite,
    apport,
    conseille,
    choisi,
    maximum,
    indemnises,
    rtcMinutes: minutesPourJoursCET(apport.rtc),
    hsMinutes: minutesPourJoursCET(apport.hs, HS_COUT_PAR_JOUR_CET),
    soldes: { rtc: counters.rtc, artt: counters.artt ?? 0, rtt: counters.rtt ?? 0, caHP: counters.caHP, ca: counters.ca, hs: counters.hs },
    conditionCA: { ok: poses >= seuil, poses, seuil },
    reliquatRTCInconnu: false,
  };
}
