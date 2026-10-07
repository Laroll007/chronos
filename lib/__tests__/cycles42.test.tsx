// Cycles 4/2 et 2/2 (rotations continues) et horaires qui changent d'un jour à
// l'autre dans le cycle (4/2 classique : 2 soirées puis 2 matinées), affichés
// sur le planning (pastille « S » / « M »).

import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { CycleConfig } from '../types';
import { DEFAULT_CYCLE_CONFIG } from '../storage';
import { clearCalculationCaches, getCATotalForCycle, getRTCAnnuel, isWorkingDay } from '../calculations';
import { abregerNomsJeux, jeuHorairesDuJour } from '../horaires';
import { getRPSPourJour } from '../rps';
import { validateUserData } from '../validation';
import { DEFAULT_COUNTERS } from '../storage';

vi.mock('../analytics', () => ({ track: vi.fn(), trackError: vi.fn() }));

import { CycleSetup } from '@/components/onboarding/CycleSetup';

afterEach(() => {
  cleanup();
  clearCalculationCaches();
  vi.useRealTimers();
});

const h = (hh: number, mm = 0) => hh * 60 + mm;
const jour = (iso: string) => {
  const [a, m, j] = iso.split('-').map(Number);
  return new Date(a, m - 1, j);
};
const serie = (cfg: CycleConfig, debut: string, n: number) =>
  Array.from({ length: n }, (_, k) => {
    const d = jour(debut);
    d.setDate(d.getDate() + k);
    return isWorkingDay(d, cfg) ? 'T' : 'r';
  }).join('');

const base = (patch: Partial<CycleConfig>): CycleConfig => ({
  ...DEFAULT_CYCLE_CONFIG,
  type: 'alterne',
  dateDebutCycle: '2026-10-05',
  ...patch,
});

describe('Cycles 4/2 et 2/2', () => {
  it('4/2 : 4 jours travaillés, 2 de repos, en continu (avant la référence aussi)', () => {
    const cfg = base({ pattern: '4/2', heuresParJour: h(8, 10) });
    expect(serie(cfg, '2026-10-05', 12)).toBe('TTTTrrTTTTrr');
    expect(serie(cfg, '2026-10-01', 4)).toBe('TTrr');
    expect(getCATotalForCycle(cfg)).toBe(23);
    expect(getRTCAnnuel(cfg)).toBe(h(41, 45));
  });

  it('2/2 : 2 jours travaillés, 2 de repos ; dotation selon la durée de vacation', () => {
    const cfg = base({ pattern: '2/2', heuresParJour: h(11, 8) });
    expect(serie(cfg, '2026-10-05', 8)).toBe('TTrrTTrr');
    expect(getCATotalForCycle(cfg)).toBe(18);
    expect(getRTCAnnuel(cfg)).toBe(h(53, 27));
    expect(getRTCAnnuel({ ...cfg, heuresParJour: h(12, 8) })).toBe(h(188, 9));
  });
});

describe('Horaires qui changent d’un jour à l’autre (4/2 : 2 soirées, 2 matinées)', () => {
  const cfg = base({
    pattern: '4/2',
    heureDebut: h(13, 0),
    heuresParJour: h(8, 10),
    horairesRotation: {
      jeux: [
        { nom: 'Soirée', heureDebut: h(13, 0), duree: h(8, 10) },
        { nom: 'Matinée', heureDebut: h(5, 0), duree: h(8, 10) },
      ],
      sequence: [0, 0, 1, 1, 0, 0],
      periodeJours: 1,
      dateReference: '2026-10-05',
    },
  });

  it('chaque jour de la série a ses horaires, cycle après cycle', () => {
    const noms = ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-11', '2026-10-13', '2026-10-14']
      .map((d) => jeuHorairesDuJour(jour(d), cfg)?.nom);
    expect(noms).toEqual(['Soirée', 'Soirée', 'Matinée', 'Matinée', 'Soirée', 'Matinée', 'Matinée']);
  });

  it('pastilles « S » / « M » ; RPS de nuit selon les horaires du jour', () => {
    expect(jeuHorairesDuJour(jour('2026-10-05'), cfg)?.court).toBe('S');
    expect(jeuHorairesDuJour(jour('2026-10-07'), cfg)?.court).toBe('M');
    expect(getRPSPourJour(jour('2026-10-05'), cfg)).toBe(1); // 21h00 → 21h10 : 10 min × 0,1
    expect(getRPSPourJour(jour('2026-10-07'), cfg)).toBe(6); // 05h00 → 06h00 : 60 min × 0,1
  });

  it('sans rotation : aucune pastille', () => {
    expect(jeuHorairesDuJour(jour('2026-10-05'), base({ pattern: '4/2' }))).toBeNull();
  });

  it('passe la validation des données', () => {
    const r = validateUserData({
      cycleConfig: cfg,
      counters: DEFAULT_COUNTERS,
      history: [],
      lastUpdated: new Date().toISOString(),
      lastResetYear: 2026,
      isOnboarded: true,
    });
    expect(r.success).toBe(true);
  });
});

describe('abregerNomsJeux', () => {
  it('initiales, deux lettres si elles se confondent', () => {
    expect(abregerNomsJeux(['Soirée', 'Matinée'])).toEqual(['S', 'M']);
    expect(abregerNomsJeux(['Matin', 'midi'])).toEqual(['Ma', 'Mi']);
  });
});

describe('Écran du cycle : 4/2 avec horaires d’un jour à l’autre', () => {
  it('enregistre une rotation d’un jour calée sur le 1er jour travaillé de la série', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 7, 10)); // mercredi 7 octobre
    const onNext = vi.fn();
    render(<CycleSetup onNext={onNext} />);
    fireEvent.click(screen.getByRole('button', { name: /Cycle 4\/2/ }));
    // Aujourd'hui = 3e jour travaillé → la série a commencé le lundi 5
    fireEvent.click(screen.getByRole('radio', { name: /3e jour\s*travaillé/ }));
    fireEvent.click(screen.getByText('Mes horaires changent'));
    fireEvent.click(screen.getByRole('radio', { name: /d’un jour à l’autre/ }));
    // Par défaut : 2 soirées puis 2 matinées ; on passe le 2e jour en matinée
    fireEvent.click(screen.getAllByRole('radiogroup', { name: /Horaires du 2e jour/ })[0]!.querySelectorAll('button')[1]!);
    fireEvent.click(screen.getByRole('button', { name: /Continuer/ }));
    const cfgOut = onNext.mock.calls[0]![0] as CycleConfig;
    expect(cfgOut.pattern).toBe('4/2');
    expect(cfgOut.dateDebutCycle).toBe('2026-10-05');
    expect(cfgOut.horairesRotation).toMatchObject({ sequence: [0, 1, 1, 1, 0, 0], periodeJours: 1, dateReference: '2026-10-05' });
  });
});
