// Étiquette du type de congé dans les cases du planning.

import { describe, it, expect } from 'vitest';
import { etiquetteDuJour } from '../typesConges';
import type { HistoryEntry } from '../types';

const d = (j: number) => new Date(2026, 9, j);
let n = 0;
const e = (j1: number, j2: number | null, action: HistoryEntry['action'], type: HistoryEntry['type'], amount = 1, extra: Partial<HistoryEntry> = {}): HistoryEntry =>
  ({ id: `e${n++}`, date: d(j1).toISOString(), ...(j2 && { dateEnd: d(j2).toISOString() }), action, type, amount, countersSnapshot: {}, ...extra }) as HistoryEntry;

const H: HistoryEntry[] = [
  e(2, 3, 'pose', 'ca', 2),
  e(8, null, 'pose', 'cf', 0.5), e(8, null, 'pose', 'hs', 0.5),
  e(9, null, 'pose', 'ca', 0.4), e(9, null, 'pose', 'rtc', 0.3), e(9, null, 'pose', 'rps', 0.3),
  e(16, null, 'pose', 'rtc', 240, { partialDay: true }),
  e(17, null, 'pose', 'rtc', 95, { partialDay: true }),
  e(20, 21, 'cmo', 'cmo'),
  e(23, null, 'astreinte', 'astreinte'),
  e(26, null, 'absence', 'absence', 1, { motif: 'asa_naissance' }),
  e(27, null, 'absence', 'absence', 1),
];

describe('Étiquette du jour sur le planning', () => {
  it.each([
    [2, 'CA'], [3, 'CA'], [8, 'CF + HS'], [9, 'CA +2'], [16, 'RTC 4h'], [17, 'RTC 1h35'],
    [20, 'CMO'], [23, 'Astreinte'], [26, 'NAI'], [27, 'Absence'],
  ])('%i octobre → %s', (jour, texte) => {
    expect(etiquetteDuJour(d(jour), H)?.texte).toBe(texte);
  });

  it('jour sans rien : pas d’étiquette', () => {
    expect(etiquetteDuJour(d(5), H)).toBeNull();
  });
});
