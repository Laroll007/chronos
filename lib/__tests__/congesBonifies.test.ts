// Congés bonifiés : 31 jours consécutifs au maximum, repos de cycle et fériés
// inclus (guide DNPAF) → décomptés en jours calendaires, pas en jours travaillés.

import { describe, it, expect } from 'vitest';
import { generateAllCombinations, getCombinationSummary } from '../optimization';
import { simulatePose } from '../calculations';
import { DEFAULT_COUNTERS } from '../storage';
import type { Counters } from '../types';

const C = (o: Partial<Counters> = {}): Counters =>
  ({ ...DEFAULT_COUNTERS, ca: 2, cf: 0, rtc: 0, hasCongesBonifies: true, congesBonifies: 31, ...o }) as Counters;

describe('Congés bonifiés', () => {
  it('un mois en 3/3 (18 jours travaillés, 31 jours calendaires) : 31 jours décomptés', () => {
    const combos = generateAllCombinations(18, C(), new Date(2026, 6, 1), 18 * 728, 31);
    const cb = combos.find((c) => c.items.some((i) => i.type === 'congesBonifies'))!;
    expect(cb.items).toEqual([expect.objectContaining({ type: 'congesBonifies', amount: 31 })]);
    expect(getCombinationSummary(cb)).toBe('31j Congés Bon.');
    expect(simulatePose(C(), 'congesBonifies', 31, new Date(2026, 6, 1)).newCounters.congesBonifies).toBe(0);
  });

  it('jamais mélangés avec un autre compteur', () => {
    const combos = generateAllCombinations(18, C({ ca: 30 }), new Date(2026, 6, 1), 18 * 728, 31);
    for (const c of combos) {
      if (c.items.some((i) => i.type === 'congesBonifies')) expect(c.items).toHaveLength(1);
    }
  });

  it('période plus longue que le solde : pas proposés', () => {
    const combos = generateAllCombinations(20, C({ congesBonifies: 25 }), new Date(2026, 6, 1), 20 * 728, 31);
    expect(combos.some((c) => c.items.some((i) => i.type === 'congesBonifies'))).toBe(false);
  });
});
