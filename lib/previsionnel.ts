// Congés posés sans décompte immédiat, et congés du plan prévisionnel.
//
// - Congés antérieurs : une période passée, déjà retirée du solde GesTT que
//   l'agent a saisi. Enregistrée pour le planning, jamais décomptée.
// - Prévisionnel de l'année prochaine : une période de l'année suivante, prise
//   sur les droits de cette année-là. Décomptée au 1er janvier (cf.
//   `appliquerDecomptesDifferes`, appelée par la bascule annuelle).
// - Congé prévisionnel (plan du service) : un simple statut, pour toute date ;
//   il ne change pas le décompte, il se voit sur le planning (hachuré, 🔒).

import type { Counters, CounterType, HistoryEntry, UserData } from './types';
import { appliquerDecomptesDifferes, compteursNouvelleAnnee } from './storage';

const jour = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** Toute la période est avant aujourd'hui. */
export function periodeAnterieure(debut: Date, fin: Date, aujourdhui: Date = new Date()): boolean {
  return jour(fin) < jour(aujourdhui);
}

/** Toute la période tombe l'année suivante. */
export function periodeAnneeSuivante(debut: Date, fin: Date, aujourdhui: Date = new Date()): boolean {
  const suivante = aujourdhui.getFullYear() + 1;
  return debut.getFullYear() === suivante && fin.getFullYear() === suivante;
}

/**
 * La période est à cheval sur aujourd'hui ou sur le 1er janvier : la case ne
 * s'appliquerait qu'à une partie des jours, on invite à poser en deux fois.
 */
export function periodeACheval(debut: Date, fin: Date, aujourdhui: Date = new Date()): boolean {
  const avant = jour(debut) < jour(aujourdhui) && jour(fin) >= jour(aujourdhui);
  const suivante = aujourdhui.getFullYear() + 1;
  const annee = debut.getFullYear() < suivante && fin.getFullYear() === suivante;
  return avant || annee;
}

/**
 * Droits de l'année suivante, déjà diminués des congés posés pour elle :
 * c'est sur eux que se calculent les options d'une pose « prévisionnel de
 * l'année prochaine ». Les CA restants deviennent des CA reportés.
 */
export function compteursAnneeSuivante(data: Pick<UserData, 'counters' | 'cycleConfig' | 'history'>, aujourdhui: Date = new Date()): Counters {
  const base = compteursNouvelleAnnee(data.counters, data.cycleConfig);
  return appliquerDecomptesDifferes(base, data.history, data.cycleConfig, aujourdhui.getFullYear() + 1, false).counters;
}

/**
 * Pour des congés antérieurs (non décomptés), les options se calculent sur la
 * dotation de l'année : le solde actuel les a déjà retirés.
 */
export function compteursDotation(data: Pick<UserData, 'counters' | 'cycleConfig'>): Counters {
  return compteursNouvelleAnnee(data.counters, data.cycleConfig);
}

/**
 * Le premier mois après l'inscription, des congés d'avant l'inscription sont
 * presque toujours déjà retirés du solde saisi : la case est cochée d'office.
 */
export function anterieurParDefaut(dateInscription: string | undefined, fin: Date, aujourdhui: Date = new Date()): boolean {
  if (!dateInscription) return false;
  const [a, m, j] = dateInscription.split('-').map(Number);
  const inscription = new Date(a!, m! - 1, j!).getTime();
  return jour(fin) < inscription && jour(aujourdhui) - inscription <= 31 * 86_400_000;
}

/** Le jour porte un congé du plan prévisionnel. */
export function estPrevisionnelLe(date: Date, history: HistoryEntry[]): boolean {
  const t = jour(date);
  return history.some(
    (e) =>
      e.previsionnel &&
      e.action === 'pose' &&
      t >= jour(new Date(e.date)) &&
      t <= jour(new Date(e.dateEnd ?? e.date))
  );
}

/** Congés posés pour l'année suivante, pas encore décomptés, par compteur. */
export function posesDifferees(history: HistoryEntry[], annee: number): Partial<Record<CounterType, number>> {
  const out: Partial<Record<CounterType, number>> = {};
  for (const e of history) {
    if (e.action !== 'pose' || e.decompte !== 'differe' || e.anneeDecompte !== annee || e.decompteApplique) continue;
    out[e.type] = (out[e.type] ?? 0) + e.amount;
  }
  return out;
}
