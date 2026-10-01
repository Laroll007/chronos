// Journées modifiées : horaires réels (prise décalée, dépassement, travail sur
// un repos) et stages. Guide DNPAF « Gestion du temps de travail » :
//
// - Dépassement : compensé « temps pour temps » → HS = durée réelle − durée
//   prévue. Sur un repos (rappel), toute la durée part en HS.
// - Prise décalée : aucune compensation sur la durée habituelle, SAUF pour les
//   heures effectuées sur un RC (0,25) ou sur un RL / jour férié (0,60),
//   crédités en RPS ; coefficients non cumulables avec 0,1 (nuit) et 0,4
//   (dimanche) → on retient le plus fort, minute par minute.
// - Choix terrain (2026-10) : les heures en plus de nuit, et le travail sur un
//   repos, ouvrent aussi ces RPS (venue du pape : repos travaillé 12h30–02h00).
// - Stage sur un jour travaillé : remplace la vacation, journée habituelle,
//   aucun effet. Sur un repos : rappel pour la durée du stage (HS + RPS).
//
// Repos de cycle : à l'issue d'une période de travail, « un RC suivi d'un RL »
// (deux RC puis un RL pour trois jours) : le DERNIER jour de repos est le RL.

import type { CycleConfig, JourModifie } from './types';
import { isWorkingDay } from './calculations';
import { getRPSPourJour } from './rps';
import { fromDayKey, toDayKey } from './events';
import { HEURES_PAR_JOUR } from './constants';

const MIN_JOUR = 24 * 60;

// ─── Jours fériés (métropole) ────────────────────────────────────────────────

/** Dimanche de Pâques (algorithme de Meeus / Jones / Butcher). */
function paques(annee: number): Date {
  const a = annee % 19;
  const b = Math.floor(annee / 100);
  const c = annee % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mois = Math.floor((h + l - 7 * m + 114) / 31);
  const jour = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(annee, mois - 1, jour);
}

const cacheFeries = new Map<number, Set<string>>();

/** Les 11 jours fériés de métropole (hors Alsace-Moselle et outre-mer). */
export function joursFeries(annee: number): Set<string> {
  const cached = cacheFeries.get(annee);
  if (cached) return cached;
  const p = paques(annee);
  const decale = (n: number) => toDayKey(new Date(p.getFullYear(), p.getMonth(), p.getDate() + n));
  const fixes = ['01-01', '05-01', '05-08', '07-14', '08-15', '11-01', '11-11', '12-25'].map(
    (md) => `${annee}-${md}`
  );
  const set = new Set([...fixes, decale(1), decale(39), decale(50)]); // lundi de Pâques, Ascension, lundi de Pentecôte
  cacheFeries.set(annee, set);
  return set;
}

export function estFerie(date: Date): boolean {
  return joursFeries(date.getFullYear()).has(toDayKey(date));
}

// ─── Nature du jour ──────────────────────────────────────────────────────────

export type NatureJour = 'travail' | 'RC' | 'RL';

/** Travaillé, ou repos : RC, ou RL s'il clôt la période de repos. */
export function natureDuJour(date: Date, cfg: CycleConfig): NatureJour {
  if (isWorkingDay(date, cfg)) return 'travail';
  const lendemain = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
  return isWorkingDay(lendemain, cfg) ? 'RL' : 'RC';
}

// Coefficients en CENTIÈMES : additionner 0,25 ou 0,1 en virgule flottante
// fausse l'arrondi final (244,5 devenait 244,4999…).
/** Coefficient « repos » (centièmes) des heures faites hors vacation ce jour-là. */
function coefRepos(date: Date, cfg: CycleConfig): number {
  if (estFerie(date)) return 60;
  const nature = natureDuJour(date, cfg);
  return nature === 'RL' ? 60 : nature === 'RC' ? 25 : 0;
}

// ─── Calcul d'une journée réelle ─────────────────────────────────────────────

/**
 * Prise de service habituelle. Agent inscrit avant l'ajout des horaires : même
 * estimation que l'écran du cycle — 19h00 s'il était en « service de nuit »
 * (barème RPS en semaine), 07h00 sinon. Sans ça, les heures de nuit d'un agent
 * de nuit tombaient « hors vacation » et prenaient à tort le bonus RC/RL.
 */
export function heureDebutHabituelle(cfg: CycleConfig): number {
  return cfg.heureDebut ?? ((cfg.rpsParJour?.lundi ?? 0) > 0 ? 19 * 60 : 7 * 60);
}

