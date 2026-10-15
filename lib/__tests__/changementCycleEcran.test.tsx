// Écran « Modifier mon cycle » : corriger ou changer de cycle (mutation).

import { describe, it, expect, afterEach, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ChangementCycle } from '@/components/dashboard/ChangementCycle';
import { DEFAULT_COUNTERS } from '../storage';
import { clearCalculationCaches } from '../calculations';
import type { CycleConfig } from '../types';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  clearCalculationCaches();
});

const SEMAINE = { lundi: true, mardi: true, mercredi: true, jeudi: true, vendredi: true, samedi: false, dimanche: false };
const ANCIEN: CycleConfig = {
  type: 'alterne', pattern: '2/2/3/2/2/3', heuresParJour: 728, heureDebut: 420,
  dateDebutCycle: '2026-01-05', semaineActuelle: 'A', semaineA: SEMAINE, semaineB: SEMAINE,
};

function rendre(cfg: CycleConfig = ANCIEN) {
  const props = { onCorriger: vi.fn(), onChanger: vi.fn(), onAnnuler: vi.fn() };
  render(<ChangementCycle cycleConfig={cfg} counters={{ ...DEFAULT_COUNTERS, ca: 10 }} history={[]} {...props} />);
  return props;
}

describe('Modifier mon cycle', () => {
  it('deux choix : corriger (toute l’année) ou changer de cycle (mutation)', () => {
    rendre();
    expect(screen.getByRole('button', { name: /Je corrige mon cycle/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Je change de cycle/ })).toBeTruthy();
    expect(screen.queryByText(/Annuler mon changement/)).toBeNull();
  });

  it('dates : le premier jour du nouveau cycle doit suivre le dernier de l’ancien', () => {
    rendre();
    fireEvent.click(screen.getByRole('button', { name: /Je change de cycle/ }));
    fireEvent.change(screen.getByLabelText('Dernier jour de l’ancien cycle'), { target: { value: '2026-07-01' } });
    fireEvent.change(screen.getByLabelText('Premier jour du nouveau cycle'), { target: { value: '2026-06-30' } });
    expect(screen.getByText(/doit suivre/)).toBeTruthy();
    expect((screen.getByRole('button', { name: /mon nouveau cycle/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('parcours complet : dates, nouveau cycle 3/3, droits de l’année, validation', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 6, 10, 10));
    const { onChanger } = rendre();
    fireEvent.click(screen.getByRole('button', { name: /Je change de cycle/ }));
    fireEvent.change(screen.getByLabelText('Dernier jour de l’ancien cycle'), { target: { value: '2026-06-30' } });
    fireEvent.change(screen.getByLabelText('Premier jour du nouveau cycle'), { target: { value: '2026-07-01' } });
    fireEvent.click(screen.getByRole('button', { name: /mon nouveau cycle/ }));

    fireEvent.click(await screen.findByText('Cycle 3/3'));
    fireEvent.click(screen.getAllByRole('radio', { name: /jour/ })[0]!);
    fireEvent.click(screen.getByRole('button', { name: /Continuer/ }));

    expect(await screen.findByText('Vos droits pour 2026')).toBeTruthy();
    expect(document.body.textContent).toMatch(/GesTT fait foi/);
    fireEvent.click(screen.getByRole('button', { name: /Valider le changement de cycle/ }));
    expect(onChanger).toHaveBeenCalledWith(
      expect.objectContaining({ dernierJour: '2026-06-30', premierJour: '2026-07-01', nouveau: expect.objectContaining({ pattern: '3/3' }) })
    );
  });

  it('changement de cycle de l’année : annulable depuis l’écran', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 6, 10, 10));
    const { onAnnuler } = rendre({
      ...ANCIEN, appliqueDepuis: '2026-07-01', droitsAnnee: { annee: 2026, ca: 18 },
      cyclesAnterieurs: [{ fin: '2026-06-30', config: ANCIEN }],
    });
    fireEvent.click(screen.getByRole('button', { name: /Annuler mon changement de cycle du 1 juillet 2026/ }));
    expect(onAnnuler).not.toHaveBeenCalled(); // confirmation d'abord
    fireEvent.click(screen.getByRole('button', { name: /Confirmer l’annulation/ }));
    expect(onAnnuler).toHaveBeenCalled();
  });
});
