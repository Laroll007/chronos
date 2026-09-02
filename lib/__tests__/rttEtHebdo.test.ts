/**
 * Deux régressions du moteur de proposition :
 *
 * 1. Les RTT (cycle hebdomadaire, 16j/an) n'étaient posables NULLE PART. Absents
 *    de `getAvailableAmount` comme de la liste `priorities`, ils n'étaient ni
 *    proposés automatiquement ni offerts au « Choix libre » — un compteur entier
 *    saisissable mais inutilisable.
 *
 * 2. En régime hebdo 39h25, poser « 5 jours » consommait 40h00 : le forfait
 *    utilisé était `heuresParJour` (la durée du lundi) au lieu de la durée
 *    moyenne réelle des jours de la période, vendredi court compris.
 */
import { describe, it, expect } from 'vitest';
import { generateAllCombinations, createCombination, canAfford } from '@/lib/optimization';
import { countWorkingDays, countWorkingMinutes } from '@/lib/calculations';
import { DEFAULT_COUNTERS, DEFAULT_CYCLE_CONFIG } from '@/lib/storage';
import { DEFAULT_HEBDO_SCHEDULE, DEFAULT_HEBDO_HEURES } from '@/lib/types';
import type { Counters, CycleConfig } from '@/lib/types';

const C = (o: Partial<Counters> = {}): Counters => ({ ...DEFAULT_COUNTERS, ...o });

const HEBDO: CycleConfig = {
  type: 'hebdo',
  heuresParJour: 8 * 60,
  dateDebutCycle: '2026-01-05',
  semaineActuelle: 'A',
  semaineA: DEFAULT_HEBDO_SCHEDULE,
  semaineB: DEFAULT_HEBDO_SCHEDULE,
  heuresSemaine: DEFAULT_HEBDO_HEURES,
};

/** Semaine complète du lundi 2 au vendredi 6 mars 2026. */
function semaineHebdo() {
  const start = new Date(2026, 2, 2);
  const end = new Date(2026, 2, 6);
  return {
    start,
    end,
    workingDays: countWorkingDays(start, end, HEBDO),
    workingMinutes: countWorkingMinutes(start, end, HEBDO),
  };
}

describe('RTT posables', () => {
  it('sont proposés quand ils sont le seul compteur disponible', () => {
    const counters = C({
      ca: 0, cf: 0, hasCF: false, rtc: 0, hasRTC: false, rps: 0, hs: 0,
      hasRTT: true, rtt: 16,
    });
    const p = semaineHebdo();
    const combos = generateAllCombinations(p.workingDays, counters, p.start, p.workingMinutes);

    expect(combos.length).toBeGreaterThan(0);
    expect(combos.some((c) => c.items.some((i) => i.type === 'rtt'))).toBe(true);
  });

  it('restent posables et payables', () => {
    const counters = C({
      ca: 0, cf: 0, hasCF: false, rtc: 0, hasRTC: false, rps: 0, hs: 0,
      hasRTT: true, rtt: 16,
    });
    const p = semaineHebdo();
    const combos = generateAllCombinations(p.workingDays, counters, p.start, p.workingMinutes);
    for (const c of combos) {
      expect(canAfford(c.items, counters, p.workingMinutes / p.workingDays).ok).toBe(true);
    }
  });

  it('ne sont pas proposés si le compteur est désactivé', () => {
    const counters = C({
      ca: 0, cf: 0, hasCF: false, rtc: 0, hasRTC: false, rps: 0, hs: 0,
      hasRTT: false, rtt: 16, // solde présent mais compteur inactif
    });
    const p = semaineHebdo();
    const combos = generateAllCombinations(p.workingDays, counters, p.start, p.workingMinutes);
    expect(combos.every((c) => !c.items.some((i) => i.type === 'rtt'))).toBe(true);
  });

  it('ne propose jamais plus de RTT que le solde', () => {
    const counters = C({
      ca: 0, cf: 0, hasCF: false, rtc: 0, hasRTC: false, rps: 0, hs: 0,
      hasRTT: true, rtt: 2,
    });
    const p = semaineHebdo(); // 5 jours à couvrir, 2 RTT seulement
    const combos = generateAllCombinations(p.workingDays, counters, p.start, p.workingMinutes);
    for (const c of combos) {
      const rtt = c.items.filter((i) => i.type === 'rtt').reduce((s, i) => s + i.amount, 0);
      expect(rtt).toBeLessThanOrEqual(2);
    }
  });
});

describe('Régime hebdo — durée réelle de la journée', () => {
  it('une semaine complète vaut 39h25, pas 40h00', () => {
    const p = semaineHebdo();
    expect(p.workingDays).toBe(5);
    expect(p.workingMinutes).toBe(39 * 60 + 25);
  });

  it('la durée moyenne couvre exactement la période, le forfait la dépasse', () => {
    const p = semaineHebdo();
    const moyenne = p.workingMinutes / p.workingDays;

    const avecMoyenne = createCombination(
      [{ type: 'cf', amount: p.workingDays }],
      C({ cf: 6552 }),
      p.start,
      moyenne
    );
    expect(avecMoyenne.items[0].amountMinutes).toBe(p.workingMinutes); // 39h25

    const avecForfait = createCombination(
      [{ type: 'cf', amount: p.workingDays }],
      C({ cf: 6552 }),
      p.start,
      HEBDO.heuresParJour // 8h00 — la durée du lundi
    );
    expect(avecForfait.items[0].amountMinutes).toBeGreaterThan(p.workingMinutes); // 40h00
  });

  it('le cycle 12h08 reste inchangé (forfait = durée réelle)', () => {
    const start = new Date(2026, 6, 6);
    const end = new Date(start);
    while (countWorkingDays(start, end, DEFAULT_CYCLE_CONFIG) < 3) end.setDate(end.getDate() + 1);
    const wd = countWorkingDays(start, end, DEFAULT_CYCLE_CONFIG);
    const wm = countWorkingMinutes(start, end, DEFAULT_CYCLE_CONFIG);

    expect(wm / wd).toBe(DEFAULT_CYCLE_CONFIG.heuresParJour);
  });
});
