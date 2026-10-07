import { describe, it, expect, afterEach } from 'vitest';
import { horairesDuJour, rangDansRotation } from '../horaires';
import { getRPSPourJour } from '../rps';
import { vacationPrevue } from '../journees';
import { clearCalculationCaches, getJourMinutes, isWorkingDay } from '../calculations';
import { DEFAULT_CYCLE_CONFIG } from '../storage';
import { validateUserData } from '../validation';
import type { CycleConfig } from '../types';
import { DEFAULT_COUNTERS } from '../storage';

const h = (hh: number, mm = 0) => hh * 60 + mm;

// Retour terrain : 2/2/3, 2 cycles de soirée 10h30-22h38 puis 1 de matinée 06h30-18h38.
const cfg: CycleConfig = {
  ...DEFAULT_CYCLE_CONFIG,
  type: 'alterne',
  pattern: '2/2/3/2/2/3',
  heureDebut: h(10, 30),
  heuresParJour: h(12, 8),
  horairesRotation: {
    jeux: [
      { nom: 'Soirée', heureDebut: h(10, 30), duree: h(12, 8) },
      { nom: 'Matinée', heureDebut: h(6, 30), duree: h(12, 8) },
    ],
    sequence: [0, 0, 1],
    periodeJours: 14,
    dateReference: '2026-10-05', // lundi : début d'un 1er cycle de soirée
  },
};
const jour = (iso: string) => {
  const [a, m, j] = iso.split('-').map(Number);
  return new Date(a, m - 1, j);
};
const premierTravaille = (iso: string) => {
  let d = jour(iso);
  while (!isWorkingDay(d, cfg) || d.getDay() === 0) d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
  return d;
};

describe('Horaires en rotation (soirée ×2, matinée ×1)', () => {
  afterEach(() => clearCalculationCaches());

  it('enchaîne 2 cycles de soirée puis 1 de matinée, toutes les 6 semaines, y compris avant la référence', () => {
    const r = cfg.horairesRotation!;
    expect(['2026-10-05', '2026-10-19', '2026-11-02', '2026-11-16'].map((d) => rangDansRotation(jour(d), r))).toEqual([0, 1, 2, 0]);
    expect(rangDansRotation(jour('2026-10-04'), r)).toBe(2); // veille : fin du cycle de matinée précédent
    expect(horairesDuJour(jour('2026-11-03'), cfg).nom).toBe('Matinée');
    expect(horairesDuJour(jour('2026-10-06'), cfg).nom).toBe('Soirée');
  });

  it('RPS du jour : 10 min en soirée de semaine, 0 en matinée de semaine', () => {
    const soir = premierTravaille('2026-10-05');
    const matin = premierTravaille('2026-11-02');
    expect(getRPSPourJour(soir, cfg)).toBe(10);
    expect(getRPSPourJour(matin, cfg)).toBe(0);
  });

  it('vacation prévue et durée travaillée suivent les horaires du jour', () => {
    const matin = premierTravaille('2026-11-02');
    expect(vacationPrevue(matin, cfg)).toEqual({ debut: h(6, 30), duree: h(12, 8) });
    expect(getJourMinutes(matin, cfg)).toBe(h(12, 8));
  });

  it('sans rotation, rien ne change', () => {
    const { horairesRotation: _r, ...simple } = cfg;
    expect(horairesDuJour(jour('2026-11-03'), simple)).toEqual({ heureDebut: h(10, 30), duree: h(12, 8) });
  });

  it('les données avec rotation passent la validation', () => {
    const data = { cycleConfig: cfg, counters: DEFAULT_COUNTERS, history: [], lastUpdated: new Date().toISOString(), lastResetYear: 2026, isOnboarded: true };
    expect(validateUserData(data).success).toBe(true);
  });
});

describe('Écran du cycle : horaires en rotation', () => {
  it('soirée ×2 puis matinée ×1, cycle en cours = 2e de soirée → référence 2 semaines plus tôt', async () => {
    const { vi } = await import('vitest');
    const { render, screen, fireEvent } = await import('@testing-library/react');
    const { CycleSetup } = await import('@/components/onboarding/CycleSetup');
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 7, 10)); // mercredi 7 octobre, lundi = 5
    const onNext = vi.fn();
    render(<CycleSetup onNext={onNext} />);
    const choisir = (label: string, hhmm: string) => {
      const [hh, mm] = hhmm.split(':');
      fireEvent.change(screen.getByLabelText(label), { target: { value: hh } });
      fireEvent.change(screen.getByLabelText(`${label}, minutes`), { target: { value: mm } });
    };
    choisir('Prise de service', '10:30');
    choisir('Fin de service', '22:38');
    fireEvent.click(screen.getByRole('radio', { name: 'Semaine A' }));
    fireEvent.click(screen.getByText('Mes horaires changent'));
    choisir('Prise de service (Matinée)', '06:30');
    choisir('Fin de service (Matinée)', '18:38');
    fireEvent.click(screen.getByText('Soirée · 2e cycle'));
    fireEvent.click(screen.getByRole('button', { name: /Continuer/ }));
    const cfgOut = onNext.mock.calls[0]![0] as CycleConfig;
    expect(cfgOut.horairesRotation).toEqual({
      jeux: [
        { nom: 'Soirée', heureDebut: h(10, 30), duree: h(12, 8) },
        { nom: 'Matinée', heureDebut: h(6, 30), duree: h(12, 8) },
      ],
      sequence: [0, 0, 1],
      periodeJours: 14,
      dateReference: '2026-09-21',
    });
    // Le cycle en cours (semaine du 5 octobre) est bien le 2e de soirée
    expect(rangDansRotation(new Date(2026, 9, 7), cfgOut.horairesRotation!)).toBe(1);
    vi.useRealTimers();
  });
});

describe('Écran du cycle : changement en début de semaine B', () => {
  it('semaine en cours A, cycles commençant en B → le cycle en cours a commencé le lundi précédent ; aperçu affiché', async () => {
    const { vi } = await import('vitest');
    const { render, screen, fireEvent, cleanup } = await import('@testing-library/react');
    cleanup();
    const { CycleSetup } = await import('@/components/onboarding/CycleSetup');
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 7, 10));
    const onNext = vi.fn();
    render(<CycleSetup onNext={onNext} />);
    fireEvent.click(screen.getByRole('radio', { name: 'Semaine A' }));
    fireEvent.click(screen.getByText('Mes horaires changent'));
    fireEvent.click(screen.getByRole('radio', { name: 'semaine B' }));
    fireEvent.click(screen.getByText('Soirée · 1er cycle'));
    expect(screen.getByText(/Prochain changement/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Continuer/ }));
    const r = (onNext.mock.calls[0]![0] as CycleConfig).horairesRotation!;
    expect(r.dateReference).toBe('2026-09-28'); // lundi de la semaine B précédente
    vi.useRealTimers();
  });
});
