import { describe, it, expect } from 'vitest';
import { effetJournee, estFerie, joursFeries, natureDuJour } from '../journees';
import { baremeRPSDepuisHoraires } from '../rps';
import type { CycleConfig } from '../types';

const h = (hh: number, mm = 0) => hh * 60 + mm;
const SEMAINE = { lundi: true, mardi: true, mercredi: true, jeudi: true, vendredi: true, samedi: false, dimanche: false };
// Lundi→vendredi travaillés 07h00–19h08 ; samedi = RC, dimanche = RL (dernier repos)
const JOUR: CycleConfig = {
  type: 'alterne', pattern: '2/2/3/2/2/3', heuresParJour: h(12, 8), heureDebut: h(7),
  dateDebutCycle: '2026-09-28', semaineActuelle: 'A', semaineA: SEMAINE, semaineB: SEMAINE,
  rpsParJour: baremeRPSDepuisHoraires(h(7), h(12, 8)),
};
const SAMEDI = new Date(2026, 9, 3);
const DIMANCHE = new Date(2026, 9, 4);
const MERCREDI = new Date(2026, 9, 7);

describe('Jours fériés et nature du jour', () => {
  it('fériés mobiles calculés depuis Pâques', () => {
    const f = joursFeries(2027);
    expect(f.has('2027-03-29')).toBe(true); // lundi de Pâques
    expect(f.has('2027-05-06')).toBe(true); // Ascension
    expect(f.has('2027-05-17')).toBe(true); // lundi de Pentecôte
    expect(estFerie(new Date(2026, 6, 14))).toBe(true);
    expect(estFerie(new Date(2026, 6, 15))).toBe(false);
  });

  it('le dernier jour de repos est le RL, les précédents des RC', () => {
    expect(natureDuJour(SAMEDI, JOUR)).toBe('RC');
    expect(natureDuJour(DIMANCHE, JOUR)).toBe('RL');
    expect(natureDuJour(MERCREDI, JOUR)).toBe('travail');
  });
});

describe('Travail sur un repos (venue du pape : 12h30 → 02h00)', () => {
  it('sur un RC (samedi) : 13h30 d’HS ; RPS 0,25 puis 0,60 sur le RL d’après minuit', () => {
    const e = effetJournee(SAMEDI, 'horaires', h(12, 30), h(2), JOUR);
    expect(e.hs).toBe(h(13, 30));
    // sam. 12h30–24h : 11h30 × 0,25 = 2h52,5 ; dim. 0h–2h (RL) : 2h × 0,60 = 1h12
    expect(e.rps).toBe(245);
    expect(e.rpsDelta).toBe(245);
  });

  it('sur un RL (dimanche) : 0,60 l’emporte sur le 0,4 du dimanche, puis nuit 0,1 le lundi', () => {
    const e = effetJournee(DIMANCHE, 'horaires', h(12, 30), h(2), JOUR);
    // dim. 11h30 × 0,60 = 6h54 ; lun. 0h–2h hors vacation, jour travaillé : nuit 0,1 = 12 min
    expect(e.rps).toBe(414 + 12);
  });
});

describe('Jour travaillé modifié', () => {
  it('dépassement jusqu’à 21h30 : 2h22 d’HS et RPS de nuit sur les 30 dernières minutes', () => {
    const e = effetJournee(MERCREDI, 'horaires', h(7), h(21, 30), JOUR);
    expect(e.hs).toBe(h(2, 22));
    expect(e.rps).toBe(3);
  });

  it('prise décalée 10h00–22h08 : pas d’HS, RPS de nuit sur 21h–22h08', () => {
    const e = effetJournee(MERCREDI, 'horaires', h(10), h(22, 8), JOUR);
    expect(e.hs).toBe(0);
    expect(e.rps).toBe(7);
  });

  it('fin anticipée : heures manquantes signalées, pas d’HS', () => {
    const e = effetJournee(MERCREDI, 'horaires', h(7), h(15), JOUR);
    expect(e.hs).toBe(0);
    expect(e.manque).toBe(h(4, 8));
  });

  it('horaires identiques à la vacation de nuit habituelle : aucun écart', () => {
    const NUIT = { ...JOUR, heureDebut: h(19, 30), rpsParJour: baremeRPSDepuisHoraires(h(19, 30), h(12, 8)) };
    const e = effetJournee(MERCREDI, 'horaires', h(19, 30), h(7, 38), NUIT);
    expect(e).toMatchObject({ hs: 0, rps: 54, rpsDelta: 0 });
  });

  it('heures en plus un jour férié travaillé : 0,60 sur les heures hors vacation', () => {
    const QUATORZE = new Date(2027, 6, 14); // mercredi
    const e = effetJournee(QUATORZE, 'horaires', h(7), h(20, 8), JOUR);
    expect(e.hs).toBe(60);
    expect(e.rps).toBe(36); // 1h × 0,60
  });
});

