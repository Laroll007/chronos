// Message « ARTT en cycle » : affiché une seule fois, aucune modification
// automatique des compteurs.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

const track = vi.fn();
vi.mock('../analytics', () => ({ track: (e: string) => track(e), trackError: vi.fn() }));

import { ArttCyclePrompt, rappelArttCycleVu } from '@/components/dashboard/ArttCyclePrompt';

let store: Map<string, string>;

beforeEach(() => {
  store = new Map();
  vi.mocked(localStorage.getItem).mockImplementation((k) => store.get(k) ?? null);
  vi.mocked(localStorage.setItem).mockImplementation((k, v) => void store.set(k, String(v)));
  track.mockClear();
});

afterEach(cleanup);

describe('ArttCyclePrompt', () => {
  it('« Gérer mes compteurs » ouvre la gestion et ne revient plus', () => {
    const onGerer = vi.fn();
    render(<ArttCyclePrompt onGerer={onGerer} />);
    expect(screen.getByText('Votre compteur ARTT')).toBeTruthy();
    expect(track).toHaveBeenCalledWith('artt_prompt_seen');

    fireEvent.click(screen.getByRole('button', { name: 'Gérer mes compteurs' }));
    expect(onGerer).toHaveBeenCalledOnce();
    expect(rappelArttCycleVu()).toBe(true);

    cleanup();
    render(<ArttCyclePrompt onGerer={onGerer} />);
    expect(screen.queryByText('Votre compteur ARTT')).toBeNull();
  });

  it('« C’est bien un autre compteur » ferme sans rien ouvrir, définitivement', () => {
    const onGerer = vi.fn();
    render(<ArttCyclePrompt onGerer={onGerer} />);
    fireEvent.click(screen.getByRole('button', { name: /bien un autre compteur/ }));
    expect(onGerer).not.toHaveBeenCalled();
    expect(track).toHaveBeenCalledWith('artt_prompt_garde');
    expect(rappelArttCycleVu()).toBe(true);
  });
});
