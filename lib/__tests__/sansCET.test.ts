// Élève, stagiaire : pas encore de CET (exclus ; ouverture une fois titulaire
// avec un an de service). L'app ne garde rien pour le CET et propose d'abord
// ce qui se perd au 31/12, sauf titularisation avant la campagne de janvier.

import { describe, it, expect } from 'vitest';
import { cetPourCampagne, reserveRTC, reserveHS } from '../calculations';
import { generateAllCombinations, getCombinationSummary } from '../optimization';
import { DEFAULT_COUNTERS, validateUserData, DEFAULT_CYCLE_CONFIG } from '../storage';
import type { Counters } from '../types';

const h = (a: number, b = 0) => a * 60 + b;
const OCT = new Date(2026, 9, 20);
const C = (o: Partial<Counters> = {}): Counters =>
  ({ ...DEFAULT_COUNTERS, ca: 0, cf: 0, caHP: 0, rtc: h(91, 5), rtcReservesCET: h(83, 30), hs: h(20), hsJoursCET: 2, rps: h(10), ...o }) as Counters;

describe('Campagne CET accessible ?', () => {
  it('agent avec CET : oui ; stagiaire : non, sauf titularisation d’ici au 31 janvier', () => {
    expect(cetPourCampagne(C(), OCT)).toBe(true);
    expect(cetPourCampagne(C({ sansCET: true }), OCT)).toBe(false);
    expect(cetPourCampagne(C({ sansCET: true, dateTitularisation: '2027-01-15' }), OCT)).toBe(true);
    expect(cetPourCampagne(C({ sansCET: true, dateTitularisation: '2027-03-01' }), OCT)).toBe(false);
    // En janvier, c'est la campagne en cours qui compte
    expect(cetPourCampagne(C({ sansCET: true, dateTitularisation: '2027-01-20' }), new Date(2027, 0, 10))).toBe(true);
  });

  it('sans CET : aucune réserve de RTC ni d’HS', () => {
    expect(reserveRTC(C({ sansCET: true }))).toBe(0);
    expect(reserveHS(C({ sansCET: true }))).toBe(0);
    expect(reserveRTC(C())).toBe(h(83, 30));
  });
});

describe('Propositions de pose', () => {
  const top = (c: Counters) => generateAllCombinations(1, c, OCT, h(12, 8)).slice(0, 3).map(getCombinationSummary);

  it('stagiaire : une journée entière de RTC (perdus au 31/12) plutôt que RPS ou HS (conservés)', () => {
    expect(top(C({ sansCET: true }))[0]).toBe('1j RTC');
  });

  it('avec un CET : les 83h30 de RTC restent gardés pour le CET', () => {
    expect(top(C())[0]).not.toBe('1j RTC');
  });

  it('stagiaire : les CA « sécurisés pour le CET » sont proposés sans avertissement', () => {
    const combos = generateAllCombinations(2, C({ sansCET: true, ca: 5, caReservesCET: 5, rtc: 0 }), OCT, h(24, 16));
    const ca = combos.find((c) => c.items.length === 1 && c.items[0]!.type === 'ca')!;
    expect(ca.disadvantages.some((d) => d.includes('sécurisés pour le CET'))).toBe(false);
  });
});

describe('Données', () => {
  it('l’option est enregistrée et validée', () => {
    const data = {
      cycleConfig: DEFAULT_CYCLE_CONFIG, counters: C({ sansCET: true, dateTitularisation: '2027-01-15' }), history: [],
      lastUpdated: '', lastResetYear: 2026, isOnboarded: true,
    };
    expect(validateUserData(data)).toBe(true);
  });
});
