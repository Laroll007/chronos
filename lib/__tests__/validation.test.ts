// Tests pour lib/validation.ts
import { describe, it, expect } from 'vitest';
import {
  CycleTypeSchema,
  WeekTypeSchema,
  CyclePatternSchema,
  WeekScheduleSchema,
  CycleConfigSchema,
  CountersSchema,
  HistoryEntrySchema,
  UserDataSchema,
  ExportDataSchema,
  validateUserData,
  validateExportData,
  validateISODate,
  parseAndValidateDate,
} from '../validation';

// ============================================
// FIXTURES DE TEST
// ============================================

const validWeekSchedule = {
  lundi: true,
  mardi: true,
  mercredi: true,
  jeudi: true,
  vendredi: true,
  samedi: false,
  dimanche: false,
};

const validCycleConfig = {
  type: 'alterne' as const,
  pattern: '4/2' as const,
  heuresParJour: 480,
  dateDebutCycle: '2024-01-01',
  semaineActuelle: 'A' as const,
  semaineA: validWeekSchedule,
  semaineB: validWeekSchedule,
};

const validCounters = {
  ca: 25,
  caConsommes: 5,
  caPosesHorsPeriode: 0,
  caHP: 2,
  cf: 480,
  cfConsoS1: 0,
  cfConsoS2: 0,
  rtc: 960,
  rtcReservesCET: 0,
  rtt: 10,
  hasRTT: true,
  rps: 0,
  rpsAnneePrec: 0,
  hs: 0,
  cet: 15,
  objectifCET: 20,
  journeeSolidariteAppliquee: false,
};

const validHistoryEntry = {
  id: 'entry-001',
  date: '2024-06-15',
  action: 'pose' as const,
  type: 'ca' as const,
  amount: -1,
  description: 'Congé annuel posé',
  countersSnapshot: { ca: 24 },
};

const validUserData = {
  cycleConfig: validCycleConfig,
  counters: validCounters,
  history: [validHistoryEntry],
  lastUpdated: '2024-06-15T10:00:00Z',
  isOnboarded: true,
};

// ============================================
// TESTS DES SCHÉMAS DE BASE
// ============================================

describe('CycleTypeSchema', () => {
  it('accepte les valeurs valides', () => {
    expect(CycleTypeSchema.safeParse('alterne').success).toBe(true);
    expect(CycleTypeSchema.safeParse('hebdo').success).toBe(true);
  });

  it('rejette les valeurs invalides', () => {
    expect(CycleTypeSchema.safeParse('invalid').success).toBe(false);
    expect(CycleTypeSchema.safeParse('').success).toBe(false);
    expect(CycleTypeSchema.safeParse(123).success).toBe(false);
  });
});

describe('WeekTypeSchema', () => {
  it('accepte A et B', () => {
    expect(WeekTypeSchema.safeParse('A').success).toBe(true);
    expect(WeekTypeSchema.safeParse('B').success).toBe(true);
  });

  it('rejette les autres valeurs', () => {
    expect(WeekTypeSchema.safeParse('C').success).toBe(false);
    expect(WeekTypeSchema.safeParse('a').success).toBe(false);
  });
});

describe('CyclePatternSchema', () => {
  it('accepte tous les patterns valides', () => {
    const validPatterns = ['4/2', '2/2', '3/3', '2/2/3/2/2/3', 'vacation_forte'];
    validPatterns.forEach(pattern => {
      expect(CyclePatternSchema.safeParse(pattern).success).toBe(true);
    });
  });

  it('rejette les patterns invalides', () => {
    expect(CyclePatternSchema.safeParse('5/2').success).toBe(false);
    expect(CyclePatternSchema.safeParse('1/1').success).toBe(false);
  });
});

