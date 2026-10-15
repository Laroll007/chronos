// Écran « Modifier cette journée » : compensation d'un rappel sur un repos.

import { describe, it, expect, afterEach, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { DayEditSection } from '@/components/dashboard/DayEditSection';
import { baremeRPSDepuisHoraires } from '../rps';
import type { CycleConfig } from '../types';

afterEach(cleanup);

const h = (hh: number, mm = 0) => hh * 60 + mm;
const SEMAINE = { lundi: true, mardi: true, mercredi: true, jeudi: true, vendredi: true, samedi: false, dimanche: false };
const CFG: CycleConfig = {
  type: 'alterne', pattern: '2/2/3/2/2/3', heuresParJour: h(12, 8), heureDebut: h(7),
  dateDebutCycle: '2026-09-28', semaineActuelle: 'A', semaineA: SEMAINE, semaineB: SEMAINE,
  rpsParJour: baremeRPSDepuisHoraires(h(7), h(12, 8)),
};
const SAMEDI = new Date(2026, 9, 3); // RC
const DIMANCHE = new Date(2026, 9, 4); // RL

function ouvrir(date: Date, onSave = vi.fn(() => true)) {
  render(<DayEditSection start={date} end={date} cycleConfig={CFG} joursModifies={[]} onSave={onSave} onDelete={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: /Modifier cette journée/ }));
  return onSave;
}

describe('Compensation du rappel', () => {
  it('RL (horaires habituels 07h00–19h08, plus de 4h) : 2 vacations présélectionnées, sans RPS', () => {
    const onSave = ouvrir(DIMANCHE);
    expect(screen.getByText('Compensation du rappel')).toBeTruthy();
    expect((screen.getByRole('radio', { name: /2 vacations/ }) as HTMLInputElement).checked).toBe(true);
    expect(document.body.textContent).toMatch(/RPS : aucun \(rappel\)/);
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(onSave).toHaveBeenCalledWith([expect.objectContaining({ choix: { mode: '2vac' } })]);
  });

  it('RC de plus de 4h : 150 % présélectionné ; saisie GesTT possible et transmise', () => {
    const onSave = ouvrir(SAMEDI);
    expect((screen.getByRole('radio', { name: /150 % des heures/ }) as HTMLInputElement).checked).toBe(true);
    expect(screen.queryByRole('radio', { name: /1 vacation/ })).toBeNull();
    fireEvent.click(screen.getByRole('radio', { name: /Selon GesTT/ }));
    fireEvent.change(screen.getByLabelText('HS créditées — heures'), { target: { value: '18' } });
    fireEvent.change(screen.getByLabelText('HS créditées — minutes'), { target: { value: '12' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
    expect(onSave).toHaveBeenCalledWith([expect.objectContaining({ choix: { mode: 'libre', libre: h(18, 12) } })]);
  });
});
