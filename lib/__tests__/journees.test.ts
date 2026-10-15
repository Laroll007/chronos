import { describe, it, expect } from 'vitest';
import { effetJournee, estFerie, formuleCorrespondante, joursFeries, natureDuJour } from '../journees';
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

describe('Rappel sur un repos : HS selon le barème, aucun RPS', () => {
  it('RL plus de 4h (12h30 → 02h00) : 2 vacations, pas de RPS', () => {
    const e = effetJournee(DIMANCHE, 'horaires', h(12, 30), h(2), JOUR);
    expect(e).toMatchObject({ duree: h(13, 30), hs: 2 * h(12, 8), rps: 0, rpsDelta: 0 });
    expect(e.rappel).toMatchObject({ defaut: '2vac', long: true, mode: '2vac' });
  });

  it('RL 4h au plus : 1 vacation (4h pile compte comme « 4h au plus »)', () => {
    expect(effetJournee(DIMANCHE, 'horaires', h(14), h(17), JOUR).hs).toBe(h(12, 8));
    expect(effetJournee(DIMANCHE, 'horaires', h(14), h(18), JOUR).hs).toBe(h(12, 8));
  });

  it('RC 4h au plus : 150 % des heures', () => {
    const e = effetJournee(SAMEDI, 'horaires', h(14), h(17), JOUR);
    expect(e).toMatchObject({ hs: h(4, 30), rps: 0 });
    expect(e.rappel?.defaut).toBe('150');
  });

  it('RC plus de 4h : non tranché, l’agent choisit (150 % ou 1 vacation) ou recopie GesTT', () => {
    const sansChoix = effetJournee(SAMEDI, 'horaires', h(12, 30), h(2), JOUR);
    expect(sansChoix.rappel?.modes).toEqual(['150', '1vac']);
    expect(sansChoix.rappel?.defaut).toBeUndefined();
    expect(sansChoix.hs).toBe(h(20, 15)); // repli : 150 %
    expect(effetJournee(SAMEDI, 'horaires', h(12, 30), h(2), JOUR, { mode: '1vac' }).hs).toBe(h(12, 8));
    expect(effetJournee(SAMEDI, 'horaires', h(12, 30), h(2), JOUR, { mode: 'libre', libre: h(21) }).hs).toBe(h(21));
  });

  it('HS recopiées de GesTT : rattachées à la formule correspondante (stats)', () => {
    expect(formuleCorrespondante(h(20, 15), h(13, 30), h(12, 8))).toBe('150');
    expect(formuleCorrespondante(h(24, 16), h(13, 30), h(12, 8))).toBe('2vac');
    expect(formuleCorrespondante(h(21), h(13, 30), h(12, 8))).toBe('autre');
  });

  it('régime hebdomadaire : 100 % par défaut (barème non confirmé), pas de RPS', () => {
    const HEBDO: CycleConfig = { ...JOUR, type: 'hebdo' };
    const e = effetJournee(DIMANCHE, 'horaires', h(9), h(15), HEBDO);
    expect(e).toMatchObject({ hs: h(6), rps: 0 });
    expect(e.rappel?.modes).toEqual(['100', '150', '200']);
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

  it('sur un repos (RC) 08h00–17h00 : rappel, sans RPS (plus de 4h : 150 % par défaut)', () => {
    const e = effetJournee(SAMEDI, 'stage', h(8), h(17), JOUR);
    expect(e).toMatchObject({ hs: h(13, 30), rps: 0 });
  });
});

// ─── Enregistrement / annulation (hook) ──────────────────────────────────────
import { act, renderHook, waitFor } from '@testing-library/react';
import { vi, beforeEach } from 'vitest';
import { STORAGE_KEY } from '../constants';
import { DEFAULT_COUNTERS } from '../storage';
import type { UserData } from '../types';

const track = vi.fn();
vi.mock('../analytics', () => ({ track: (e: string) => track(e), trackError: vi.fn() }));
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

  it('rappel sur un RL recopié de GesTT : +21h d’HS, aucun RPS, statistique, puis annulation exacte', async () => {
    const { result } = renderHook(() => useCounters());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let res: { hs: number; rps: number } | null = null;
    act(() => {
      res = result.current.enregistrerJoursModifies([
        { date: '2026-10-04', type: 'horaires', debut: h(12, 30), fin: h(2), choix: { mode: 'libre', libre: h(21) } },
      ]);
    });
    expect(res).toEqual({ hs: h(21), rps: 0 });
    expect(stored().counters).toMatchObject({ hs: h(31), rps: h(20) });
    expect(stored().joursModifies?.[0]).toMatchObject({ compensation: 'libre', hsLibre: h(21) });
    expect(track).toHaveBeenCalledWith('rappel_gestt_rl_long_autre');

    // Corrigé (règle : 2 vacations) : l'ancien crédit est retiré avant le nouveau
    act(() => {
      result.current.enregistrerJoursModifies([
        { date: '2026-10-04', type: 'horaires', debut: h(12, 30), fin: h(2), choix: { mode: '2vac' } },
      ]);
    });
    expect(stored().joursModifies).toHaveLength(1);
    expect(stored().counters.hs).toBe(h(10) + 2 * h(12, 8));
    expect(track).toHaveBeenCalledWith('rappel_choix_rl_long_2vac');

    act(() => { result.current.supprimerJourModifie('2026-10-04'); });
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
