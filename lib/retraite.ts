// Simulateur de départ à la retraite.
//
// Beaucoup d'agents soldent l'intégralité de leurs compteurs d'un coup et cessent
// de travailler bien avant leur radiation des cadres — parfois plus d'un an.
// L'outil répond à « à partir de quand puis-je ne plus venir ? » : on part de la
// date de radiation et on remonte le calendrier à rebours en consommant les
// compteurs sur chaque jour travaillé du cycle.
//
// Trois règles APORTT structurent le calcul :
//
// 1. CET — « L'agent doit impérativement utiliser en congés, avant cette date,
//    les 15 premiers jours du CET […] Pour les autres jours, l'indemnisation
//    intervient à la date de cessation des fonctions. » Les 15 premiers jours
//    sont donc un plancher de congés, le reste relève d'un choix.
//
// 2. Année incomplète — « congé annuel dont la durée est calculée au prorata de
//    la durée accomplie », et pour les CF/ARTT « proportionnel au temps de
//    présence, calculé par période de 15 jours ». La dotation de l'année de
//    radiation est donc partielle.
//
// 3. Années intermédiaires — les congés payés valent période d'activité : un
//    agent absent toute l'année 2027 acquiert malgré tout sa dotation 2027, qu'il
//    peut poser par anticipation. Elles comptent donc pleines.

import { Counters, CycleConfig, CounterType, HistoryEntry } from './types';
import {
  CF_TOTAL_ANNUEL,
  RTC_BRUT_ANNUEL,
  RTC_NET_ANNUEL,
  ARTT_QUOTA_ANNUEL,
  RTT_QUOTA_HEBDO,
  CET_SEUIL_OPTION,
  HEURES_PAR_JOUR,
} from './constants';
import { getCATotalForCycle, getJourMinutes, isWorkingDay } from './calculations';
import { isDayBasedType } from './optimization';
import { computeRPSCredit, toISODay } from './rps';

/** Indemnisation d'un jour de CET non posé, selon la catégorie (guide APORTT). */
export const INDEMNISATION_CET: Record<CategorieAgent, number> = {
  A: 150,
  B: 100,
  C: 83,
};

export type CategorieAgent = 'A' | 'B' | 'C';

/** Compteurs mobilisables pour un départ, dans l'ordre de consommation. */
export const COMPTEURS_RETRAITE: CounterType[] = [
  // Périmés en premier : ils seraient perdus autrement.
  'caAnterieur', 'caHPAnterieur',
  'ca', 'caHP', 'artt', 'rtt', 'congesBonifies',
  'cf', 'rtc', 'rps', 'hs', 'hsHistorique',
  // Le CET en dernier : c'est le seul dont le reliquat est indemnisé.
  'cet', 'cet2008',
];

export interface OptionsRetraite {
  /** Jours de CET posés en congés. Plancher : les 15 premiers (obligatoires). */
  cetPoseEnConges?: number;
  /** Compteurs exclus du calcul (l'agent préfère se les faire payer). */
  exclus?: CounterType[];
  /** Catégorie, pour estimer l'indemnisation du CET non posé. */
  categorie?: CategorieAgent;
}

export interface ConsommationCompteur {
  type: CounterType;
  /** Quantité mobilisée, dans l'unité du compteur. */
  quantite: number;
  unite: 'jours' | 'heures';
  /** Jours travaillés que ce compteur couvre. */
  joursCouverts: number;
}

export interface ResultatRetraite {
  /** Dernier jour effectivement travaillé (null si les compteurs couvrent tout). */
  dernierJourTravaille: Date | null;
  /** Premier jour de l'absence continue. */
  premierJourConge: Date | null;
  /** Jours travaillés couverts par les compteurs. */
  joursCouverts: number;
  /** Durée calendaire de l'absence, en jours. */
  dureeCalendaire: number;
  /** Détail par compteur. */
  detail: ConsommationCompteur[];
  /** Dotations futures intégrées, par année. */
  dotationsFutures: { annee: number; prorata: number; jours: number; minutes: number }[];
  /** Jours de CET non posés, donc indemnisés. */
  cetIndemnise: number;
  /** Estimation de l'indemnisation, en euros. */
  indemnisationEuros: number;
  /** Reliquat n'ayant pas suffi à couvrir un jour de plus. */
  reliquatMinutes: number;
  /** true si les compteurs couvrent toute la période jusqu'à la radiation. */
  couvreToutePeriode: boolean;
}

