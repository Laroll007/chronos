// Répartition d'une pose sur plusieurs compteurs, en heures.
//
// Le « Choix libre » raisonnait en journées entières : un solde horaire
// inférieur à une journée (7h de RTC) n'était pas proposé, et une nuit ne
// pouvait pas être posée moitié RTC, moitié RPS. Ici, les compteurs horaires
// se saisissent en minutes et sont placés à la minute près sur les jours
// travaillés de la période ; deux compteurs peuvent donc se partager un jour.

import type { CounterType } from './types';
import { isDayBasedType } from './optimization';

export interface LigneRepartition {
  type: CounterType;
  /** Jours pour un compteur en jours (CA…), minutes pour un compteur horaire. */
  amount: number;
}

export interface TrancheRepartition extends LigneRepartition {
  /** Indices (dans les jours travaillés de la période) du premier et du dernier jour touchés. */
  debut: number;
  fin: number;
}

export type ResultatRepartition =
  | { ok: true; tranches: TrancheRepartition[] }
  /** `ecart` en minutes : > 0 il manque des heures, < 0 il y en a trop. */
  | { ok: false; ecart: number; raison: 'incomplet' | 'excedent' | 'jours' };

/**
 * Place les lignes sur les jours travaillés (`durees` = minutes de chaque jour,
 * dans l'ordre). Les compteurs en jours prennent des journées entières, en
 * premier ; les compteurs horaires remplissent ensuite le reste, dans l'ordre
 * saisi. La couverture doit être exacte : ni heure manquante, ni heure en trop.
 */
export function repartirSurJours(lignes: LigneRepartition[], durees: number[]): ResultatRepartition {
  const total = durees.reduce((s, d) => s + d, 0);
  const enJours = lignes.filter((l) => isDayBasedType(l.type) && l.amount > 0);
  const enHeures = lignes.filter((l) => !isDayBasedType(l.type) && l.amount > 0);

  const tranches: TrancheRepartition[] = [];
  let jour = 0;
  for (const l of enJours) {
    if (jour + l.amount > durees.length) {
      return { ok: false, ecart: 0, raison: 'jours' };
    }
    tranches.push({ ...l, debut: jour, fin: jour + l.amount - 1 });
    jour += l.amount;
  }

  // Minutes déjà couvertes par les journées entières.
  let position = durees.slice(0, jour).reduce((s, d) => s + d, 0);
  const couvertes = position + enHeures.reduce((s, l) => s + l.amount, 0);
  if (couvertes !== total) {
    return { ok: false, ecart: total - couvertes, raison: couvertes < total ? 'incomplet' : 'excedent' };
  }

  // Jour contenant la minute `m` (0 = première minute de la période).
  const jourDe = (m: number) => {
    let cumul = 0;
    for (let i = 0; i < durees.length; i++) {
      cumul += durees[i];
      if (m < cumul) return i;
    }
    return durees.length - 1;
  };
  for (const l of enHeures) {
    tranches.push({ ...l, debut: jourDe(position), fin: jourDe(position + l.amount - 1) });
    position += l.amount;
  }

  return { ok: true, tranches };
}
