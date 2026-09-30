// Nouveautés présentées une fois, à la première ouverture après une mise à jour.
//
// N'y inscrire que les versions qui changent vraiment l'usage : une fenêtre à
// chaque correctif finirait par être fermée sans être lue.

import { APP_VERSION } from './constants';

export type ReleaseAction = 'cycle' | 'cet';

export interface ReleaseItem {
  emoji: string;
  title: string;
  text: string;
  /** Raccourci vers l'écran concerné. */
  action?: { label: string; target: ReleaseAction };
}

export interface ReleaseNote {
  version: string; // semver, comparé à APP_VERSION
  items: ReleaseItem[];
}

export const RELEASE_NOTES: ReleaseNote[] = [
  {
    version: '1.12.0',
    items: [
      {
        emoji: '⏱️',
        title: 'RPS crédités au bon taux',
        text: 'Indiquez vos horaires de prise et de fin de service : vos RPS de nuit (21h–6h) et du dimanche sont crédités automatiquement après chaque vacation, comme dans GesTT. Jour, nuit ou horaires mixtes.',
        action: { label: 'Renseigner mes horaires', target: 'cycle' },
      },
      {
        emoji: '📌',
        title: 'Vos événements sur le planning',
        text: 'RDV, formation, audience… Sélectionnez un jour ou utilisez « Mes événements » sous le calendrier. Sans effet sur vos compteurs.',
      },
      {
        emoji: '💰',
        title: 'Mon épargne CET',
        text: 'Combien vous pouvez verser au CET et quels congés choisir. Dans Compteurs → « Combien puis-je verser au CET ? ».',
        action: { label: 'Voir mon épargne CET', target: 'cet' },
      },
    ],
  },
];

const SEEN_KEY = 'chronos_release_seen';

/** Comparaison semver simple : -1, 0 ou 1. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d < 0 ? -1 : 1;
  }
  return 0;
}

function readSeen(): string | null {
  try {
    return localStorage.getItem(SEEN_KEY);
  } catch {
    return null;
  }
}

/**
 * Notes à présenter : celles postérieures à la dernière vue, jusqu'à la version
 * installée (une note écrite pour la 1.13 n'apparaît pas dans une 1.12).
 */
export function pendingReleaseNotes(
  seen: string | null = readSeen(),
  current: string = APP_VERSION
): ReleaseNote[] {
  return RELEASE_NOTES.filter(
    (n) => compareVersions(n.version, current) <= 0 && (!seen || compareVersions(n.version, seen) > 0)
  ).sort((a, b) => compareVersions(b.version, a.version));
}

/** Marque tout ce qui est publié comme vu (nouvel inscrit, ou fenêtre fermée). */
export function markReleaseNotesSeen(current: string = APP_VERSION): void {
  try {
    localStorage.setItem(SEEN_KEY, current);
  } catch {
    /* la fenêtre réapparaîtra, sans gravité */
  }
}
