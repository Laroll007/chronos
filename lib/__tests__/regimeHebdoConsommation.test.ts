import { describe, it, expect } from 'vitest';
import { generateAllCombinations } from '@/lib/optimization';
import { countWorkingMinutes, countWorkingDays, getJourMinutes } from '@/lib/calculations';
import { DEFAULT_HEBDO_SCHEDULE, DEFAULT_HEBDO_HEURES } from '@/lib/types';
import type { CycleConfig, Counters } from '@/lib/types';

const hebdo = {
  type: 'hebdo',
  heuresParJour: 8 * 60, // représentatif (lundi)
  heuresSemaine: DEFAULT_HEBDO_HEURES, // 8h Lu-Je, 7h25 Ve
  dateDebutCycle: '2026-01-05',
  semaineActuelle: 'A',
  semaineA: DEFAULT_HEBDO_SCHEDULE,
  semaineB: DEFAULT_HEBDO_SCHEDULE,
} as unknown as CycleConfig;

// Lundi 2026-06-08 → vendredi 2026-06-12
const start = new Date(2026, 5, 8);
const end = new Date(2026, 5, 12);

const counters = {
  ca: 0, caHP: 0, cf: 0, rtc: 100 * 60, rtt: 0, rps: 0, hs: 0, cet: 0,
  artt: 0, caAnterieur: 0, caHPAnterieur: 0, cet2008: 0, congesBonifies: 0, hsHistorique: 0,
  caConsommes: 0, caPosesHorsPeriode: 0, cfConsoS1: 0, cfConsoS2: 0,
} as unknown as Counters;

describe('Bug 2 — consommation aux heures réelles du régime hebdo', () => {
  it('getJourMinutes renvoie 8h Lu-Je et 7h25 Ve', () => {
    expect(getJourMinutes(new Date(2026, 5, 8), hebdo)).toBe(480);  // lundi
    expect(getJourMinutes(new Date(2026, 5, 12), hebdo)).toBe(445); // vendredi 7h25
    expect(getJourMinutes(new Date(2026, 5, 13), hebdo)).toBe(0);   // samedi repos
  });

  it('countWorkingMinutes = 8+8+8+8+7h25 = 39h25 (2365 min), pas 5×12h08', () => {
    expect(countWorkingDays(start, end, hebdo)).toBe(5);
    expect(countWorkingMinutes(start, end, hebdo)).toBe(2365);
    expect(2365).not.toBe(5 * 728); // ≠ 3640 (forfait 12h08)
  });

  it('combo RTC pur consomme 2365 min (réel), pas 3640 min (12h08)', () => {
    const wm = countWorkingMinutes(start, end, hebdo);
    const combos = generateAllCombinations(5, counters, start, wm);
    const rtcPur = combos.find(
      (c) => c.items.length === 1 && c.items[0].type === 'rtc'
    );
    expect(rtcPur).toBeDefined();
    expect(rtcPur!.items[0].amountMinutes).toBe(2365);
  });

  it('16h RTC couvrent 2 jours hebdo (16h/8h), pas 1 seul (16h/12h08)', () => {
    const c2 = { ...counters, rtc: 16 * 60 } as unknown as Counters;
    const wm = countWorkingMinutes(start, new Date(2026, 5, 9), hebdo); // Lu+Ma = 16h
    const combos = generateAllCombinations(2, c2, start, wm);
    const rtcPur = combos.find((c) => c.items.length === 1 && c.items[0].type === 'rtc');
    expect(rtcPur).toBeDefined(); // 16h suffisent pour 2 jours à 8h
    expect(rtcPur!.items[0].amountMinutes).toBe(960); // 16h exact
  });
});
