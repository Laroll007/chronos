// Changement de cycle en cours d'année (mutation, changement de service).
//
// L'agent indique le dernier jour de son ancien cycle et le premier jour du
// nouveau. L'app :
//  - garde l'ancien cycle pour les jours d'avant (planning, RC/RL, horaires,
//    RPS : cf. lib/cycleDuJour.ts) ;
//  - recalcule les droits de l'année au prorata du temps passé dans chaque
//    cycle (guide DNPAF : « année incomplète », au prorata de la durée
//    accomplie), avec l'arrondi APORTT à la demi-journée ; les jours entre deux
//    cycles comptent avec le nouveau ;
//  - recrédite les RPS des jours déjà crédités avec l'ancien barème depuis le
//    changement.
// Dotations : CA selon le cycle (25 en hebdomadaire) ; RTC (selon le cycle)
// et CF seulement en régime cyclique ; ARTT et RTT seulement en hebdomadaire.
// Un passage cycle → hebdomadaire garde donc le prorata de RTC et de CF acquis
// en cycle (le guide le prévoit pour le reliquat de CF), et inversement. GesTT
// fait foi : l'agent peut corriger chaque montant avant de valider.

import type { CompteurDote, Counters, CycleConfig, CycleSimple, DroitsAnnee, HistoryEntry } from './types';
import { ARTT_QUOTA_ANNUEL, RTT_QUOTA_HEBDO } from './constants';
import { cfAnnuel } from './zones';
import { arrondirDotation, getCATotalForCycle, getRTCAnnuel, reserveRTCConseillee } from './calculations';
import { getRPSPourJour, isJourOuvrantRPS } from './rps';
import { cleJour, cycleSimple } from './cycleDuJour';

export const COMPTEURS_DOTES: CompteurDote[] = ['ca', 'cf', 'rtc', 'artt', 'rtt'];
/** Compteurs en minutes (les autres en jours). */
export const EN_MINUTES: ReadonlySet<CompteurDote> = new Set(['cf', 'rtc']);

const JOUR_MS = 86_400_000;
const versDate = (cle: string) => {
  const [a, m, j] = cle.split('-').map(Number);
  return new Date(a, m - 1, j);
};
const lendemain = (cle: string) => {
  const d = versDate(cle);
  d.setDate(d.getDate() + 1);
  return cleJour(d);
};
/** Jours de `a` à `b` inclus (0 si b < a). */
const nbJours = (a: string, b: string) =>
  b < a ? 0 : Math.round((versDate(b).getTime() - versDate(a).getTime()) / JOUR_MS) + 1;

/** Le compteur est-il doté pour cet agent ? (mêmes règles que la bascule annuelle) */
export function compteurActif(c: Counters, k: CompteurDote): boolean {
  if (k === 'ca') return true;
  if (k === 'cf') return c.hasCF !== false;
  if (k === 'rtc') return c.hasRTC !== false;
  if (k === 'artt') return !!c.hasARTT;
  return !!c.hasRTT;
}

/** Dotation annuelle complète d'un cycle, dans l'unité du compteur. */
export function quotaCycle(cfg: CycleSimple, c: Counters, k: CompteurDote): number {
  if (!compteurActif(c, k)) return 0;
  const hebdo = cfg.type === 'hebdo';
  switch (k) {
    case 'ca': return getCATotalForCycle(cfg);
    case 'cf': return hebdo ? 0 : cfAnnuel(cfg.zone);
    case 'rtc': return hebdo ? 0 : getRTCAnnuel(cfg);
    case 'artt': return hebdo ? ARTT_QUOTA_ANNUEL : 0;
    case 'rtt': return hebdo ? RTT_QUOTA_HEBDO : 0;
  }
}

/**
 * Droits de l'année `annee` au prorata des cycles successifs de `cfg` (au jour
 * près ; un jour entre deux cycles compte avec le suivant).
 */
export function droitsProrata(cfg: CycleConfig, c: Counters, annee: number): Record<CompteurDote, number> {
  const debutAnnee = `${annee}-01-01`;
  const finAnnee = `${annee}-12-31`;
  const total = nbJours(debutAnnee, finAnnee);
  // Segments contigus : chaque ancien cycle jusqu'à sa fin, le cycle actuel ensuite.
  const segments: { config: CycleSimple; du: string; au: string }[] = [];
  let debut = debutAnnee;
  for (const ancien of cfg.cyclesAnterieurs ?? []) {
    const au = ancien.fin < finAnnee ? ancien.fin : finAnnee;
    if (au >= debut) segments.push({ config: ancien.config, du: debut, au });
    const suivant = lendemain(ancien.fin);
    if (suivant > debut) debut = suivant;
  }
  if (debut <= finAnnee) segments.push({ config: cycleSimple(cfg), du: debut, au: finAnnee });

  const droits = {} as Record<CompteurDote, number>;
  for (const k of COMPTEURS_DOTES) {
    const brut = segments.reduce((s, seg) => s + (quotaCycle(seg.config, c, k) * nbJours(seg.du, seg.au)) / total, 0);
    droits[k] = EN_MINUTES.has(k) ? Math.round(brut) : arrondirDotation(brut);
  }
  return droits;
}

