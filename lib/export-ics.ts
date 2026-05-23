// Génération de fichiers .ics (iCalendar) côté navigateur — zéro serveur
// RFC 5545 + RFC 7986 (COLOR property)

import { CycleConfig, HistoryEntry } from './types';
import { isWorkingDay } from './calculations';

// ─── Labels par type de congé ────────────────────────────────────────────────
const LEAVE_LABELS: Record<string, string> = {
  ca:   'Congé CA',
  caHP: 'Congé CA HP',
  cf:   'Congé CF (Crédit Férié)',
  rtc:  'Congé RTC',
  rtt:  'Congé RTT',
  rps:  'Congé RPS',
  hs:   'Heures supplémentaires',
  cet:  'Congé CET',
};

// ─── Couleurs RFC 7986 ───────────────────────────────────────────────────────
// Supportées par Apple Calendar, Fastmail Calendar, Proton Calendar
const COLORS = {
  work:  'steelblue',
  rest:  'silver',
  leave: 'seagreen',
} as const;

// ─── Utilitaires ─────────────────────────────────────────────────────────────
function toICSDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function makeUID(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}@mychronos.fr`;
}

// Fold les lignes longues (RFC 5545 §3.1 : max 75 octets par ligne)
function foldLine(line: string): string {
  if (line.length <= 75) return line;
  const chunks: string[] = [];
  chunks.push(line.slice(0, 75));
  let i = 75;
  while (i < line.length) {
    chunks.push(' ' + line.slice(i, i + 74));
    i += 74;
  }
  return chunks.join('\r\n');
}

// ─── Types internes ───────────────────────────────────────────────────────────
interface VEvent {
  uid: string;
  dtstart: string;  // YYYYMMDD
  dtend: string;    // YYYYMMDD exclusif
  summary: string;
  color: string;
  transp: 'OPAQUE' | 'TRANSPARENT';
  description?: string;
}

function veventToLines(e: VEvent): string {
  const props = [
    'BEGIN:VEVENT',
    `UID:${e.uid}`,
    `DTSTART;VALUE=DATE:${e.dtstart}`,
    `DTEND;VALUE=DATE:${e.dtend}`,
    foldLine(`SUMMARY:${e.summary}`),
    `COLOR:${e.color}`,
    `TRANSP:${e.transp}`,
  ];
  if (e.description) props.push(foldLine(`DESCRIPTION:${e.description}`));
  props.push('END:VEVENT');
  return props.join('\r\n');
}

function buildCalendar(events: VEvent[], year: number, calName: string): string {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//My Chronos//Planning ' + year + '//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    foldLine(`X-WR-CALNAME:${calName}`),
    'X-WR-CALDESC:Planning généré par My Chronos — mychronos.fr',
    'X-WR-TIMEZONE:Europe/Paris',
    ...events.map(veventToLines),
    'END:VCALENDAR',
  ].join('\r\n');
}

// ─── Types d'export ───────────────────────────────────────────────────────────
export type ExportType = 'all' | 'work' | 'rest' | 'leaves';

export const EXPORT_TYPE_LABELS: Record<ExportType, string> = {
  all:    'Tout le planning',
  work:   'Jours travaillés',
  rest:   'Jours de repos',
  leaves: 'Congés posés',
};

// ─── Fonction principale ──────────────────────────────────────────────────────
export function generateICS(
  cycleConfig: CycleConfig,
  history: HistoryEntry[],
  exportType: ExportType,
  year: number = new Date().getFullYear(),
): string {
  const events: VEvent[] = [];
  const includeWork   = exportType === 'all' || exportType === 'work';
  const includeRest   = exportType === 'all' || exportType === 'rest';
  const includeLeaves = exportType === 'all' || exportType === 'leaves';

  // ── Jours travaillés / repos — groupés par runs consécutifs ─────────────────
  if (includeWork || includeRest) {
    const start = new Date(year, 0, 1);
    const end   = new Date(year, 11, 31);
    const cur   = new Date(start);

    // Groupe les runs consécutifs de même type pour limiter le nombre d'events
    interface Run { isWork: boolean; start: Date; end: Date }
    const runs: Run[] = [];

    while (cur <= end) {
      const dayIsWork = isWorkingDay(new Date(cur), cycleConfig);
      const last = runs[runs.length - 1];
      if (last && last.isWork === dayIsWork) {
        last.end = new Date(cur);
      } else {
        runs.push({ isWork: dayIsWork, start: new Date(cur), end: new Date(cur) });
      }
      cur.setDate(cur.getDate() + 1);
    }

    for (const run of runs) {
      if (run.isWork && includeWork) {
        events.push({
          uid: makeUID(),
          dtstart: toICSDate(run.start),
          dtend:   toICSDate(addDays(run.end, 1)),
          summary: 'Travail',
          color:   COLORS.work,
          transp:  'OPAQUE',
        });
      } else if (!run.isWork && includeRest) {
        events.push({
          uid: makeUID(),
          dtstart: toICSDate(run.start),
          dtend:   toICSDate(addDays(run.end, 1)),
          summary: 'Repos',
          color:   COLORS.rest,
          transp:  'TRANSPARENT',
        });
      }
    }
  }

  // ── Congés posés (depuis l'historique) ──────────────────────────────────────
  if (includeLeaves) {
    const posed = history.filter(
      (h) => h.action === 'pose' && new Date(h.date).getFullYear() === year,
    );

    for (const entry of posed) {
      const startDate = new Date(entry.date.slice(0, 10) + 'T00:00:00');
      const endDate   = entry.dateEnd
        ? new Date(entry.dateEnd.slice(0, 10) + 'T00:00:00')
        : new Date(startDate);

      events.push({
        uid:         makeUID(),
        dtstart:     toICSDate(startDate),
        dtend:       toICSDate(addDays(endDate, 1)),
        summary:     LEAVE_LABELS[entry.type] ?? 'Congé',
        color:       COLORS.leave,
        transp:      'OPAQUE',
        description: entry.description,
      });
    }
  }

  const calNames: Record<ExportType, string> = {
    all:    `My Chronos ${year}`,
    work:   `My Chronos ${year} — Jours travaillés`,
    rest:   `My Chronos ${year} — Jours de repos`,
    leaves: `My Chronos ${year} — Congés posés`,
  };

  return buildCalendar(events, year, calNames[exportType]);
}

// ─── Téléchargement navigateur ────────────────────────────────────────────────
export function downloadICS(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