/** Part de l'année effectivement servie avant la radiation (0 → 1). */
export function getProrataAnnee(dateRetraite: Date): number {
  const annee = dateRetraite.getFullYear();
  const debut = new Date(annee, 0, 1);
  const fin = new Date(annee, 11, 31);
  const total = Math.round((fin.getTime() - debut.getTime()) / 86_400_000) + 1;
  const servis = Math.round((dateRetraite.getTime() - debut.getTime()) / 86_400_000) + 1;
  return Math.max(0, Math.min(1, servis / total));
}

/**
 * Arrondi APORTT des dotations non entières : au demi-jour le plus proche selon
 * la décimale (< 0,25 en dessous ; 0,25–0,74 au demi ; ≥ 0,75 au dessus).
 */
export function arrondirDotation(jours: number): number {
  const entier = Math.floor(jours);
  const dec = jours - entier;
  if (dec < 0.25) return entier;
  if (dec < 0.75) return entier + 0.5;
  return entier + 1;
}

interface Dotation {
  jours: Partial<Record<CounterType, number>>;
  minutes: Partial<Record<CounterType, number>>;
}

/** Dotation annuelle d'un agent, proratisée le cas échéant. */
function dotationAnnuelle(
  counters: Counters,
  cycleConfig: CycleConfig,
  prorata: number
): Dotation {
  const jours: Partial<Record<CounterType, number>> = {};
  const minutes: Partial<Record<CounterType, number>> = {};

  jours.ca = arrondirDotation(getCATotalForCycle(cycleConfig) * prorata);
  if (counters.hasARTT) jours.artt = arrondirDotation(ARTT_QUOTA_ANNUEL * prorata);
  if (counters.hasRTT) jours.rtt = arrondirDotation(RTT_QUOTA_HEBDO * prorata);
  if (counters.hasCF !== false) minutes.cf = Math.round(CF_TOTAL_ANNUEL * prorata);
  if (counters.hasRTC !== false) {
    const base = counters.journeeSolidariteAppliquee ? RTC_NET_ANNUEL : RTC_BRUT_ANNUEL;
    minutes.rtc = Math.round(base * prorata);
  }
  // Ni RPS ni HS : ils dépendent du travail réellement effectué, pas d'une
  // dotation. Les RPS acquis d'ici le départ sont ajoutés séparément.
  return { jours, minutes };
}

/** Solde d'un compteur, dans son unité propre. */
function soldeCourant(counters: Counters, type: CounterType): number {
  switch (type) {
    case 'ca': return counters.ca;
    case 'caHP': return counters.caHP;
    case 'caAnterieur': return counters.caAnterieur;
    case 'caHPAnterieur': return counters.caHPAnterieur;
    case 'artt': return counters.hasARTT ? counters.artt ?? 0 : 0;
    case 'rtt': return counters.hasRTT ? counters.rtt ?? 0 : 0;
    case 'congesBonifies': return counters.hasCongesBonifies ? counters.congesBonifies ?? 0 : 0;
    case 'cet': return counters.cet;
    case 'cet2008': return counters.hasCET2008 ? counters.cet2008 ?? 0 : 0;
    case 'cf': return counters.hasCF !== false ? counters.cf : 0;
    case 'rtc': return counters.hasRTC !== false ? counters.rtc : 0;
    case 'rps': return counters.rps;
    case 'hs': return counters.hs;
    case 'hsHistorique': return counters.hsHistorique;
    default: return 0;
  }
}