/** Droits de l'année en vigueur pour le cycle actuel (prorata enregistré, sinon quota du cycle). */
export function droitsAnnee(cfg: CycleConfig, c: Counters, k: CompteurDote, annee = new Date().getFullYear()): number {
  const d = cfg.droitsAnnee;
  if (d && d.annee === annee && d[k] !== undefined) return d[k]!;
  // Sans changement de cycle cette année : quota habituel (comme la bascule annuelle).
  switch (k) {
    case 'ca': return getCATotalForCycle(cfg);
    case 'cf': return cfAnnuel(cfg.zone);
    case 'rtc': return getRTCAnnuel(cfg);
    case 'artt': return ARTT_QUOTA_ANNUEL;
    case 'rtt': return RTT_QUOTA_HEBDO;
  }
}

// ─── Aperçu et enregistrement ───────────────────────────────────────────────

export interface ParamsChangement {
  /** Dernier jour de l'ancien cycle ('YYYY-MM-DD'). */
  dernierJour: string;
  /** Premier jour du nouveau cycle ('YYYY-MM-DD'). */
  premierJour: string;
  /** Nouveau cycle (tel que saisi dans « Modifier mon cycle »). */
  nouveau: CycleSimple;
  /** Droits de l'année corrigés par l'agent (sinon : prorata calculé). */
  droitsCorriges?: Partial<Record<CompteurDote, number>>;
}

export interface LigneDroits {
  compteur: CompteurDote;
  /** Droits de l'année avant le changement. */
  avant: number;
  /** Droits de l'année au prorata, après le changement. */
  apres: number;
  /** Solde actuel. */
  solde: number;
}

export interface ApercuChangement {
  config: CycleConfig;
  annee: number;
  lignes: LigneDroits[];
  /** Écart de RPS sur les jours déjà crédités depuis le changement (minutes). */
  rpsEcart: number;
  erreur?: string;
}

/** Vérifie les dates ; renvoie un message d'erreur ou null. */
export function erreurDates(ancien: CycleConfig, dernierJour: string, premierJour: string): string | null {
  const re = /^\d{4}-\d{2}-\d{2}$/;
  if (!re.test(dernierJour) || !re.test(premierJour)) return 'Indiquez les deux dates.';
  if (premierJour <= dernierJour) return 'Le premier jour du nouveau cycle doit suivre le dernier jour de l’ancien.';
  if (nbJours(dernierJour, premierJour) > 92) return 'Plus de trois mois entre les deux cycles : vérifiez les dates.';
  if (ancien.appliqueDepuis && dernierJour < ancien.appliqueDepuis)
    return 'Le dernier jour de l’ancien cycle est antérieur à votre précédent changement de cycle.';
  return null;
}

const creditRPS = (d: Date, cfg: CycleConfig, history: HistoryEntry[]) =>
  isJourOuvrantRPS(d, cfg, history) ? getRPSPourJour(d, cfg) : 0;

