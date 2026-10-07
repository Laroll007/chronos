import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { STORAGE_KEY } from '../constants';
import { DEFAULT_COUNTERS, DEFAULT_CYCLE_CONFIG, migrateUserData } from '../storage';
import { planEpargneCET } from '../cet';
import type { HistoryEntry, UserData } from '../types';

vi.mock('../analytics', () => ({ track: vi.fn(), trackError: vi.fn() }));
import { useCounters } from '@/hooks/useCounters';

const h = (hh: number, mm = 0) => hh * 60 + mm;

/** 15 CA posés en 2026 : seuil de 4/5 × 18 atteint. */
const posesCA2026: HistoryEntry[] = [
  { id: 'p', date: new Date(2026, 5, 10).toISOString(), action: 'pose', type: 'ca', amount: 15, countersSnapshot: {} },
];

function data(over: Partial<UserData> = {}, counters: Partial<UserData['counters']> = {}): UserData {
  return {
    cycleConfig: DEFAULT_CYCLE_CONFIG,
    counters: { ...DEFAULT_COUNTERS, cet: 4, ...counters },
    history: posesCA2026,
    lastUpdated: new Date().toISOString(),
    lastResetYear: 2027,
    isOnboarded: true,
    ...over,
  };
}

describe('Plan d’épargne CET', () => {
  it('hors janvier : estimation sur les soldes actuels (RTC d’abord)', () => {
    // CET de 20 j : il ne peut garder que 10 j de plus
    const plan = planEpargneCET(data({ lastResetYear: 2026 }, { rtc: h(175, 1), cet: 20 }), new Date(2026, 8, 15));
    expect(plan.mode).toBe('estimation');
    expect(plan.anneeVersement).toBe(2027);
    expect(plan.capacite).toBe(10);
    expect(plan.apport).toMatchObject({ rtc: 10, total: 10 });
    expect(plan.rtcMinutes).toBe(h(83, 30));
    // Tous les RTC peuvent partir (175h01 / 8h21 = 20 j) : le surplus est indemnisé
    expect(plan.maximum.rtc).toBe(20);
    expect(plan.indemnises).toBe(plan.maximum.total - 10);
  });

  it('retour collègue 3/3 : 188h09 de RTC = 22 j ; à l’ouverture tout reste, ensuite 10 gardés et 12 payés', () => {
    const rtc = h(188, 9);
    const ouverture = planEpargneCET(data({ lastResetYear: 2026 }, { rtc, cet: 0, ca: 0, caHP: 0 }), new Date(2026, 8, 15));
    expect(ouverture.maximum.rtc).toBe(22);
    expect(ouverture.apport.rtc).toBe(22);
    expect(ouverture.indemnises).toBe(0);
    const ensuite = planEpargneCET(data({ lastResetYear: 2026 }, { rtc, cet: 22, ca: 0, caHP: 0 }), new Date(2026, 8, 15));
    expect(ensuite.apport.rtc).toBe(10);
    expect(ensuite.indemnises).toBe(12);
  });

  it('CET gelé au-delà de 60 jours : aucun versement', () => {
    const plan = planEpargneCET(data({ lastResetYear: 2026 }, { rtc: h(100), cet: 72 }), new Date(2026, 8, 15));
    expect(plan.capacite).toBe(0);
    expect(plan.maximum.total).toBe(0);
  });

  it('janvier : porte sur les reliquats de l’année écoulée, jamais sur la nouvelle dotation', () => {
    const d = data(
      { reliquatCET: { annee: 2026, rtc: h(20), caReserves: 0 } }, // 20h de RTC restantes → 2 j
      { rtc: h(175, 1), ca: 18, caAnterieur: 3, caHPAnterieur: 2 }
    );
    const plan = planEpargneCET(d, new Date(2027, 0, 15));
    expect(plan.mode).toBe('janvier');
    expect(plan.anneeConges).toBe(2026);
    // 2 j de RTC (reliquat) + 2 CA HP antérieurs + 3 CA antérieurs — pas les 18 CA de 2027
    expect(plan.apport).toMatchObject({ rtc: 2, caHP: 2, ca: 3, hs: 0, total: 7 });
  });

  it('janvier : sans 15 CA pris en 2026, ni CA ni CA HP', () => {
    const d = data(
      { history: [], reliquatCET: { annee: 2026, rtc: h(20), caReserves: 0 } },
      { caAnterieur: 3, caHPAnterieur: 2 }
    );
    const plan = planEpargneCET(d, new Date(2027, 0, 15));
    expect(plan.conditionCA).toMatchObject({ ok: false, poses: 0, seuil: 15 });
    expect(plan.apport).toMatchObject({ rtc: 2, ca: 0, caHP: 0, total: 2 });
  });

  it('CET au-delà du plafond (relèvement JO) : aucun versement, jamais de valeur négative', () => {
    const plan = planEpargneCET(data({}, { cet: 72, rtc: h(175) }), new Date(2026, 8, 15));
    expect(plan.capacite).toBe(0);
    expect(plan.apport).toMatchObject({ rtc: 0, ca: 0, caHP: 0, hs: 0, total: 0 });
    const janvier = planEpargneCET(
      data({ reliquatCET: { annee: 2026, rtc: h(40), caReserves: 0 } }, { cet: 72, caAnterieur: 3 }),
      new Date(2027, 0, 15)
    );
    expect(janvier.apport.total).toBe(0);
  });

  it('CET au plafond : plus rien à verser', () => {
    const plan = planEpargneCET(data({}, { cet: 60, rtc: h(175) }), new Date(2026, 8, 15));
    expect(plan.capacite).toBe(0);
    expect(plan.apport.total).toBe(0);
  });
});

