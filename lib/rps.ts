// Crédit automatique des RPS (récupération dimanche).
//
// L'APORTT définit des coefficients non cumulables appliqués aux heures
// travaillées : 0,4 le dimanche, 0,1 pour le travail de nuit (créneau 21h–6h).
// Un agent de nuit récupère donc à CHAQUE vacation, pas seulement le dimanche —
// d'où un barème paramétrable par jour de semaine (`cycleConfig.rpsParJour`)
// plutôt que la règle « dimanche uniquement » codée en dur à l'origine.
//
// Le crédit est INCRÉMENTAL, jamais recalculé depuis le 1er janvier. Un recalcul
// écraserait le solde et rendrait des RPS déjà consommés, en plus d'effacer le
// stock déclaré à l'inscription par un agent arrivé en cours d'année.

import { Counters, CycleConfig, HistoryEntry, WeekHours } from './types';
import { RPS_PAR_DIMANCHE, HEURES_PAR_JOUR } from './constants';
import { isWorkingDay, hasPostedLeaveOnDate, hasCMOOnDate } from './calculations';

const JOURS: (keyof WeekHours)[] = [
  'dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi',
];

/** Barème par défaut : seuls les dimanches, 4h51 (12h08 × 0,4). */
export function baremeRPSParDefaut(): WeekHours {
  return {
    lundi: 0, mardi: 0, mercredi: 0, jeudi: 0, vendredi: 0, samedi: 0,
    dimanche: RPS_PAR_DIMANCHE,
  };
}

/**
 * Barème « agent de nuit » : coefficient 0,1 sur chaque vacation (créneau 21h–6h)
 * et 0,4 le dimanche. Les coefficients n'étant PAS cumulables, le dimanche garde
 * le seul 0,4 au lieu d'additionner les deux.
 */
export function baremeRPSNuit(jourMinutes: number = HEURES_PAR_JOUR): WeekHours {
  const nuit = Math.round(jourMinutes * 0.1);
  return {
    lundi: nuit, mardi: nuit, mercredi: nuit, jeudi: nuit, vendredi: nuit, samedi: nuit,
    dimanche: Math.round(jourMinutes * 0.4),
  };
}

/** Minutes de RPS créditées pour un jour travaillé donné. */
export function getRPSPourJour(date: Date, cycleConfig: CycleConfig): number {
  const bareme = cycleConfig.rpsParJour;
  if (!bareme) {
    // Comportement historique : seuls les dimanches.
    return date.getDay() === 0 ? RPS_PAR_DIMANCHE : 0;
  }
  return Math.max(0, bareme[JOURS[date.getDay()]] ?? 0);
}

/** 'YYYY-MM-DD' en heure locale (pas d'UTC : évite un décalage d'un jour). */
export function toISODay(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`;
}

function fromISODay(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Ce jour a-t-il été réellement travaillé ?
 *
 * Il ne suffit pas qu'il soit au planning : un jour couvert par un congé ou un
 * arrêt maladie n'a pas été travaillé et ne génère aucun RPS. Une pose à l'heure
 * (départ anticipé) laisse en revanche la journée travaillée.
 *
 * Les astreintes posées sur un dimanche de repos ne comptent pas ici : elles
 * restent en saisie manuelle, comme le reste de leur compensation.
 */
export function isJourOuvrantRPS(
  date: Date,
  cycleConfig: CycleConfig,
  history: HistoryEntry[]
): boolean {
  if (!isWorkingDay(date, cycleConfig)) return false;
  if (hasPostedLeaveOnDate(date, history)) return false;
  if (hasCMOOnDate(date, history)) return false;
  return true;
}

export interface RPSCredit {
  /** Minutes à ajouter au solde. */
  minutes: number;
  /** Nombre de jours ouvrant droit à des RPS sur la période. */
  jours: number;
  /** Nouveau repère à mémoriser ('YYYY-MM-DD'). */
  marker: string;
}

/**
 * Calcule les RPS à créditer depuis le dernier repère, sans jamais recompter.
 *
 * Retourne toujours un repère à mémoriser — même sans dimanche à créditer, pour
 * que le prochain calcul reparte de la bonne date. `minutes` vaut 0 quand il n'y
 * a rien à ajouter.
 */
export function computeRPSCredit(
  counters: Counters,
  cycleConfig: CycleConfig,
  history: HistoryEntry[],
  today: Date = new Date()
): RPSCredit {
  const marker = counters.rpsDernierCredit ? fromISODay(counters.rpsDernierCredit) : null;
  const fin = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  // Premier passage (ou repère illisible) : on pose le repère sans rien créditer.
  // Créditer rétroactivement inventerait des dimanches que l'agent a peut-être
  // déjà comptés dans le solde qu'il a saisi.
  if (!marker) {
    return { minutes: 0, jours: 0, marker: toISODay(fin) };
  }

  // Repère dans le futur (horloge décalée, import d'une sauvegarde plus récente) :
  // on ne crédite rien et on ne recule pas le repère.
  if (marker >= fin) {
    return { minutes: 0, jours: 0, marker: counters.rpsDernierCredit! };
  }

  let jours = 0;
  let minutes = 0;
  const cursor = new Date(marker);
  cursor.setDate(cursor.getDate() + 1); // strictement après le repère
  while (cursor <= fin) {
    if (isJourOuvrantRPS(cursor, cycleConfig, history)) {
      const credit = getRPSPourJour(cursor, cycleConfig);
      if (credit > 0) {
        jours++;
        minutes += credit;
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return { minutes, jours, marker: toISODay(fin) };
}
