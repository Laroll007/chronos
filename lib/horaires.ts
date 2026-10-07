// Horaires qui changent au fil des cycles (ex. 2 cycles de soirée 10h30-22h38,
// puis 1 cycle de matinée 06h30-18h38). Sans rotation, les horaires du cycle
// (heureDebut + heuresParJour) valent pour tous les jours.
//
// Module autonome (pas d'import du moteur de cycle) : `calculations`, `rps` et
// `journees` s'en servent tous.

import type { CycleConfig, JeuHoraires, RotationHoraires } from './types';
import { HEURES_PAR_JOUR } from './constants';

const JOUR_MS = 86_400_000;

function jourUTC(iso: string): number {
  const [a, m, j] = iso.split('-').map(Number);
  return Date.UTC(a, m - 1, j);
}

/** Rotation exploitable (au moins deux jeux, une séquence cohérente). */
export function rotationValide(r: RotationHoraires | undefined): r is RotationHoraires {
  return Boolean(
    r &&
      r.jeux.length >= 2 &&
      r.sequence.length >= 2 &&
      r.periodeJours > 0 &&
      r.sequence.every((i) => Number.isInteger(i) && i >= 0 && i < r.jeux.length)
  );
}

/**
 * Rang de la date dans la séquence de la rotation (0 = premier cycle de la
 * séquence). Fonctionne aussi avant la date de référence.
 */
export function rangDansRotation(date: Date, r: RotationHoraires): number {
  const jours = Math.round((Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - jourUTC(r.dateReference)) / JOUR_MS);
  const periode = Math.floor(jours / r.periodeJours);
  const n = r.sequence.length;
  return ((periode % n) + n) % n;
}

export interface HorairesJour {
  heureDebut: number | undefined;
  duree: number;
  /** Nom du jeu d'horaires (rotation uniquement). */
  nom?: string;
}

/** Horaires prévus ce jour-là, selon la rotation s'il y en a une. */
export function horairesDuJour(date: Date, cfg: CycleConfig): HorairesJour {
  const r = cfg.type === 'alterne' ? cfg.horairesRotation : undefined;
  if (rotationValide(r)) {
    const jeu: JeuHoraires = r.jeux[r.sequence[rangDansRotation(date, r)]];
    return { heureDebut: jeu.heureDebut, duree: jeu.duree, nom: jeu.nom };
  }
  return { heureDebut: cfg.heureDebut, duree: cfg.heuresParJour || HEURES_PAR_JOUR };
}
