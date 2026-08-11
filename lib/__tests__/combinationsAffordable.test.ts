/**
 * Garantie centrale du moteur d'optimisation : une combinaison PROPOSÉE doit être
 * POSABLE.
 *
 * Régression protégée : `toWorkingDays` arrondissait au dixième de jour le plus
 * proche, donnant à l'app jusqu'à ~36 min de solde imaginaire. Un agent avec
 * 108h42 de CF se voyait proposer « 9j CF » (= 109h12) noté 100/100 — seule
 * option — puis refuser à la pose. L'échec laissait alors les items déjà posés
 * en place et trouait la période.
 */
import { describe, it, expect } from 'vitest';
import {
  generateAllCombinations,
  canAfford,
  createCombination,
  isDayBasedType,
} from '@/lib/optimization';
import { countWorkingDays, countWorkingMinutes } from '@/lib/calculations';
import { DEFAULT_COUNTERS, DEFAULT_CYCLE_CONFIG } from '@/lib/storage';
import { HEURES_PAR_JOUR } from '@/lib/constants';
import type { Counters } from '@/lib/types';

const cfg = DEFAULT_CYCLE_CONFIG;
const C = (over: Partial<Counters> = {}): Counters => ({ ...DEFAULT_COUNTERS, ...over });

/** Trouve une plage réelle contenant exactement `nb` jours travaillés. */
function plage(nb: number, from = new Date(2026, 6, 6)) {
  const start = new Date(from);
  const end = new Date(start);
  while (countWorkingDays(start, end, cfg) < nb) end.setDate(end.getDate() + 1);
  return {
    start,
    end,
    workingDays: countWorkingDays(start, end, cfg),
    workingMinutes: countWorkingMinutes(start, end, cfg),
  };
}

// Profils volontairement variés, dont plusieurs soldes « juste en dessous »
// d'un nombre entier de journées — la zone où l'ancien arrondi se trompait.
const PROFILS: { label: string; counters: Counters; jours: number }[] = [
  { label: 'profil neuf', counters: C(), jours: 3 },
  { label: 'CF 30 min sous 9 jours', counters: C({ ca: 0, cf: 9 * 728 - 30, rtc: 0, hasRTC: false, rps: 0, hs: 0 }), jours: 9 },
  { label: 'CF 1 min sous 5 jours', counters: C({ ca: 0, cf: 5 * 728 - 1, rtc: 0, hasRTC: false, rps: 0, hs: 0 }), jours: 5 },
  { label: 'RTC 20 min sous 4 jours', counters: C({ ca: 0, cf: 0, hasCF: false, rtc: 4 * 728 - 20, rps: 0, hs: 0 }), jours: 4 },
  { label: 'compteurs presque vides', counters: C({ ca: 1, cf: 400, rtc: 900, rps: 120, hs: 60 }), jours: 2 },
  { label: 'profil complet, longue période', counters: C({ ca: 18, cf: 6552, rtc: 11229, rps: 5000, hs: 3000 }), jours: 15 },
  { label: 'autres corps (ARTT + CA ant.)', counters: C({ ca: 5, hasARTT: true, artt: 20, caAnterieur: 4, cf: 0, hasCF: false, rtc: 0, hasRTC: false }), jours: 4 },
  { label: 'tout à zéro', counters: C({ ca: 0, cf: 0, hasCF: false, rtc: 0, hasRTC: false, rps: 0, hs: 0 }), jours: 3 },
];

