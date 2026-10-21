// Congé d'une année déjà basculée : le supprimer en 2027 ne rend rien aux
// compteurs 2027 (ceux de 2026 ont été remplacés par la dotation au 1er janvier).
// Avant la correction : supprimer 2 RTC du 10/12/2026 en février 2027 ajoutait
// 24h16 de RTC qui n'existent pas dans GesTT.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { STORAGE_KEY } from '../constants';
import { DEFAULT_COUNTERS, DEFAULT_CYCLE_CONFIG } from '../storage';
import { anneeDebitee, poseDUneAnneeClose } from '../previsionnel';
import type { HistoryEntry, UserData } from '../types';

vi.mock('../analytics', () => ({ track: vi.fn(), trackError: vi.fn() }));
const { useCounters } = await import('@/hooks/useCounters');

const h = (a: number, b = 0) => a * 60 + b;
const pose = (date: string, o: Partial<HistoryEntry> = {}): HistoryEntry => ({
  id: `p-${date}-${o.creeLe ?? ''}`, date: new Date(`${date}T08:00:00`).toISOString(), action: 'pose',
  type: 'rtc', amount: h(24, 16), countersSnapshot: {}, ...o,
});

describe('Année débitée par une pose', () => {
  it('date d’enregistrement si connue, sinon année du congé ; rien pour un congé antérieur ou un différé non appliqué', () => {
    expect(anneeDebitee(pose('2026-12-10'))).toBe(2026);
    expect(anneeDebitee(pose('2026-12-28', { creeLe: '2027-01-05' }))).toBe(2027); // posé après la bascule
    expect(anneeDebitee(pose('2026-12-10', { decompte: 'anterieur' }))).toBeNull();
    expect(anneeDebitee(pose('2027-02-01', { decompte: 'differe', anneeDecompte: 2027 }))).toBeNull();
    expect(anneeDebitee(pose('2027-02-01', { decompte: 'differe', anneeDecompte: 2027, decompteApplique: true }))).toBe(2027);
    expect(anneeDebitee({ ...pose('2026-12-10'), action: 'cmo' })).toBeNull();
  });

  it('année close = antérieure à l’année des compteurs', () => {
    expect(poseDUneAnneeClose(pose('2026-12-10'), 2027)).toBe(true);
    expect(poseDUneAnneeClose(pose('2026-12-10'), 2026)).toBe(false);
    expect(poseDUneAnneeClose(pose('2026-12-28', { creeLe: '2027-01-05' }), 2027)).toBe(false);
  });
});

describe('Supprimer un congé après la bascule', () => {
  let store: Map<string, string>;
  const RTC_2027 = h(188, 9);
  beforeEach(() => {
    store = new Map();
    vi.mocked(localStorage.getItem).mockImplementation((k) => store.get(k) ?? null);
    vi.mocked(localStorage.setItem).mockImplementation((k, v) => void store.set(k, String(v)));
    vi.mocked(localStorage.removeItem).mockImplementation((k) => void store.delete(k));
  });
  function charger(history: HistoryEntry[]) {
    const data: UserData = {
      cycleConfig: DEFAULT_CYCLE_CONFIG,
      counters: { ...DEFAULT_COUNTERS, rtc: RTC_2027, hasRTC: true, rpsDernierCredit: '2099-01-01' },
      history, lastUpdated: new Date().toISOString(), lastResetYear: 2027, schemaVersion: 99, isOnboarded: true,
    };
    store.set(STORAGE_KEY, JSON.stringify(data));
  }
  const stored = () => JSON.parse(store.get(STORAGE_KEY)!) as UserData;

  it('congé de 2026 supprimé en 2027 : RTC 2027 inchangés, congé retiré', async () => {
    const vieux = pose('2026-12-10');
    charger([vieux]);
    const { result } = renderHook(() => useCounters());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => { result.current.deleteHistoryEntry(vieux.id); });
    expect(stored().counters.rtc).toBe(RTC_2027);
    expect(stored().history).toEqual([]);
  });

  it('congé de 2027 supprimé : les heures sont bien rendues', async () => {
    const recent = pose('2027-02-10', { creeLe: '2027-01-20' });
    charger([recent]);
    const { result } = renderHook(() => useCounters());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => { result.current.deleteHistoryEntry(recent.id); });
    expect(stored().counters.rtc).toBe(RTC_2027 + h(24, 16));
  });

  it('congé daté de 2026 mais posé après la bascule (décompté sur 2027) : rendu sur 2027', async () => {
    const retro = pose('2026-12-28', { creeLe: '2027-01-05' });
    charger([retro]);
    const { result } = renderHook(() => useCounters());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => { result.current.deleteHistoryEntry(retro.id); });
    expect(stored().counters.rtc).toBe(RTC_2027 + h(24, 16));
  });

  it('une nouvelle pose garde sa date d’enregistrement', async () => {
    charger([]);
    const { result } = renderHook(() => useCounters());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const jour = new Date(2027, 2, 3);
    act(() => { result.current.poseConge('rtc', h(12, 8), jour, jour); });
    expect(stored().history[0]?.creeLe).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
