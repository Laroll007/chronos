// Passage de l'ancienne app Android (TWA) à l'app native : récupération des
// données restées dans le navigateur.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { HistoryEntry, UserData } from '../types';

vi.mock('../analytics', () => ({ track: vi.fn(), trackError: vi.fn(), detectPlatform: () => 'android' }));

let rappelTransfert: ((e: { donnees: string }) => void) | undefined;
const ouvrirNavigateur = vi.fn(async (_o: unknown) => {});
vi.mock('../natif-android', () => ({
  ChronosNatif: {
    navigateurs: async () => ({
      navigateurs: [
        { paquet: 'com.sec.android.app.sbrowser', nom: 'Samsung Internet', defaut: true },
        { paquet: 'com.android.chrome', nom: 'Chrome', defaut: false },
      ],
    }),
    ouvrirNavigateur: (o: unknown) => ouvrirNavigateur(o),
    addListener: async (_e: string, rappel: (e: { donnees: string }) => void) => {
      rappelTransfert = rappel;
      return { remove: async () => {} };
    },
  },
}));

import { decoderTransfert, encoderTransfert, lireDonneesTransfert, LIEN_RETOUR } from '../transfert';
import { DEFAULT_COUNTERS, DEFAULT_CYCLE_CONFIG } from '../storage';
import { apiUrl, plateformeNative } from '../api';
import { RecuperationAndroid } from '@/components/onboarding/RecuperationAndroid';
import { Transfert } from '@/app/transfert/Transfert';

let store: Map<string, string>;
beforeEach(() => {
  store = new Map();
  vi.mocked(localStorage.getItem).mockImplementation((k) => store.get(k) ?? null);
  vi.mocked(localStorage.setItem).mockImplementation((k, v) => void store.set(k, String(v)));
  rappelTransfert = undefined;
  ouvrirNavigateur.mockClear();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  delete (window as { Capacitor?: unknown }).Capacitor;
});

const pose = (i: number, action: HistoryEntry['action'] = 'pose'): HistoryEntry =>
  ({ id: `p${i}`, date: new Date(2026, 8, i + 1).toISOString(), action, type: 'ca', amount: 1, countersSnapshot: {} }) as HistoryEntry;

function donnees(): UserData {
  return {
    cycleConfig: { ...DEFAULT_CYCLE_CONFIG },
    counters: { ...DEFAULT_COUNTERS },
    history: [pose(1), pose(2), pose(3, 'cancel' as HistoryEntry['action'])],
    lastUpdated: '2026-10-10T08:00:00.000Z',
    lastResetYear: 2026,
    isOnboarded: true,
    dateInscription: '2026-03-01',
    events: [{ id: 'e1', date: '2026-10-20', titre: 'Anniversaire' }],
  } as unknown as UserData;
}

describe('Encodage du lien de retour', () => {
  it('aller-retour compressé : copie exacte, événements perso compris', async () => {
    const brut = JSON.stringify(donnees());
    const d = await encoderTransfert(brut);
    expect(d.startsWith('g1.')).toBe(true);
    expect(d).toMatch(/^g1\.[A-Za-z0-9_-]+$/); // sûr dans une adresse
    expect(await decoderTransfert(d)).toBe(brut);
  });

  it('navigateur sans compression : repli lisible', async () => {
    vi.stubGlobal('CompressionStream', undefined);
    const brut = JSON.stringify({ accent: 'congé été €' });
    const d = await encoderTransfert(brut);
    expect(d.startsWith('j1.')).toBe(true);
    expect(await decoderTransfert(d)).toBe(brut);
  });

  it('format inconnu ou vide : refusé', async () => {
    await expect(decoderTransfert('x1.abc')).rejects.toThrow();
    await expect(decoderTransfert('g1.')).rejects.toThrow();
  });
});

