// Crédit d'heures des élus (CME) : dotation trimestrielle, non reportable
// (guide DNPAF ; « renouvelé chaque trimestre » selon des agents élus). L'agent
// saisit sa dotation ; l'utilisé est recalculé d'après ses absences CME du
// trimestre en cours : la remise à zéro au 1er janvier, avril, juillet et
// octobre est donc automatique.

import type { Counters, HistoryEntry } from './types';

export interface CreditCME {
  dotation: number; // minutes par trimestre
  utilise: number; // minutes utilisées ce trimestre
  reste: number;
  /** Dernier jour du trimestre en cours. */
  finTrimestre: Date;
}

export function trimestreDe(date: Date): { debut: Date; fin: Date } {
  const q = Math.floor(date.getMonth() / 3);
  return { debut: new Date(date.getFullYear(), q * 3, 1), fin: new Date(date.getFullYear(), q * 3 + 3, 0) };
}

export function creditCME(counters: Counters, history: HistoryEntry[], now: Date = new Date()): CreditCME | null {
  const dotation = counters.cmeTrimestre ?? 0;
  if (dotation <= 0) return null;
  const { debut, fin } = trimestreDe(now);
  const finJour = new Date(fin.getFullYear(), fin.getMonth(), fin.getDate(), 23, 59, 59);
  const utilise = history
    .filter((e) => e.action === 'absence' && e.motif === 'elu_cme')
    .filter((e) => {
      const d = new Date(e.date);
      return d >= debut && d <= finJour;
    })
    .reduce((s, e) => s + (e.minutes ?? 0), 0);
  return { dotation, utilise, reste: Math.max(0, dotation - utilise), finTrimestre: fin };
}
