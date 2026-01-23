// Schémas de validation Zod pour Chronos

import { z } from 'zod';

// ============================================
// SCHÉMAS DE BASE
// ============================================

export const CycleTypeSchema = z.enum(['alterne', 'hebdo']);

export const WeekTypeSchema = z.enum(['A', 'B']);

export const CyclePatternSchema = z.enum([
  '4/2',
  '2/2',
  '3/3',
  '2/2/3/2/2/3',
  'vacation_forte',
]);

export const WeekScheduleSchema = z.object({
  lundi: z.boolean(),
  mardi: z.boolean(),
  mercredi: z.boolean(),
  jeudi: z.boolean(),
  vendredi: z.boolean(),
  samedi: z.boolean(),
  dimanche: z.boolean(),
});

// ============================================
// SCHÉMAS PRINCIPAUX
// ============================================

export const CycleConfigSchema = z.object({
  type: CycleTypeSchema,
  pattern: CyclePatternSchema.optional(),
  heuresParJour: z.number().min(0).max(1440), // max 24h en minutes
  dateDebutCycle: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format de date invalide (YYYY-MM-DD)'),
  semaineActuelle: WeekTypeSchema,
  semaineA: WeekScheduleSchema,
  semaineB: WeekScheduleSchema.optional(),
});

export const CountersSchema = z.object({
  // Congés Annuels
  ca: z.number().min(0).max(30),
  caConsommes: z.number().min(0),
  caPosesHorsPeriode: z.number().min(0),
  caHP: z.number().min(0).max(2),

  // Crédits Fériés (en minutes)
  cf: z.number().min(0),
  cfConsoS1: z.number().min(0),
  cfConsoS2: z.number().min(0),

  // RTC (en minutes)
  rtc: z.number().min(0),
  rtcReservesCET: z.number().min(0),

  // RTT (optionnel)
  rtt: z.number().min(0).optional(),
  hasRTT: z.boolean(),

  // RPS (en minutes)
  rps: z.number().min(0),
  rpsAnneePrec: z.number().min(0),

  // Heures Supplémentaires (en minutes)
  hs: z.number().min(0).max(9600), // max 160h

  // CET
  cet: z.number().min(0).max(60),
  objectifCET: z.number().min(0).max(60),

  // Journée de solidarité
  journeeSolidariteAppliquee: z.boolean().optional(),
});

export const HistoryActionSchema = z.enum(['pose', 'credit', 'transfer_cet', 'correction']);

export const CounterTypeSchema = z.enum(['ca', 'caHP', 'cf', 'rtc', 'rtt', 'rps', 'hs', 'cet']);

export const HistoryEntrySchema = z.object({
  id: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}/, 'Format de date invalide'),
  action: HistoryActionSchema,
  type: CounterTypeSchema,
  amount: z.number(),
  description: z.string().optional(),
  countersSnapshot: CountersSchema.partial(),
});

export const UserDataSchema = z.object({
  cycleConfig: CycleConfigSchema,
  counters: CountersSchema,
  history: z.array(HistoryEntrySchema),
  lastUpdated: z.string().optional(),
  isOnboarded: z.boolean(),
});

// ============================================
// SCHÉMA EXPORT/IMPORT
// ============================================

export const ExportDataSchema = z.object({
  version: z.string(),
  exportDate: z.string(),
  cycleConfig: CycleConfigSchema,
  counters: CountersSchema,
  history: z.array(HistoryEntrySchema),
});

// ============================================
// FONCTIONS DE VALIDATION
// ============================================

export type ValidationResult<T> =
  | { success: true; data: T }
  | { success: false; error: string; details?: z.ZodError };

/**
 * Valide les données utilisateur avec Zod
 */
export function validateUserData(data: unknown): ValidationResult<z.infer<typeof UserDataSchema>> {
  const result = UserDataSchema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  // Construire un message d'erreur lisible
  const zodError = result.error;
  const errorMessages = zodError.issues.map(issue => {
    const path = issue.path.join('.');
    return `${path}: ${issue.message}`;
  });

  return {
    success: false,
    error: `Données invalides: ${errorMessages.join(', ')}`,
    details: zodError,
  };
}

/**
 * Valide les données d'import avec Zod
 */
export function validateExportData(data: unknown): ValidationResult<z.infer<typeof ExportDataSchema>> {
  const result = ExportDataSchema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  const zodError = result.error;
  const errorMessages = zodError.issues.map(issue => {
    const path = issue.path.join('.');
    return `${path}: ${issue.message}`;
  });

  return {
    success: false,
    error: `Format d'import invalide: ${errorMessages.join(', ')}`,
    details: zodError,
  };
}

/**
 * Valide une date au format ISO
 */
export function validateISODate(dateString: string): boolean {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateString)) return false;

  const date = new Date(dateString);
  return !isNaN(date.getTime());
}

/**
 * Valide et parse une date, retourne null si invalide
 */
export function parseAndValidateDate(dateString: string): Date | null {
  if (!validateISODate(dateString)) return null;

  const date = new Date(dateString);
  if (isNaN(date.getTime())) return null;

  return date;
}
