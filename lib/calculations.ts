// Fonctions de calcul pour Chronos

import {
  CycleConfig,
  Counters,
  WeekSchedule,
  WeekType,
  CETProjection,
  SimulationResult,
  CounterType,
  Alert,
  CyclePattern,
  HistoryEntry,
} from './types';
import {
  HEURES_PAR_JOUR,
  CA_TOTAL_ANNUEL,
  CA_PAR_CYCLE,
  CA_MAX_VERS_CET,
  CA_REQUIS_POUR_HP,
  CA_HP_BONUS,
  CF_PAR_SEMESTRE,
  RTC_RESERVES_CET,
  RTC_LIBRES,
  RTC_COUT_PAR_JOUR_CET,
  RTC_MAX_JOURS_CET,
  RTC_GAIN_PAR_JOUR,
  RPS_PAR_DIMANCHE,
  HS_MAX_STOCKABLES,
  HS_MAX_VERS_CET,
  CET_PLAFOND,
  CET_APPORT_ANNUEL_MAX,
  JOURNEE_SOLIDARITE,
  CYCLES_EXCLUS_ABONDEMENT_HS,
} from './constants';

// ============================================
// HELPERS DATE (sans problèmes de DST)
// ============================================

/**
 * Calcule le nombre de jours entre deux dates (sans utiliser les millisecondes)
 * Évite les bugs liés au changement d'heure (DST)
 */
function daysBetween(
  y1: number, m1: number, d1: number,
  y2: number, m2: number, d2: number
): number {
  // Convertir en "jour julien simplifié" pour un calcul sans time zones
  const toJulian = (y: number, m: number, d: number): number => {
    const a = Math.floor((14 - m) / 12);
    const y2 = y + 4800 - a;
    const m2 = m + 12 * a - 3;
    return d + Math.floor((153 * m2 + 2) / 5) + 365 * y2 + Math.floor(y2 / 4) - Math.floor(y2 / 100) + Math.floor(y2 / 400) - 32045;
  };
  return toJulian(y2, m2, d2) - toJulian(y1, m1, d1);
}

// ============================================
// CACHES PERFORMANCE (PERF-006, PERF-007)
// ============================================

// Cache pour getWeekType - clé: "dateISO|configHash"
const weekTypeCache = new Map<string, WeekType>();
const MAX_CACHE_SIZE = 1000;

// Cache pour isWorkingDay - clé: "dateISO|configHash"
const workingDayCache = new Map<string, boolean>();

/**
 * Génère une clé de cache pour la config de cycle
 */
function getCycleConfigHash(cycleConfig: CycleConfig): string {
  return `${cycleConfig.dateDebutCycle}|${cycleConfig.semaineActuelle}`;
}

/**
 * Nettoie le cache si trop grand (LRU simple)
 */
function pruneCache(cache: Map<string, unknown>): void {
  if (cache.size > MAX_CACHE_SIZE) {
    // Supprimer les 200 premières entrées (les plus anciennes)
    const keys = Array.from(cache.keys()).slice(0, 200);
    keys.forEach((key) => cache.delete(key));
  }
}

/**
 * Vide les caches (utile pour les tests ou reset)
 */
export function clearCalculationCaches(): void {
  weekTypeCache.clear();
  workingDayCache.clear();
}

// ============================================
// CALCULS DE CYCLE
// ============================================

/**
 * Détermine si une date est en semaine A ou B
 * PERF-006: Utilise un cache Map pour éviter les recalculs
 */
