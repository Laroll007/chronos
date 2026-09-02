/**
 * Alerte « RTC réservés entamés ».
 *
 * Régression protégée : elle se déclenchait en priorité `urgent`, sans condition
 * de date, dès que le solde RTC passait sous 83h30 — c'est-à-dire pour l'usage
 * normal d'un agent qui consomme ses RTC. Résultat : un bandeau rouge permanent
 * et non désactivable toute l'année.
 *
 * La « réserve » de 83h30 ne sert qu'au transfert CET de fin d'année : l'alerte
 * n'a de sens qu'à l'approche de la deadline, et seulement si le CET peut encore
 * recevoir quelque chose.
 */
import { describe, it, expect } from 'vitest';
import { calculateDeadlineNotifications } from '@/lib/notifications';
import { DEFAULT_COUNTERS, DEFAULT_CYCLE_CONFIG } from '@/lib/storage';
import { RTC_RESERVES_CET, CET_PLAFOND } from '@/lib/constants';
import type { Counters } from '@/lib/types';

const C = (o: Partial<Counters> = {}): Counters => ({ ...DEFAULT_COUNTERS, ...o });
const cfg = DEFAULT_CYCLE_CONFIG;
const alerteRTC = (c: Counters, d: Date) =>
  calculateDeadlineNotifications(c, d, cfg).find((n) => n.id === 'rtc-reserves-alert');

// Solde volontairement sous la réserve de 83h30.
const RTC_ENTAME = { rtc: RTC_RESERVES_CET - 600, hasRTC: true };

describe('Alerte RTC réservés', () => {
  it('reste muette en début et milieu d’année', () => {
    for (const d of [new Date(2026, 1, 15), new Date(2026, 4, 15), new Date(2026, 7, 15)]) {
      expect(alerteRTC(C(RTC_ENTAME), d), `mois ${d.getMonth()}`).toBeUndefined();
    }
  });

  it('se déclenche à l’approche de la deadline', () => {
    const a = alerteRTC(C(RTC_ENTAME), new Date(2026, 11, 10));
    expect(a).toBeDefined();
  });

  it('monte en urgence à mesure que le 31/12 approche', () => {
    const novembre = alerteRTC(C(RTC_ENTAME), new Date(2026, 10, 5));
    const decembre = alerteRTC(C(RTC_ENTAME), new Date(2026, 11, 28));
    expect(novembre?.priority).not.toBe('urgent');
    expect(decembre?.priority).toBe('urgent');
  });

  it('reste muette si le CET est plein — la réserve n’a plus d’objet', () => {
    const a = alerteRTC(C({ ...RTC_ENTAME, cet: CET_PLAFOND }), new Date(2026, 11, 10));
    expect(a).toBeUndefined();
  });

  it('reste muette si la réserve est intacte', () => {
    const a = alerteRTC(C({ rtc: RTC_RESERVES_CET + 1000 }), new Date(2026, 11, 10));
    expect(a).toBeUndefined();
  });

  it('reste muette si l’agent n’a pas de RTC', () => {
    const a = alerteRTC(C({ ...RTC_ENTAME, hasRTC: false }), new Date(2026, 11, 10));
    expect(a).toBeUndefined();
  });
});
