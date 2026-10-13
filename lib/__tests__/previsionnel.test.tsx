// Congés non décomptés (antérieurs, année suivante) et congés du plan
// prévisionnel.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, cleanup, render, renderHook, screen, waitFor } from '@testing-library/react';
import { STORAGE_KEY } from '../constants';
import { DEFAULT_COUNTERS, DEFAULT_CYCLE_CONFIG, migrateUserData } from '../storage';
import { anterieurParDefaut, estPrevisionnelLe, periodeACheval, periodeAnneeSuivante, periodeAnterieure, posesDifferees } from '../previsionnel';
import type { HistoryEntry, UserData } from '../types';
import { countWorkingDays } from '../calculations';

vi.mock('../analytics', () => ({ track: vi.fn(), trackError: vi.fn() }));
import { useCounters } from '@/hooks/useCounters';
import { OptimizationModal } from '@/components/dashboard/OptimizationModal';

const j = (a: number, m: number, d: number) => new Date(a, m - 1, d);

function data(over: Partial<UserData> = {}, counters: Partial<UserData['counters']> = {}): UserData {
  return {
    cycleConfig: DEFAULT_CYCLE_CONFIG,
    counters: { ...DEFAULT_COUNTERS, ca: 10, caHP: 0, caPosesHorsPeriode: 0, ...counters },
    history: [],
    lastUpdated: new Date().toISOString(),
    lastResetYear: 2026,
    schemaVersion: 99,
    isOnboarded: true,
    ...over,
  };
}

describe('Périodes', () => {
  const auj = j(2026, 10, 13);
  it('antérieure, année suivante, à cheval', () => {
    expect(periodeAnterieure(j(2026, 3, 2), j(2026, 3, 6), auj)).toBe(true);
    expect(periodeAnterieure(j(2026, 10, 12), j(2026, 10, 13), auj)).toBe(false);
    expect(periodeAnneeSuivante(j(2027, 2, 15), j(2027, 2, 19), auj)).toBe(true);
    expect(periodeACheval(j(2026, 12, 28), j(2027, 1, 3), auj)).toBe(true);
    expect(periodeACheval(j(2026, 10, 10), j(2026, 10, 15), auj)).toBe(true);
    expect(periodeACheval(j(2026, 11, 2), j(2026, 11, 6), auj)).toBe(false);
  });

  it('« congés antérieurs » cochés d’office le premier mois, avant l’inscription', () => {
    expect(anterieurParDefaut('2026-10-01', j(2026, 9, 10), auj)).toBe(true);
    expect(anterieurParDefaut('2026-10-01', j(2026, 10, 5), auj)).toBe(false); // après l'inscription
    expect(anterieurParDefaut('2026-08-01', j(2026, 7, 10), auj)).toBe(false); // plus d'un mois après
    expect(anterieurParDefaut(undefined, j(2026, 9, 10), auj)).toBe(false);
  });
});

describe('Bascule au 1er janvier : déduction des congés posés pour l’année', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(j(2027, 1, 2));
  });
  afterEach(() => vi.useRealTimers());

  it('les CA de février 2027 sont déduits des 18 CA de 2027 (et comptent pour le CA HP)', () => {
    const debut = j(2027, 2, 1);
    const fin = j(2027, 2, 12);
    const n = countWorkingDays(debut, fin, DEFAULT_CYCLE_CONFIG); // jours travaillés réellement posés
    const differe: HistoryEntry = {
      id: 'd', date: debut.toISOString(), dateEnd: fin.toISOString(),
      action: 'pose', type: 'ca', amount: n, countersSnapshot: {}, decompte: 'differe', anneeDecompte: 2027, previsionnel: true,
    };
    const out = migrateUserData(data({ history: [differe] }));
    expect(n).toBeGreaterThanOrEqual(5);
    expect(out.counters.ca).toBe(18 - n);
    expect(out.counters.caPosesHorsPeriode).toBe(n);
    expect(out.counters.caHP).toBe(n >= 8 ? 2 : 1); // 1er jour de CA HP dès 5 CA hors période
    expect(out.history[0]!.decompteApplique).toBe(true);
    expect(posesDifferees(out.history, 2027)).toEqual({});
  });
});

