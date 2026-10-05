import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { STORAGE_KEY } from '../constants';
import { DEFAULT_COUNTERS, DEFAULT_CYCLE_CONFIG } from '../storage';
import { hasPostedLeaveOnDate } from '../calculations';
import type { UserData } from '../types';

vi.mock('../analytics', () => ({ track: vi.fn(), trackError: vi.fn() }));
import { useCounters } from '@/hooks/useCounters';

const h = (hh: number, mm = 0) => hh * 60 + mm;

describe('Nuit posée moitié RTC, moitié RPS', () => {
  let store: Map<string, string>;
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 5));
    store = new Map();
    vi.mocked(localStorage.getItem).mockImplementation((k) => store.get(k) ?? null);
    vi.mocked(localStorage.setItem).mockImplementation((k, v) => void store.set(k, String(v)));
    vi.mocked(localStorage.removeItem).mockImplementation((k) => void store.delete(k));
    const data: UserData = {
      cycleConfig: DEFAULT_CYCLE_CONFIG,
      counters: { ...DEFAULT_COUNTERS, rtc: h(7), rps: h(10), rpsDernierCredit: '2026-10-05' },
      history: [],
      lastUpdated: new Date().toISOString(),
      lastResetYear: 2026,
      isOnboarded: true,
      schemaVersion: 99,
    } as UserData;
    store.set(STORAGE_KEY, JSON.stringify(data));
  });
  afterEach(() => vi.useRealTimers());

  it('deux poses sur la même nuit : jour posé, compteurs débités, annulation complète', async () => {
    const { result } = renderHook(() => useCounters());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const nuit = new Date(2026, 9, 12);
    let ids: (string | undefined)[] = [];
    act(() => {
      ids = [
        result.current.poseConge('rtc', h(7), nuit, nuit, undefined, 'grp-1').entryId,
        result.current.poseConge('rps', h(5, 8), nuit, nuit, undefined, 'grp-1').entryId,
      ];
    });
    let d = JSON.parse(store.get(STORAGE_KEY)!) as UserData;
    expect(d.counters.rtc).toBe(0);
    expect(d.counters.rps).toBe(h(10) - h(5, 8));
    expect(hasPostedLeaveOnDate(nuit, d.history)).toBe(true);

    act(() => { ids.forEach((id) => result.current.deleteHistoryEntry(id!)); });
    d = JSON.parse(store.get(STORAGE_KEY)!) as UserData;
    expect(d.counters).toMatchObject({ rtc: h(7), rps: h(10) });
    expect(d.history).toHaveLength(0);
  });
});
