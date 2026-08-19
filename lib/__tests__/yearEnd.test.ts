/**
 * Bilan de fin d'année + cohérence des CA HP.
 *
 * Le bilan doit tenir compte du plafond d'alimentation du CET (15 j/an) : les
 * sources se disputent les places. Inutile d'annoncer « gardez 5 CA pour le CET »
 * si le RTC a déjà consommé les places — ces CA sont perdus s'ils ne sont pas posés.
 */
import { describe, it, expect } from 'vitest';
import { calculateYearEndBalance, BILAN_MOIS_DEBUT } from '@/lib/yearEnd';
import { simulatePose } from '@/lib/calculations';
import { DEFAULT_COUNTERS, DEFAULT_CYCLE_CONFIG } from '@/lib/storage';
import { CA_HP_BONUS, CET_APPORT_ANNUEL_MAX, CA_MAX_VERS_CET } from '@/lib/constants';
import type { Counters } from '@/lib/types';

const cfg = DEFAULT_CYCLE_CONFIG;
const C = (o: Partial<Counters> = {}): Counters => ({ ...DEFAULT_COUNTERS, ...o });
const SEPTEMBRE = new Date(2026, 8, 15);
const item = (b: ReturnType<typeof calculateYearEndBalance>, t: string) =>
  b.items.find((i) => i.type === t);

describe('Bilan de fin d’année', () => {
  it('ne s’active qu’à partir de septembre', () => {
    const c = C({ ca: 18 });
    expect(calculateYearEndBalance(c, cfg, new Date(2026, 5, 15)).actif).toBe(false); // juin
    expect(calculateYearEndBalance(c, cfg, new Date(2026, 7, 31)).actif).toBe(false); // 31 août
    expect(calculateYearEndBalance(c, cfg, new Date(2026, BILAN_MOIS_DEBUT, 1)).actif).toBe(true);
    expect(calculateYearEndBalance(c, cfg, new Date(2026, 11, 20)).actif).toBe(true);
  });

  it('n’annonce pas 5 CA épargnables si le RTC a déjà pris les places', () => {
    // 15 places : RTC en prend 10, CA HP 2 → il n'en reste que 3 pour les CA.
    const c = C({ ca: 18, cet: 0, rtc: 11229, caHP: 2 });
    const b = calculateYearEndBalance(c, cfg, SEPTEMBRE);

    expect(b.capaciteCET).toBe(CET_APPORT_ANNUEL_MAX);
    expect(b.apportCET.rtc).toBe(10);
    expect(b.apportCET.caHP).toBe(2);
    expect(b.apportCET.ca).toBe(3); // et non 5
    expect(b.apportCET.total).toBe(CET_APPORT_ANNUEL_MAX);
    // Donc 15 CA à poser, pas 13.
    expect(item(b, 'ca')!.aSolder).toBe(15);
  });

  it('respecte les CA que l’agent a sécurisés (son intention passe devant)', () => {
    const c = C({ ca: 18, cet: 0, caReservesCET: 5, rtc: 11229, caHP: 2 });
    const b = calculateYearEndBalance(c, cfg, SEPTEMBRE);

    expect(b.apportCET.ca).toBe(5);            // la réserve est honorée
    expect(item(b, 'ca')!.aSolder).toBe(13);   // et n'est pas comptée « à solder »
  });

  it('sans place au CET, tout est à poser', () => {
    const c = C({ ca: 18, cet: 60, rtc: 11229, caHP: 2 });
    const b = calculateYearEndBalance(c, cfg, SEPTEMBRE);

    expect(b.capaciteCET).toBe(0);
    expect(b.apportCET.total).toBe(0);
    expect(item(b, 'ca')!.aSolder).toBe(18);
    expect(item(b, 'caHP')!.aSolder).toBe(2);
  });

  it('plafonne l’apport CA à la limite annuelle même sans concurrence', () => {
    const c = C({ ca: 18, cet: 0, rtc: 0, hasRTC: false, caHP: 0, hs: 0 });
    const b = calculateYearEndBalance(c, cfg, SEPTEMBRE);
    expect(b.apportCET.ca).toBe(CA_MAX_VERS_CET);
  });

  it('inclut ARTT et RTT, qui ne vont pas au CET', () => {
    const c = C({
      ca: 0, cet: 0, rtc: 0, hasRTC: false, cf: 0, hasCF: false,
      hasARTT: true, artt: 8, hasRTT: true, rtt: 4,
    });
    const b = calculateYearEndBalance(c, cfg, SEPTEMBRE);
    expect(item(b, 'artt')!.aSolder).toBe(8);
    expect(item(b, 'rtt')!.aSolder).toBe(4);
    expect(b.joursASolder).toBe(12);
  });

  it('ne signale rien quand tout est soldé', () => {
    const c = C({ ca: 0, cet: 0, rtc: 0, hasRTC: false, cf: 0, hasCF: false, caHP: 0 });
    const b = calculateYearEndBalance(c, cfg, SEPTEMBRE);
    expect(b.items).toHaveLength(0);
    expect(b.joursASolder).toBe(0);
  });

  it('ignore les compteurs désactivés sur le profil', () => {
    const c = C({ ca: 0, rtc: 11229, hasRTC: false, cf: 6552, hasCF: false });
    const b = calculateYearEndBalance(c, cfg, SEPTEMBRE);
    expect(item(b, 'rtc')).toBeUndefined();
    expect(item(b, 'cf')).toBeUndefined();
  });
});

describe('CA HP — cohérence du bonus', () => {
  it('ne dépasse jamais le bonus de 2 jours', () => {
    // Profil incohérent : CA HP déjà déclarés, barre à 0. L'agent repose 8 CA.
    let c = C({ ca: 18, caHP: CA_HP_BONUS, caPosesHorsPeriode: 0 });
    for (let i = 0; i < 8; i++) {
      c = simulatePose(c, 'ca', 1, new Date(2026, 1, 10)).newCounters;
    }
    expect(c.caHP).toBe(CA_HP_BONUS); // et non 4
  });

  it('accorde bien le bonus au franchissement du seuil', () => {
    let c = C({ ca: 18, caHP: 0, caPosesHorsPeriode: 0 });
    for (let i = 0; i < 7; i++) {
      c = simulatePose(c, 'ca', 1, new Date(2026, 1, 10)).newCounters;
    }
    expect(c.caHP).toBe(0);
    c = simulatePose(c, 'ca', 1, new Date(2026, 1, 10)).newCounters;
    expect(c.caHP).toBe(CA_HP_BONUS);
  });

  it('n’accorde rien pour des CA posés en période estivale', () => {
    let c = C({ ca: 18, caHP: 0, caPosesHorsPeriode: 0 });
    for (let i = 0; i < 10; i++) {
      c = simulatePose(c, 'ca', 1, new Date(2026, 6, 10)).newCounters; // juillet
    }
    expect(c.caPosesHorsPeriode).toBe(0);
    expect(c.caHP).toBe(0);
  });
});
