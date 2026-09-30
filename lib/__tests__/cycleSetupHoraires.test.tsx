import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { CycleSetup } from '@/components/onboarding/CycleSetup';
import type { CycleConfig } from '../types';

function submit(onNext: ReturnType<typeof vi.fn>) {
  // Choix de la semaine en cours (obligatoire en cycle alterné)
  fireEvent.click(screen.getAllByRole('radio')[0]!);
  fireEvent.click(screen.getByRole('button', { name: /Continuer/ }));
  return onNext.mock.calls[0]![0] as CycleConfig;
}

describe('Étape cycle : horaires de vacation', () => {
  it('par défaut 07h00 → 19h08 : 12h08, RPS uniquement le dimanche', () => {
    const onNext = vi.fn();
    render(<CycleSetup onNext={onNext} />);
    expect(screen.getByText(/Durée : 12h08/)).toBeInTheDocument();
    const cfg = submit(onNext);
    expect(cfg.heureDebut).toBe(7 * 60);
    expect(cfg.heuresParJour).toBe(728);
    expect(cfg.rpsParJour).toMatchObject({ lundi: 0, samedi: 0, dimanche: 291 });
  });

  it('19h30 → 07h38 : durée déduite et barème exact (54 min / 3h21 / 2h24)', () => {
    const onNext = vi.fn();
    render(<CycleSetup onNext={onNext} />);
    fireEvent.change(screen.getByLabelText('Prise de service'), { target: { value: '19:30' } });
    fireEvent.change(screen.getByLabelText('Fin de service'), { target: { value: '07:38' } });
    expect(screen.getByText(/fin le lendemain/)).toBeInTheDocument();
    expect(screen.getByText(/54 min|0h54/)).toBeInTheDocument();
    const cfg = submit(onNext);
    expect(cfg.heureDebut).toBe(19 * 60 + 30);
    expect(cfg.heuresParJour).toBe(728);
    expect(cfg.rpsParJour).toMatchObject({ lundi: 54, vendredi: 54, samedi: 201, dimanche: 144 });
  });

  it('horaires incohérents : le bouton est bloqué', () => {
    const onNext = vi.fn();
    render(<CycleSetup onNext={onNext} />);
    fireEvent.click(screen.getAllByRole('radio')[0]!);
    fireEvent.change(screen.getByLabelText('Fin de service'), { target: { value: '07:00' } }); // 0 min
    expect(screen.getByRole('button', { name: /Vérifiez vos horaires/ })).toBeDisabled();
  });

  it('agent déjà inscrit en service de nuit sans horaires : prérempli 19h00, durée conservée', () => {
    const onNext = vi.fn();
    const existant = {
      type: 'alterne', pattern: '2/2/3/2/2/3', heuresParJour: 668, dateDebutCycle: '2026-09-28',
      semaineActuelle: 'A',
      semaineA: { lundi: true, mardi: true, mercredi: false, jeudi: false, vendredi: true, samedi: true, dimanche: true },
      semaineB: { lundi: false, mardi: false, mercredi: true, jeudi: true, vendredi: false, samedi: false, dimanche: false },
      rpsParJour: { lundi: 67, mardi: 67, mercredi: 67, jeudi: 67, vendredi: 67, samedi: 67, dimanche: 267 },
    } as CycleConfig;
    render(<CycleSetup onNext={onNext} initialConfig={existant} />);
    expect((screen.getByLabelText('Prise de service') as HTMLInputElement).value).toBe('19:00');
    expect((screen.getByLabelText('Fin de service') as HTMLInputElement).value).toBe('06:08');
  });
});