/** Nouveau cycle avec son historique, droits au prorata et écart de RPS. */
export function apercuChangement(
  ancien: CycleConfig,
  counters: Counters,
  history: HistoryEntry[],
  p: ParamsChangement,
  aujourdhui: Date = new Date()
): ApercuChangement {
  const annee = aujourdhui.getFullYear();
  const erreur = erreurDates(ancien, p.dernierJour, p.premierJour) ?? undefined;

  // Droits de l'année avant le changement, avec les mêmes dotations par régime
  // que le prorata : seuls les compteurs dont la dotation change bougent.
  const dejaProratise = ancien.droitsAnnee?.annee === annee ? ancien.droitsAnnee : undefined;
  const avant = Object.fromEntries(
    COMPTEURS_DOTES.map((k) => [k, dejaProratise?.[k] ?? quotaCycle(cycleSimple(ancien), counters, k)])
  ) as Record<CompteurDote, number>;
  const provisoire: CycleConfig = {
    ...p.nouveau,
    // Le lieu d'affectation se règle à part : un nouveau cycle le garde.
    ...((p.nouveau.zone ?? ancien.zone) && { zone: p.nouveau.zone ?? ancien.zone }),
    appliqueDepuis: p.premierJour,
    cyclesAnterieurs: [
      ...(ancien.cyclesAnterieurs ?? []),
      { ...(ancien.appliqueDepuis && { debut: ancien.appliqueDepuis }), fin: p.dernierJour, config: cycleSimple(ancien), ...(ancien.droitsAnnee && { droitsAvant: ancien.droitsAnnee }) },
    ],
  };
  const prorata = droitsProrata(provisoire, counters, annee);
  const apres = { ...prorata, ...p.droitsCorriges };

  const lignes: LigneDroits[] = COMPTEURS_DOTES.filter((k) => compteurActif(counters, k) && (k === 'ca' || avant[k] > 0 || apres[k] > 0)).map((k) => ({
    compteur: k,
    avant: avant[k],
    apres: apres[k],
    solde: (counters[k] as number | undefined) ?? 0,
  }));

  // RPS déjà crédités (jusqu'au repère) depuis le lendemain de l'ancien cycle.
  let rpsEcart = 0;
  const repere = counters.rpsDernierCredit;
  if (!erreur && repere) {
    const d = versDate(lendemain(p.dernierJour));
    const fin = versDate(repere);
    while (d <= fin) {
      rpsEcart += creditRPS(d, provisoire, history) - creditRPS(d, ancien, history);
      d.setDate(d.getDate() + 1);
    }
  }

  const droitsEnregistres: DroitsAnnee = { annee, ...apres };
  return { config: { ...provisoire, droitsAnnee: droitsEnregistres }, annee, lignes, rpsEcart, ...(erreur && { erreur }) };
}

/**
 * Applique le changement : nouveau cycle, soldes ajustés de l'écart de droits
 * (jamais en dessous de 0), RPS recrédités. Les écarts réellement appliqués
 * sont mémorisés pour pouvoir annuler à l'identique.
 */
export function appliquerChangement(
  ancien: CycleConfig,
  counters: Counters,
  history: HistoryEntry[],
  p: ParamsChangement,
  aujourdhui: Date = new Date()
): { config: CycleConfig; counters: Counters } | { erreur: string } {
  const a = apercuChangement(ancien, counters, history, p, aujourdhui);
  if (a.erreur) return { erreur: a.erreur };
  const n: Counters = { ...counters };
  const ajustements: Partial<Record<CompteurDote | 'rps', number>> = {};
  for (const l of a.lignes) {
    const avantSolde = (n[l.compteur] as number | undefined) ?? 0;
    const nouveauSolde = Math.max(0, avantSolde + (l.apres - l.avant));
    (n[l.compteur] as number) = nouveauSolde;
    if (nouveauSolde !== avantSolde) ajustements[l.compteur] = nouveauSolde - avantSolde;
  }
  if (a.rpsEcart !== 0) {
    const rps = Math.max(0, n.rps + a.rpsEcart);
    ajustements.rps = rps - n.rps;
    n.rps = rps;
  }
  n.rtcReservesCET = reserveRTCConseillee(a.config);
  const anterieurs = [...(a.config.cyclesAnterieurs ?? [])];
  anterieurs[anterieurs.length - 1] = { ...anterieurs[anterieurs.length - 1]!, ajustements };
  return { config: { ...a.config, cyclesAnterieurs: anterieurs }, counters: n };
}

/** Le dernier changement de cycle peut-il être annulé ? (même année, droits encore en vigueur) */
export function changementAnnulable(cfg: CycleConfig, aujourdhui: Date = new Date()): boolean {
  return !!cfg.cyclesAnterieurs?.length && cfg.droitsAnnee?.annee === aujourdhui.getFullYear();
}

/** Annule le dernier changement : ancien cycle rétabli, écarts retirés. */
export function annulerChangement(cfg: CycleConfig, counters: Counters): { config: CycleConfig; counters: Counters } | null {
  const anterieurs = [...(cfg.cyclesAnterieurs ?? [])];
  const dernier = anterieurs.pop();
  if (!dernier) return null;
  const n: Counters = { ...counters };
  for (const [k, ecart] of Object.entries(dernier.ajustements ?? {}) as [CompteurDote | 'rps', number][]) {
    (n[k] as number) = Math.max(0, ((n[k] as number | undefined) ?? 0) - ecart);
  }
  const config: CycleConfig = {
    ...dernier.config,
    ...(dernier.debut && { appliqueDepuis: dernier.debut }),
    ...(anterieurs.length > 0 && { cyclesAnterieurs: anterieurs }),
    ...(dernier.droitsAvant && { droitsAnnee: dernier.droitsAvant }),
  };
  n.rtcReservesCET = reserveRTCConseillee(config);
  return { config, counters: n };
}
