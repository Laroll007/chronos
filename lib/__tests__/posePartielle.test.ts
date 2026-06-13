import { describe, it, expect } from 'vitest';
import {
  hasPostedLeaveOnDate,
  getPartialMinutesOnDate,
  computeWorkedDays,
} from '@/lib/calculations';
import { DEFAULT_HEBDO_SCHEDULE, DEFAULT_HEBDO_HEURES } from '@/lib/types';
import type { CycleConfig, HistoryEntry } from '@/lib/types';

const hebdo = {
  type: 'hebdo',
  heuresParJour: 8 * 60,
  heuresSemaine: DEFAULT_HEBDO_HEURES,
  dateDebutCycle: '2026-01-05',
  semaineActuelle: 'A',
  semaineA: DEFAULT_HEBDO_SCHEDULE,
  semaineB: DEFAULT_HEBDO_SCHEDULE,
} as unknown as CycleConfig;

const mardi = new Date(2026, 5, 9); // mardi travaillé

const partialEntry: HistoryEntry = {
  id: 'p1',
  date: mardi.toISOString(),
  action: 'pose',
  type: 'hs',
  amount: 240, // 4h
  partialDay: true,
  countersSnapshot: {},
} as unknown as HistoryEntry;

const fullEntry: HistoryEntry = {
  id: 'f1',
  date: mardi.toISOString(),
  action: 'pose',
  type: 'ca',
  amount: 1,
  countersSnapshot: {},
} as unknown as HistoryEntry;

describe('pose fractionnée (Bug 5)', () => {
  it('getPartialMinutesOnDate renvoie les minutes posées', () => {
    expect(getPartialMinutesOnDate(mardi, [partialEntry])).toBe(240);
    expect(getPartialMinutesOnDate(mardi, [])).toBe(0);
  });

  it('un jour avec pose partielle N\'EST PAS un congé plein-jour', () => {
    expect(hasPostedLeaveOnDate(mardi, [partialEntry])).toBe(false);
  });

  it('une pose plein-jour reste détectée comme congé', () => {
    expect(hasPostedLeaveOnDate(mardi, [fullEntry])).toBe(true);
  });

  it('computeWorkedDays : le jour partiel reste travaillé (pas en congé)', () => {
    // semaine Lu 8 → Ve 12 : 5 jours travaillés
    const start = new Date(2026, 5, 8);
    const end = new Date(2026, 5, 12);
    const breakdown = computeWorkedDays(start, end, hebdo, [partialEntry]);
    expect(breakdown.workingDays).toBe(5);
    expect(breakdown.leaveDays).toBe(0); // la pose partielle ne retire pas le jour
    expect(breakdown.netWorkedDays).toBe(5);
  });

  it('un congé plein-jour, lui, retire le jour travaillé', () => {
    const start = new Date(2026, 5, 8);
    const end = new Date(2026, 5, 12);
    const breakdown = computeWorkedDays(start, end, hebdo, [fullEntry]);
    expect(breakdown.leaveDays).toBe(1);
    expect(breakdown.netWorkedDays).toBe(4);
  });
});