describe('Bascule de janvier : relevé des reliquats pour le CET', () => {
  afterEach(() => vi.useRealTimers());

  it('mémorise les RTC restants et les CA sécurisés avant de les remplacer', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2027, 0, 3));
    const d = data({ lastResetYear: 2026 }, { rtc: h(40), caReservesCET: 2, ca: 4 });
    const out = migrateUserData(d);
    expect(out.reliquatCET).toEqual({ annee: 2026, rtc: h(40), artt: 0, rtt: 0, caReserves: 2 });
    expect(out.counters.caAnterieur).toBe(4);
    expect(out.counters.rtc).not.toBe(h(40)); // nouvelle dotation
  });

  it('après plusieurs années sans ouvrir l’app, pas de relevé', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2027, 0, 3));
    const out = migrateUserData(data({ lastResetYear: 2024 }, { rtc: h(40) }));
    expect(out.reliquatCET).toBeUndefined();
  });
});

describe('Enregistrement du versement (janvier)', () => {
  let store: Map<string, string>;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2027, 0, 15));
    store = new Map();
    vi.mocked(localStorage.getItem).mockImplementation((k) => store.get(k) ?? null);
    vi.mocked(localStorage.setItem).mockImplementation((k, v) => void store.set(k, String(v)));
    vi.mocked(localStorage.removeItem).mockImplementation((k) => void store.delete(k));
    store.set(
      STORAGE_KEY,
      JSON.stringify(
        data(
          { reliquatCET: { annee: 2026, rtc: h(20), caReserves: 0 }, schemaVersion: 99 },
          { rtc: h(175, 1), ca: 18, caAnterieur: 3, caHPAnterieur: 2, hs: h(10), rpsDernierCredit: '2027-01-15' }
        )
      )
    );
  });
  afterEach(() => vi.useRealTimers());

  const stored = () => JSON.parse(store.get(STORAGE_KEY)!) as UserData;

  it('verse toutes les sources, puis l’annulation remet chaque jour à sa place', async () => {
    const { result } = renderHook(() => useCounters());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => { expect(result.current.enregistrerEpargneCET().success).toBe(true); });
    let d = stored();
    // 2 RTC + 2 CA HP + 3 CA + 1 HS (10h → 1 j à 8h21) = 8 j
    expect(d.counters.cet).toBe(4 + 8);
    expect(d.counters).toMatchObject({ caAnterieur: 0, caHPAnterieur: 0, ca: 18, hs: h(10) - h(8, 21) });
    expect(d.reliquatCET).toBeUndefined();
    const entry = d.history.find((e) => e.action === 'transfer_cet')!;
    expect(entry.cetDetail).toEqual({ rtc: 2, caHP: 2, ca: 3, hs: 1 });

    act(() => { result.current.deleteHistoryEntry(entry.id); });
    d = stored();
    expect(d.counters).toMatchObject({ cet: 4, caAnterieur: 3, caHPAnterieur: 2, ca: 18, hs: h(10) });
    expect(d.reliquatCET).toEqual({ annee: 2026, rtc: 2 * h(8, 21), artt: 0, rtt: 0, caReserves: 0 });
  });

  it('versement maximal : le surplus indemnisé sort du CET, et l’annulation le rend', async () => {
    // CET à 22 j (> 15) : il ne garde que 10 j de plus. Reliquat de 188h09 = 22 j de RTC.
    const d0 = stored();
    d0.counters.cet = 22;
    d0.counters.caAnterieur = 0;
    d0.counters.caHPAnterieur = 0;
    d0.counters.hs = 0;
    d0.reliquatCET = { annee: 2026, rtc: h(188, 9), caReserves: 0 };
    store.set(STORAGE_KEY, JSON.stringify(d0));
    const { result } = renderHook(() => useCounters());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => { expect(result.current.enregistrerEpargneCET(true).success).toBe(true); });
    let d = stored();
    expect(d.counters.cet).toBe(32); // 22 + 10 gardés ; 12 indemnisés
    const entry = d.history.find((e) => e.action === 'transfer_cet')!;
    expect(entry.amount).toBe(22);
    expect(entry.cetDetail).toEqual({ rtc: 22, caHP: 0, ca: 0, hs: 0, indemnises: 12 });

    act(() => { result.current.deleteHistoryEntry(entry.id); });
    d = stored();
    expect(d.counters.cet).toBe(22);
    expect(d.reliquatCET?.rtc).toBe(22 * h(8, 21));
  });
});
