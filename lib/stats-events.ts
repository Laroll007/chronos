// Catalogue des statistiques anonymes — partagé client / serveur.
//
// C'est aussi la liste blanche : le serveur rejette tout nom d'événement absent
// d'ici. Ajouter une fonctionnalité à mesurer = ajouter une ligne ci-dessous,
// puis appeler `track('<nom>')` à l'endroit voulu.

export const STATS_EVENTS = {
  // Onboarding (entonnoir)
  onboarding_cycle_done: { label: 'Onboarding : cycle renseigné', group: 'Onboarding' },
  onboarding_done: { label: 'Onboarding : terminé', group: 'Onboarding' },

  // Calendrier
  view_week: { label: 'Vue Semaine', group: 'Calendrier' },
  view_year: { label: 'Vue Année', group: 'Calendrier' },
  range_select: { label: 'Sélection d’une période', group: 'Calendrier' },

  // Poses
  leave_pose: { label: 'Congés posés (combinaison)', group: 'Poses' },
  leave_pose_partiel: { label: 'Heures posées (partiel)', group: 'Poses' },
  cmo_mark: { label: 'Arrêt maladie (CMO)', group: 'Poses' },
  astreinte_mark: { label: 'Astreinte', group: 'Poses' },
  leave_edit: { label: 'Modification d’un congé', group: 'Poses' },
  leave_delete: { label: 'Suppression d’un congé', group: 'Poses' },
  cet_epargne: { label: 'Épargne CET', group: 'Poses' },

  // Écrans
  open_counters: { label: 'Ouvre les compteurs', group: 'Écrans' },
  counters_edit: { label: 'Modifie ses compteurs', group: 'Écrans' },
  counter_help: { label: 'Aide (?) d’un compteur', group: 'Écrans' },
  open_profile: { label: 'Ouvre le profil / projection CET', group: 'Écrans' },
  open_notifications: { label: 'Ouvre les alertes', group: 'Écrans' },
  notif_permission: { label: 'Active les notifications', group: 'Écrans' },
  open_settings: { label: 'Ouvre les paramètres', group: 'Écrans' },

  // Outils
  cycle_change: { label: 'Change de cycle', group: 'Outils' },
  tool_worked_days: { label: 'Calcul jours travaillés', group: 'Outils' },
  tool_retraite: { label: 'Simulateur retraite', group: 'Outils' },
  backup_export: { label: 'Export sauvegarde', group: 'Outils' },
  backup_import: { label: 'Import sauvegarde', group: 'Outils' },
  app_reset: { label: 'Réinitialisation', group: 'Outils' },

  // À propos
  feedback_open: { label: 'Ouvre « Donner mon avis »', group: 'À propos' },
  feedback_sent: { label: 'Envoie un avis', group: 'À propos' },
  welcome_reopen: { label: 'Revoit le message de bienvenue', group: 'À propos' },
  kofi_click: { label: 'Clic Ko-fi', group: 'À propos' },
} as const satisfies Record<string, { label: string; group: string }>;

export type StatsEvent = keyof typeof STATS_EVENTS;

export const STATS_PLATFORMS = ['ios', 'android', 'pwa', 'web'] as const;
export type StatsPlatform = (typeof STATS_PLATFORMS)[number];

export function isStatsEvent(name: string): name is StatsEvent {
  return Object.prototype.hasOwnProperty.call(STATS_EVENTS, name);
}

export function isStatsPlatform(p: unknown): p is StatsPlatform {
  return typeof p === 'string' && (STATS_PLATFORMS as readonly string[]).includes(p);
}

/**
 * Profil de cycle, en catégories grossières. Jamais de date ni de solde.
 * Clés « famille:valeur », ex. `type:alterne`, `pattern:2/2`, `duree:12h08`.
 */
export const PROFILE_KEY_RE = /^(type|pattern|duree|option):[A-Za-z0-9/_\-hé]{1,24}$/;

/** Clé d'erreur : texte court, déjà nettoyé côté client. */
export const ERROR_KEY_MAX = 120;

/**
 * Nettoie un message d'erreur pour qu'il ne transporte aucune donnée :
 * chiffres (dates, soldes, durées) remplacés, URL et chaînes entre guillemets
 * retirées, longueur bornée.
 */
export function sanitizeErrorKey(source: string, name: string, message: string): string {
  const cleaned = message
    .replace(/https?:\/\/\S+|capacitor:\/\/\S+/g, '<url>')
    .replace(/(["'`]).*?\1/g, '<str>')
    .replace(/\d+/g, '#')
    .replace(/\s+/g, ' ')
    .trim();
  return `${source}|${name || 'Error'}: ${cleaned}`.slice(0, ERROR_KEY_MAX);
}

// ─── Dates (jour local de l'appareil) ─────────────────────────────────────────

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** `YYYY-MM-DD` dans le fuseau de l'appareil. */
export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** `YYYY-MM` */
export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

/** Semaine ISO 8601 : `YYYY-Www`. */
export function isoWeekKey(d: Date): string {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dow = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dow);
  const yearStart = Date.UTC(t.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((t.getTime() - yearStart) / 86_400_000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${pad(week)}`;
}

/** Semaine ISO d'un `YYYY-MM-DD` (sans dépendre du fuseau du serveur). */
export function isoWeekOfDayKey(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  return isoWeekKey(new Date(y!, m! - 1, d!));
}

// ─── Format du payload envoyé au serveur ──────────────────────────────────────

export interface StatsDayBucket {
  /** Ouvertures de l'app (lancement ou retour au premier plan après une pause). */
  opens: number;
  events: Partial<Record<StatsEvent, number>>;
  errors: Record<string, number>;
  /**
   * Présent sur le PREMIER envoi de la journée pour cet appareil : sert à
   * compter les actifs sans aucun identifiant.
   */
  active?: {
    firstOfWeek: boolean;
    firstOfMonth: boolean;
    isNew: boolean;
    profile: string[];
  };
}

export interface StatsPayload {
  v: 1;
  platform: StatsPlatform;
  version: string;
  days: Record<string, StatsDayBucket>;
}