export function getWeekType(date: Date, cycleConfig: CycleConfig): WeekType {
  // Utiliser la date locale, pas UTC
  const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const configHash = getCycleConfigHash(cycleConfig);
  const cacheKey = `${dateKey}|${configHash}`;

  // Vérifier le cache
  const cached = weekTypeCache.get(cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  // Calculer le nombre de jours sans utiliser les millisecondes (évite les bugs DST)
  const [startYear, startMonth, startDay] = cycleConfig.dateDebutCycle.split('-').map(Number);
  const diffDays = daysBetween(startYear, startMonth, startDay, date.getFullYear(), date.getMonth() + 1, date.getDate());
  const weekNumber = Math.floor(diffDays / 7);

  // Si semaine de départ est A, alternance A-B-A-B...
  const isEvenWeek = weekNumber % 2 === 0;
  const result: WeekType = cycleConfig.semaineActuelle === 'A'
    ? (isEvenWeek ? 'A' : 'B')
    : (isEvenWeek ? 'B' : 'A');

  // Mettre en cache
  pruneCache(weekTypeCache);
  weekTypeCache.set(cacheKey, result);

  return result;
}

/**
 * Génère une clé de cache complète pour isWorkingDay
 */
function getWorkingDayConfigHash(cycleConfig: CycleConfig): string {
  const scheduleA = Object.values(cycleConfig.semaineA).join('');
  const scheduleB = cycleConfig.semaineB ? Object.values(cycleConfig.semaineB).join('') : scheduleA;
  return `${cycleConfig.dateDebutCycle}|${cycleConfig.semaineActuelle}|${scheduleA}|${scheduleB}`;
}

/**
 * Vérifie si un jour donné est travaillé selon le cycle
 * PERF-007: Utilise un cache Map pour éviter les recalculs
 */
export function isWorkingDay(date: Date, cycleConfig: CycleConfig): boolean {
  // Utiliser la date locale, pas UTC
  const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const configHash = getWorkingDayConfigHash(cycleConfig);
  const cacheKey = `${dateKey}|${configHash}`;

  // Vérifier le cache
  const cached = workingDayCache.get(cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  // Calculer
  const weekType = getWeekType(date, cycleConfig);
  const dayOfWeek = date.getDay(); // 0 = dimanche, 1 = lundi, etc.

  const dayKeys: (keyof WeekSchedule)[] = [
    'dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'
  ];
  const dayKey = dayKeys[dayOfWeek];

  const schedule = weekType === 'A' ? cycleConfig.semaineA : (cycleConfig.semaineB || cycleConfig.semaineA);
  const result = schedule[dayKey];

  // Mettre en cache
  pruneCache(workingDayCache);
  workingDayCache.set(cacheKey, result);

  return result;
}

/**
 * Vérifie si un jour est un dimanche travaillé
 */
export function isSundayWorked(date: Date, cycleConfig: CycleConfig): boolean {
  return date.getDay() === 0 && isWorkingDay(date, cycleConfig);
}

/**
 * Compte les dimanches travaillés entre deux dates
 */
export function countSundaysWorked(
  startDate: Date,
  endDate: Date,
  cycleConfig: CycleConfig
): number {
  let count = 0;
  const current = new Date(startDate);

  while (current <= endDate) {
    if (isSundayWorked(current, cycleConfig)) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }

  return count;
}

/**
 * Calcule les RPS accumulés depuis le début de l'année
 */
export function calculateRPSAccumulated(
  currentDate: Date,
  cycleConfig: CycleConfig,
  rpsAnneePrec: number
): number {
  const yearStart = new Date(currentDate.getFullYear(), 0, 1);
  const sundaysWorked = countSundaysWorked(yearStart, currentDate, cycleConfig);
  const rpsThisYear = sundaysWorked * RPS_PAR_DIMANCHE;

  return rpsAnneePrec + rpsThisYear;
}

/**
 * Compte les jours travaillés entre deux dates
 */
export function countWorkingDays(
  startDate: Date,
  endDate: Date,
  cycleConfig: CycleConfig
): number {
  let count = 0;
  const current = new Date(startDate);

  while (current <= endDate) {
    if (isWorkingDay(current, cycleConfig)) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }

  return count;
}

// ============================================
// CALCULS CA PAR CYCLE (APORTT)
// ============================================

/**
 * Retourne le nombre de CA selon le pattern de cycle
 */
export function getCAParCycle(pattern?: CyclePattern): number {
  if (!pattern) return CA_TOTAL_ANNUEL;
  return CA_PAR_CYCLE[pattern] ?? CA_TOTAL_ANNUEL;
}

// ============================================
// CALCULS RTC ET JOURNÉE DE SOLIDARITÉ (APORTT)
// ============================================

/**
 * Calcule le RTC net après déduction de la journée de solidarité
 * La JS déduit toujours 12h08 des RTC pour les cycles binaires
 */
export function calculerRTCNet(
  rtcBrut: number,
  cyclePattern?: CyclePattern,
  journeeSolidariteAppliquee: boolean = true
): { rtcNet: number; deductionJS: number; estExcluCompensationHS: boolean } {
  if (!journeeSolidariteAppliquee) {
    return { rtcNet: rtcBrut, deductionJS: 0, estExcluCompensationHS: false };
  }

  const deductionJS = JOURNEE_SOLIDARITE; // 728 min (12h08)

  // Les cycles binaires 12h08 et VF sont exclus de la compensation HS
  const estExcluCompensationHS = cyclePattern
    ? CYCLES_EXCLUS_ABONDEMENT_HS.includes(cyclePattern)
    : true; // Par défaut, considérer exclu

  return {
    rtcNet: Math.max(0, rtcBrut - deductionJS),
    deductionJS,
    estExcluCompensationHS,
  };
}

// ============================================
// CALCULS CA HP
// ============================================

/**
 * Vérifie si une date est dans la période CA HP
 */
export function isInCAHPPeriod(date: Date): boolean {
  const month = date.getMonth() + 1;
  const day = date.getDate();

  // Période 1 : 01/01 - 30/04
  const inPeriod1 = month >= 1 && month <= 4;

  // Période 2 : 01/11 - 31/12
  const inPeriod2 = month >= 11 && month <= 12;

  return inPeriod1 || inPeriod2;
}

/**
 * Calcule si les CA HP sont obtenus
 */
export function checkCAHPCondition(caPosesHorsPeriode: number): number {
  return caPosesHorsPeriode >= CA_REQUIS_POUR_HP ? CA_HP_BONUS : 0;
}

/**
 * Calcule les CA restants à poser pour obtenir les CA HP
 */
export function getCANeededForHP(caPosesHorsPeriode: number): number {
  if (caPosesHorsPeriode >= CA_REQUIS_POUR_HP) return 0;
  return CA_REQUIS_POUR_HP - caPosesHorsPeriode;
}

// ============================================
// CALCULS CF PAR SEMESTRE
// ============================================

/**
 * Détermine le semestre courant
 */
export function getCurrentSemester(date: Date): 1 | 2 {
  return date.getMonth() < 6 ? 1 : 2;
}

/**
 * Calcule les CF restants pour le semestre courant
 */
export function getCFRemainingForSemester(
  semester: 1 | 2,
  cfConsoS1: number,
  cfConsoS2: number
): number {
  const consumed = semester === 1 ? cfConsoS1 : cfConsoS2;
  return Math.max(0, CF_PAR_SEMESTRE - consumed);
}

/**
 * Calcule les jours restants jusqu'à la deadline du semestre
 */
export function getDaysUntilSemesterDeadline(date: Date): number {
  const semester = getCurrentSemester(date);
  const deadline = semester === 1
    ? new Date(date.getFullYear(), 5, 30) // 30 juin
    : new Date(date.getFullYear(), 11, 31); // 31 décembre

  const diffTime = deadline.getTime() - date.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

// ============================================
// CALCULS RTC
// ============================================

/**
 * Calcule les RTC libres disponibles (après réserve CET)
 */
export function getRTCLibres(rtcTotal: number): number {
  return Math.max(0, rtcTotal - RTC_RESERVES_CET);
}

/**
 * Vérifie si les RTC réservés pour CET sont entamés
 */
export function isRTCReservesEntames(rtcTotal: number): boolean {
  return rtcTotal < RTC_RESERVES_CET;
}

/**
 * Calcule la perte si RTC réservés entamés
 */
export function calculateRTCLoss(rtcTotal: number): number {
  if (rtcTotal >= RTC_RESERVES_CET) return 0;
  const joursManquants = Math.ceil((RTC_RESERVES_CET - rtcTotal) / RTC_COUT_PAR_JOUR_CET);
  return joursManquants * RTC_GAIN_PAR_JOUR;
}

// ============================================
// CALCULS CET
// ============================================

/**
 * Calcule la marge CET disponible
 */
export function getCETMargeDisponible(cetActuel: number): number {
  return Math.max(0, CET_PLAFOND - cetActuel);
}

/**
 * Calcule l'apport CET maximum possible cette année
 */
export function getCETApportMaxAnnee(cetActuel: number): number {
  const margePlafond = getCETMargeDisponible(cetActuel);
  return Math.min(margePlafond, CET_APPORT_ANNUEL_MAX);
}

/**
 * Calcule la stratégie CET optimale
 */
export function calculateOptimalCETStrategy(counters: Counters): CETProjection {
  const apportMax = getCETApportMaxAnnee(counters.cet);
  const besoin = Math.min(
    counters.objectifCET - counters.cet,
    apportMax
  );

  if (besoin <= 0) {
    return {
      apportCET: { rtc: 0, caHP: 0, ca: 0, hs: 0 },
      totalApport: 0,
      cetFinal: counters.cet,
      gainNetRTC: 0,
      joursEconomises: 0,
      joursPerdus: 0,
      isOptimal: counters.cet >= counters.objectifCET,
    };
  }

  const apport = {
    rtc: 0,
    caHP: 0,
    ca: 0,
    hs: 0,
  };

  let resteBesoin = besoin;

  // 1. Priorité absolue : RTC (gain 3h47/jour)
  const rtcDisponibles = Math.floor(counters.rtc / RTC_COUT_PAR_JOUR_CET);
  apport.rtc = Math.min(RTC_MAX_JOURS_CET, rtcDisponibles, resteBesoin);
  resteBesoin -= apport.rtc;

  // 2. CA HP (si obtenus)
  if (resteBesoin > 0 && counters.caHP > 0) {
    apport.caHP = Math.min(counters.caHP, resteBesoin);
    resteBesoin -= apport.caHP;
  }

  // 3. CA classiques (max 5)
  if (resteBesoin > 0) {
    apport.ca = Math.min(CA_MAX_VERS_CET, counters.ca, resteBesoin);
    resteBesoin -= apport.ca;
  }

  // 4. HS (max 5 jours)
  if (resteBesoin > 0) {
    const hsJours = Math.floor(counters.hs / HEURES_PAR_JOUR);
    apport.hs = Math.min(HS_MAX_VERS_CET, hsJours, resteBesoin);
  }

  const totalApport = apport.rtc + apport.caHP + apport.ca + apport.hs;
  const gainNetRTC = apport.rtc * RTC_GAIN_PAR_JOUR;

  // Calcul des jours perdus (CA et RTC libres non utilisés)
  const caExcedentaires = Math.max(0, counters.ca - CA_MAX_VERS_CET - apport.ca);
  const rtcLibresRestants = Math.max(0, getRTCLibres(counters.rtc) - (apport.rtc * RTC_COUT_PAR_JOUR_CET));
  const rtcJoursPerdus = Math.floor(rtcLibresRestants / HEURES_PAR_JOUR);

  return {
    apportCET: apport,
    totalApport,
    cetFinal: counters.cet + totalApport,
    gainNetRTC,
    joursEconomises: Math.floor(gainNetRTC / HEURES_PAR_JOUR),
    joursPerdus: caExcedentaires + rtcJoursPerdus,
    isOptimal: totalApport >= besoin,
  };
}

// ============================================
// SIMULATION
// ============================================

/**
 * Simule la pose d'un congé
 */
export function simulatePose(
  counters: Counters,
  type: CounterType,
  amount: number, // en minutes pour heures, en jours pour CA/CET
  date: Date
): SimulationResult {
  const newCounters = { ...counters };
  const alerts: Alert[] = [];

  switch (type) {
    case 'ca': {
      if (amount > counters.ca) {
        return {
          newCounters: counters,
          alerts: [{ id: '1', type: 'error', priority: 'high', message: 'CA insuffisants' }],
          isValid: false,
          errorMessage: `Vous n'avez que ${counters.ca} CA disponibles`,
        };
      }
      newCounters.ca -= amount;
      newCounters.caConsommes += amount;
      if (isInCAHPPeriod(date)) {
        newCounters.caPosesHorsPeriode += amount;
        newCounters.caHP = checkCAHPCondition(newCounters.caPosesHorsPeriode);
      }
      break;
    }

    case 'cf': {
      if (amount > counters.cf) {
        return {
          newCounters: counters,
          alerts: [{ id: '1', type: 'error', priority: 'high', message: 'CF insuffisants' }],
          isValid: false,
          errorMessage: `Vous n'avez que ${formatMinutes(counters.cf)} de CF disponibles`,
        };
      }
      newCounters.cf -= amount;
      const semester = getCurrentSemester(date);
      if (semester === 1) {
        newCounters.cfConsoS1 += amount;
      } else {
        newCounters.cfConsoS2 += amount;
      }
      break;
    }

    case 'rtc': {
      if (amount > counters.rtc) {
        return {
          newCounters: counters,
          alerts: [{ id: '1', type: 'error', priority: 'high', message: 'RTC insuffisants' }],
          isValid: false,
          errorMessage: `Vous n'avez que ${formatMinutes(counters.rtc)} de RTC disponibles`,
        };
      }
      newCounters.rtc -= amount;

      // Alerte si RTC réservés entamés
      if (isRTCReservesEntames(newCounters.rtc)) {
        alerts.push({
          id: '2',
          type: 'warning',
          priority: 'high',
          message: 'Attention : vous entamez vos RTC réservés pour le CET !',
          counterType: 'rtc',
        });
      }
      break;
    }

    case 'rtt': {
      if (!counters.hasRTT || counters.rtt === undefined) {
        return {
          newCounters: counters,
          alerts: [{ id: '1', type: 'error', priority: 'high', message: 'RTT non disponibles' }],
          isValid: false,
          errorMessage: 'Vous n\'avez pas de RTT configurés',
        };
      }
      if (amount > counters.rtt) {
        return {
          newCounters: counters,
          alerts: [{ id: '1', type: 'error', priority: 'high', message: 'RTT insuffisants' }],
          isValid: false,
          errorMessage: `Vous n'avez que ${formatMinutes(counters.rtt)} de RTT disponibles`,
        };
      }
      newCounters.rtt = counters.rtt - amount;
      break;
    }

    case 'rps': {
      if (amount > counters.rps) {
        return {
          newCounters: counters,
          alerts: [{ id: '1', type: 'error', priority: 'high', message: 'RPS insuffisants' }],
          isValid: false,
          errorMessage: `Vous n'avez que ${formatMinutes(counters.rps)} de RPS disponibles`,
        };
      }
      newCounters.rps -= amount;
      break;
    }

    case 'hs': {
      if (amount > counters.hs) {
        return {
          newCounters: counters,
          alerts: [{ id: '1', type: 'error', priority: 'high', message: 'HS insuffisantes' }],
          isValid: false,
          errorMessage: `Vous n'avez que ${formatMinutes(counters.hs)} d'HS disponibles`,
        };
      }
      newCounters.hs -= amount;
      break;
    }

    default:
      return {
        newCounters: counters,
        alerts: [{ id: '1', type: 'error', priority: 'high', message: 'Type de congé invalide' }],
        isValid: false,
        errorMessage: 'Type de congé non reconnu',
      };
  }

  return {
    newCounters,
    alerts,
    isValid: true,
  };
}

// ============================================
// UTILITAIRES
// ============================================

/**
 * Formate des minutes en heures:minutes
 */
export function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return `${hours}h${mins.toString().padStart(2, '0')}`;
}

/**
 * Parse une chaîne heures:minutes en minutes
 */
export function parseTimeToMinutes(timeStr: string): number {
  const match = timeStr.match(/^(\d+)h?(\d*)$/i);
  if (!match) return 0;

  const hours = parseInt(match[1], 10) || 0;
  const mins = parseInt(match[2], 10) || 0;

  return hours * 60 + mins;
}

/**
 * Calcule les jours restants jusqu'à une date
 */
export function getDaysUntil(targetDate: Date, fromDate: Date = new Date()): number {
  const diffTime = targetDate.getTime() - fromDate.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Formate une date en français
 */
export function formatDateFR(date: Date): string {
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Calcule le pourcentage d'urgence basé sur le temps restant
 */
export function calculateUrgencyPercent(daysRemaining: number, totalDays: number): number {
  if (daysRemaining <= 0) return 100;
  if (daysRemaining >= totalDays) return 0;
  return Math.round((1 - daysRemaining / totalDays) * 100);
}

/**
 * Détermine la couleur d'alerte selon l'urgence
 */
export function getUrgencyColor(percent: number): 'success' | 'warning' | 'error' {
  if (percent >= 80) return 'error';
  if (percent >= 50) return 'warning';
  return 'success';
}

/**
 * Vérifie si une date a au moins un congé posé
 */
export function hasPostedLeaveOnDate(
  date: Date,
  history: HistoryEntry[]
): boolean {
  const dateStr = date.toISOString().split('T')[0]; // Format YYYY-MM-DD
  return history.some(
    (entry) => entry.action === 'pose' && entry.date.startsWith(dateStr)
  );
}
