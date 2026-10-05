import { describe, it, expect } from 'vitest';
import { repartirApportCET } from '../cet';
import { getRTCLibres, reserveRTC, reserveHS } from '../calculations';
import { generateAllCombinations } from '../optimization';
import { DEFAULT_COUNTERS } from '../storage';
import type { Counters } from '../types';

const h = (hh: number, mm = 0) => hh * 60 + mm;
const C = (o: Partial<Counters>): Counters => ({ ...DEFAULT_COUNTERS, ...o });

describe('Ce que je garde pour le CET (retours terrain)', () => {
  it('sans réglage : 83h30 de RTC protégés, aucune HS', () => {
    const c = C({});
    expect(reserveRTC(c)).toBe(h(83, 30));
    expect(reserveHS(c)).toBe(0);
  });

  it('« je ne mets que 9 RTC » : 75h09 protégés, versement conseillé limité à 9 RTC', () => {
    const c = C({ cet: 20, rtc: h(150), rtcJoursCET: 9, ca: 0, caHP: 0, hs: 0 });
    expect(reserveRTC(c)).toBe(9 * h(8, 21));
    expect(getRTCLibres(c.rtc, reserveRTC(c))).toBe(h(150) - 9 * h(8, 21));
    const { capacite, apport } = repartirApportCET(c);
    expect(capacite).toBe(10);
    expect(apport.rtc).toBe(9);
  });

  it('« 2 ou 3 selon la place » : 2 jours d’HS gardés passent avant les CA HP', () => {
    // CET à 55 j : 5 jours de place → 3 RTC + 2 HS gardées, plus de place pour les CA HP
    const c = C({ cet: 55, rtc: h(100), rtcJoursCET: 3, hsJoursCET: 2, hs: h(30), caHP: 2, ca: 0 });
    const { capacite, apport } = repartirApportCET(c);
    expect(capacite).toBe(5);
    expect(apport).toMatchObject({ rtc: 3, hs: 2, caHP: 0 });
  });

  it('sans réglage, le comportement 1.14 est inchangé (RTC jusqu’à remplir la place)', () => {
    const { apport } = repartirApportCET(C({ cet: 0, rtc: h(188, 9), ca: 0, caHP: 0, hs: 0 }));
    expect(apport.rtc).toBe(22);
  });

  it('les HS gardées ne sont pas proposées en premier à la pose', () => {
    const c = C({ ca: 0, caHP: 0, cf: 0, hasCF: false, rtc: 0, hasRTC: false, rps: h(12, 8), hs: h(12, 8), hsJoursCET: 1 });
    const combos = generateAllCombinations(1, c, new Date(2026, 9, 13), h(12, 8));
    expect(combos[0].items.map((i) => i.type)).toEqual(['rps']);
  });
});
