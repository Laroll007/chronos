// Statistiques d'usage anonymes.
//
// Principe : AUCUN identifiant (ni ID d'appareil, ni cookie, ni empreinte).
// L'appareil agrège localement des compteurs par jour (ouvertures, fonctionnalités
// utilisées, erreurs) et les envoie par lots. Pour compter les utilisateurs
// actifs sans les identifier, le premier envoi de la journée porte un marqueur
// « actif » + deux booléens « premier de la semaine / du mois » calculés ici :
// le serveur n'a plus qu'à les additionner. Le serveur ne conserve pas l'IP.
//
// Désactivable dans Paramètres → « Statistiques anonymes ».

import { APP_VERSION, STORAGE_KEY } from './constants';
import {
  dayKey,
  isoWeekKey,
  monthKey,
  sanitizeErrorKey,
  type StatsDayBucket,
  type StatsEvent,
  type StatsPayload,
  type StatsPlatform,
} from './stats-events';
import { apiUrl, plateformeNative } from './api';

const STATE_KEY = 'chronos_stats';
const OPTOUT_KEY = 'chronos_stats_optout';
const PLATFORM_KEY = 'chronos_stats_platform';

/** Un retour au premier plan après au moins ce délai compte comme une ouverture. */
const RESUME_AS_OPEN_MS = 5 * 60 * 1000;
/** Au-delà, les jours non envoyés (appareil hors ligne) sont abandonnés. */
const MAX_PENDING_DAYS = 14;
const MAX_ERROR_KEYS_PER_DAY = 20;
const FIRST_FLUSH_DELAY_MS = 10_000;

interface StatsState {
  pending: Record<string, StatsDayBucket>;
  lastActiveDay?: string;
  lastActiveWeek?: string;
  lastActiveMonth?: string;
  /** L'appareil a déjà été compté (nouveau ou existant). */
  known?: boolean;
  /** Lots dont l'envoi a échoué : renvoyés tels quels, avec le même numéro. */
  renvois?: StatsPayload[];
  /** Dernier marqueur « actif » envoyé (pour corriger une migration après coup). */
  envoye?: { isNew: boolean; firstOfWeek: boolean; firstOfMonth: boolean; corrige?: boolean };
}

/** Ce que la page de transfert transmet de l'ancien appareil (aucun identifiant). */
export type EtatStatsNavigateur = Pick<StatsState, 'known' | 'lastActiveDay' | 'lastActiveWeek' | 'lastActiveMonth'>;

const MAX_RENVOIS = 10;

let started = false;
let ouvertureComptee = false;
let hiddenAt: number | null = null;
let profileProvider: (() => string[]) | null = null;
let flushTimer: ReturnType<typeof setTimeout> | null = null;

// ─── Préférence utilisateur ───────────────────────────────────────────────────

export function isStatsEnabled(): boolean {
  try {
    return localStorage.getItem(OPTOUT_KEY) !== '1';
  } catch {
    return false;
  }
}

export function setStatsEnabled(enabled: boolean): void {
  try {
    if (enabled) {
      localStorage.removeItem(OPTOUT_KEY);
    } else {
      localStorage.setItem(OPTOUT_KEY, '1');
      // Rien de ce qui a été collecté localement ne part après un refus.
      localStorage.removeItem(STATE_KEY);
    }
  } catch {
    /* stockage indisponible : rien à faire */
  }
}

// ─── État local ───────────────────────────────────────────────────────────────

function readState(): StatsState {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as StatsState;
      if (parsed && typeof parsed === 'object' && parsed.pending) return parsed;
    }
  } catch {
    /* état corrompu : on repart de zéro */
  }
  return { pending: {} };
}

function writeState(state: StatsState): void {
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
  } catch {
    /* quota plein ou stockage bloqué : on perd ces stats, sans gêner l'app */
  }
}

function bucketFor(state: StatsState, day: string): StatsDayBucket {
  return (state.pending[day] ??= { opens: 0, events: {}, errors: {} });
}

/** Modifie l'état si les stats sont actives. */
function mutate(fn: (state: StatsState, today: string) => void): void {
  if (typeof window === 'undefined' || !isStatsEnabled()) return;
  const state = readState();
  fn(state, dayKey(new Date()));
  writeState(state);
}

// ─── Plateforme ───────────────────────────────────────────────────────────────

/** Plateforme de l'appareil : app iPhone, app Android (native ou TWA), web installé ou navigateur. */
export function detectPlatform(): StatsPlatform {
  const natif = plateformeNative();
  if (natif) return natif;
  try {
    // L'app Android (TWA) n'expose le referrer `android-app://` qu'au lancement :
    // on le mémorise pour les navigations suivantes.
    if (document.referrer.startsWith('android-app://fr.mychronos.app')) {
      localStorage.setItem(PLATFORM_KEY, 'android');
      return 'android';
    }
    if (localStorage.getItem(PLATFORM_KEY) === 'android') return 'android';
  } catch {
    /* ignore */
  }
  if (window.matchMedia?.('(display-mode: standalone)').matches) return 'pwa';
  return 'web';
}

