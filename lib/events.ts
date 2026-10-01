// Événements personnels du planning (RDV, formation, audience…).
//
// Purement informatifs : ils n'entrent dans aucun calcul (compteurs, RPS, jours
// travaillés). Les dates sont des jours LOCAUX 'YYYY-MM-DD', comparables en
// chaînes, ce qui évite les décalages de fuseau rencontrés avec toISOString().

import type { EventCategory, EventColor, PersonalEvent } from './types';

export const EVENT_CATEGORIES: Record<EventCategory, { label: string; emoji: string }> = {
  rdv: { label: 'Rendez-vous', emoji: '📅' },
  formation: { label: 'Formation / stage', emoji: '🎓' },
  audience: { label: 'Audience / convocation', emoji: '⚖️' },
  perso: { label: 'Personnel', emoji: '🏠' },
  autre: { label: 'Autre', emoji: '📌' },
};

// Palette « à la Google Agenda » : lisible avec du texte blanc, et distincte des
// couleurs d'état du planning (bleu travail, vert congé, violet CMO, ambre
// astreinte, teal heures, ciel/indigo journées modifiées). Classes écrites en
// entier pour que Tailwind les génère.
export const EVENT_COLORS: Record<EventColor, { label: string; bg: string; border: string }> = {
  rose: { label: 'Rose', bg: 'bg-rose-600', border: 'border-rose-600' },
  orange: { label: 'Orange', bg: 'bg-orange-600', border: 'border-orange-600' },
  fuchsia: { label: 'Fuchsia', bg: 'bg-fuchsia-600', border: 'border-fuchsia-600' },
  cyan: { label: 'Cyan', bg: 'bg-cyan-700', border: 'border-cyan-700' },
  lime: { label: 'Vert', bg: 'bg-lime-700', border: 'border-lime-700' },
  slate: { label: 'Gris', bg: 'bg-slate-600', border: 'border-slate-600' },
};

export const CATEGORY_COLOR: Record<EventCategory, EventColor> = {
  rdv: 'rose',
  formation: 'orange',
  audience: 'fuchsia',
  perso: 'lime',
  autre: 'cyan',
};

export function eventColor(event: Pick<PersonalEvent, 'category' | 'color'>): EventColor {
  return event.color ?? CATEGORY_COLOR[event.category];
}

export const EVENT_TITLE_MAX = 60;
export const EVENT_NOTE_MAX = 300;

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Jour local 'YYYY-MM-DD'. */
export function toDayKey(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${m}-${d}`;
}

/** 'YYYY-MM-DD' → Date locale à minuit. */
export function fromDayKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y!, m! - 1, d!);
}

function isValidDay(key: unknown): key is string {
  if (typeof key !== 'string' || !DAY_RE.test(key)) return false;
  return toDayKey(fromDayKey(key)) === key; // refuse le 31/02 et consorts
}

/**
 * Valide et normalise un événement. Retourne null s'il est inutilisable
 * (données corrompues, import d'une sauvegarde modifiée à la main…).
 */
export function sanitizeEvent(raw: unknown): PersonalEvent | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const e = raw as Record<string, unknown>;
  if (typeof e.id !== 'string' || !e.id) return null;
  if (!isValidDay(e.date)) return null;
  const title = typeof e.title === 'string' ? e.title.trim().slice(0, EVENT_TITLE_MAX) : '';
  if (!title) return null;
  const category: EventCategory =
    typeof e.category === 'string' && e.category in EVENT_CATEGORIES
      ? (e.category as EventCategory)
      : 'autre';

  const event: PersonalEvent = { id: e.id, date: e.date, title, category };
  if (isValidDay(e.dateEnd) && e.dateEnd > e.date) event.dateEnd = e.dateEnd;
  if (typeof e.time === 'string' && TIME_RE.test(e.time)) event.time = e.time;
  if (typeof e.note === 'string' && e.note.trim()) event.note = e.note.trim().slice(0, EVENT_NOTE_MAX);
  if (typeof e.color === 'string' && e.color in EVENT_COLORS) event.color = e.color as EventColor;
  return event;
}

export function sanitizeEvents(raw: unknown): PersonalEvent[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(sanitizeEvent).filter((e): e is PersonalEvent => e !== null);
}

/** L'événement couvre-t-il ce jour ? */
export function eventCoversDay(event: PersonalEvent, dayKey: string): boolean {
  return dayKey >= event.date && dayKey <= (event.dateEnd ?? event.date);
}

/** Événements d'un jour, triés par heure (sans heure en premier). */
export function eventsOnDate(date: Date, events: PersonalEvent[] | undefined): PersonalEvent[] {
  if (!events?.length) return [];
  const key = toDayKey(date);
  return events.filter((e) => eventCoversDay(e, key)).sort(compareEvents);
}

/** Événements qui touchent la période [start, end]. */
export function eventsInRange(start: Date, end: Date, events: PersonalEvent[] | undefined): PersonalEvent[] {
  if (!events?.length) return [];
  const a = toDayKey(start);
  const b = toDayKey(end);
  return events.filter((e) => e.date <= b && (e.dateEnd ?? e.date) >= a).sort(compareEvents);
}

export function compareEvents(a: PersonalEvent, b: PersonalEvent): number {
  return a.date.localeCompare(b.date) || (a.time ?? '').localeCompare(b.time ?? '') || a.title.localeCompare(b.title);
}

/** « jeu. 2 oct. » ou « 2 → 4 oct. », + « · 14h30 ». */
export function formatEventWhen(event: PersonalEvent): string {
  const opts: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' };
  const start = fromDayKey(event.date).toLocaleDateString('fr-FR', opts);
  const range = event.dateEnd
    ? `${start} → ${fromDayKey(event.dateEnd).toLocaleDateString('fr-FR', opts)}`
    : start;
  return event.time ? `${range} · ${event.time.replace(':', 'h')}` : range;
}
