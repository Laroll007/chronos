// Élus (conseillers municipaux…) : AME, CME (crédit d'heures trimestriel non
// reportable), formation ; absences en heures qui laissent le jour travaillé.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { creditCME, trimestreDe } from '../creditCME';
import { hasAbsenceOnDate, hasAbsencePartielleOnDate } from '../calculations';
import { etiquetteDuJour } from '../typesConges';
import { MOTIFS_ABSENCE, ORDRE_MOTIFS } from '../absences';
import { DEFAULT_COUNTERS, DEFAULT_CYCLE_CONFIG } from '../storage';
import { STORAGE_KEY } from '../constants';
import type { HistoryEntry, UserData } from '../types';

vi.mock('../analytics', () => ({ track: vi.fn(), trackError: vi.fn() }));
const { useCounters } = await import('@/hooks/useCounters');

const h = (a: number, b = 0) => a * 60 + b;
const cme = (jour: Date, minutes: number, extra: Partial<HistoryEntry> = {}): HistoryEntry =>
  ({ id: `c${jour.getTime()}`, date: jour.toISOString(), action: 'absence', type: 'absence', amount: minutes, partialDay: true, minutes, motif: 'elu_cme', countersSnapshot: {}, ...extra }) as HistoryEntry;

describe('Motifs des élus', () => {
  it('AME, CME et formation (FHP) proposés avec leur code GesTT', () => {
    expect(ORDRE_MOTIFS).toEqual(expect.arrayContaining(['elu_ame', 'elu_cme', 'elu_formation']));
    expect([MOTIFS_ABSENCE.elu_ame.code, MOTIFS_ABSENCE.elu_cme.code, MOTIFS_ABSENCE.elu_formation.code]).toEqual(['AME', 'CME', 'FHP']);
  });
});

describe('Crédit d’heures CME', () => {
  it('trimestres civils', () => {
    expect(trimestreDe(new Date(2026, 10, 3))).toEqual({ debut: new Date(2026, 9, 1), fin: new Date(2026, 11, 31) });
    expect(trimestreDe(new Date(2026, 1, 15)).fin).toEqual(new Date(2026, 2, 31));
  });

  it('utilisé = CME du trimestre en cours ; remis à zéro au trimestre suivant, sans report', () => {
    const c = { ...DEFAULT_COUNTERS, cmeTrimestre: h(35) };
    const history = [cme(new Date(2026, 9, 6), h(3)), cme(new Date(2026, 10, 12), h(7)), cme(new Date(2026, 8, 30), h(10))];
    expect(creditCME(c, history, new Date(2026, 10, 20))).toMatchObject({ dotation: h(35), utilise: h(10), reste: h(25) });
    expect(creditCME(c, history, new Date(2027, 0, 5))).toMatchObject({ utilise: 0, reste: h(35) });
    expect(creditCME(DEFAULT_COUNTERS, history)).toBeNull(); // non renseigné : pas de suivi
  });
});

describe('Absence en heures', () => {
  const jour = new Date(2026, 9, 6);
  const history = [cme(jour, h(3))];

  it('le jour reste travaillé ; étiquette « CME 3h » sur le planning', () => {
    expect(hasAbsenceOnDate(jour, history)).toBe(false);
    expect(hasAbsencePartielleOnDate(jour, history)).toBe(true);
    expect(etiquetteDuJour(jour, history)?.texte).toBe('CME 3h');
  });
});

describe('Enregistrement (hook)', () => {
  let store: Map<string, string>;
  beforeEach(() => {
    store = new Map();
    vi.mocked(localStorage.getItem).mockImplementation((k) => store.get(k) ?? null);
    vi.mocked(localStorage.setItem).mockImplementation((k, v) => void store.set(k, String(v)));
    const data: UserData = {
      cycleConfig: { ...DEFAULT_CYCLE_CONFIG, heuresParJour: h(12, 8) }, counters: { ...DEFAULT_COUNTERS, cmeTrimestre: h(35) }, history: [],
      lastUpdated: new Date().toISOString(), lastResetYear: new Date().getFullYear(), schemaVersion: 99, isOnboarded: true,
    } as UserData;
    store.set(STORAGE_KEY, JSON.stringify(data));
  });
  const stored = () => JSON.parse(store.get(STORAGE_KEY)!) as UserData;

  it('CME en heures : 3h décomptées ; CME sur une journée entière : la durée de la vacation', async () => {
    const { result } = renderHook(() => useCounters());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => { result.current.poseAbsence('elu_cme', new Date(2026, 9, 6), undefined, h(3)); });
    expect(stored().history[0]).toMatchObject({ motif: 'elu_cme', partialDay: true, amount: h(3), minutes: h(3) });

    // Premier jour travaillé d'octobre dans ce cycle
    const { isWorkingDay } = await import('../calculations');
    const d = new Date(2026, 9, 1);
    while (!isWorkingDay(d, stored().cycleConfig)) d.setDate(d.getDate() + 1);
    act(() => { result.current.poseAbsence('elu_cme', new Date(d), undefined); });
    expect(stored().history[1]).toMatchObject({ motif: 'elu_cme', minutes: h(12, 8) });
    expect(stored().history[1]!.partialDay).toBeUndefined();
  });
});
