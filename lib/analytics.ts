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
import { apiUrl, isNativeApp } from './api';

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
}

let started = false;
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

function detectPlatform(): StatsPlatform {
  if (isNativeApp()) return 'ios';
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
    state.lastActiveDay = today;
    state.lastActiveWeek = week;
    state.lastActiveMonth = month;
    state.known = true;
  });
}

/** Envoie les jours en attente. Les compteurs ne sont retirés qu'après succès. */
export async function flushStats(): Promise<void> {
  if (typeof window === 'undefined' || !isStatsEnabled()) return;
  const state = readState();

  // Purge des jours trop anciens (appareil resté longtemps hors ligne).
  const cutoff = dayKey(new Date(Date.now() - MAX_PENDING_DAYS * 86_400_000));
  for (const day of Object.keys(state.pending)) {
    if (day < cutoff) delete state.pending[day];
  }

  const days = Object.keys(state.pending);
  if (days.length === 0) return;

  // Le profil n'est lu qu'au moment de l'envoi : à l'ouverture, les données
  // ne sont pas encore chargées (ou l'onboarding n'est pas fait).
  const profile = profileProvider?.() ?? [];
  for (const day of days) {
    const active = state.pending[day]!.active;
    if (active && active.profile.length === 0) active.profile = profile;
  }

  const payload: StatsPayload = {
    v: 1,
    platform: detectPlatform(),
    version: APP_VERSION,
    days: state.pending,
  };

  // Retiré AVANT l'envoi : un 2e flush concurrent (pagehide + visibilitychange)
  // ne renvoie pas les mêmes compteurs. Remis en cas d'échec.
  writeState({ ...state, pending: {} });

  try {
    const res = await fetch(apiUrl('/api/stats'), {
      method: 'POST',
      // text/plain = requête CORS « simple », sans pré-vol (app iOS).
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify(payload),
      keepalive: true,
    });
    if (res.ok || res.status === 400) return; // 400 = lot invalide : inutile d'insister
    throw new Error(`HTTP ${res.status}`);
  } catch {
    restorePending(payload.days);
  }
}

function restorePending(days: Record<string, StatsDayBucket>): void {
  mutate((state) => {
    for (const [day, sent] of Object.entries(days)) {
      const cur = state.pending[day];
      if (!cur) {
        state.pending[day] = sent;
        continue;
      }
      cur.opens += sent.opens;
      for (const [k, n] of Object.entries(sent.events)) {
        const e = k as StatsEvent;
        cur.events[e] = (cur.events[e] ?? 0) + (n ?? 0);
      }
      for (const [k, n] of Object.entries(sent.errors)) cur.errors[k] = (cur.errors[k] ?? 0) + n;
      cur.active ??= sent.active;
    }
  });
}

function scheduleFlush(delay: number): void {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushStats();
  }, delay);
}

/** À appeler une fois au démarrage de l'app (côté client). */
export function startStats(): void {
  if (started || typeof window === 'undefined') return;
  started = true;

  recordOpen();
  scheduleFlush(FIRST_FLUSH_DELAY_MS);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      hiddenAt = Date.now();
      void flushStats();
    } else if (hiddenAt !== null && Date.now() - hiddenAt >= RESUME_AS_OPEN_MS) {
      hiddenAt = null;
      recordOpen();
      scheduleFlush(FIRST_FLUSH_DELAY_MS);
    }
  });

  window.addEventListener('error', (e) => trackError('window', e.error ?? e.message));
  window.addEventListener('unhandledrejection', (e) => trackError('promise', e.reason));
}
