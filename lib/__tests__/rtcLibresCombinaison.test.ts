// Retour d'un agent (16/10/2026) : 7h35 de RTC libres (au-delà des 83h30 gardés
// pour le CET) à compléter avec 4h33 d'HS pour une vacation de 12h08. L'app
// proposait 6h04 RTC + 6h04 HS (moitié-moitié) au lieu de tout le RTC libre.

import { describe, it, expect } from 'vitest';
import { generateAllCombinations, getCombinationSummary } from '../optimization';
import { DEFAULT_COUNTERS } from '../storage';
import type { Counters } from '../types';

const h = (a: number, b = 0) => a * 60 + b;
const C = (o: Partial<Counters>): Counters =>
  ({ ...DEFAULT_COUNTERS, ca: 0, cf: 0, caHP: 0, rtcReservesCET: h(83, 30), ...o }) as Counters;
const top3 = (c: Counters) =>
  generateAllCombinations(1, c, new Date(2026, 10, 3), h(12, 8)).slice(0, 3).map(getCombinationSummary);

describe('Une vacation en heures : tout le RTC libre d’abord, sans entamer la réserve CET', () => {
  it('7h35 de RTC libres + HS : 7h35 RTC + 4h33 HS proposé, plus de moitié-moitié', () => {
    const t = top3(C({ rtc: h(83, 30) + h(7, 35), hs: h(10), rps: 0 }));
    expect(t[0]).toBe('7h35 RTC + 4h33 HS');
    expect(t).not.toContain('6h04 RTC + 6h04 HS');
  });

  it('avec aussi des RPS : RTC libre complété par RPS ou HS, les deux proposés', () => {
    const t = top3(C({ rtc: h(83, 30) + h(7, 35), hs: h(10), rps: h(10) }));
    expect(t.slice(0, 2)).toEqual(['7h35 RTC + 4h33 RPS', '7h35 RTC + 4h33 HS']);
  });

  it('sans réserve CET (agent qui n’en garde pas) : rien ne change, une journée entière de RTC', () => {
    const t = top3(C({ rtc: h(91, 5), rtcReservesCET: 0, rtcJoursCET: 0, hs: h(10) }));
    expect(t[0]).toBe('1j RTC');
  });
});
