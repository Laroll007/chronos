import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { OptimizationModal } from '@/components/dashboard/OptimizationModal';
import { DEFAULT_COUNTERS } from '../storage';
import type { Combination } from '../types';

vi.mock('../analytics', () => ({ track: vi.fn(), trackError: vi.fn() }));

const h = (hh: number, mm = 0) => hh * 60 + mm;
const NUIT = h(12, 8);

async function ouvrir(counters = {}) {
  const onApply = vi.fn((c: Combination) => { void c; return true; });
  render(
    <OptimizationModal
      isOpen
      onClose={vi.fn()}
      startDate={new Date(2026, 9, 6)}
      endDate={new Date(2026, 9, 6)}
      workingDaysCount={1}
      workingMinutesCount={NUIT}
      dureesJours={[NUIT]}
      jourMinutes={NUIT}
      counters={{ ...DEFAULT_COUNTERS, ca: 0, cf: 0, hasCF: false, rtc: h(7), rps: h(30), hs: 0, ...counters }}
      onApply={onApply}
    />
  );
  fireEvent.click(await screen.findByText('Poser librement mes congés', {}, { timeout: 3000 }));
  return onApply;
}

// Le bouton du choix libre (les propositions automatiques ont aussi un « Valider »).
const valider = () =>
  screen.getByText(/^Total/).closest('div.border-t')!.querySelector('button') as HTMLButtonElement;

describe('Choix libre en heures', () => {
  it('7h de RTC (moins d’une journée) sont proposées et se complètent par du RPS', async () => {
    const onApply = await ouvrir();
    // 1re ligne : RTC pré-rempli avec tout le solde (7h)
    expect((screen.getAllByLabelText('heures')[0] as HTMLInputElement).value).toBe('7');
    expect(screen.getByText(/Il manque 5h08/)).toBeTruthy();
    fireEvent.click(screen.getByText('Ajouter un type'));
    // 2e ligne pré-remplie avec ce qui manque
    expect((screen.getAllByLabelText('heures')[1] as HTMLInputElement).value).toBe('5');
    expect((screen.getAllByLabelText('minutes')[1] as HTMLInputElement).value).toBe('8');
    fireEvent.click(valider());
    const combo = onApply.mock.calls[0]![0];
    expect(combo.repartition).toEqual([
      { type: 'rtc', amount: h(7), debut: 0, fin: 0 },
      { type: 'rps', amount: h(5, 8), debut: 0, fin: 0 },
    ]);
    expect(combo.items.map((i) => i.amountMinutes)).toEqual([h(7), h(5, 8)]);
  });

  it('nuit 7h35 RTC + 4h33 RPS saisie à la main', async () => {
    const onApply = await ouvrir({ rtc: h(80) });
    const heures = () => screen.getAllByLabelText('heures') as HTMLInputElement[];
    const minutes = () => screen.getAllByLabelText('minutes') as HTMLInputElement[];
    fireEvent.change(heures()[0]!, { target: { value: '7' } });
    fireEvent.change(minutes()[0]!, { target: { value: '35' } });
    fireEvent.click(screen.getByText('Ajouter un type'));
    expect(heures()[1]!.value).toBe('4');
    expect(minutes()[1]!.value).toBe('33');
    fireEvent.click(valider());
    expect(onApply.mock.calls[0]![0].repartition!.map((t) => t.amount)).toEqual([h(7, 35), h(4, 33)]);
  });

  it('total incomplet : Valider reste bloqué', async () => {
    await ouvrir({ rps: 0 });
    expect(valider().disabled).toBe(true);
  });
});

describe('Jour déjà entamé par une pose à l’heure', () => {
  it('seuls les compteurs horaires complètent les heures restantes, pas de journée entière de CA', async () => {
    const onApply = vi.fn((c: Combination) => { void c; return true; });
    render(
      <OptimizationModal
        isOpen
        onClose={vi.fn()}
        startDate={new Date(2026, 9, 6)}
        endDate={new Date(2026, 9, 6)}
        workingDaysCount={1}
        workingMinutesCount={NUIT - h(4)}
        dureesJours={[NUIT - h(4)]}
        minutesDejaPosees={h(4)}
        jourMinutes={NUIT}
        counters={{ ...DEFAULT_COUNTERS, ca: 10, cf: 0, hasCF: false, rtc: h(20), rps: 0, hs: 0 }}
        onApply={onApply}
      />
    );
    expect(screen.getByText(/4h00 déjà posées sur ce jour/)).toBeTruthy();
    fireEvent.click(screen.getByText('Poser librement mes congés'));
    const options = [...(screen.getAllByRole('combobox')[0] as HTMLSelectElement).options].map((o) => o.value);
    expect(options).not.toContain('ca');
    expect(options).toContain('rtc');
    // RTC pré-rempli avec ce qui reste (8h08)
    expect((screen.getAllByLabelText('heures')[0] as HTMLInputElement).value).toBe('8');
    fireEvent.click(valider());
    expect(onApply.mock.calls[0]![0].repartition).toEqual([{ type: 'rtc', amount: h(8, 8), debut: 0, fin: 0 }]);
  });
});
