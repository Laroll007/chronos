/**
 * Dates et fuseaux horaires.
 *
 * Chronos manipule des JOURS, jamais des heures : un congé, une date limite, une
 * semaine A/B. Deux pièges classiques font glisser ces jours :
 *  - le changement d'heure (journées de 23 h et 25 h) dans les calculs en
 *    millisecondes ;
 *  - les conversions UTC (`toISOString`, `new Date('YYYY-MM-DD')`), qui décalent
 *    d'un jour selon le fuseau — métropole (UTC+1/+2) comme Antilles-Guyane
 *    (UTC−3/−4).
 *
 * Ces tests sont écrits pour passer dans TOUS les fuseaux : `npm run test:tz`
 * les rejoue en métropole, aux Antilles, en Guyane, à la Réunion et à Nouméa.
 */
import { describe, it, expect } from 'vitest';
import { getWeekType, isWorkingDay, getDaysUntil, jourLocal, aujourdhuiISO } from '@/lib/calculations';
import { generateICS } from '@/lib/export-ics';
import { generateRecommendations } from '@/lib/recommendations';
import { DEFAULT_COUNTERS, DEFAULT_CYCLE_CONFIG } from '@/lib/storage';
import type { HistoryEntry } from '@/lib/types';

const cfg = { ...DEFAULT_CYCLE_CONFIG, dateDebutCycle: '2026-01-19', semaineActuelle: 'B' as const };

describe('Alternance A/B et changements d’heure', () => {
  it('le cycle reste périodique sur 14 jours pendant 6 ans, changements d’heure compris', () => {
    const d = new Date(2026, 0, 19);
    for (let i = 0; i < 6 * 366; i++) {
      const plus14 = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 14);
      expect(isWorkingDay(plus14, cfg)).toBe(isWorkingDay(d, cfg));
      d.setDate(d.getDate() + 1);
    }
  });

  it('les semaines basculent le lundi, y compris les week-ends de changement d’heure', () => {
    // Passages à l'heure d'été / d'hiver 2026-2027 (dimanche)
    for (const [a, m, j] of [[2026, 2, 29], [2026, 9, 25], [2027, 2, 28], [2027, 9, 31]]) {
      const dimanche = new Date(a, m, j);
      const lundi = new Date(a, m, j + 1);
      expect(dimanche.getDay()).toBe(0);
      expect(getWeekType(lundi, cfg)).not.toBe(getWeekType(dimanche, cfg));
    }
  });

  it('l’heure de la journée ne change pas la semaine (00h01 comme 23h59)', () => {
    for (const [a, m, j] of [[2026, 2, 29], [2026, 9, 25], [2026, 8, 21]]) {
      const matin = new Date(a, m, j, 0, 1);
      const soir = new Date(a, m, j, 23, 59);
      expect(getWeekType(soir, cfg)).toBe(getWeekType(matin, cfg));
    }
  });
});

describe('Comptes à rebours', () => {
  it('compte les jours de calendrier, même à travers le passage à l’heure d’hiver (journée de 25 h)', () => {
    expect(getDaysUntil(new Date(2026, 9, 30), new Date(2026, 9, 20))).toBe(10);
    expect(getDaysUntil(new Date(2027, 3, 5), new Date(2027, 2, 26))).toBe(10); // heure d'été
  });

  it('en cours de journée, la date limite du jour vaut 0 et celle de demain 1', () => {
    const maintenant = new Date(2026, 9, 24, 23, 30);
    expect(getDaysUntil(new Date(2026, 9, 24), maintenant)).toBe(0);
    expect(getDaysUntil(new Date(2026, 9, 25), maintenant)).toBe(1);
  });
});

describe('Dates sans heure (« YYYY-MM-DD »)', () => {
  it('jourLocal lit une date seule dans le fuseau de l’appareil, pas en UTC', () => {
    const d = jourLocal('2026-12-31');
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 11, 31]);
  });

  it('jourLocal ramène un horodatage d’historique au jour local où il a été écrit', () => {
    // Un congé du 21/09 est enregistré comme « minuit local » en UTC.
    const d = jourLocal(new Date(2026, 8, 21).toISOString());
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 8, 21]);
  });

  it('la date limite des congés bonifiés tombe le bon jour (ouverture + 48 mois)', () => {
    const counters = { ...DEFAULT_COUNTERS, hasCongesBonifies: true, congesBonifies: 10, congesBonifiesDateOuverture: '2024-03-01' };
    const rec = generateRecommendations(counters, cfg, new Date(2026, 8, 21)).find((r) => r.counterType === 'congesBonifies');
    expect(rec?.deadline).toBe('2028-03-01');
    expect(rec?.reason).toContain('01/03/2024');
  });
});

describe('Export calendrier (.ics)', () => {
  it('place un congé à sa vraie date', () => {
    const history: HistoryEntry[] = [{
      id: 'x', date: new Date(2026, 8, 21).toISOString(), dateEnd: new Date(2026, 8, 23).toISOString(),
      type: 'ca', action: 'pose', amount: 3, description: 'test', countersSnapshot: {},
    } as HistoryEntry];
    const ics = generateICS(cfg, history, 'leaves', 2026);
    expect(ics).toContain('DTSTART;VALUE=DATE:20260921');
    expect(ics).toContain('DTEND;VALUE=DATE:20260924'); // fin exclusive : lendemain du 23
  });
});

it('aujourdhuiISO reste le jour local à minuit passé', () => {
  expect(aujourdhuiISO(new Date(2026, 9, 25, 0, 30))).toBe('2026-10-25');
});
