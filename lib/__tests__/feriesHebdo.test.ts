import { describe, it, expect, afterEach } from 'vitest';
import { clearCalculationCaches, countWorkingDays, isWorkingDay } from '../calculations';
import { DEFAULT_CYCLE_CONFIG } from '../storage';
import { DEFAULT_HEBDO_HEURES, DEFAULT_HEBDO_SCHEDULE } from '../types';
import type { CycleConfig } from '../types';

const hebdo = {
  type: 'hebdo',
  heuresParJour: DEFAULT_HEBDO_HEURES.lundi,
  heuresSemaine: DEFAULT_HEBDO_HEURES,
  dateDebutCycle: '2026-01-05',
  semaineActuelle: 'A',
  semaineA: DEFAULT_HEBDO_SCHEDULE,
} as unknown as CycleConfig;

describe('Régime hebdomadaire : jours fériés non travaillés', () => {
  afterEach(() => clearCalculationCaches());

  it('le 11 novembre 2026 (mercredi) n’est pas travaillé, la veille oui', () => {
    expect(isWorkingDay(new Date(2026, 10, 11), hebdo)).toBe(false);
    expect(isWorkingDay(new Date(2026, 10, 10), hebdo)).toBe(true);
  });

  it('lundi de Pentecôte et Ascension (fériés mobiles) non travaillés', () => {
    expect(isWorkingDay(new Date(2026, 4, 25), hebdo)).toBe(false); // lundi de Pentecôte 2026
    expect(isWorkingDay(new Date(2026, 4, 14), hebdo)).toBe(false); // Ascension 2026
  });

  it('une semaine avec un férié compte 4 jours travaillés (un CA posé dessus n’est pas décompté)', () => {
    expect(countWorkingDays(new Date(2026, 10, 9), new Date(2026, 10, 15), hebdo)).toBe(4);
  });

  it('les cycles ne changent pas : un férié reste travaillé selon la rotation', () => {
    // 3/3 dont la série commence le 11 novembre (férié) : jour travaillé
    const cycle: CycleConfig = { ...DEFAULT_CYCLE_CONFIG, type: 'alterne', pattern: '3/3', dateDebutCycle: '2026-11-11' };
    expect(isWorkingDay(new Date(2026, 10, 11), cycle)).toBe(true);
  });
});
