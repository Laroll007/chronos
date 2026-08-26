// Fonctions de calcul pour Chronos

import {
  CycleConfig,
  Counters,
  WeekSchedule,
  WeekHours,
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
  CA_HEBDO,
  CA_MAX_VERS_CET,
  CA_REQUIS_POUR_HP,
  CA_HP_PALIER_1,
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
 * Inclut semaineA/B pour invalider le cache après modification du planning
 */
function getCycleConfigHash(cycleConfig: CycleConfig): string {
  const scheduleA = Object.values(cycleConfig.semaineA).map(v => v ? '1' : '0').join('');
  const scheduleB = cycleConfig.semaineB ? Object.values(cycleConfig.semaineB).map(v => v ? '1' : '0').join('') : '';
  return `${cycleConfig.dateDebutCycle}|${cycleConfig.semaineActuelle}|${scheduleA}|${scheduleB}`;
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

/**
 * Durée travaillée (en minutes) d'un jour donné selon le régime.
 * - Cycle hebdo avec heuresSemaine : durée réelle du jour de la semaine (8h00 Lu-Je, 7h25 Ve…), 0 si repos.
 * - Sinon (cycles APORTT 12h08…) : heuresParJour (valeur représentative du régime), 0 si repos.
 * Sert de source de vérité pour convertir « jours posés » ↔ « minutes consommées » sur les compteurs horaires.
 */
export function getJourMinutes(date: Date, cycleConfig: CycleConfig): number {
  if (!isWorkingDay(date, cycleConfig)) return 0;

  if (cycleConfig.type === 'hebdo' && cycleConfig.heuresSemaine) {
    const dayKeys: (keyof WeekHours)[] = [
      'dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi',
    ];
    return cycleConfig.heuresSemaine[dayKeys[date.getDay()]] || 0;
  }

  return cycleConfig.heuresParJour || HEURES_PAR_JOUR;
}

/**
 * Somme exacte des minutes travaillées sur les jours TRAVAILLÉS d'une période.
 * Utilisé pour dimensionner la pose des compteurs horaires (CF/RTC/RPS/HS) selon
 * la durée réelle des jours (et non un forfait 12h08), notamment en cycle hebdo.
 */
export function countWorkingMinutes(
  startDate: Date,
  endDate: Date,
  cycleConfig: CycleConfig
): number {
  let total = 0;
  const current = new Date(startDate);
  current.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);

  while (current <= end) {
    total += getJourMinutes(current, cycleConfig);
    current.setDate(current.getDate() + 1);
  }

  return total;
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

/**
 * Retourne le nombre de CA annuels selon le cycle complet.
 * Cycle hebdomadaire = 25 (régime général) ; sinon dépend du pattern.
 */
export function getCATotalForCycle(cycleConfig: CycleConfig): number {
  if (cycleConfig.type === 'hebdo') return CA_HEBDO;
  return getCAParCycle(cycleConfig.pattern);
}

/**
 * Total d'heures travaillées sur la semaine (en minutes) — cycle hebdo.
 * Retourne 0 si non applicable (cycle alterné sans map par jour).
 */
export function getWeeklyMinutes(cycleConfig: CycleConfig): number {
  const h = cycleConfig.heuresSemaine;
  if (!h) return 0;
  return h.lundi + h.mardi + h.mercredi + h.jeudi + h.vendredi + h.samedi + h.dimanche;
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
  journeeSolidariteAppliquee: boolean = false
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
 * Nombre de jours TRAVAILLÉS d'une plage qui tombent réellement dans la période
 * CA HP (1er jan → 30 avr, 1er nov → 31 déc).
 *
 * Une pose du 28 avril au 5 mai ne compte que ses jours antérieurs au 1er mai :
 * auparavant, la date de début seule décidait, et les 4 jours étaient crédités
 * hors période — le bonus de 2 CA HP pouvait être accordé à tort (et refusé à
 * tort pour une plage 29 octobre → 3 novembre).
 */
export function countCAHPDays(
  startDate: Date,
  endDate: Date,
  cycleConfig: CycleConfig
): number {
  let count = 0;
  const current = new Date(startDate);
  current.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);

  while (current <= end) {
    if (isWorkingDay(current, cycleConfig) && isInCAHPPeriod(current)) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }

  return count;
}

/**
 * CA HP acquis pour un nombre de CA posés hors période.
 * Deux paliers : 4 CA → 1 jour de bonus, 8 CA → 2 jours.
 */
export function checkCAHPCondition(caPosesHorsPeriode: number): number {
  if (caPosesHorsPeriode >= CA_REQUIS_POUR_HP) return CA_HP_BONUS;
  if (caPosesHorsPeriode >= CA_HP_PALIER_1) return 1;
  return 0;
}

/**
 * Calcule les CA restants à poser pour obtenir le bonus COMPLET (2 jours).
 */
export function getCANeededForHP(caPosesHorsPeriode: number): number {
  if (caPosesHorsPeriode >= CA_REQUIS_POUR_HP) return 0;
  return CA_REQUIS_POUR_HP - caPosesHorsPeriode;
}

/**
 * CA restants à poser pour atteindre le PROCHAIN palier (1er ou 2e jour de bonus).
 * 0 si les deux paliers sont déjà franchis.
 */
export function getCANeededForNextHPPalier(caPosesHorsPeriode: number): number {
  if (caPosesHorsPeriode < CA_HP_PALIER_1) return CA_HP_PALIER_1 - caPosesHorsPeriode;
  if (caPosesHorsPeriode < CA_REQUIS_POUR_HP) return CA_REQUIS_POUR_HP - caPosesHorsPeriode;
  return 0;
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
 * Répartit les minutes travaillées d'une plage entre les deux semestres.
 *
 * Une pose du 28 juin au 3 juillet était intégralement imputée au S1, parce que
 * le semestre était déduit de la seule date de début — même défaut que pour la
 * période CA HP. Le crédit CF étant semestriel, cela faussait le suivi des deux
 * semestres à la fois.
 */
export function splitWorkingMinutesBySemester(
  startDate: Date,
  endDate: Date,
  cycleConfig: CycleConfig
): { s1: number; s2: number } {
  let s1 = 0;
  let s2 = 0;
  const current = new Date(startDate);
  current.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);

  while (current <= end) {
    const minutes = getJourMinutes(current, cycleConfig);
    if (minutes > 0) {
      if (getCurrentSemester(current) === 1) s1 += minutes;
      else s2 += minutes;
    }
    current.setDate(current.getDate() + 1);
  }

  return { s1, s2 };
}

/**
 * Part des `amount` minutes posées à imputer au 1er semestre, au prorata des
 * minutes réellement travaillées de chaque côté du 30 juin.
 */
export function getCFS1Share(
  amount: number,
  startDate: Date,
  endDate: Date,
  cycleConfig: CycleConfig
): number {
  const { s1, s2 } = splitWorkingMinutesBySemester(startDate, endDate, cycleConfig);
  const total = s1 + s2;
  // Plage sans jour travaillé : on retombe sur le semestre de la date de début.
  if (total === 0) return getCurrentSemester(startDate) === 1 ? amount : 0;
  return Math.min(amount, Math.round(amount * (s1 / total)));
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
  // Toujours cibler le maximum épargnable — pas d'objectif manuel
  const besoin = apportMax;

  if (besoin <= 0) {
    return {
      apportCET: { rtc: 0, caHP: 0, ca: 0, hs: 0 },
      totalApport: 0,
      cetFinal: counters.cet,
      gainNetRTC: 0,
      joursEconomises: 0,
      joursPerdus: 0,
      isOptimal: true,
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
/**
 * Précisions sur la plage couverte par une pose. Sans elles, la date de début
 * décide pour toute la période — ce qui fausse les poses à cheval sur une
 * frontière (30 avril pour les CA HP, 30 juin pour les CF).
 */
export interface PoseContext {
  /** Jours de la pose réellement situés dans la période CA HP (cf. countCAHPDays). */
  hpDays?: number;
  /** Minutes de la pose imputables au 1er semestre (cf. getCFS1Share). */
  cfS1Minutes?: number;
}

export function simulatePose(
  counters: Counters,
  type: CounterType,
  amount: number, // en minutes pour heures, en jours pour CA/CET
  date: Date,
  context: PoseContext = {}
): SimulationResult {
  const { hpDays, cfS1Minutes } = context;
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
      // Nombre de jours réellement posés dans la période HP : fourni par
      // l'appelant pour une plage, sinon déduit de la date (pose d'un seul jour).
      const joursHP = Math.min(
        amount,
        hpDays ?? (isInCAHPPeriod(date) ? amount : 0)
      );
      if (joursHP > 0) {
        // Deux paliers : 4 CA hors période → 1 jour de bonus, 8 CA → 2 jours.
        // On ne crédite QUE les paliers nouvellement franchis : `caHP` est un
        // solde consommable, le recalculer écraserait un bonus déjà utilisé.
        const acquisAvant = checkCAHPCondition(newCounters.caPosesHorsPeriode);
        newCounters.caPosesHorsPeriode += joursHP;
        const acquisApres = checkCAHPCondition(newCounters.caPosesHorsPeriode);
        const gain = acquisApres - acquisAvant;
        if (gain > 0) {
          // Plafonné au bonus réglementaire : un agent ayant déjà déclaré ses
          // CA HP à la main se retrouvait sinon au-delà du maximum de 2.
          newCounters.caHP = Math.min(CA_HP_BONUS, newCounters.caHP + gain);
        }
      }
      break;
    }

    case 'caHP': {
      if (amount > counters.caHP) {
        return {
          newCounters: counters,
          alerts: [{ id: '1', type: 'error', priority: 'high', message: 'CA HP insuffisants' }],
          isValid: false,
          errorMessage: `Vous n'avez que ${counters.caHP} CA HP disponibles`,
        };
      }
      newCounters.caHP -= amount;
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
      // Répartition réelle entre les semestres : fournie par l'appelant pour une
      // plage, sinon déduite de la date (pose sur un seul jour).
      const partS1 = cfS1Minutes ?? (getCurrentSemester(date) === 1 ? amount : 0);
      newCounters.cfConsoS1 += partS1;
      newCounters.cfConsoS2 += amount - partS1;
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
          errorMessage: `Vous n'avez que ${counters.rtt}j de RTT disponibles`,
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

    case 'cet': {
      if (amount > counters.cet) {
        return {
          newCounters: counters,
          alerts: [{ id: '1', type: 'error', priority: 'high', message: 'CET insuffisant' }],
          isValid: false,
          errorMessage: `Vous n'avez que ${counters.cet}j de CET disponibles`,
        };
      }
      newCounters.cet -= amount;
      break;
    }

    case 'artt': {
      if (!counters.hasARTT || counters.artt === undefined) {
        return {
          newCounters: counters,
          alerts: [{ id: '1', type: 'error', priority: 'high', message: 'ARTT non configurés' }],
          isValid: false,
          errorMessage: 'Les ARTT ne sont pas activés sur votre profil',
        };
      }
      if (amount > counters.artt) {
        return {
          newCounters: counters,
          alerts: [{ id: '1', type: 'error', priority: 'high', message: 'ARTT insuffisants' }],
          isValid: false,
          errorMessage: `Vous n'avez que ${counters.artt}j d'ARTT disponibles`,
        };
      }
      newCounters.artt = counters.artt - amount;
      break;
    }

    case 'caAnterieur': {
      if (amount > counters.caAnterieur) {
        return {
          newCounters: counters,
          alerts: [{ id: '1', type: 'error', priority: 'high', message: 'CA antérieurs insuffisants' }],
          isValid: false,
          errorMessage: `Vous n'avez que ${counters.caAnterieur}j de CA antérieurs disponibles`,
        };
      }
      newCounters.caAnterieur -= amount;
      break;
    }

    case 'caHPAnterieur': {
      if (amount > counters.caHPAnterieur) {
        return {
          newCounters: counters,
          alerts: [{ id: '1', type: 'error', priority: 'high', message: 'CA HP antérieurs insuffisants' }],
          isValid: false,
          errorMessage: `Vous n'avez que ${counters.caHPAnterieur}j de CA HP antérieurs disponibles`,
        };
      }
      newCounters.caHPAnterieur -= amount;
      break;
    }

    case 'cet2008': {
      if (!counters.hasCET2008 || counters.cet2008 === undefined) {
        return {
          newCounters: counters,
          alerts: [{ id: '1', type: 'error', priority: 'high', message: 'CET 2008 non configuré' }],
          isValid: false,
          errorMessage: 'Le CET 2008 n\'est pas activé sur votre profil',
        };
      }
      if (amount > counters.cet2008) {
        return {
          newCounters: counters,
          alerts: [{ id: '1', type: 'error', priority: 'high', message: 'CET 2008 insuffisant' }],
          isValid: false,
          errorMessage: `Vous n'avez que ${counters.cet2008}j de CET 2008 disponibles`,
        };
      }
      newCounters.cet2008 = counters.cet2008 - amount;
      break;
    }

    case 'congesBonifies': {
      if (!counters.hasCongesBonifies || counters.congesBonifies === undefined) {
        return {
          newCounters: counters,
          alerts: [{ id: '1', type: 'error', priority: 'high', message: 'Congés bonifiés non configurés' }],
          isValid: false,
          errorMessage: 'Les congés bonifiés ne sont pas activés sur votre profil',
        };
      }
      if (amount > counters.congesBonifies) {
        return {
          newCounters: counters,
          alerts: [{ id: '1', type: 'error', priority: 'high', message: 'Congés bonifiés insuffisants' }],
          isValid: false,
          errorMessage: `Vous n'avez que ${counters.congesBonifies}j de congés bonifiés disponibles`,
        };
      }
      newCounters.congesBonifies = counters.congesBonifies - amount;
      break;
    }

    case 'hsHistorique': {
      if (amount > counters.hsHistorique) {
        return {
          newCounters: counters,
          alerts: [{ id: '1', type: 'error', priority: 'high', message: 'HS historiques insuffisantes' }],
          isValid: false,
          errorMessage: `Vous n'avez que ${formatMinutes(counters.hsHistorique)} de HS historiques disponibles`,
        };
      }
      newCounters.hsHistorique -= amount;
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
 * Vérifie si une date est couverte par une entrée d'historique d'une action donnée
 */
function dateMatchesEntry(date: Date, entry: HistoryEntry, action: HistoryEntry['action']): boolean {
  if (entry.action !== action) return false;

  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  const dateTime = normalized.getTime();

  const startDate = new Date(entry.date);
  startDate.setHours(0, 0, 0, 0);
  const startTime = startDate.getTime();

  if (!entry.dateEnd) {
    return dateTime === startTime;
  }

  const endDate = new Date(entry.dateEnd);
  endDate.setHours(23, 59, 59, 999);
  return dateTime >= startTime && dateTime <= endDate.getTime();
}

/**
 * Vérifie si une date a au moins un congé posé
 */
export function hasPostedLeaveOnDate(
  date: Date,
  history: HistoryEntry[]
): boolean {
  // Les poses fractionnées (partialDay) ne couvrent PAS la journée entière → exclues ici.
  return history.some((entry) => !entry.partialDay && dateMatchesEntry(date, entry, 'pose'));
}

/**
 * Total des minutes posées en « fraction de journée » (sortie anticipée / demi-journée)
 * sur une date donnée. 0 si aucune. Le jour reste un jour travaillé.
 */
export function getPartialMinutesOnDate(
  date: Date,
  history: HistoryEntry[]
): number {
  return history
    .filter((entry) => entry.partialDay && dateMatchesEntry(date, entry, 'pose'))
    .reduce((sum, entry) => sum + entry.amount, 0);
}

/**
 * Vérifie si une date est marquée comme arrêt maladie (CMO)
 */
export function hasCMOOnDate(
  date: Date,
  history: HistoryEntry[]
): boolean {
  return history.some((entry) => dateMatchesEntry(date, entry, 'cmo'));
}

/**
 * Vérifie si une date est marquée comme astreinte / permanence
 */
export function hasAstreinteOnDate(
  date: Date,
  history: HistoryEntry[]
): boolean {
  return history.some((entry) => dateMatchesEntry(date, entry, 'astreinte'));
}

export interface WorkedDaysBreakdown {
  workingDays: number;   // jours travaillés (cycle + astreintes sur jours de repos)
  leaveDays: number;     // jours travaillés couverts par un congé posé
  cmoDays: number;       // jours travaillés couverts par un arrêt maladie (CMO)
  astreinteDays: number; // jours de repos travaillés en astreinte / permanence
  netWorkedDays: number; // jours réellement travaillés (workingDays - leaveDays - cmoDays)
}

/**
 * Calcule les jours réellement travaillés sur une période :
 * jours travaillés du cycle (+ astreintes posées sur des jours de repos),
 * moins les congés posés, moins les CMO.
 * Un congé posé prime sur un CMO si les deux couvrent le même jour.
 */
export function computeWorkedDays(
  startDate: Date,
  endDate: Date,
  cycleConfig: CycleConfig,
  history: HistoryEntry[]
): WorkedDaysBreakdown {
  let workingDays = 0;
  let leaveDays = 0;
  let cmoDays = 0;
  let astreinteDays = 0;

  const current = new Date(startDate);
  current.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);

  while (current <= end) {
    if (isWorkingDay(current, cycleConfig)) {
      workingDays++;
      if (hasPostedLeaveOnDate(current, history)) {
        leaveDays++;
      } else if (hasCMOOnDate(current, history)) {
        cmoDays++;
      }
    } else if (hasAstreinteOnDate(current, history)) {
      // Jour normalement en repos mais travaillé en astreinte → compté comme travaillé
      workingDays++;
      astreinteDays++;
    }
    current.setDate(current.getDate() + 1);
  }

  return {
    workingDays,
    leaveDays,
    cmoDays,
    astreinteDays,
    netWorkedDays: workingDays - leaveDays - cmoDays,
  };
}
