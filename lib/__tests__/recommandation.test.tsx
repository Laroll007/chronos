// Recommandation à un collègue et demande d'avis dans les stores.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { HistoryEntry } from '../types';

const track = vi.fn();
vi.mock('../analytics', () => ({ track: (e: string) => track(e), trackError: vi.fn(), detectPlatform: () => 'android' }));

import { lienAvisStore, noterDemandeAvis, peutDemanderAvis, LIEN_TELECHARGER } from '../recommandation';
import { RecommanderModal } from '@/components/shared/RecommanderModal';
import { AvisPrompt } from '@/components/dashboard/AvisPrompt';

let store: Map<string, string>;
beforeEach(() => {
  store = new Map();
  vi.mocked(localStorage.getItem).mockImplementation((k) => store.get(k) ?? null);
  vi.mocked(localStorage.setItem).mockImplementation((k, v) => void store.set(k, String(v)));
  track.mockClear();
});
afterEach(cleanup);

const pose = (i: number): HistoryEntry =>
  ({ id: `p${i}`, date: new Date(2026, 8, i + 1).toISOString(), action: 'pose', type: 'ca', amount: 1, countersSnapshot: {} }) as HistoryEntry;
const now = new Date(2026, 9, 13);

describe('Quand demander un avis', () => {
  it('pas avant 3 poses, ni dans la première semaine', () => {
    expect(peutDemanderAvis([pose(1), pose(2)], '2026-09-01', now)).toBe(false);
    expect(peutDemanderAvis([pose(1), pose(2), pose(3)], '2026-10-10', now)).toBe(false);
    expect(peutDemanderAvis([pose(1), pose(2), pose(3)], '2026-09-01', now)).toBe(true);
  });

  it('au plus une fois tous les 4 mois', () => {
    noterDemandeAvis(now);
    expect(peutDemanderAvis([pose(1), pose(2), pose(3)], '2026-09-01', new Date(2026, 11, 1))).toBe(false);
    expect(peutDemanderAvis([pose(1), pose(2), pose(3)], '2026-09-01', new Date(2027, 2, 1))).toBe(true);
  });

  it('fiche du store selon le téléphone, aucune sur le web', () => {
    expect(lienAvisStore('ios')).toBe('https://apps.apple.com/app/id6762043430?action=write-review');
    expect(lienAvisStore('android')).toBe('https://play.google.com/store/apps/details?id=fr.mychronos.app');
    expect(lienAvisStore('web')).toBeNull();
  });
});

describe('Fenêtres', () => {
  it('« Recommander » : QR code, envoi, et repli WhatsApp / SMS sans partage du téléphone', async () => {
    render(<RecommanderModal onClose={vi.fn()} />);
    expect(screen.getByAltText(/QR code/)).toBeTruthy();
    expect(screen.getByText(LIEN_TELECHARGER)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Envoyer le lien/ }));
    expect(await screen.findByText('WhatsApp')).toBeTruthy(); // pas de navigator.share dans les tests
    expect(track).toHaveBeenCalledWith('partage_ouvert');
  });

  it('invitation Android neutre : pas de question sur l’appréciation, avis ou recommandation', () => {
    render(<AvisPrompt plateforme="android" onRecommander={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Laisser un avis/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Recommander à un collègue/ })).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/aimez|aimes|satisfait/i);
    expect(track).toHaveBeenCalledWith('avis_demande');
  });

  it('web : pas de store, seulement la recommandation', () => {
    render(<AvisPrompt plateforme="web" onRecommander={vi.fn()} onClose={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /Laisser un avis/ })).toBeNull();
    expect(screen.getByRole('button', { name: /Recommander à un collègue/ })).toBeTruthy();
  });
});
