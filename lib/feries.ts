// Jours fériés de métropole. Module autonome (sans dépendance au moteur de
// cycle) : `isWorkingDay` s'en sert pour le régime hebdomadaire, où un jour
// férié n'est pas travaillé.

import { toDayKey } from './events';


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