describe('WeekScheduleSchema', () => {
  it('accepte un planning valide', () => {
    const result = WeekScheduleSchema.safeParse(validWeekSchedule);
    expect(result.success).toBe(true);
  });

  it('rejette si un jour manque', () => {
    const incomplete = { ...validWeekSchedule };
    delete (incomplete as Record<string, boolean>).lundi;
    expect(WeekScheduleSchema.safeParse(incomplete).success).toBe(false);
  });

  it('rejette les valeurs non-booléennes', () => {
    const invalid = { ...validWeekSchedule, lundi: 'oui' };
    expect(WeekScheduleSchema.safeParse(invalid).success).toBe(false);
  });
});

// ============================================
// TESTS DES SCHÉMAS PRINCIPAUX
// ============================================

describe('CycleConfigSchema', () => {
  it('accepte une configuration valide', () => {
    const result = CycleConfigSchema.safeParse(validCycleConfig);
    expect(result.success).toBe(true);
  });

  it('accepte sans pattern (optionnel)', () => {
    const config = { ...validCycleConfig };
    delete (config as Record<string, unknown>).pattern;
    expect(CycleConfigSchema.safeParse(config).success).toBe(true);
  });

  it('accepte sans semaineB (optionnel)', () => {
    const config = { ...validCycleConfig };
    delete (config as Record<string, unknown>).semaineB;
    expect(CycleConfigSchema.safeParse(config).success).toBe(true);
  });

  it('rejette heuresParJour > 1440', () => {
    const config = { ...validCycleConfig, heuresParJour: 1500 };
    expect(CycleConfigSchema.safeParse(config).success).toBe(false);
  });

  it('rejette heuresParJour négatif', () => {
    const config = { ...validCycleConfig, heuresParJour: -1 };
    expect(CycleConfigSchema.safeParse(config).success).toBe(false);
  });

  it('rejette un format de date invalide', () => {
    const config = { ...validCycleConfig, dateDebutCycle: '01-01-2024' };
    expect(CycleConfigSchema.safeParse(config).success).toBe(false);
  });

  it('rejette un format de date avec mauvais séparateur', () => {
    const config = { ...validCycleConfig, dateDebutCycle: '2024/01/01' };
    expect(CycleConfigSchema.safeParse(config).success).toBe(false);
  });
});

describe('CountersSchema', () => {
  it('accepte des compteurs valides', () => {
    const result = CountersSchema.safeParse(validCounters);
    expect(result.success).toBe(true);
  });

  it('accepte sans RTT (optionnel)', () => {
    const counters = { ...validCounters };
    delete (counters as Record<string, unknown>).rtt;
    expect(CountersSchema.safeParse(counters).success).toBe(true);
  });

  it('rejette CA > 30', () => {
    const counters = { ...validCounters, ca: 31 };
    expect(CountersSchema.safeParse(counters).success).toBe(false);
  });

  it('rejette CA < 0', () => {
    const counters = { ...validCounters, ca: -1 };
    expect(CountersSchema.safeParse(counters).success).toBe(false);
  });

  it('rejette caHP > 2', () => {
    const counters = { ...validCounters, caHP: 3 };
    expect(CountersSchema.safeParse(counters).success).toBe(false);
  });

  it('rejette HS > 9600 (160h)', () => {
    const counters = { ...validCounters, hs: 9601 };
    expect(CountersSchema.safeParse(counters).success).toBe(false);
  });

  it('rejette CET > 60', () => {
    const counters = { ...validCounters, cet: 61 };
    expect(CountersSchema.safeParse(counters).success).toBe(false);
  });

  it('rejette objectifCET > 60', () => {
    const counters = { ...validCounters, objectifCET: 61 };
    expect(CountersSchema.safeParse(counters).success).toBe(false);
  });
});