describe('Stage', () => {
  it('sur un jour travaillé : remplace la vacation, aucun effet', () => {
    expect(effetJournee(MERCREDI, 'stage', undefined, undefined, JOUR)).toMatchObject({ hs: 0, rps: 0, rpsDelta: 0 });
  });

  it('sur un repos (RC) 08h00–17h00 : rappel → 9h d’HS et RPS 0,25', () => {
    const e = effetJournee(SAMEDI, 'stage', h(8), h(17), JOUR);
    expect(e).toMatchObject({ hs: h(9), rps: 135 });
  });
});

// ─── Enregistrement / annulation (hook) ──────────────────────────────────────
import { act, renderHook, waitFor } from '@testing-library/react';
import { vi, beforeEach } from 'vitest';
import { STORAGE_KEY } from '../constants';
import { DEFAULT_COUNTERS } from '../storage';
import type { UserData } from '../types';

vi.mock('../analytics', () => ({ track: vi.fn(), trackError: vi.fn() }));
const { useCounters } = await import('@/hooks/useCounters');

describe('Journées modifiées : crédit et annulation', () => {
  let store: Map<string, string>;
  beforeEach(() => {
    store = new Map();
    vi.mocked(localStorage.getItem).mockImplementation((k) => store.get(k) ?? null);
    vi.mocked(localStorage.setItem).mockImplementation((k, v) => void store.set(k, String(v)));
    vi.mocked(localStorage.removeItem).mockImplementation((k) => void store.delete(k));
    const data: UserData = {
      cycleConfig: JOUR,
      counters: { ...DEFAULT_COUNTERS, hs: h(10), rps: h(20), rpsDernierCredit: '2099-01-01' },
      history: [],
      lastUpdated: new Date().toISOString(),
      lastResetYear: new Date().getFullYear(),
      schemaVersion: 99,
      isOnboarded: true,
    };
    store.set(STORAGE_KEY, JSON.stringify(data));
  });
  const stored = () => JSON.parse(store.get(STORAGE_KEY)!) as UserData;

  it('venue du pape sur un RC : +13h30 HS et +4h05 RPS, puis annulation exacte', async () => {
    const { result } = renderHook(() => useCounters());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let res: { hs: number; rps: number } | null = null;
    act(() => { res = result.current.enregistrerJoursModifies([{ date: '2026-10-03', type: 'horaires', debut: h(12, 30), fin: h(2) }]); });
    expect(res).toEqual({ hs: h(13, 30), rps: 245 });
    expect(stored().counters).toMatchObject({ hs: h(23, 30), rps: h(20) + 245 });

    // Corrigée (fin à minuit) : l'ancien crédit est retiré avant le nouveau
    act(() => { result.current.enregistrerJoursModifies([{ date: '2026-10-03', type: 'horaires', debut: h(12, 30), fin: 0 }]); });
    expect(stored().joursModifies).toHaveLength(1);
    expect(stored().counters.hs).toBe(h(10) + h(11, 30));

    act(() => { result.current.supprimerJourModifie('2026-10-03'); });
    expect(stored().counters).toMatchObject({ hs: h(10), rps: h(20) });
    expect(stored().joursModifies).toEqual([]);
  });
});

describe('Agent inscrit avant l’ajout des horaires', () => {
  it('ancien « service de nuit » : vacation supposée à 19h00, ses heures de nuit restent « dans la vacation »', () => {
    const { heureDebut: _h, ...sansHoraires } = JOUR;
    const ancienNuit = { ...sansHoraires, heuresParJour: h(11, 8), rpsParJour: { lundi: 67, mardi: 67, mercredi: 67, jeudi: 67, vendredi: 67, samedi: 67, dimanche: 267 } };
    // Vendredi 19h00 → samedi 06h08 (samedi = RC) : pas de bonus RC sur les heures d'après minuit
    const e = effetJournee(new Date(2026, 9, 2), 'horaires', h(19), h(6, 8), ancienNuit);
    expect(e.hs).toBe(0);
    expect(e.rps).toBe(54); // 9h de nuit × 0,1, comme GesTT
  });
});
