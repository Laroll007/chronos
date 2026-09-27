import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { STORAGE_KEY } from '../constants';
import { DEFAULT_COUNTERS, DEFAULT_CYCLE_CONFIG, ONBOARDING_DRAFT_KEY, resetAllData } from '../storage';
import type { UserData } from '../types';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace: vi.fn() }) }));
const track = vi.fn();
vi.mock('../analytics', () => ({ track: (e: string) => track(e), trackError: vi.fn() }));

import { useCounters } from '@/hooks/useCounters';
import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard';
import { EMPTY_COUNTERS } from '@/components/onboarding/CountersSetup';

let store: Map<string, string>;

beforeEach(() => {
  // vitest.setup.ts remplace localStorage par des vi.fn() inertes.
  store = new Map();
  vi.mocked(localStorage.getItem).mockImplementation((k) => store.get(k) ?? null);
  vi.mocked(localStorage.setItem).mockImplementation((k, v) => void store.set(k, String(v)));
  vi.mocked(localStorage.removeItem).mockImplementation((k) => void store.delete(k));
  push.mockClear();
  track.mockClear();
});

function stored(): UserData {
  return JSON.parse(store.get(STORAGE_KEY)!);
}

function seedPending() {
  const data: UserData = {
    cycleConfig: DEFAULT_CYCLE_CONFIG,
    counters: EMPTY_COUNTERS,
    history: [],
    lastUpdated: new Date().toISOString(),
    lastResetYear: new Date().getFullYear(),
    compteursARenseigner: true,
    isOnboarded: true,
  };
  store.set(STORAGE_KEY, JSON.stringify(data));
}

describe('onboarding : compteurs remis à plus tard', () => {
  it('« Je n’ai pas mes compteurs » termine l’onboarding avec des compteurs vides à renseigner', async () => {
    store.set(ONBOARDING_DRAFT_KEY, JSON.stringify({ cycleConfig: DEFAULT_CYCLE_CONFIG }));
    render(<OnboardingWizard />);

    // Brouillon retrouvé : on reprend directement à l'étape compteurs.
    fireEvent.click(await screen.findByText("Je n'ai pas mes compteurs sous la main"));

    const data = stored();
    expect(data.isOnboarded).toBe(true);
    expect(data.compteursARenseigner).toBe(true);
    expect(data.counters).toMatchObject({ ca: 0, cf: 0, hasCF: false, rtc: 0, hasRTC: false });
    expect(store.has(ONBOARDING_DRAFT_KEY)).toBe(false);
    expect(push).toHaveBeenCalledWith('/dashboard');
    expect(track).toHaveBeenCalledWith('onboarding_resume');
    expect(track).toHaveBeenCalledWith('onboarding_skip_counters');
    expect(track).not.toHaveBeenCalledWith('onboarding_done');
  });

  it('sans brouillon, l’onboarding démarre au choix du cycle', () => {
    render(<OnboardingWizard />);
    expect(screen.queryByText("Je n'ai pas mes compteurs sous la main")).toBeNull();
    expect(track).not.toHaveBeenCalledWith('onboarding_resume');
  });

  it('la saisie des compteurs en cours est sauvegardée dans le brouillon', async () => {
    store.set(ONBOARDING_DRAFT_KEY, JSON.stringify({ cycleConfig: DEFAULT_CYCLE_CONFIG }));
    render(<OnboardingWizard />);
    fireEvent.click(await screen.findByText('Suivant'));
    await waitFor(() => expect(JSON.parse(store.get(ONBOARDING_DRAFT_KEY)!).subStep).toBe('selection'));
  });
});

describe('useCounters : rappel des compteurs', () => {
  it('compléter les compteurs retire le rappel et recalcule l’objectif CET', async () => {
    seedPending();
    const { result } = renderHook(() => useCounters());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.compteursARenseigner).toBe(true);

    act(() => {
      result.current.completerCompteurs({ ...DEFAULT_COUNTERS, ca: 12, cet: 20 });
    });

    expect(result.current.compteursARenseigner).toBe(false);
    const data = stored();
    expect(data.compteursARenseigner).toBeUndefined();
    expect(data.counters.ca).toBe(12);
    expect(data.counters.objectifCET).toBeGreaterThan(20);
    expect(track).toHaveBeenCalledWith('counters_completed_later');
  });

  it('masquer le rappel conserve les compteurs', async () => {
    seedPending();
    const { result } = renderHook(() => useCounters());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.masquerRappelCompteurs());

    expect(result.current.compteursARenseigner).toBe(false);
    expect(stored().counters.ca).toBe(0);
    expect(track).toHaveBeenCalledWith('counters_reminder_dismissed');
  });

  it('un utilisateur existant (champ absent) n’a pas de rappel', async () => {
    seedPending();
    const data = stored();
    delete data.compteursARenseigner;
    store.set(STORAGE_KEY, JSON.stringify(data));
    const { result } = renderHook(() => useCounters());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.compteursARenseigner).toBe(false);
  });
});

it('réinitialiser l’app efface aussi le brouillon d’onboarding', () => {
  store.set(ONBOARDING_DRAFT_KEY, '{}');
  resetAllData();
  expect(store.has(ONBOARDING_DRAFT_KEY)).toBe(false);
});