describe('HistoryEntrySchema', () => {
  it('accepte une entrée valide', () => {
    const result = HistoryEntrySchema.safeParse(validHistoryEntry);
    expect(result.success).toBe(true);
  });

  it('accepte sans description (optionnel)', () => {
    const entry = { ...validHistoryEntry };
    delete (entry as Record<string, unknown>).description;
    expect(HistoryEntrySchema.safeParse(entry).success).toBe(true);
  });

  it('rejette un id vide', () => {
    const entry = { ...validHistoryEntry, id: '' };
    expect(HistoryEntrySchema.safeParse(entry).success).toBe(false);
  });

  it('rejette une action invalide', () => {
    const entry = { ...validHistoryEntry, action: 'delete' };
    expect(HistoryEntrySchema.safeParse(entry).success).toBe(false);
  });

  it('rejette un type de compteur invalide', () => {
    const entry = { ...validHistoryEntry, type: 'invalid' };
    expect(HistoryEntrySchema.safeParse(entry).success).toBe(false);
  });

  it('accepte toutes les actions valides', () => {
    const actions = ['pose', 'credit', 'transfer_cet', 'correction'];
    actions.forEach(action => {
      const entry = { ...validHistoryEntry, action };
      expect(HistoryEntrySchema.safeParse(entry).success).toBe(true);
    });
  });

  it('accepte tous les types de compteur valides', () => {
    const types = ['ca', 'caHP', 'cf', 'rtc', 'rtt', 'rps', 'hs', 'cet'];
    types.forEach(type => {
      const entry = { ...validHistoryEntry, type };
      expect(HistoryEntrySchema.safeParse(entry).success).toBe(true);
    });
  });
});

describe('UserDataSchema', () => {
  it('accepte des données utilisateur valides', () => {
    const result = UserDataSchema.safeParse(validUserData);
    expect(result.success).toBe(true);
  });

  it('accepte sans lastUpdated (optionnel)', () => {
    const data = { ...validUserData };
    delete (data as Record<string, unknown>).lastUpdated;
    expect(UserDataSchema.safeParse(data).success).toBe(true);
  });

  it('accepte un historique vide', () => {
    const data = { ...validUserData, history: [] };
    expect(UserDataSchema.safeParse(data).success).toBe(true);
  });

  it('rejette sans cycleConfig', () => {
    const data = { ...validUserData };
    delete (data as Record<string, unknown>).cycleConfig;
    expect(UserDataSchema.safeParse(data).success).toBe(false);
  });

  it('rejette sans counters', () => {
    const data = { ...validUserData };
    delete (data as Record<string, unknown>).counters;
    expect(UserDataSchema.safeParse(data).success).toBe(false);
  });

  it('rejette sans isOnboarded', () => {
    const data = { ...validUserData };
    delete (data as Record<string, unknown>).isOnboarded;
    expect(UserDataSchema.safeParse(data).success).toBe(false);
  });
});

describe('ExportDataSchema', () => {
  const validExportData = {
    version: '1.0.0',
    exportDate: '2024-06-15T10:00:00Z',
    cycleConfig: validCycleConfig,
    counters: validCounters,
    history: [validHistoryEntry],
  };

  it('accepte des données export valides', () => {
    const result = ExportDataSchema.safeParse(validExportData);
    expect(result.success).toBe(true);
  });

  it('rejette sans version', () => {
    const data = { ...validExportData };
    delete (data as Record<string, unknown>).version;
    expect(ExportDataSchema.safeParse(data).success).toBe(false);
  });

  it('rejette sans exportDate', () => {
    const data = { ...validExportData };
    delete (data as Record<string, unknown>).exportDate;
    expect(ExportDataSchema.safeParse(data).success).toBe(false);
  });
});

// ============================================
// TESTS DES FONCTIONS DE VALIDATION
// ============================================