describe('Combinaisons proposées = combinaisons posables', () => {
  it.each(PROFILS)('$label : aucune proposition impossible', ({ counters, jours }) => {
    const p = plage(jours);
    const combos = generateAllCombinations(p.workingDays, counters, p.start, p.workingMinutes);
    const dayMin = p.workingMinutes / p.workingDays;

    for (const combo of combos) {
      const verdict = canAfford(combo.items, counters, dayMin);
      expect(
        verdict.ok,
        `combinaison impossible proposée : ${combo.items
          .map((i) => `${i.type}=${i.amountMinutes}`)
          .join(' + ')}`
      ).toBe(true);
    }
  });

  it('ne propose plus « 9j CF » à un agent qui a 108h42 (le bug d’origine)', () => {
    const counters = C({ ca: 0, cf: 108 * 60 + 42, rtc: 0, hasRTC: false, rps: 0, hs: 0 });
    const p = plage(9);
    const combos = generateAllCombinations(p.workingDays, counters, p.start, p.workingMinutes);

    expect(combos).toHaveLength(0); // il ne peut réellement pas couvrir 9 jours
  });

  it('complète le reliquat avec un autre compteur horaire quand c’est possible', () => {
    // 108h42 de CF ne couvrent que 8 jours pleins ; 30 min de RTC bouclent le 9e.
    const counters = C({ ca: 0, cf: 108 * 60 + 42, rtc: 600, rps: 0, hs: 0 });
    const p = plage(9);
    const combos = generateAllCombinations(p.workingDays, counters, p.start, p.workingMinutes);

    expect(combos.length).toBeGreaterThan(0);
    const top = combos[0];
    expect(top.items.map((i) => i.type).sort()).toEqual(['cf', 'rtc']);
    // Le total couvre exactement la période, sans dépasser les soldes.
    const total = top.items.reduce((s, i) => s + (i.amountMinutes ?? 0), 0);
    expect(total).toBe(p.workingMinutes);
    expect(canAfford(top.items, counters, p.workingMinutes / p.workingDays).ok).toBe(true);
  });

  it('ne propose pas deux fois la même répartition', () => {
    const counters = C({ ca: 0, cf: 108 * 60 + 42, rtc: 600, rps: 0, hs: 0 });
    const p = plage(9);
    const combos = generateAllCombinations(p.workingDays, counters, p.start, p.workingMinutes);

    const signatures = combos.map((c) =>
      c.items.map((i) => `${i.type}:${Math.round(i.amountMinutes ?? i.amount)}`).sort().join('|')
    );
    expect(new Set(signatures).size).toBe(signatures.length);
  });
});

describe('canAfford', () => {
  it('accepte une combinaison couverte par les soldes', () => {
    const counters = C({ ca: 5, cf: 3 * HEURES_PAR_JOUR });
    const combo = createCombination(
      [{ type: 'cf', amount: 3 }, { type: 'ca', amount: 2 }],
      counters,
      new Date(2026, 6, 6)
    );
    expect(canAfford(combo.items, counters).ok).toBe(true);
  });

  it('détecte le manque et le chiffre dans la bonne unité', () => {
    const counters = C({ ca: 1, cf: 3 * HEURES_PAR_JOUR });
    const combo = createCombination(
      [{ type: 'cf', amount: 3 }, { type: 'ca', amount: 2 }],
      counters,
      new Date(2026, 6, 6)
    );
    const verdict = canAfford(combo.items, counters);
    expect(verdict.ok).toBe(false);
    expect(verdict.shortfalls).toHaveLength(1);
    expect(verdict.shortfalls[0]).toMatchObject({ type: 'ca', missing: 1 });
  });

  it('cumule un même compteur apparaissant deux fois', () => {
    const counters = C({ cf: 2 * HEURES_PAR_JOUR });
    const items = [
      { type: 'cf' as const, amount: 1.5, amountMinutes: Math.round(1.5 * HEURES_PAR_JOUR) },
      { type: 'cf' as const, amount: 1, amountMinutes: HEURES_PAR_JOUR },
    ];
    expect(canAfford(items, counters).ok).toBe(false);
  });

  it('traite un compteur désactivé comme un solde nul', () => {
    const counters = C({ hasARTT: false, artt: 12 });
    expect(canAfford([{ type: 'artt', amount: 2 }], counters).ok).toBe(false);
  });

  it('compare en minutes exactes, pas en jours arrondis', () => {
    // 30 min de moins que 9 journées pleines : l'ancien arrondi validait, plus maintenant.
    const counters = C({ cf: 9 * HEURES_PAR_JOUR - 30 });
    const items = [{ type: 'cf' as const, amount: 9, amountMinutes: 9 * HEURES_PAR_JOUR }];
    const verdict = canAfford(items, counters);
    expect(verdict.ok).toBe(false);
    expect(verdict.shortfalls[0].missing).toBe(30);
  });
});

describe('unités', () => {
  it('les types en jours ne sont jamais convertis en minutes', () => {
    for (const t of ['ca', 'caHP', 'cet', 'artt', 'rtt', 'caAnterieur'] as const) {
      expect(isDayBasedType(t)).toBe(true);
    }
    for (const t of ['cf', 'rtc', 'rps', 'hs', 'hsHistorique'] as const) {
      expect(isDayBasedType(t)).toBe(false);
    }
  });
});