describe('Vérification avant import', () => {
  it('résumé : congés posés (hors annulations) et dernière modification', () => {
    const r = lireDonneesTransfert(JSON.stringify(donnees()));
    expect(r?.poses).toBe(2);
    expect(r?.derniereModif).toBe('2026-10-10T08:00:00.000Z');
  });

  it('JSON invalide ou pas des données My Chronos : null', () => {
    expect(lireDonneesTransfert('{oups')).toBeNull();
    expect(lireDonneesTransfert(JSON.stringify({ foo: 1 }))).toBeNull();
    expect(lireDonneesTransfert(null)).toBeNull();
  });
});

describe('Plateforme', () => {
  it('distingue l’app Android native de l’app iPhone', () => {
    expect(plateformeNative()).toBeNull();
    (window as { Capacitor?: unknown }).Capacitor = { isNativePlatform: () => true, getPlatform: () => 'android' };
    expect(plateformeNative()).toBe('android');
    expect(apiUrl('/api/stats')).toBe('/api/stats'); // même origine que le site chargé
    (window as { Capacitor?: unknown }).Capacitor = { isNativePlatform: () => true, getPlatform: () => 'ios' };
    expect(plateformeNative()).toBe('ios');
    expect(apiUrl('/api/stats')).toBe('https://mychronos.fr/api/stats');
  });
});

describe('Page du navigateur (mychronos.fr/transfert)', () => {
  it('données présentes : résumé et envoi vers l’app', () => {
    store.set('chronos_data', JSON.stringify(donnees()));
    render(<Transfert />);
    expect(document.body.textContent).toMatch(/2 congés posés/);
    expect(document.body.textContent).toMatch(/rien n’est effacé/);
    expect(screen.getByRole('button', { name: /Envoyer dans l’application/ })).toBeTruthy();
  });

  it('aucune donnée : retour à l’app, qui proposera un autre navigateur', () => {
    render(<Transfert />);
    expect(screen.getByText('Aucune donnée ici')).toBeTruthy();
    expect(screen.getByRole('link', { name: /Revenir dans l’application/ }).getAttribute('href')).toBe(`${LIEN_RETOUR}?d=`);
  });
});

describe('Écran de récupération dans l’app Android', () => {
  it('ouvre le navigateur, puis demande confirmation avant d’importer', async () => {
    const onRecupere = vi.fn();
    render(<RecuperationAndroid onRecupere={onRecupere} />);
    fireEvent.click(screen.getByRole('button', { name: /Récupérer mes données/ }));
    expect(ouvrirNavigateur).toHaveBeenCalledWith({ url: `${window.location.origin}/transfert`, paquet: undefined });
    expect(await screen.findByText(/Envoyer dans l’application/)).toBeTruthy();

    const d = await encoderTransfert(JSON.stringify(donnees()));
    await act(async () => rappelTransfert!({ donnees: d }));
    expect(await screen.findByText('Données trouvées')).toBeTruthy();
    expect(document.body.textContent).toMatch(/2 congés posés/);
    expect(onRecupere).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /Récupérer ces données/ }));
    expect(onRecupere).toHaveBeenCalledTimes(1);
    expect(onRecupere.mock.calls[0][0].data.events).toHaveLength(1);
  });

  it('navigateur vide : propose les autres navigateurs du téléphone', async () => {
    render(<RecuperationAndroid onRecupere={vi.fn()} />);
    await act(async () => rappelTransfert!({ donnees: '' }));
    expect(await screen.findByText(/Aucune donnée My Chronos dans ce navigateur/)).toBeTruthy();
    // Samsung Internet (par défaut) a été essayé : Chrome est proposé.
    fireEvent.click(await screen.findByRole('button', { name: 'Chrome' }));
    expect(ouvrirNavigateur).toHaveBeenCalledWith({ url: `${window.location.origin}/transfert`, paquet: 'com.android.chrome' });
  });

  it('données illisibles : rien n’est importé', async () => {
    const onRecupere = vi.fn();
    render(<RecuperationAndroid onRecupere={onRecupere} />);
    await act(async () => rappelTransfert!({ donnees: 'g1.pasdugzip' }));
    expect(await screen.findByText(/illisibles/)).toBeTruthy();
    expect(onRecupere).not.toHaveBeenCalled();
  });
});
