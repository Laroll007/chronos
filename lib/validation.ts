// Validation manuelle — remplace zod (~280KB économisés dans le bundle)
// API publique identique pour ne pas casser les tests et le code existant.

import type { UserData, Counters, CycleConfig, HistoryEntry, WeekSchedule, ExportData } from './types';

// ============================================
// TYPE RÉSULTAT (compatible avec l'ancienne API zod)
// ============================================

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; details?: string[] };

// Interface interne pour les faux-schemas compatibles .safeParse()
interface Schema<T> {
  safeParse(data: unknown): { success: true; data: T } | { success: false; error: string };
}

// ============================================
// HELPERS INTERNES
// ============================================

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const CYCLE_TYPES = ['alterne', 'hebdo'] as const;
const WEEK_TYPES = ['A', 'B'] as const;
const CYCLE_PATTERNS = ['4/2', '2/2', '3/3', '2/2/3/2/2/3', 'vacation_forte'] as const;
const HISTORY_ACTIONS = ['pose', 'credit', 'transfer_cet', 'correction'] as const;
const COUNTER_TYPES = [
  'ca', 'caHP', 'cf', 'rtc', 'rtt', 'rps', 'hs', 'cet',
  'artt', 'caAnterieur', 'caHPAnterieur', 'cet2008', 'congesBonifies', 'hsHistorique',
] as const;

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
function isNum(v: unknown, min = 0, max = Infinity): boolean {
  return typeof v === 'number' && !isNaN(v) && v >= min && v <= max;
}
function isBool(v: unknown): v is boolean {
  return typeof v === 'boolean';
}
function isStr(v: unknown): v is string {
  return typeof v === 'string';
}
function makeEnum<T extends string>(values: readonly T[]): Schema<T> {
  return {
    safeParse(data: unknown) {
      if ((values as readonly unknown[]).includes(data)) {
        return { success: true, data: data as T };
      }
      return { success: false, error: `Valeur invalide: ${String(data)}` };
    },
  };
}

// ============================================
// VALIDATEURS INTERNES
// ============================================

function checkWeekSchedule(v: unknown): string[] {
  if (!isObj(v)) return ['objet attendu'];
  const days = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
  return days.filter(d => !isBool(v[d])).map(d => `${d}: boolean attendu`);
}

function checkCycleConfig(v: unknown): string[] {
  if (!isObj(v)) return ['cycleConfig: objet attendu'];
  const errors: string[] = [];
  if (!(CYCLE_TYPES as readonly unknown[]).includes(v.type))
    errors.push('type: alterne|hebdo attendu');
  if (v.pattern !== undefined && !(CYCLE_PATTERNS as readonly unknown[]).includes(v.pattern))
    errors.push('pattern: valeur invalide');
  if (!isNum(v.heuresParJour as unknown, 0, 1440))
    errors.push('heuresParJour: 0-1440 attendu');
  if (v.heuresJourCourt !== undefined && !isNum(v.heuresJourCourt as unknown, 0, 1440))
    errors.push('heuresJourCourt: 0-1440 attendu');
  if (!isStr(v.dateDebutCycle) || !DATE_RE.test(v.dateDebutCycle as string))
    errors.push('dateDebutCycle: YYYY-MM-DD attendu');
  if (!(WEEK_TYPES as readonly unknown[]).includes(v.semaineActuelle))
    errors.push('semaineActuelle: A|B attendu');
  checkWeekSchedule(v.semaineA).forEach(e => errors.push('semaineA.' + e));
  if (v.semaineB !== undefined)
    checkWeekSchedule(v.semaineB).forEach(e => errors.push('semaineB.' + e));
  return errors;
}

function checkCounters(v: unknown): string[] {
  if (!isObj(v)) return ['counters: objet attendu'];
  const errors: string[] = [];
  const numFields: [string, number, number][] = [
    ['ca', 0, 30], ['caConsommes', 0, Infinity], ['caPosesHorsPeriode', 0, Infinity],
    ['caHP', 0, 2], ['cf', 0, Infinity], ['cfConsoS1', 0, Infinity], ['cfConsoS2', 0, Infinity],
    ['rtc', 0, Infinity], ['rtcReservesCET', 0, Infinity],
    ['rps', 0, Infinity], ['rpsAnneePrec', 0, Infinity],
    ['hs', 0, 9600], ['cet', 0, 60], ['objectifCET', 0, 60],
  ];
  for (const [field, min, max] of numFields) {
    if (!isNum(v[field] as unknown, min, max))
      errors.push(`${field}: nombre ${min}-${max === Infinity ? '+∞' : max} attendu`);
  }
  if (!isBool(v.hasRTT)) errors.push('hasRTT: boolean attendu');
  if (v.rtt !== undefined && !isNum(v.rtt as unknown, 0))
    errors.push('rtt: nombre >= 0 attendu');
  if (v.journeeSolidariteAppliquee !== undefined && !isBool(v.journeeSolidariteAppliquee))
    errors.push('journeeSolidariteAppliquee: boolean attendu');
  // Champs optionnels — présents uniquement si activés
  if (v.hasARTT !== undefined && !isBool(v.hasARTT)) errors.push('hasARTT: boolean attendu');
  if (v.artt !== undefined && !isNum(v.artt as unknown, 0)) errors.push('artt: nombre >= 0 attendu');
  if (v.caAnterieur !== undefined && !isNum(v.caAnterieur as unknown, 0)) errors.push('caAnterieur: nombre >= 0 attendu');
  if (v.caHPAnterieur !== undefined && !isNum(v.caHPAnterieur as unknown, 0)) errors.push('caHPAnterieur: nombre >= 0 attendu');
  if (v.hasCET2008 !== undefined && !isBool(v.hasCET2008)) errors.push('hasCET2008: boolean attendu');
  if (v.cet2008 !== undefined && !isNum(v.cet2008 as unknown, 0)) errors.push('cet2008: nombre >= 0 attendu');
  if (v.hasCongesBonifies !== undefined && !isBool(v.hasCongesBonifies)) errors.push('hasCongesBonifies: boolean attendu');
  if (v.congesBonifies !== undefined && !isNum(v.congesBonifies as unknown, 0)) errors.push('congesBonifies: nombre >= 0 attendu');
  if (v.hsHistorique !== undefined && !isNum(v.hsHistorique as unknown, 0)) errors.push('hsHistorique: nombre >= 0 attendu');
  return errors;
}

