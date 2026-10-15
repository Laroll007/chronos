// Changement de cycle en cours de route (mutation, changement de service) :
// quel cycle s'appliquait tel jour ?
//
// Le cycle actuel vaut à partir de `appliqueDepuis` ; avant, ce sont les
// `cyclesAnterieurs`, chacun de son `debut` à sa `fin` (inclus). Entre la fin
// d'un cycle et le début du suivant (jours de mutation), aucun cycle : ces
// jours ne sont pas travaillés.
//
// Toutes les fonctions qui raisonnent « par jour » (jour travaillé, horaires,
// RPS, semaine A/B…) passent par ici : le reste de l'app n'a pas à connaître
// l'historique. Module sans dépendance, importable partout.

import type { CycleConfig, CycleSimple } from './types';

/** 'YYYY-MM-DD' en heure locale. */
export function cleJour(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** Le cycle sans son historique. */
export function cycleSimple(cfg: CycleConfig): CycleSimple {
  const { appliqueDepuis: _a, cyclesAnterieurs: _c, droitsAnnee: _d, ...simple } = cfg;
  return simple;
}

/**
 * Cycle applicable le jour `date` (sans historique), ou null entre deux cycles.
 * Sans changement de cycle, renvoie `cfg` tel quel (aucun coût).
 */
export function cycleDuJour(date: Date, cfg: CycleConfig): CycleConfig | null {
  if (!cfg.appliqueDepuis) return cfg;
  const jour = cleJour(date);
  if (jour >= cfg.appliqueDepuis) return cfg;
  for (const ancien of cfg.cyclesAnterieurs ?? []) {
    if ((!ancien.debut || jour >= ancien.debut) && jour <= ancien.fin) return ancien.config;
  }
  return null;
}
