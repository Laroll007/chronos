// Nouveautés présentées une fois, à la première ouverture après une mise à jour.
//
// N'y inscrire que les versions qui changent vraiment l'usage : une fenêtre à
// chaque correctif finirait par être fermée sans être lue.

import { APP_VERSION } from './constants';

export type ReleaseAction = 'cycle' | 'cet' | 'communaute';

export interface ReleaseItem {
  emoji: string;
  /** Logo à la place de l'émoji (marque reconnaissable, ex. Discord). */
  logo?: 'discord';
  title: string;
  text: string;
  /** Mise en garde affichée en petit sous le texte. */
  note?: string;
  /** Raccourci vers l'écran concerné. */
  action?: { label: string; target: ReleaseAction };
}

export interface ReleaseNote {
  version: string; // semver, comparé à APP_VERSION
  items: ReleaseItem[];
}

export const RELEASE_NOTES: ReleaseNote[] = [
  {
    version: '1.16.0',
    items: [
      {
        emoji: '📏',
        title: 'Tes RTC selon la grille officielle',
        text: 'La dotation annuelle de RTC et le conseil pour le CET suivent maintenant ton cycle et la durée de tes vacations : 188h09 en 12h08, 53h27 en 11h08. Vérifie que ton cycle est bien réglé.',
        action: { label: 'Vérifier mon cycle', target: 'cycle' },
      },
      {
        emoji: '🗓️',
        title: 'Cycles 4/2 et 2/2',
        text: 'Ils sont disponibles ! Et si tes horaires changent, chaque jour travaillé du planning affiche sa pastille (S pour soirée, M pour matinée…).',
        action: { label: 'Modifier mon cycle', target: 'cycle' },
      },
      {
        emoji: '🔄',
        title: 'Des horaires qui changent',
        text: 'Deux cycles de soirée puis un de matinée, ou deux soirées puis deux matinées dans le même cycle ? Indique tes deux jeux d’horaires : RPS et journées modifiées suivent les bons horaires chaque jour.',
        action: { label: 'Régler mes horaires', target: 'cycle' },
      },
      {
        emoji: '🏦',
        title: 'ARTT et RTT vers le CET',
        text: 'Tes ARTT et tes RTT peuvent maintenant alimenter ton CET en janvier, en totalité.',
        action: { label: 'Voir mon épargne CET', target: 'cet' },
      },
    ],
  },
  {
    version: '1.15.0',
    items: [
      {
        emoji: '💬',
        logo: 'discord',
        title: 'Rejoins la communauté My Chronos !',
        text: 'My Chronos est né d’un agent, pour les agents… et maintenant, il grandit avec toi. Une idée, un bug, une question ? Rejoins la toute nouvelle communauté sur Discord : tes retours orientent directement les prochaines versions. Et Marco, l’assistant qui connaît l’app par cœur, est là pour te répondre.',
        note: 'Reste anonyme : ne partage jamais ton nom, ton matricule, ton grade, ton service, ton lieu de travail ni de photo de document. Le serveur est ouvert à tous, et les messages adressés à Marco sont traités par une IA.',
        action: { label: 'Rejoindre la communauté', target: 'communaute' },
      },
      {
        emoji: '🏦',
        title: 'Garde tes RTC et HS pour le CET',
        text: 'Choisis combien de jours de RTC (10 par défaut) et d’HS mettre de côté : ils ne te sont plus proposés à la pose et passent en premier dans le versement de janvier.',
        action: { label: 'Voir mon épargne CET', target: 'cet' },
      },
      {
        emoji: '📋',
        title: 'ASA, Art. 13, CFS, EXN, repos décalé',
        text: 'Marque ces absences sur ton planning, sans toucher à tes compteurs : touche le jour, puis « Autre absence ».',
      },
    ],
  },
  {
    version: '1.14.0',
    items: [
      {
        emoji: '🔁',
        title: 'Le cycle 3/3 est disponible',
        text: '3 jours travaillés, 3 jours de repos : choisissez-le dans votre cycle et indiquez où vous en êtes aujourd’hui. RC, RL et RPS sont calculés comme pour les autres cycles.',
        action: { label: 'Modifier mon cycle', target: 'cycle' },
      },
      {
        emoji: '⏳',
        title: 'Une journée sur plusieurs compteurs',
        text: 'Dans « Choix libre », les RTC, RPS, HS et CF se posent en heures : une nuit en 7h35 de RTC et 4h33 de RPS, ou 7h de RTC complétées par du RPS.',
      },
      {
        emoji: '💰',
        title: 'Épargne CET : les vraies règles',
        text: 'Tous vos RTC restants peuvent aller au CET. Au-delà de 15 jours, le CET ne garde que 10 jours de plus par an : l’app vous conseille le bon versement et estime l’indemnisation du surplus.',
        action: { label: 'Voir mon épargne CET', target: 'cet' },
      },
      {
        emoji: '🧮',
        title: 'Gérer mes compteurs',
        text: 'Un compteur oublié à l’inscription (RTC, ARTT…) ? Ajoutez-le depuis Compteurs → « Gérer mes compteurs ».',
      },
    ],
  },
  {
    version: '1.13.0',
    items: [
      {
        emoji: '✏️',
        title: 'Modifiez une journée',
        text: 'Touchez deux fois un jour : horaires réels (heures en plus, prise décalée, travail sur un repos) ou stage. Vos HS et RPS sont crédités automatiquement, nuit, dimanche, RC, RL et jours fériés compris.',
      },
      {
        emoji: '🗓️',
        title: 'Un planning façon agenda',
        text: 'Chaque jour dans sa case, vos événements en couleur avec leur titre, et une barre continue pour ceux qui durent plusieurs jours. Choisissez la couleur de chaque événement.',
      },
    ],
  },
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