/**
 * Calcule la date à partir de laquelle l'agent peut cesser de travailler.
 *
 * `today` est injectable pour les tests ; il détermine les années de dotation
 * future à intégrer et la période d'acquisition des RPS restants.
 */
export function calculerDepartRetraite(
  dateRetraite: Date,
  counters: Counters,
  cycleConfig: CycleConfig,
  history: HistoryEntry[] = [],
  options: OptionsRetraite = {},
  today: Date = new Date()
): ResultatRetraite {
  const exclus = new Set(options.exclus ?? []);
  const categorie = options.categorie ?? 'B';

  // ── Stock disponible, par compteur ────────────────────────────────────────
  const stockJours = new Map<CounterType, number>();
  const stockMinutes = new Map<CounterType, number>();

  for (const type of COMPTEURS_RETRAITE) {
    if (exclus.has(type)) continue;
    let solde = soldeCourant(counters, type);
    if (solde <= 0) continue;

    // Le CET est le seul compteur dont une part peut être indemnisée plutôt que
    // posée : on ne retient que ce que l'agent a choisi de poser.
    if (type === 'cet') {
      const plancher = Math.min(CET_SEUIL_OPTION, solde);
      const choisi = options.cetPoseEnConges ?? solde;
      solde = Math.max(plancher, Math.min(choisi, solde));
    }

    if (isDayBasedType(type)) stockJours.set(type, solde);
    else stockMinutes.set(type, solde);
  }

  // ── Dotations des années à venir ──────────────────────────────────────────
  const dotationsFutures: ResultatRetraite['dotationsFutures'] = [];
  const anneeRetraite = dateRetraite.getFullYear();
  for (let annee = today.getFullYear() + 1; annee <= anneeRetraite; annee++) {
    const prorata = annee === anneeRetraite ? getProrataAnnee(dateRetraite) : 1;
    const dot = dotationAnnuelle(counters, cycleConfig, prorata);

    let totalJours = 0;
    let totalMinutes = 0;
    for (const [type, valeur] of Object.entries(dot.jours) as [CounterType, number][]) {
      if (exclus.has(type) || valeur <= 0) continue;
      stockJours.set(type, (stockJours.get(type) ?? 0) + valeur);
      totalJours += valeur;
    }
    for (const [type, valeur] of Object.entries(dot.minutes) as [CounterType, number][]) {
      if (exclus.has(type) || valeur <= 0) continue;
      stockMinutes.set(type, (stockMinutes.get(type) ?? 0) + valeur);
      totalMinutes += valeur;
    }
    dotationsFutures.push({ annee, prorata, jours: totalJours, minutes: totalMinutes });
  }

  // ── Remontée du calendrier ────────────────────────────────────────────────
  // Le stock de RPS dépend des jours encore travaillés d'ici au départ, qui
  // dépendent eux-mêmes du stock : on itère jusqu'à stabilisation (convergence
  // en 2 ou 3 passes, la correction étant décroissante).
  const rpsInclus = !exclus.has('rps');
  let rpsAjoutes = 0;
  let resultat = parcourir(dateRetraite, cycleConfig, stockJours, stockMinutes);

  for (let i = 0; i < 5 && rpsInclus && resultat.premierJourConge; i++) {
    const credit = computeRPSCredit(
      { ...counters, rpsDernierCredit: toISODay(today) },
      cycleConfig,
      history,
      resultat.premierJourConge
    );
    if (credit.minutes === rpsAjoutes) break;
    const delta = credit.minutes - rpsAjoutes;
    rpsAjoutes = credit.minutes;
    stockMinutes.set('rps', (stockMinutes.get('rps') ?? 0) + delta);
    resultat = parcourir(dateRetraite, cycleConfig, stockJours, stockMinutes);
  }

  // ── Restitution ───────────────────────────────────────────────────────────
  const cetPose = stockJours.get('cet') ?? 0;
  const cetIndemnise = exclus.has('cet') ? counters.cet : Math.max(0, counters.cet - cetPose);

  return {
    ...resultat,
    dotationsFutures,
    cetIndemnise,
    indemnisationEuros: Math.round(cetIndemnise * INDEMNISATION_CET[categorie]),
  };
}