// ─── API publique ─────────────────────────────────────────────────────────────

/** Compte une utilisation de fonctionnalité. */
export function track(event: StatsEvent): void {
  mutate((state, today) => {
    const events = bucketFor(state, today).events;
    events[event] = (events[event] ?? 0) + 1;
  });
}

/** Compte une erreur (type + message nettoyé, jamais de données). */
export function trackError(source: string, error: unknown): void {
  const name = error instanceof Error ? error.name : typeof error;
  const message = error instanceof Error ? error.message : String(error ?? '');
  const key = sanitizeErrorKey(source, name, message);
  mutate((state, today) => {
    const errors = bucketFor(state, today).errors;
    if (errors[key] === undefined && Object.keys(errors).length >= MAX_ERROR_KEYS_PER_DAY) return;
    errors[key] = (errors[key] ?? 0) + 1;
  });
}

/**
 * Fournit le profil de cycle (catégories grossières) joint au marqueur
 * « actif » du jour. Appelé par le dashboard une fois les données chargées.
 */
export function setStatsProfile(provider: () => string[]): void {
  profileProvider = provider;
}

/** Marqueur posé par « Réinitialiser l'application » (cf. resetAllData). */
function resetVolontaire(): boolean {
  try {
    return localStorage.getItem('chronos_reset_volontaire') === '1';
  } catch {
    return false;
  }
}

function hasUserData(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== null;
  } catch {
    return false;
  }
}

function recordOpen(): void {
  mutate((state, today) => {
    bucketFor(state, today).opens += 1;
    if (state.lastActiveDay === today) return;

    const now = new Date();
    const week = isoWeekKey(now);
    const month = monthKey(now);
    bucketFor(state, today).active = {
      firstOfWeek: state.lastActiveWeek !== week,
      firstOfMonth: state.lastActiveMonth !== month,
      // Un utilisateur qui avait déjà des données avant l'arrivée des stats
      // n'est pas une nouvelle installation.
      isNew: !state.known && !hasUserData(),
      profile: [],
    };
    // Appareil déjà vu, mais revenu sans aucune donnée (et sans réinitialisation
    // volontaire) : ses données ont probablement été effacées par le navigateur.
    if (state.known && !hasUserData() && !resetVolontaire()) {
      const bucket = bucketFor(state, today);
      bucket.events.donnees_absentes = (bucket.events.donnees_absentes ?? 0) + 1;
    }
    state.lastActiveDay = today;
    state.lastActiveWeek = week;
    state.lastActiveMonth = month;
    state.known = true;
  });
}

/** Numéro de lot aléatoire (identifie un envoi, jamais l'appareil). */
function nouveauLot(): string {
  try {
    const octets = new Uint8Array(10);
    crypto.getRandomValues(octets);
    return Array.from(octets, (o) => (o % 36).toString(36)).join('');
  } catch {
    return Math.random().toString(36).slice(2, 12);
  }
}

/** true si le serveur a pris le lot (ou l'a refusé définitivement). */
async function envoyer(payload: StatsPayload): Promise<boolean> {
  try {
    const res = await fetch(apiUrl('/api/stats'), {
      method: 'POST',
      // text/plain = requête CORS « simple », sans pré-vol (app iOS).
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(payload),
      keepalive: true,
    });
    return res.ok || res.status === 400; // 400 = lot invalide : inutile d'insister
  } catch {
    return false;
  }
}

/**
 * Envoie les jours en attente, et les lots précédemment en échec. Un lot en
 * échec est renvoyé à l'identique (même numéro) : si le serveur l'avait reçu
 * malgré l'erreur (réseau coupé avant la réponse), il ne le compte pas deux fois.
 */
