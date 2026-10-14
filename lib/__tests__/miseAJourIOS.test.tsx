// Bandeau « nouvelle version » de l'app iPhone.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

vi.mock('../analytics', () => ({ track: vi.fn(), trackError: vi.fn(), detectPlatform: () => 'ios' }));
vi.mock('../api', () => ({ isNativeApp: () => true, plateformeNative: () => 'ios', apiUrl: (p: string) => `https://mychronos.fr${p}` }));
vi.mock('../constants', async (orig) => ({ ...(await orig<typeof import('../constants')>()), APP_VERSION: '1.17.0' }));

import { MiseAJourIOS } from '@/components/shared/MiseAJourIOS';

let store: Map<string, string>;
beforeEach(() => {
  store = new Map();
  vi.mocked(localStorage.getItem).mockImplementation((k) => store.get(k) ?? null);
  vi.mocked(localStorage.setItem).mockImplementation((k, v) => void store.set(k, String(v)));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const repondre = (ios: unknown) =>
  vi.stubGlobal('fetch', vi.fn(async () => ({ json: async () => ({ ios }) })));

describe('Bandeau de mise à jour iPhone', () => {
  it('version plus récente sur l’App Store : bandeau avec la nouveauté', async () => {
    repondre({ version: '1.18', note: 'Tes congés prévisionnels d’un coup d’œil' });
    render(<MiseAJourIOS />);
    expect(await screen.findByText(/nouvelle version de My Chronos/)).toBeTruthy();
    expect(screen.getByText(/Nouveauté : Tes congés prévisionnels/)).toBeTruthy();
  });

  it('déjà à jour : rien', async () => {
    repondre({ version: '1.17' });
    render(<MiseAJourIOS />);
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    expect(screen.queryByText(/nouvelle version/)).toBeNull();
  });

  it('fermé : ne revient pas pour cette version', async () => {
    repondre({ version: '1.18' });
    render(<MiseAJourIOS />);
    fireEvent.click(await screen.findByRole('button', { name: 'Fermer' }));
    expect(store.get('chronos_maj_ios_ignoree')).toBe('1.18');
    cleanup();
    render(<MiseAJourIOS />);
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    expect(screen.queryByText(/nouvelle version/)).toBeNull();
  });
});