describe('useCounters : poses sans décompte et plan prévisionnel', () => {
  let store: Map<string, string>;
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(j(2026, 10, 13));
    store = new Map();
    vi.mocked(localStorage.getItem).mockImplementation((k) => store.get(k) ?? null);
    vi.mocked(localStorage.setItem).mockImplementation((k, v) => void store.set(k, String(v)));
    vi.mocked(localStorage.removeItem).mockImplementation((k) => void store.delete(k));
    store.set(STORAGE_KEY, JSON.stringify(data()));
  });
  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });
  const stored = () => JSON.parse(store.get(STORAGE_KEY)!) as UserData;

  it('année suivante : rien n’est décompté maintenant, annulation sans effet sur les compteurs', async () => {
    const { result } = renderHook(() => useCounters());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    let id: string | undefined;
    act(() => {
      const r = result.current.poseConge('ca', 5, j(2027, 2, 15), j(2027, 2, 19), undefined, undefined, { decompte: 'differe', previsionnel: true });
      expect(r.success).toBe(true);
      id = r.entryId;
    });
    expect(stored().counters.ca).toBe(10);
    const e = stored().history[0]!;
    expect(e).toMatchObject({ decompte: 'differe', anneeDecompte: 2027, previsionnel: true });
    expect(estPrevisionnelLe(j(2027, 2, 17), stored().history)).toBe(true);
    expect(posesDifferees(stored().history, 2027)).toEqual({ ca: 5 });

    act(() => { result.current.deleteHistoryEntry(id!); });
    expect(stored().counters.ca).toBe(10);
    expect(stored().history).toHaveLength(0);
  });

  it('année suivante : refusée au-delà des droits de l’année (18 CA)', async () => {
    const { result } = renderHook(() => useCounters());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => {
      const r = result.current.poseConge('ca', 19, j(2027, 3, 1), j(2027, 3, 31), undefined, undefined, { decompte: 'differe' });
      expect(r.success).toBe(false);
    });
  });

  it('congés antérieurs : enregistrés sans toucher aux compteurs, même sans solde', async () => {
    store.set(STORAGE_KEY, JSON.stringify(data({}, { ca: 0 })));
    const { result } = renderHook(() => useCounters());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => {
      const r = result.current.poseConge('ca', 4, j(2026, 3, 2), j(2026, 3, 5), undefined, undefined, { decompte: 'anterieur' });
      expect(r.success).toBe(true);
    });
    expect(stored().counters.ca).toBe(0);
    expect(stored().history[0]!.decompte).toBe('anterieur');
  });

  it('pose normale marquée puis démarquée comme prévisionnelle', async () => {
    const { result } = renderHook(() => useCounters());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    let id = '';
    act(() => { id = result.current.poseConge('ca', 2, j(2026, 11, 2), j(2026, 11, 3)).entryId!; });
    expect(stored().counters.ca).toBe(8);
    act(() => { result.current.marquerPrevisionnel([id], true); });
    expect(stored().history[0]!.previsionnel).toBe(true);
    act(() => { result.current.marquerPrevisionnel([id], false); });
    expect(stored().history[0]!.previsionnel).toBeUndefined();
  });
});

describe('Fenêtre de pose : les cases selon les dates', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(j(2026, 10, 13));
  });
  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });
  const ouvrir = (debut: Date, fin: Date, dateInscription?: string) => {
    const c = { ...DEFAULT_COUNTERS, ca: 10 };
    render(
      <OptimizationModal
        isOpen
        onClose={vi.fn()}
        startDate={debut}
        endDate={fin}
        workingDaysCount={3}
        counters={c}
        compteursSansDecompte={{ anterieur: c, anneeSuivante: c }}
        dateInscription={dateInscription}
        onApply={vi.fn()}
      />
    );
  };
  const caseAvec = (texte: RegExp) => screen.getByText(texte).closest('label')!.querySelector('input') as HTMLInputElement;

  it('année suivante : « prévisionnel de l’année prochaine » cochée d’office', () => {
    ouvrir(j(2027, 2, 15), j(2027, 2, 19));
    expect(caseAvec(/Congé prévisionnel/).checked).toBe(false);
    expect(caseAvec(/prévisionnel de l’année prochaine/).checked).toBe(true);
  });

  it('passé : « congés antérieurs » décochée, sauf le premier mois avant l’inscription', () => {
    ouvrir(j(2026, 3, 2), j(2026, 3, 6));
    expect(caseAvec(/ce sont des congés antérieurs/).checked).toBe(false);
    cleanup();
    ouvrir(j(2026, 9, 7), j(2026, 9, 9), '2026-10-01');
    expect(caseAvec(/ce sont des congés antérieurs/).checked).toBe(true);
  });

  it('période à venir cette année : seulement la case « prévisionnel »', () => {
    ouvrir(j(2026, 11, 2), j(2026, 11, 6));
    expect(screen.getByText(/Congé prévisionnel/)).toBeTruthy();
    expect(screen.queryByText(/congés antérieurs/)).toBeNull();
    expect(screen.queryByText(/année prochaine/)).toBeNull();
  });
});
