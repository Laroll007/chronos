// Fenêtre du sondage « Préparons 2027 » : parcours confirmer / corriger /
// question ARTT / plus tard, et envoi anonyme.

import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { DEFAULT_COUNTERS } from '../storage';
import type { Counters, CycleConfig } from '../types';

const track = vi.fn();
let statsActives = true;
vi.mock('@/lib/analytics', () => ({
  track: (e: string) => track(e),
  trackError: vi.fn(),
  isStatsEnabled: () => statsActives,
  detectPlatform: () => 'android',
}));
const { Sondage2027 } = await import('@/components/dashboard/Sondage2027');

const fetchMock = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true }) }));
beforeEach(() => {
  statsActives = true;
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  fetchMock.mockClear();
  track.mockClear();
});

const h = (a: number, b = 0) => a * 60 + b;
const S = { lundi: true, mardi: true, mercredi: true, jeudi: true, vendredi: true, samedi: false, dimanche: false };
const NUIT: CycleConfig = {
  type: 'alterne', pattern: '2/2/3/2/2/3', heuresParJour: h(12, 8), heureDebut: h(19),
  dateDebutCycle: '2026-01-05', semaineActuelle: 'A', semaineA: S, semaineB: S,
};
const C = (o: Partial<Counters> = {}) => ({ ...DEFAULT_COUNTERS, hasCF: true, hasRTC: true, ...o }) as Counters;

function ouvrir(counters = C()) {
  const props = { onRepondre: vi.fn(), onPlusTard: vi.fn(), onClose: vi.fn() };
  render(<Sondage2027 cycleConfig={NUIT} counters={counters} {...props} />);
  return props;
}
const corpsEnvoye = () => JSON.parse((fetchMock.mock.calls[0] as unknown as [string, { body: string }])[1].body);

describe('Sondage « Préparons 2027 »', () => {
  it('montre ce que l’app créditera pour le cycle de l’agent', () => {
    ouvrir();
    expect(screen.getByText('2/2/3 · nuit · 12h08')).toBeTruthy();
    expect(screen.getByText('18 j')).toBeTruthy();
    expect(screen.getByText('188h09')).toBeTruthy();
    expect(screen.getByText('109h12')).toBeTruthy();
    expect(track).toHaveBeenCalledWith('sondage_vu');
  });

  it('« Oui, c’est bien ça » : réponse enregistrée et envoyée sans chiffres', () => {
    const { onRepondre } = ouvrir();
    fireEvent.click(screen.getByRole('button', { name: /Oui, c’est bien ça/ }));
    expect(onRepondre).toHaveBeenCalledWith(expect.objectContaining({ reponse: 'confirme' }));
    expect(corpsEnvoye()).toEqual({ profil: 'alterne|2/2/3/2/2/3|12h08|nuit', plateforme: 'android', version: expect.any(String), reponse: 'confirme' });
    expect(screen.getByText('Votre 1er janvier est prêt')).toBeTruthy();
  });

  it('« Non, je corrige » : seules les valeurs modifiées sont envoyées, et appliquées par défaut', () => {
    const { onRepondre } = ouvrir();
    fireEvent.click(screen.getByRole('button', { name: /Non, je corrige/ }));
    fireEvent.change(screen.getByLabelText('RTC : heures'), { target: { value: '165' } });
    fireEvent.change(screen.getByLabelText('RTC : minutes'), { target: { value: '54' } });
    fireEvent.click(screen.getByRole('button', { name: 'Arrêt maladie' }));
    fireEvent.click(screen.getByRole('button', { name: 'Valider' }));
    expect(onRepondre).toHaveBeenCalledWith(expect.objectContaining({
      reponse: 'corrige', dotations: { rtc: h(165, 54) }, appliquer: true, motif: 'maladie',
    }));
    expect(corpsEnvoye()).toMatchObject({ reponse: 'corrige', dotations: { rtc: h(165, 54) }, motif: 'maladie' });
    expect(screen.getByText('165h54')).toBeTruthy(); // récapitulatif
  });

  it('agent en cycle avec un compteur ARTT : question dédiée', () => {
    const { onRepondre } = ouvrir(C({ hasARTT: true }));
    fireEvent.click(screen.getByRole('button', { name: /Oui, c’est bien ça/ }));
    expect(onRepondre).not.toHaveBeenCalled();
    expect(screen.getByText('Dans GesTT, c’est…')).toBeTruthy();
    fireEvent.click(screen.getByRole('radio', { name: /Deux compteurs différents/ }));
    fireEvent.change(screen.getByLabelText('Jours d’ARTT au 1er janvier'), { target: { value: '12' } });
    fireEvent.click(screen.getByRole('button', { name: 'Valider' }));
    expect(onRepondre).toHaveBeenCalledWith(expect.objectContaining({ reponse: 'confirme', artt: 'distinct', arttJours: 12 }));
  });

  it('« Plus tard » : rien n’est envoyé', () => {
    const { onPlusTard, onClose, onRepondre } = ouvrir();
    fireEvent.click(screen.getByRole('button', { name: 'Plus tard' }));
    expect(onPlusTard).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
    expect(onRepondre).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('statistiques désactivées : la réponse s’applique sur l’appareil mais n’est pas envoyée', () => {
    statsActives = false;
    const { onRepondre } = ouvrir();
    fireEvent.click(screen.getByRole('button', { name: /Oui, c’est bien ça/ }));
    expect(onRepondre).toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
