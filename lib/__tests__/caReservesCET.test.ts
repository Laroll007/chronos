/**
 * CA sécurisés pour le CET (`counters.caReservesCET`).
 *
 * Règle : les jours mis de côté ne sont pas proposés à la pose. Si — et seulement
 * si — aucune combinaison ne couvre la période sans y toucher, l'app les repropose
 * en signalant explicitement qu'elle entame la réserve. La décision reste à l'agent.
 */
import { describe, it, expect } from 'vitest';
import { generateAllCombinations, canAfford } from '@/lib/optimization';
import { countWorkingDays, countWorkingMinutes } from '@/lib/calculations';
import { DEFAULT_COUNTERS, DEFAULT_CYCLE_CONFIG } from '@/lib/storage';
import type { Counters } from '@/lib/types';

const cfg = DEFAULT_CYCLE_CONFIG;
const C = (over: Partial<Counters> = {}): Counters => ({ ...DEFAULT_COUNTERS, ...over });

function plage(nb: number) {
  const start = new Date(2026, 6, 6);
  const end = new Date(start);
  while (countWorkingDays(start, end, cfg) < nb) end.setDate(end.getDate() + 1);
  return {
    start,
    workingDays: countWorkingDays(start, end, cfg),
    workingMinutes: countWorkingMinutes(start, end, cfg),
  };
}

/** Total de CA (en jours) engagé par une combinaison. */
const caUtilises = (items: { type: string; amount: number }[]) =>
  items.filter((i) => i.type === 'ca').reduce((s, i) => s + i.amount, 0);

describe('CA sécurisés pour le CET', () => {
  it('ne propose pas les CA mis de côté quand d’autres compteurs suffisent', () => {
    // 10 CA dont 5 sécurisés, et assez de CF pour couvrir seul la période.
    const counters = C({ ca: 10, caReservesCET: 5, cf: 6552, rtc: 0, hasRTC: false });
    const p = plage(4);
    const combos = generateAllCombinations(p.workingDays, counters, p.start, p.workingMinutes);

    expect(combos.length).toBeGreaterThan(0);
    for (const c of combos) {
      expect(caUtilises(c.items)).toBeLessThanOrEqual(5); // jamais plus que les 5 libres
      expect(c.disadvantages.some((d) => d.includes('sécurisés'))).toBe(false);
    }
  });

  it('n’entame pas la réserve tant qu’une solution existe sans elle', () => {
    // 6 CA dont 5 sécurisés → 1 seul CA librement posable ; le CF couvre le reste.
    const counters = C({ ca: 6, caReservesCET: 5, cf: 6552, rtc: 0, hasRTC: false });
    const p = plage(3);
    const combos = generateAllCombinations(p.workingDays, counters, p.start, p.workingMinutes);

    expect(combos.length).toBeGreaterThan(0);
    for (const c of combos) expect(caUtilises(c.items)).toBeLessThanOrEqual(1);
  });

  it('repropose la réserve — en prévenant — quand il n’y a aucune autre solution', () => {
    // Uniquement des CA, tous sécurisés : sans eux, rien ne couvre la période.
    const counters = C({
      ca: 5, caReservesCET: 5,
      cf: 0, hasCF: false, rtc: 0, hasRTC: false, rps: 0, hs: 0,
    });
    const p = plage(3);
    const combos = generateAllCombinations(p.workingDays, counters, p.start, p.workingMinutes);

    expect(combos.length).toBeGreaterThan(0);
    const avecCA = combos.filter((c) => caUtilises(c.items) > 0);
    expect(avecCA.length).toBeGreaterThan(0);
    // …et chacune le dit explicitement, en tête des inconvénients.
    for (const c of avecCA) {
      expect(c.disadvantages[0]).toContain('Entame vos 5 CA sécurisés');
    }
  });

  it('les combinaisons de repli restent réellement posables', () => {
    const counters = C({
      ca: 5, caReservesCET: 5,
      cf: 0, hasCF: false, rtc: 0, hasRTC: false, rps: 0, hs: 0,
    });
    const p = plage(3);
    const combos = generateAllCombinations(p.workingDays, counters, p.start, p.workingMinutes);
    for (const c of combos) {
      expect(canAfford(c.items, counters, p.workingMinutes / p.workingDays).ok).toBe(true);
    }
  });

  it('sans réserve, le comportement est strictement inchangé', () => {
    // Même profil, seule la réserve change : sans elle, les 4 jours peuvent être
    // couverts entièrement en CA ; avec 8 CA sécurisés sur 10, ce n'est plus proposé.
    const p = plage(4);
    const gen = (reserve: number) =>
      generateAllCombinations(
        p.workingDays,
        C({ ca: 10, caReservesCET: reserve, cf: 0, hasCF: false, rtc: 0, hasRTC: false, rps: 0, hs: 0 }),
        p.start,
        p.workingMinutes
      );

    const sansReserve = gen(0);
    expect(sansReserve.some((c) => caUtilises(c.items) === p.workingDays)).toBe(true);
    expect(sansReserve.every((c) => !c.disadvantages.some((d) => d.includes('sécurisés')))).toBe(true);

    // 10 CA − 8 sécurisés = 2 librement posables : impossible de couvrir 4 jours,
    // et comme aucun autre compteur n'existe, l'app bascule sur le repli signalé.
    const avecReserve = gen(8);
    expect(avecReserve.every((c) => c.disadvantages[0]?.includes('Entame vos 8 CA sécurisés'))).toBe(true);
  });

  it('une réserve supérieure au solde ne casse rien', () => {
    const counters = C({ ca: 2, caReservesCET: 99, cf: 6552 });
    const p = plage(3);
    const combos = generateAllCombinations(p.workingDays, counters, p.start, p.workingMinutes);
    expect(combos.length).toBeGreaterThan(0);
    for (const c of combos) {
      expect(canAfford(c.items, counters, p.workingMinutes / p.workingDays).ok).toBe(true);
    }
  });

  it('un ancien profil sans le champ se comporte comme sans réserve', () => {
    const legacy = { ...DEFAULT_COUNTERS, ca: 10, cf: 6552 } as Counters;
    delete (legacy as Partial<Counters>).caReservesCET;
    const p = plage(4);
    const combos = generateAllCombinations(p.workingDays, legacy, p.start, p.workingMinutes);
    expect(combos.length).toBeGreaterThan(0);
    expect(combos.every((c) => !c.disadvantages.some((d) => d.includes('sécurisés')))).toBe(true);
  });
});