/** Vacation prévue ce jour-là (null si repos). Minutes depuis minuit du jour. */
export function vacationPrevue(date: Date, cfg: CycleConfig): { debut: number; duree: number } | null {
  if (!isWorkingDay(date, cfg)) return null;
  return { debut: heureDebutHabituelle(cfg), duree: cfg.heuresParJour || HEURES_PAR_JOUR };
}

/** Durée d'une plage début → fin (fin ≤ début = le lendemain). */
export function dureePlage(debut: number, fin: number): number {
  return ((fin - debut + MIN_JOUR) % MIN_JOUR) || MIN_JOUR;
}

/** RPS des heures réellement travaillées, en centièmes de minute. */
function rpsReel(date: Date, debut: number, duree: number, cfg: CycleConfig): number {
  const prevue = vacationPrevue(date, cfg);
  const memoCoef = new Map<number, number>();
  let total = 0;
  for (let m = debut; m < debut + duree; m++) {
    const decalageJour = Math.floor(m / MIN_JOUR);
    const jour = new Date(date.getFullYear(), date.getMonth(), date.getDate() + decalageJour);
    const minuteDuJour = m % MIN_JOUR;
    let coef = jour.getDay() === 0 ? 40 : minuteDuJour >= 21 * 60 || minuteDuJour < 6 * 60 ? 10 : 0;
    const dansVacation = prevue !== null && m >= prevue.debut && m < prevue.debut + prevue.duree;
    if (!dansVacation) {
      if (!memoCoef.has(decalageJour)) memoCoef.set(decalageJour, coefRepos(jour, cfg));
      coef = Math.max(coef, memoCoef.get(decalageJour)!);
    }
    total += coef;
  }
  return total;
}

export interface EffetJournee {
  duree: number;
  dureePrevue: number;
  /** Minutes d'HS à créditer (dépassement, ou travail sur un repos). */
  hs: number;
  /** Minutes manquantes (fin anticipée) : à poser en congé. */
  manque: number;
  /** RPS des heures réelles. */
  rps: number;
  /** Écart avec le crédit RPS habituel du jour (déjà / bientôt crédité). */
  rpsDelta: number;
  nature: NatureJour;
  ferie: boolean;
}

/** Effet sur les compteurs de `type` effectué de `debut` à `fin` le jour `date`. */
export function effetJournee(
  date: Date,
  type: JourModifie['type'],
  debut: number | undefined,
  fin: number | undefined,
  cfg: CycleConfig
): EffetJournee {
  const nature = natureDuJour(date, cfg);
  const ferie = estFerie(date);
  const prevue = vacationPrevue(date, cfg);
  const dureePrevue = prevue?.duree ?? 0;

  // Stage sur un jour travaillé : il remplace la vacation, rien ne change.
  if (type === 'stage' && prevue) {
    return { duree: dureePrevue, dureePrevue, hs: 0, manque: 0, rps: 0, rpsDelta: 0, nature, ferie };
  }
  if (debut === undefined || fin === undefined) {
    return { duree: 0, dureePrevue, hs: 0, manque: 0, rps: 0, rpsDelta: 0, nature, ferie };
  }

  const duree = dureePlage(debut, fin);
  const rps = Math.round(rpsReel(date, debut, duree, cfg) / 100);
  const habituel = prevue ? getRPSPourJour(date, cfg) : 0;
  return {
    duree,
    dureePrevue,
    hs: Math.max(0, duree - dureePrevue),
    manque: Math.max(0, dureePrevue - duree),
    rps,
    rpsDelta: rps - habituel,
    nature,
    ferie,
  };
}

// ─── Lecture ─────────────────────────────────────────────────────────────────

export function jourModifieDu(date: Date, jours: JourModifie[] | undefined): JourModifie | undefined {
  if (!jours?.length) return undefined;
  const key = toDayKey(date);
  return jours.find((j) => j.date === key);
}

export function joursModifiesEntre(start: Date, end: Date, jours: JourModifie[] | undefined): JourModifie[] {
  if (!jours?.length) return [];
  const a = toDayKey(start);
  const b = toDayKey(end);
  return jours.filter((j) => j.date >= a && j.date <= b).sort((x, y) => x.date.localeCompare(y.date));
}

/** Écarte les entrées illisibles (stockage corrompu, import modifié à la main). */
export function sanitizeJoursModifies(raw: unknown): JourModifie[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((j): j is JourModifie => {
    if (!j || typeof j !== 'object') return false;
    const e = j as Record<string, unknown>;
    return (
      typeof e.id === 'string' &&
      typeof e.date === 'string' &&
      toDayKey(fromDayKey(e.date)) === e.date &&
      (e.type === 'horaires' || e.type === 'stage') &&
      typeof e.hsCredite === 'number' &&
      typeof e.rpsCredite === 'number'
    );
  });
}
