import { describe, it, expect, vi, afterEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { CycleSetup } from '@/components/onboarding/CycleSetup';
import { DEFAULT_CYCLE_CONFIG } from '../storage';
import { clearCalculationCaches, getRTCAnnuel, isWorkingDay, getCATotalForCycle } from '../calculations';
import { natureDuJour } from '../journees';
import type { CycleConfig } from '../types';

const cfg33: CycleConfig = { ...DEFAULT_CYCLE_CONFIG, type: 'alterne', pattern: '3/3', dateDebutCycle: '2026-10-05' };
const d = (iso: string) => {
  const [a, m, j] = iso.split('-').map(Number);
  return new Date(a, m - 1, j);
};

describe('Cycle 3/3 : rotation continue', () => {
  afterEach(() => clearCalculationCaches());

  it('3 jours travaillés, 3 de repos, indépendamment des semaines', () => {
    const jours = Array.from({ length: 12 }, (_, i) => isWorkingDay(new Date(2026, 9, 5 + i), cfg33));
    expect(jours).toEqual([true, true, true, false, false, false, true, true, true, false, false, false]);
  });

  it('fonctionne aussi avant la date de référence', () => {
    expect(isWorkingDay(d('2026-10-04'), cfg33)).toBe(false); // veille : 3e repos
    expect(isWorkingDay(d('2026-10-02'), cfg33)).toBe(false); // 1er repos
    expect(isWorkingDay(d('2026-10-01'), cfg33)).toBe(true); // 3e jour de la série précédente
    expect(isWorkingDay(d('2026-09-29'), cfg33)).toBe(true); // 1er jour
    expect(isWorkingDay(d('2026-09-28'), cfg33)).toBe(false);
    expect(isWorkingDay(d('2025-03-01'), cfg33)).toBe(isWorkingDay(d('2025-03-07'), cfg33)); // période 6 j
  });

  it('RC puis RL : le dernier repos avant la reprise est le repos légal', () => {
    expect(natureDuJour(d('2026-10-08'), cfg33)).toBe('RC');
    expect(natureDuJour(d('2026-10-09'), cfg33)).toBe('RC');
    expect(natureDuJour(d('2026-10-10'), cfg33)).toBe('RL');
    expect(natureDuJour(d('2026-10-11'), cfg33)).toBe('travail');
  });

  it('le cache distingue un 2/2/3/2/2/3 et un 3/3 de même date de référence', () => {
    const cfg2223: CycleConfig = { ...cfg33, pattern: '2/2/3/2/2/3' };
    const jour = d('2026-10-08');
    const a = isWorkingDay(jour, cfg2223);
    expect(isWorkingDay(jour, cfg33)).toBe(false);
    expect(isWorkingDay(jour, cfg2223)).toBe(a);
  });

  it('quotas : 18 CA, RTC 188h09 brut (175h… de moins la journée de solidarité)', () => {
    expect(getCATotalForCycle(cfg33)).toBe(18);
    expect(getRTCAnnuel(cfg33)).toBe(188 * 60 + 9);
    expect(getRTCAnnuel(cfg33, true)).toBe(188 * 60 + 9 - 728);
    expect(getRTCAnnuel(DEFAULT_CYCLE_CONFIG)).toBe(187 * 60 + 9);
  });
});

describe('Étape cycle : choix du 3/3', () => {
  afterEach(() => vi.useRealTimers());

  it('position « 2e jour de repos » aujourd’hui → série commencée il y a 4 jours', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 5, 10));
    const onNext = vi.fn();
    render(<CycleSetup onNext={onNext} />);
    fireEvent.click(screen.getByText('Cycle 3/3'));
    expect(screen.queryByText('Semaine A')).toBeNull();
    const continuer = screen.getByRole('button', { name: /Indiquez où vous en êtes/ }) as HTMLButtonElement;
    expect(continuer.disabled).toBe(true);
    const radios = screen.getAllByRole('radio', { name: /jour/ });
    fireEvent.click(radios[4]!); // 2e jour de repos
    fireEvent.click(screen.getByRole('button', { name: /Continuer/ }));
    const cfg = onNext.mock.calls[0]![0] as CycleConfig;
    expect(cfg.pattern).toBe('3/3');
    expect(cfg.dateDebutCycle).toBe('2026-10-01');
    clearCalculationCaches();
    expect(isWorkingDay(new Date(2026, 9, 5), cfg)).toBe(false);
    expect(isWorkingDay(new Date(2026, 9, 7), cfg)).toBe(true);
  });

  it('modification d’un 3/3 existant : position du jour reprise', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 6, 10)); // 2e jour travaillé de cfg33
    render(<CycleSetup onNext={vi.fn()} initialConfig={cfg33} />);
    const radios = screen.getAllByRole('radio', { name: /jour/ });
    expect(radios[1]!.getAttribute('aria-checked')).toBe('true');
  });
});
