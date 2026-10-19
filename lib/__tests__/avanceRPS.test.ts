// Avance de RPS : guide APORTT, « Temps compensés (ou RPS) » — « Pour faciliter
// la gestion des RPS, des avances peuvent être consenties dès le début de
// l'année. » Cas remonté : 2/2/3 de nuit en 12h08, 31h36 de RPS, 3 nuits posées
// (36h24) → GesTT passe le solde à -4h48 au lieu de compléter par des HS.

import { describe, it, expect } from 'vitest';
import { formatMinutes, simulatePose } from '../calculations';
import { canAfford } from '../optimization';
import { DEFAULT_COUNTERS } from '../storage';
import type { Counters } from '../types';

const h = (a: number, b = 0) => a * 60 + b;
const C: Counters = { ...DEFAULT_COUNTERS, rps: h(31, 36), hs: h(20) };
const TROIS_NUITS = h(36, 24);
const JOUR = new Date(2026, 10, 3);

describe('Avance de RPS', () => {
  it('sans avance : refusée au-delà du solde (comportement par défaut)', () => {
    expect(simulatePose(C, 'rps', TROIS_NUITS, JOUR).isValid).toBe(false);
    expect(canAfford([{ type: 'rps', amount: 3, amountMinutes: TROIS_NUITS }], C, h(12, 8)).ok).toBe(false);
  });

  it('avec avance : le solde devient négatif (-4h48), sans toucher aux HS', () => {
    const r = simulatePose(C, 'rps', TROIS_NUITS, JOUR, { avanceRPS: true });
    expect(r.isValid).toBe(true);
    expect(r.newCounters.rps).toBe(-h(4, 48));
    expect(r.newCounters.hs).toBe(h(20));
    expect(canAfford([{ type: 'rps', amount: 3, amountMinutes: TROIS_NUITS }], C, h(12, 8), true).ok).toBe(true);
  });

  it('l’avance ne vaut que pour les RPS', () => {
    expect(canAfford([{ type: 'hs', amount: 2, amountMinutes: h(24, 16) }], C, h(12, 8), true).ok).toBe(false);
  });

  it('un solde négatif s’affiche correctement', () => {
    expect(formatMinutes(-h(4, 48))).toBe('-4h48');
    expect(formatMinutes(-30)).toBe('-0h30');
    expect(formatMinutes(h(31, 36))).toBe('31h36');
  });
});

describe('Après une avance (RPS négatifs)', () => {
  it('les propositions automatiques n’utilisent pas de RPS et restent payables', async () => {
    const { generateAllCombinations } = await import('../optimization');
    const enAvance: Counters = { ...C, rps: -h(4, 48), ca: 10, hs: h(30) };
    const combis = generateAllCombinations(2, enAvance, JOUR, 2 * h(12, 8));
    expect(combis.length).toBeGreaterThan(0);
    for (const c of combis) {
      expect(c.items.some((i) => i.type === 'rps')).toBe(false);
      expect(canAfford(c.items, enAvance, h(12, 8)).ok).toBe(true);
    }
  });
});
