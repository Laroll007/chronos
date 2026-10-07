import { describe, it, expect } from 'vitest';
import { getCATotalForCycle, getRTCAnnuel, reserveRTCConseillee } from '../calculations';
import { repartirApportCET } from '../cet';
import { DEFAULT_COUNTERS, DEFAULT_CYCLE_CONFIG, migrateUserData } from '../storage';
import type { CycleConfig, UserData } from '../types';

// Grille officielle « cas de figure pour un taux plein (100 %) », colonne CEA.
const h = (hh: number, mm = 0) => hh * 60 + mm;
const cycle = (pattern: CycleConfig['pattern'], heuresParJour: number): CycleConfig =>
  ({ ...DEFAULT_CYCLE_CONFIG, type: 'alterne', pattern, heuresParJour });

describe('Dotations de la grille officielle (CEA, taux plein)', () => {
  it.each([
    ['2/2/3/2/2/3 à 12h08', cycle('2/2/3/2/2/3', h(12, 8)), 18, h(188, 9), 22],
    ['3/3 à 12h08', cycle('3/3', h(12, 8)), 18, h(188, 9), 22],
    ['2/2/3/2/2/3 à 11h08', cycle('2/2/3/2/2/3', h(11, 8)), 18, h(53, 27), 6],
    ['3/3 à 11h08 (nuit 19h → 06h08)', cycle('3/3', h(11, 8)), 18, h(53, 27), 6],
    ['4/2', cycle('4/2', h(8, 10)), 23, h(41, 45), 5],
    ['vacation forte', cycle('vacation_forte', h(9, 31)), 20, h(19, 2), 2],
  ])('%s : CA, RTC et vacations versables au CET', (_n, cfg, ca, rtc, versables) => {
    expect(getCATotalForCycle(cfg)).toBe(ca);
    expect(getRTCAnnuel(cfg)).toBe(rtc);
    // Tout le RTC versable part au CET quand il a la place (CET vide)
    expect(repartirApportCET({ ...DEFAULT_COUNTERS, rtc, ca: 0, caHP: 0, hs: 0, cet: 0 }).maximum.rtc).toBe(versables);
  });

  it('réserve RTC conseillée : 10 jours à 12h08, mais 6 jours (50h06) à 11h08', () => {
    expect(reserveRTCConseillee(cycle('3/3', h(12, 8)))).toBe(h(83, 30));
    expect(reserveRTCConseillee(cycle('3/3', h(11, 8)))).toBe(h(50, 6));
  });

  it('au chargement, la réserve conseillée suit le cycle de l’agent', () => {
    const data = {
      cycleConfig: cycle('3/3', h(11, 8)),
      counters: { ...DEFAULT_COUNTERS, rtc: h(53, 27) },
      history: [], lastUpdated: '', lastResetYear: new Date().getFullYear(), isOnboarded: true,
    } as UserData;
    expect(migrateUserData(data).counters.rtcReservesCET).toBe(h(50, 6));
  });
});
