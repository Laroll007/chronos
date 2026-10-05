import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { STORAGE_KEY } from '../constants';
import { DEFAULT_COUNTERS, DEFAULT_CYCLE_CONFIG } from '../storage';
import { computeWorkedDays, hasAbsenceOnDate, isWorkingDay } from '../calculations';
import { isJourOuvrantRPS } from '../rps';
import { validateUserData } from '../validation';
import type { UserData } from '../types';

vi.mock('../analytics', () => ({ track: vi.fn(), trackError: vi.fn() }));
import { useCounters } from '@/hooks/useCounters';

describe('Absences sans compteur (ASA, Art. 13, CFS, EXN, repos décalé)', () => {
  let store: Map<string, string>;
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 5));
    store = new Map();
    vi.mocked(localStorage.getItem).mockImplementation((k) => store.get(k) ?? null);
    vi.mocked(localStorage.setItem).mockImplementation((k, v) => void store.set(k, String(v)));
    vi.mocked(localStorage.removeItem).mockImplementation((k) => void store.delete(k));
    store.set(STORAGE_KEY, JSON.stringify({
      cycleConfig: DEFAULT_CYCLE_CONFIG,
      counters: { ...DEFAULT_COUNTERS, ca: 18, rtc: 600, rps: 100, rpsDernierCredit: '2026-10-05' },
      history: [], lastUpdated: new Date().toISOString(), lastResetYear: 2026, isOnboarded: true, schemaVersion: 99,
    }));
  });
  afterEach(() => vi.useRealTimers());

  it('ASA mariage : jours non travaillés, aucun compteur débité, ni RPS ; suppression propre', async () => {
    const { result } = renderHook(() => useCounters());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    // une journée travaillée de la config par défaut
    let jour = new Date(2026, 9, 12);
    while (!isWorkingDay(jour, DEFAULT_CYCLE_CONFIG)) jour = new Date(jour.getFullYear(), jour.getMonth(), jour.getDate() + 1);

    act(() => { expect(result.current.poseAbsence('asa_mariage', jour, jour).success).toBe(true); });
    let d = JSON.parse(store.get(STORAGE_KEY)!) as UserData;
    expect(d.counters).toMatchObject({ ca: 18, rtc: 600, rps: 100 });
    const entry = d.history[0];
    expect(entry).toMatchObject({ action: 'absence', type: 'absence', motif: 'asa_mariage', description: 'ASA mariage / PACS' });
    expect(hasAbsenceOnDate(jour, d.history)).toBe(true);
    expect(isJourOuvrantRPS(jour, DEFAULT_CYCLE_CONFIG, d.history)).toBe(false);
    expect(computeWorkedDays(jour, jour, DEFAULT_CYCLE_CONFIG, d.history).netWorkedDays).toBe(0);
    expect(validateUserData(d).success).toBe(true);

    act(() => { result.current.deleteHistoryEntry(entry.id); });
    d = JSON.parse(store.get(STORAGE_KEY)!) as UserData;
    expect(d.history).toHaveLength(0);
    expect(d.counters).toMatchObject({ ca: 18, rtc: 600, rps: 100 });
  });
});
