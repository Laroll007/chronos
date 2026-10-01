import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

vi.mock('../analytics', () => ({ track: vi.fn(), trackError: vi.fn() }));
import { HorairesPrompt, rappelHorairesDu, reporterRappelHoraires } from '@/components/dashboard/HorairesPrompt';

describe('Rappel « renseignez vos horaires »', () => {
  let store: Map<string, string>;
  beforeEach(() => {
    store = new Map();
    vi.mocked(localStorage.getItem).mockImplementation((k) => store.get(k) ?? null);
    vi.mocked(localStorage.setItem).mockImplementation((k, v) => void store.set(k, String(v)));
  });

  it('« Plus tard » repousse de 7 jours, et l’app n’insiste plus après 3 refus', () => {
    const t0 = Date.UTC(2026, 9, 1);
    const jour = 24 * 3600 * 1000;
    expect(rappelHorairesDu(t0)).toBe(true);
    reporterRappelHoraires(t0);
    expect(rappelHorairesDu(t0 + 6 * jour)).toBe(false);
    expect(rappelHorairesDu(t0 + 7 * jour)).toBe(true);
    reporterRappelHoraires(t0 + 7 * jour);
    reporterRappelHoraires(t0 + 14 * jour);
    expect(rappelHorairesDu(t0 + 100 * jour)).toBe(false);
  });

  it('« Renseigner mes horaires » ouvre l’écran du cycle', () => {
    const onRenseigner = vi.fn();
    render(<HorairesPrompt onRenseigner={onRenseigner} />);
    fireEvent.click(screen.getByText('Renseigner mes horaires'));
    expect(onRenseigner).toHaveBeenCalled();
    expect(screen.queryByText('Vos horaires de vacation')).toBeNull();
  });
});
