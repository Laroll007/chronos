// Crédit automatique des RPS (récupération dimanche).
//
// L'APORTT accorde 4h51 par dimanche travaillé (12h08 × 0,4). L'app connaît le
// cycle, elle sait donc quels dimanches sont travaillés — mais elle ne créditait
// rien : `updateRPS` existait sans jamais être appelé.
//
// Le crédit est INCRÉMENTAL, jamais recalculé depuis le 1er janvier. Un recalcul
// écraserait le solde et rendrait des RPS déjà consommés, en plus d'effacer le
// stock déclaré à l'inscription par un agent arrivé en cours d'année.

import { Counters, CycleConfig, HistoryEntry } from './types';
import { RPS_PAR_DIMANCHE } from './constants';
import { isWorkingDay, hasPostedLeaveOnDate, hasCMOOnDate } from './calculations';

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
 * Ce dimanche a-t-il été réellement travaillé ?
 *
 * Il ne suffit pas qu'il soit au planning : un dimanche couvert par un congé ou
 * un arrêt maladie n'a pas été travaillé et ne génère aucun RPS. Une pose à
 * l'heure (départ anticipé) laisse en revanche la journée travaillée.
 *
 * Les astreintes posées sur un dimanche de repos ne comptent pas ici : elles
 * restent en saisie manuelle, comme le reste de leur compensation.
 */
export function isSundayActuallyWorked(
  date: Date,
  cycleConfig: CycleConfig,
  history: HistoryEntry[]
): boolean {
  if (date.getDay() !== 0) return false;
  if (!isWorkingDay(date, cycleConfig)) return false;
  if (hasPostedLeaveOnDate(date, history)) return false;
  if (hasCMOOnDate(date, history)) return false;
  return true;
}

export interface RPSCredit {
  /** Minutes à ajouter au solde. */
  minutes: number;
  /** Nombre de dimanches concernés. */
  sundays: number;
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
    return { minutes: 0, sundays: 0, marker: toISODay(fin) };
  }

  // Repère dans le futur (horloge décalée, import d'une sauvegarde plus récente) :
  // on ne crédite rien et on ne recule pas le repère.
  if (marker >= fin) {
    return { minutes: 0, sundays: 0, marker: counters.rpsDernierCredit! };
  }

  let sundays = 0;
  const cursor = new Date(marker);
  cursor.setDate(cursor.getDate() + 1); // strictement après le repère
  while (cursor <= fin) {
    if (isSundayActuallyWorked(cursor, cycleConfig, history)) sundays++;
    cursor.setDate(cursor.getDate() + 1);
  }

  return {
    minutes: sundays * RPS_PAR_DIMANCHE,
    sundays,
    marker: toISODay(fin),
  };
}
