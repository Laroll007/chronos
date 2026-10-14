// Filet de sécurité (rappel de sauvegarde) et diagnostic des pertes de données.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

vi.mock('../analytics', () => ({ track: vi.fn(), trackError: vi.fn() }));

import { noterRappelSauvegarde, noterSauvegarde, rappelSauvegardeDu } from '../sauvegarde';
import { navigateurHote, profilDiagnostic } from '../diagnostic';
import { PROFILE_KEY_RE } from '../stats-events';
import { SauvegardePrompt } from '@/components/dashboard/SauvegardePrompt';

let store: Map<string, string>;
beforeEach(() => {
  store = new Map();
  vi.mocked(localStorage.getItem).mockImplementation((k) => store.get(k) ?? null);
  vi.mocked(localStorage.setItem).mockImplementation((k, v) => void store.set(k, String(v)));
});
afterEach(cleanup);

const J = 86_400_000;
const t0 = Date.UTC(2026, 9, 14);

describe('Rappel de sauvegarde', () => {
  it('jamais sur l’iPhone (copie native)', () => {
    expect(rappelSauvegardeDu(true, t0)).toBe(false);
  });

  it('jamais sauvegardé : tout de suite, puis tous les 3 jours', () => {
    expect(rappelSauvegardeDu(false, t0)).toBe(true);
    noterRappelSauvegarde(t0);
    expect(rappelSauvegardeDu(false, t0 + 2 * J)).toBe(false);
    expect(rappelSauvegardeDu(false, t0 + 3 * J)).toBe(true);
  });

  it('sauvegarde récente : rien ; plus de 30 jours : une fois par semaine', () => {
    noterSauvegarde(t0);
    expect(rappelSauvegardeDu(false, t0 + 10 * J)).toBe(false);
    expect(rappelSauvegardeDu(false, t0 + 31 * J)).toBe(true);
    noterRappelSauvegarde(t0 + 31 * J);
    expect(rappelSauvegardeDu(false, t0 + 35 * J)).toBe(false);
  });

  it('la fenêtre annonce le bug identifié et la correction en cours', () => {
    render(<SauvegardePrompt onClose={vi.fn()} />);
    expect(document.body.textContent).toMatch(/un bug peut effacer les données/);
    expect(document.body.textContent).toMatch(/nous travaillons sur une correction/);
    expect(screen.getByRole('button', { name: /Enregistrer ma sauvegarde/ })).toBeTruthy();
  });
});

describe('Diagnostic anonyme', () => {
  it('reconnaît le navigateur hôte', () => {
    expect(navigateurHote('Mozilla/5.0 (Linux; Android 14; SM-S901B) AppleWebKit/537.36 SamsungBrowser/27.0 Chrome/125')).toBe('samsung');
    expect(navigateurHote('Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/141.0 Mobile Safari/537.36')).toBe('chrome');
  });

  it('profil : vide sur l’iPhone, clés acceptées par le serveur ailleurs', () => {
    expect(profilDiagnostic('ios')).toEqual([]);
    expect(profilDiagnostic('android')).toEqual(['nav:app_native']);
    for (const cle of [...profilDiagnostic(null), ...profilDiagnostic('android'), 'stockage:protege', 'stockage:non_protege', 'nav:samsung']) {
      expect(PROFILE_KEY_RE.test(cle)).toBe(true);
    }
  });
});