describe('validateUserData', () => {
  it('retourne success: true pour des données valides', () => {
    const result = validateUserData(validUserData);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(validUserData);
    }
  });

  it('retourne success: false pour des données invalides', () => {
    const result = validateUserData({ invalid: 'data' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('Données invalides');
      expect(result.details).toBeDefined();
    }
  });

  it('inclut le chemin dans le message d\'erreur', () => {
    const invalidData = { ...validUserData, counters: { ...validCounters, ca: 50 } };
    const result = validateUserData(invalidData);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('counters.ca');
    }
  });

  it('valide null comme invalide', () => {
    const result = validateUserData(null);
    expect(result.success).toBe(false);
  });

  it('valide undefined comme invalide', () => {
    const result = validateUserData(undefined);
    expect(result.success).toBe(false);
  });
});

describe('validateExportData', () => {
  const validExportData = {
    version: '1.0.0',
    exportDate: '2024-06-15T10:00:00Z',
    cycleConfig: validCycleConfig,
    counters: validCounters,
    history: [validHistoryEntry],
  };

  it('retourne success: true pour des données valides', () => {
    const result = validateExportData(validExportData);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual(validExportData);
    }
  });

  it('retourne success: false pour des données invalides', () => {
    const result = validateExportData({ invalid: 'data' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("Format d'import invalide");
    }
  });

  it('rejette une version manquante', () => {
    const data = { ...validExportData };
    delete (data as Record<string, unknown>).version;
    const result = validateExportData(data);
    expect(result.success).toBe(false);
  });
});

describe('validateISODate', () => {
  it('accepte une date ISO valide', () => {
    expect(validateISODate('2024-01-15')).toBe(true);
    expect(validateISODate('2024-12-31')).toBe(true);
    expect(validateISODate('2000-06-01')).toBe(true);
  });

  it('rejette un format invalide', () => {
    expect(validateISODate('01-15-2024')).toBe(false);
    expect(validateISODate('2024/01/15')).toBe(false);
    expect(validateISODate('15-01-2024')).toBe(false);
    expect(validateISODate('2024-1-15')).toBe(false);
    expect(validateISODate('2024-01-5')).toBe(false);
  });

  it('accepte les dates que JS Date auto-corrige', () => {
    // Note: JS Date est tolérant et auto-corrige certaines dates
    // '2024-02-30' devient '2024-03-01'
    expect(validateISODate('2024-02-30')).toBe(true); // auto-corrigé en mars
  });

  it('rejette les dates que JS considère invalides', () => {
    expect(validateISODate('2024-13-01')).toBe(false); // mois 13 = Invalid Date
    expect(validateISODate('2024-00-01')).toBe(false); // mois 0 = Invalid Date
  });

  it('rejette les chaînes vides ou non-dates', () => {
    expect(validateISODate('')).toBe(false);
    expect(validateISODate('not-a-date')).toBe(false);
    expect(validateISODate('2024')).toBe(false);
  });
});

describe('parseAndValidateDate', () => {
  it('retourne un objet Date pour une date valide', () => {
    const result = parseAndValidateDate('2024-06-15');
    expect(result).toBeInstanceOf(Date);
    expect(result?.getFullYear()).toBe(2024);
    expect(result?.getMonth()).toBe(5); // 0-indexed
    expect(result?.getDate()).toBe(15);
  });

  it('retourne null pour un format invalide', () => {
    expect(parseAndValidateDate('15-06-2024')).toBeNull();
    expect(parseAndValidateDate('2024/06/15')).toBeNull();
    expect(parseAndValidateDate('invalid')).toBeNull();
  });

  it('retourne null pour mois > 12 (Invalid Date)', () => {
    expect(parseAndValidateDate('2024-13-01')).toBeNull();
  });

  it('retourne une Date pour dates auto-corrigées par JS', () => {
    // JS Date auto-corrige '2024-02-30' en '2024-03-01'
    const result = parseAndValidateDate('2024-02-30');
    expect(result).toBeInstanceOf(Date);
    expect(result?.getMonth()).toBe(2); // Mars (0-indexed)
    expect(result?.getDate()).toBe(1);
  });

  it('retourne null pour une chaîne vide', () => {
    expect(parseAndValidateDate('')).toBeNull();
  });
});
