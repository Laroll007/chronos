import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { STORAGE_KEY } from '../constants';
import { DEFAULT_COUNTERS, DEFAULT_CYCLE_CONFIG, migrateUserData } from '../storage';
import { planEpargneCET } from '../cet';
import type { UserData } from '../types';

vi.mock('../analytics', () => ({ track: vi.fn(), trackError: vi.fn() }));
import { useCounters } from '@/hooks/useCounters';

// Bulle d'aide ARTT : « Non transférables au CET » était faux (guide DNPAF :
// « tous les jours ou heures ARTT peuvent alimenter le CET »).
describe('ARTT au CET : de bout en bout', () => {
  let store: Map<string, string>;
  const base = (over: Partial<UserData> = {}, c: Partial<UserData['counters']> = {}): UserData => ({
    cycleConfig: DEFAULT_CYCLE_CONFIG,
    counters: { ...DEFAULT_COUNTERS, rtc: 0, hasRTC: false, ca: 0, caHP: 0, hs: 0, cet: 20, hasARTT: true, artt: 6, ...c },
    history: [], lastUpdated: new Date().toISOString(), lastResetYear: 2026, isOnboarded: true, ...over,
  } as UserData);

  beforeEach(() => {
    store = new Map();
    vi.mocked(localStorage.getItem).mockImplementation((k) => store.get(k) ?? null);
    vi.mocked(localStorage.setItem).mockImplementation((k, v) => void store.set(k, String(v)));
    vi.mocked(localStorage.removeItem).mockImplementation((k) => void store.delete(k));
  });
  afterEach(() => vi.useRealTimers());

  it('les ARTT restants au 31/12 sont relevés, versés en janvier, et rendus si on annule', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2027, 0, 10));
    const apres = migrateUserData(base());
    expect(apres.reliquatCET).toMatchObject({ annee: 2026, artt: 6 });

    const plan = planEpargneCET(apres, new Date(2027, 0, 10));
    expect(plan.apport).toMatchObject({ artt: 6, total: 6 });

    store.set(STORAGE_KEY, JSON.stringify({ ...apres, schemaVersion: 99 }));
    const { result } = renderHook(() => useCounters());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => { expect(result.current.enregistrerEpargneCET().success).toBe(true); });
    let d = JSON.parse(store.get(STORAGE_KEY)!) as UserData;
    expect(d.counters.cet).toBe(26);
    const entry = d.history.find((e) => e.action === 'transfer_cet')!;
    expect(entry.cetDetail).toMatchObject({ artt: 6 });
    expect(entry.description).toMatch(/6j d'ARTT/);

    act(() => { result.current.deleteHistoryEntry(entry.id); });
    d = JSON.parse(store.get(STORAGE_KEY)!) as UserData;
    expect(d.counters.cet).toBe(20);
    expect(d.reliquatCET).toMatchObject({ annee: 2026, artt: 6 });
  });
});