/**
 * Remonte le calendrier depuis la radiation en consommant les stocks.
 * Les compteurs en JOURS paient une journée entière quelle qu'en soit la durée ;
 * les compteurs horaires paient la durée réelle du jour (cycle hebdo compris).
 */
function parcourir(
  dateRetraite: Date,
  cycleConfig: CycleConfig,
  stockJoursSrc: Map<CounterType, number>,
  stockMinutesSrc: Map<CounterType, number>
): Omit<ResultatRetraite, 'dotationsFutures' | 'cetIndemnise' | 'indemnisationEuros'> {
  const jours = new Map(stockJoursSrc);
  const minutes = new Map(stockMinutesSrc);
  const consomme = new Map<CounterType, { quantite: number; joursCouverts: number }>();

  const noter = (type: CounterType, quantite: number) => {
    const e = consomme.get(type) ?? { quantite: 0, joursCouverts: 0 };
    e.quantite += quantite;
    e.joursCouverts += 1;
    consomme.set(type, e);
  };

  const curseur = new Date(dateRetraite);
  curseur.setHours(0, 0, 0, 0);
  let joursCouverts = 0;
  let premierJourConge: Date | null = null;
  // Garde-fou : au-delà de 10 ans en arrière, le stock est manifestement aberrant.
  const limite = new Date(curseur);
  limite.setFullYear(limite.getFullYear() - 10);

  while (curseur >= limite) {
    if (!isWorkingDay(curseur, cycleConfig)) {
      // Un jour de repos ne coûte rien, mais il prolonge l'absence dès lors
      // qu'un congé a déjà été posé après lui.
      if (premierJourConge) premierJourConge = new Date(curseur);
      curseur.setDate(curseur.getDate() - 1);
      continue;
    }

    // D'abord les compteurs en jours, dans l'ordre de priorité.
    const typeJour = COMPTEURS_RETRAITE.find((t) => (jours.get(t) ?? 0) >= 1);
    if (typeJour) {
      jours.set(typeJour, (jours.get(typeJour) ?? 0) - 1);
      noter(typeJour, 1);
    } else {
      // Puis les compteurs horaires, si le solde couvre la journée entière.
      const cout = getJourMinutes(curseur, cycleConfig) || HEURES_PAR_JOUR;
      const typeHeure = COMPTEURS_RETRAITE.find((t) => (minutes.get(t) ?? 0) >= cout);
      if (!typeHeure) break; // plus rien ne couvre une journée complète
      minutes.set(typeHeure, (minutes.get(typeHeure) ?? 0) - cout);
      noter(typeHeure, cout);
    }

    joursCouverts++;
    premierJourConge = new Date(curseur);
    curseur.setDate(curseur.getDate() - 1);
  }

  // `curseur` pointe sur le jour précédant l'absence : on recule jusqu'au
  // dernier jour réellement travaillé.
  let dernierJourTravaille: Date | null = null;
  if (joursCouverts > 0) {
    const recherche = new Date(curseur);
    for (let i = 0; i < 400; i++) {
      if (isWorkingDay(recherche, cycleConfig)) {
        dernierJourTravaille = new Date(recherche);
        break;
      }
      recherche.setDate(recherche.getDate() - 1);
    }
  }

  const reliquatMinutes = Array.from(minutes.values()).reduce((s, v) => s + v, 0);
  const dureeCalendaire = premierJourConge
    ? Math.round((dateRetraite.getTime() - premierJourConge.getTime()) / 86_400_000) + 1
    : 0;

  return {
    dernierJourTravaille,
    premierJourConge,
    joursCouverts,
    dureeCalendaire,
    reliquatMinutes,
    couvreToutePeriode: curseur < limite,
    detail: Array.from(consomme.entries()).map(([type, e]) => ({
      type,
      quantite: e.quantite,
      unite: isDayBasedType(type) ? 'jours' : 'heures',
      joursCouverts: e.joursCouverts,
    })),
  };
}