export async function flushStats(): Promise<void> {
  if (typeof window === 'undefined' || !isStatsEnabled()) return;
  const state = readState();

  // Purge des jours trop anciens (appareil resté longtemps hors ligne).
  const cutoff = dayKey(new Date(Date.now() - MAX_PENDING_DAYS * 86_400_000));
  for (const day of Object.keys(state.pending)) {
    if (day < cutoff) delete state.pending[day];
  }

  const aEnvoyer: StatsPayload[] = [...(state.renvois ?? [])];
  const days = Object.keys(state.pending);
  if (days.length > 0) {
    // Le profil n'est lu qu'au moment de l'envoi : à l'ouverture, les données
    // ne sont pas encore chargées (ou l'onboarding n'est pas fait).
    const profile = profileProvider?.() ?? [];
    let envoye = state.envoye;
    for (const day of days.sort()) {
      const active = state.pending[day]!.active;
      if (!active) continue;
      if (active.profile.length === 0) active.profile = profile;
      envoye = { isNew: active.isNew, firstOfWeek: active.firstOfWeek, firstOfMonth: active.firstOfMonth };
    }
    aEnvoyer.push({ v: 1, platform: detectPlatform(), version: APP_VERSION, days: state.pending, lot: nouveauLot() });
    state.envoye = envoye;
  }
  if (aEnvoyer.length === 0) return;

  // Retiré AVANT l'envoi : un 2e flush concurrent (pagehide + visibilitychange)
  // ne renvoie pas les mêmes compteurs. Les échecs reviennent dans `renvois`.
  writeState({ ...state, pending: {}, renvois: [] });

  const echecs: StatsPayload[] = [];
  for (const payload of aEnvoyer) {
    if (!(await envoyer(payload))) echecs.push(payload);
  }
  if (echecs.length > 0) {
    mutate((s) => {
      s.renvois = [...(s.renvois ?? []), ...echecs].slice(-MAX_RENVOIS);
    });
  }
}

/**
 * App Android native : l'agent vient de récupérer les données de l'ancienne app
 * (navigateur). Ce n'est pas un nouvel appareil, ni un 2e actif de la semaine
 * ou du mois si l'ancien l'était déjà : on corrige le marqueur en attente, ou,
 * s'il est déjà parti, on envoie une correction que le serveur décompte.
 */
export function fusionnerMigration(nav: EtatStatsNavigateur | undefined): void {
  if (!nav?.known) return;
  mutate((state, today) => {
    const now = new Date();
    const memeSemaine = nav.lastActiveWeek === isoWeekKey(now);
    const memeMois = nav.lastActiveMonth === monthKey(now);
    const enAttente = Object.values(state.pending).find((b) => b.active)?.active;
    if (enAttente) {
      enAttente.isNew = false;
      if (memeSemaine) enAttente.firstOfWeek = false;
      if (memeMois) enAttente.firstOfMonth = false;
    } else if (state.envoye && !state.envoye.corrige) {
      const b = bucketFor(state, today);
      const plus = (e: StatsEvent) => (b.events[e] = (b.events[e] ?? 0) + 1);
      if (state.envoye.isNew) plus('migration_nouveau_annule');
      if (state.envoye.firstOfWeek && memeSemaine) plus('migration_semaine_annulee');
      if (state.envoye.firstOfMonth && memeMois) plus('migration_mois_annule');
      state.envoye.corrige = true;
    }
    state.known = true;
    if (nav.lastActiveWeek && (!state.lastActiveWeek || nav.lastActiveWeek > state.lastActiveWeek)) state.lastActiveWeek = nav.lastActiveWeek;
    if (nav.lastActiveMonth && (!state.lastActiveMonth || nav.lastActiveMonth > state.lastActiveMonth)) state.lastActiveMonth = nav.lastActiveMonth;
  });
}

/** État des stats de ce navigateur, transmis à l'app native lors d'une migration. */
export function etatStatsNavigateur(): EtatStatsNavigateur | undefined {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (!raw) return undefined;
    const s = JSON.parse(raw) as StatsState;
    return { known: !!s.known, lastActiveDay: s.lastActiveDay, lastActiveWeek: s.lastActiveWeek, lastActiveMonth: s.lastActiveMonth };
  } catch {
    return undefined;
  }
}

function scheduleFlush(delay: number): void {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushStats();
  }, delay);
}

/**
 * À appeler au démarrage (côté client). `ouverture` : seules les pages de l'app
 * (inscription, planning) comptent comme une ouverture / un actif ; les autres
 * (accueil, téléchargement, transfert…) n'envoient que leurs événements.
 */
export function startStats({ ouverture = true }: { ouverture?: boolean } = {}): void {
  if (typeof window === 'undefined') return;
  if (ouverture && !ouvertureComptee) {
    ouvertureComptee = true;
    recordOpen();
    scheduleFlush(FIRST_FLUSH_DELAY_MS);
  }
  if (started) return;
  started = true;
  if (!ouverture) scheduleFlush(FIRST_FLUSH_DELAY_MS);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      hiddenAt = Date.now();
      void flushStats();
    } else if (ouvertureComptee && hiddenAt !== null && Date.now() - hiddenAt >= RESUME_AS_OPEN_MS) {
      hiddenAt = null;
      recordOpen();
      scheduleFlush(FIRST_FLUSH_DELAY_MS);
    }
  });

  window.addEventListener('error', (e) => trackError('window', e.error ?? e.message));
  window.addEventListener('unhandledrejection', (e) => trackError('promise', e.reason));
}
