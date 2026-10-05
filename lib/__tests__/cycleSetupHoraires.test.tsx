import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { CycleSetup } from '@/components/onboarding/CycleSetup';
import type { CycleConfig } from '../types';

// Heure + minutes dans deux listes (plus de <input type="time">)
function choisirHeure(label: string, hhmm: string) {
  const [h, m] = hhmm.split(':');
  fireEvent.change(screen.getByLabelText(label), { target: { value: h } });
  fireEvent.change(screen.getByLabelText(`${label}, minutes`), { target: { value: m } });
}

function heureAffichee(label: string) {
  const h = (screen.getByLabelText(label) as HTMLSelectElement).value;
  const m = (screen.getByLabelText(`${label}, minutes`) as HTMLSelectElement).value;
  return `${h}:${m}`;
}

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
    expect(screen.getByText(/Durée : 12h08/)).toBeTruthy();
    const cfg = submit(onNext);
    expect(cfg.heureDebut).toBe(7 * 60);
    expect(cfg.heuresParJour).toBe(728);
    expect(cfg.rpsParJour).toMatchObject({ lundi: 0, samedi: 0, dimanche: 291 });
  });

  it('19h30 → 07h38 : durée déduite et barème exact (54 min / 3h21 / 2h24)', () => {
    const onNext = vi.fn();
    render(<CycleSetup onNext={onNext} />);
    choisirHeure('Prise de service', '19:30');
    choisirHeure('Fin de service', '07:38');
    expect(screen.getByText(/fin le lendemain/)).toBeTruthy();
    expect(screen.getByText(/54 min|0h54/)).toBeTruthy();
    const cfg = submit(onNext);
    expect(cfg.heureDebut).toBe(19 * 60 + 30);
    expect(cfg.heuresParJour).toBe(728);
    expect(cfg.rpsParJour).toMatchObject({ lundi: 54, vendredi: 54, samedi: 201, dimanche: 144 });
  });

  it('horaires incohérents : le bouton est bloqué', () => {
    const onNext = vi.fn();
    render(<CycleSetup onNext={onNext} />);
    fireEvent.click(screen.getAllByRole('radio')[0]!);
    choisirHeure('Fin de service', '07:00'); // 0 min
    expect((screen.getByRole('button', { name: /Vérifiez vos horaires/ }) as HTMLButtonElement).disabled).toBe(true);
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
    expect(heureAffichee('Prise de service')).toBe('19:00');
    expect(heureAffichee('Fin de service')).toBe('06:08');
  });
});

describe('Étape compteurs : CET au-delà de 60 jours', () => {
  it('accepte un solde de 72 jours (plafond relevé exceptionnellement)', async () => {
    const { CountersSetup } = await import('@/components/onboarding/CountersSetup');
    const { DEFAULT_CYCLE_CONFIG } = await import('@/lib/storage');
    const onNext = vi.fn();
    const { container } = render(<CountersSetup cycleConfig={DEFAULT_CYCLE_CONFIG} onNext={onNext} onBack={vi.fn()} />);
    fireEvent.click(screen.getByText('Suivant'));
    fireEvent.click(container.querySelector('#counter-cet')!);
    fireEvent.click(screen.getByText('Continuer'));
    fireEvent.change(screen.getByLabelText('Stock CET actuel'), { target: { value: '72' } });
    fireEvent.click(screen.getByText('Terminer'));
    expect(onNext.mock.calls[0]![0].cet).toBe(72);
  });
});

describe('« Gérer mes compteurs » (hors onboarding)', () => {
  it('pré-coche les compteurs actifs et permet d’activer le RTC sans perdre les autres', async () => {
    const { CountersSetup } = await import('@/components/onboarding/CountersSetup');
    const { DEFAULT_CYCLE_CONFIG, DEFAULT_COUNTERS } = await import('@/lib/storage');
    const onNext = vi.fn();
    const actuels = { ...DEFAULT_COUNTERS, ca: 12, cf: 3000, hasCF: true, rtc: 0, hasRTC: false, cet: 20, rps: 0 };
    const { container } = render(
      <CountersSetup cycleConfig={DEFAULT_CYCLE_CONFIG} onNext={onNext} onBack={vi.fn()}
        initialCounters={actuels} skipIntro preselection />
    );
    const coche = (k: string) => (container.querySelector(`#counter-${k}`) as HTMLInputElement).checked;
    expect([coche('ca'), coche('cf'), coche('cet'), coche('rtc'), coche('rps')]).toEqual([true, true, true, false, false]);
    fireEvent.click(container.querySelector('#counter-rtc')!);
    fireEvent.click(screen.getByText('Continuer'));
    fireEvent.click(screen.getByText('Terminer'));
    const final = onNext.mock.calls[0]![0];
    expect(final).toMatchObject({ ca: 12, cf: 3000, hasCF: true, hasRTC: true, cet: 20 });
  });
});
