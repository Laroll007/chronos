// Réponse à « Vos CA sont-ils reportés ? » après la bascule (congé maternité,
// arrêt maladie, congé familial) : oui → CAM jusqu'au 31 mars de N+2.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { STORAGE_KEY } from '../constants';
import { DEFAULT_COUNTERS, DEFAULT_CYCLE_CONFIG } from '../storage';
import type { UserData } from '../types';

vi.mock('../analytics', () => ({ track: vi.fn(), trackError: vi.fn() }));
const { useCounters } = await import('@/hooks/useCounters');

let store: Map<string, string>;
beforeEach(() => {
  store = new Map();
  vi.mocked(localStorage.getItem).mockImplementation((k) => store.get(k) ?? null);
  vi.mocked(localStorage.setItem).mockImplementation((k, v) => void store.set(k, String(v)));
  vi.mocked(localStorage.removeItem).mockImplementation((k) => void store.delete(k));
  const data: UserData = {
    cycleConfig: DEFAULT_CYCLE_CONFIG,
    counters: { ...DEFAULT_COUNTERS, ca: 18, caAnterieur: 8, rpsDernierCredit: '2099-01-01' },
    history: [], lastUpdated: new Date().toISOString(), lastResetYear: new Date().getFullYear(),
    schemaVersion: 99, isOnboarded: true,
    reportCAM: { annee: 2026, jours: 8 },
  };
  store.set(STORAGE_KEY, JSON.stringify(data));
});
const stored = () => JSON.parse(store.get(STORAGE_KEY)!) as UserData;

describe('Report en CAM après la bascule', () => {
  it('« Oui, ce sont des CAM » : les CA antérieurs deviennent des CA reportés jusqu’au 31 mars de N+2', async () => {
    const { result } = renderHook(() => useCounters());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => { result.current.repondreReportCAM(true); });
    expect(stored().counters).toMatchObject({ caAnterieur: 0, caReporte: 8, caReporteLimite: '2028-03-31' });
    expect(stored().reportCAM).toBeUndefined();
  });

  it('« Non » : rien ne change, la question n’est plus posée', async () => {
    const { result } = renderHook(() => useCounters());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => { result.current.repondreReportCAM(false); });
    expect(stored().counters.caAnterieur).toBe(8);
    expect(stored().counters.caReporte).toBeUndefined();
    expect(stored().reportCAM).toBeUndefined();
  });
});