function checkHistoryEntry(v: unknown, i: number): string[] {
  if (!isObj(v)) return [`history[${i}]: objet attendu`];
  const errors: string[] = [];
  if (!isStr(v.id) || (v.id as string).length < 1) errors.push(`history[${i}].id: string non vide`);
  if (!isStr(v.date) || !DATE_RE.test(v.date as string)) errors.push(`history[${i}].date: YYYY-MM-DD`);
  if (!(HISTORY_ACTIONS as readonly unknown[]).includes(v.action)) errors.push(`history[${i}].action: invalide`);
  if (!(COUNTER_TYPES as readonly unknown[]).includes(v.type)) errors.push(`history[${i}].type: invalide`);
  if (typeof v.amount !== 'number') errors.push(`history[${i}].amount: nombre attendu`);
  return errors;
}

// ============================================
// SCHÉMAS EXPORTÉS (compatibles .safeParse())
// ============================================

export const CycleTypeSchema = makeEnum(CYCLE_TYPES);
export const WeekTypeSchema = makeEnum(WEEK_TYPES);
export const CyclePatternSchema = makeEnum(CYCLE_PATTERNS);

export const WeekScheduleSchema: Schema<WeekSchedule> = {
  safeParse(data) {
    const errors = checkWeekSchedule(data);
    if (errors.length) return { success: false, error: errors.join(', ') };
    return { success: true, data: data as WeekSchedule };
  },
};

export const CycleConfigSchema: Schema<CycleConfig> = {
  safeParse(data) {
    const errors = checkCycleConfig(data);
    if (errors.length) return { success: false, error: errors.join(', ') };
    return { success: true, data: data as CycleConfig };
  },
};

export const CountersSchema: Schema<Counters> = {
  safeParse(data) {
    const errors = checkCounters(data);
    if (errors.length) return { success: false, error: errors.join(', ') };
    return { success: true, data: data as Counters };
  },
};

export const HistoryEntrySchema: Schema<HistoryEntry> = {
  safeParse(data) {
    const errors = checkHistoryEntry(data, 0);
    if (errors.length) return { success: false, error: errors.join(', ') };
    return { success: true, data: data as HistoryEntry };
  },
};

export const UserDataSchema: Schema<UserData> = {
  safeParse(data) {
    const result = validateUserData(data);
    return result;
  },
};

export const ExportDataSchema: Schema<ExportData> = {
  safeParse(data) {
    const result = validateExportData(data);
    return result;
  },
};

// ============================================
// FONCTIONS PUBLIQUES
// ============================================

export function validateUserData(data: unknown): ValidationResult<UserData> {
  if (!isObj(data)) return { success: false, error: 'Données invalides: objet attendu' };

  const errors: string[] = [
    ...checkCycleConfig(data.cycleConfig).map(e => 'cycleConfig.' + e),
    ...checkCounters(data.counters).map(e => 'counters.' + e),
    ...(!Array.isArray(data.history)
      ? ['history: tableau attendu']
      : data.history.flatMap((e, i) => checkHistoryEntry(e, i)).slice(0, 10)),
  ];

  if (!isBool(data.isOnboarded)) errors.push('isOnboarded: boolean attendu');

  if (errors.length > 0) {
    return {
      success: false,
      error: `Données invalides: ${errors.slice(0, 3).join(', ')}`,
      details: errors,
    };
  }
  return { success: true, data: data as unknown as UserData };
}

export function validateExportData(data: unknown): ValidationResult<ExportData> {
  if (!isObj(data)) return { success: false, error: "Format d'import invalide: objet attendu" };

  const errors: string[] = [];
  if (!isStr(data.version)) errors.push('version: string attendu');
  if (!isStr(data.exportDate)) errors.push('exportDate: string attendu');
  errors.push(...checkCycleConfig(data.cycleConfig));
  errors.push(...checkCounters(data.counters));
  if (!Array.isArray(data.history)) {
    errors.push('history: tableau attendu');
  } else {
    data.history.flatMap((e, i) => checkHistoryEntry(e, i)).slice(0, 10).forEach(e => errors.push(e));
  }

  if (errors.length > 0) {
    return {
      success: false,
      error: `Format d'import invalide: ${errors.slice(0, 3).join(', ')}`,
      details: errors,
    };
  }
  return { success: true, data: data as unknown as ExportData };
}

export function validateISODate(dateString: string): boolean {
  if (!DATE_RE.test(dateString)) return false;
  const date = new Date(dateString);
  return !isNaN(date.getTime());
}

export function parseAndValidateDate(dateString: string): Date | null {
  if (!validateISODate(dateString)) return null;
  const date = new Date(dateString);
  return isNaN(date.getTime()) ? null : date;
}
