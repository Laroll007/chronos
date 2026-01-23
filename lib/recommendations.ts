// Algorithme de recommandations pour Chronos

import { Counters, CycleConfig, Recommendation, AlertPriority } from './types';
import {
  CF_PAR_SEMESTRE,
  CA_REQUIS_POUR_HP,
  RTC_RESERVES_CET,
  RTC_LIBRES,
  HS_MAX_STOCKABLES,
  HEURES_PAR_JOUR,
} from './constants';
import {
  formatMinutes,
  getCurrentSemester,
  getCFRemainingForSemester,
  getDaysUntilSemesterDeadline,
  getRTCLibres,
  isRTCReservesEntames,
  getCANeededForHP,
  getDaysUntil,
  calculateUrgencyPercent,
} from './calculations';
import { generateId } from './storage';

// ============================================
// GÉNÉRATION DES RECOMMANDATIONS
// ============================================

/**
 * Génère toutes les recommandations basées sur l'état actuel
 */
export function generateRecommendations(
  counters: Counters,
  cycleConfig: CycleConfig,
  currentDate: Date = new Date()
): Recommendation[] {
  const recommendations: Recommendation[] = [];
  const year = currentDate.getFullYear();

  // 1. CF SEMESTRE (priorité haute)
  recommendations.push(...checkCFSemester(counters, currentDate, year));

  // 2. CA HP CONDITION (priorité haute si proche deadline)
  recommendations.push(...checkCAHPCondition(counters, currentDate, year));

  // 3. RTC LIBRES (priorité moyenne)
  recommendations.push(...checkRTCLibres(counters, currentDate, year));

  // 4. RTC RÉSERVÉS ENTAMÉS (priorité critique)
  recommendations.push(...checkRTCReserves(counters));

  // 5. CA EXCÉDENTAIRES (priorité moyenne)
  recommendations.push(...checkCAExcedentaires(counters, currentDate, year));

  // 6. RTT (si applicable)
  if (counters.hasRTT && counters.rtt !== undefined) {
    recommendations.push(...checkRTT(counters, currentDate, year));
  }

  // 7. HS LIMITE (priorité haute si proche)
  recommendations.push(...checkHSLimite(counters));

  // Trier par priorité
  const priorityOrder: Record<AlertPriority, number> = {
    high: 0,
    medium: 1,
    low: 2,
  };

  return recommendations.sort((a, b) => {
    // D'abord par priorité
    const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (priorityDiff !== 0) return priorityDiff;

    // Ensuite par deadline (les plus proches d'abord)
    if (a.deadline && b.deadline) {
      return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
    }
    if (a.deadline) return -1;
    if (b.deadline) return 1;

    return 0;
  });
}

// ============================================
// VÉRIFICATIONS INDIVIDUELLES
// ============================================

function checkCFSemester(
  counters: Counters,
  currentDate: Date,
  year: number
): Recommendation[] {
  const recommendations: Recommendation[] = [];
  const semester = getCurrentSemester(currentDate);
  const daysRemaining = getDaysUntilSemesterDeadline(currentDate);

  // Semestre 1
  if (semester === 1) {
    const cfRestantS1 = getCFRemainingForSemester(1, counters.cfConsoS1, counters.cfConsoS2);
    if (cfRestantS1 > 0) {
      const urgency = calculateUrgencyPercent(daysRemaining, 180);
      recommendations.push({
        id: generateId(),
        priority: urgency >= 80 ? 'high' : urgency >= 50 ? 'medium' : 'low',
        action: `Consommer ${formatMinutes(cfRestantS1)} de CF`,
        reason: `Deadline semestre 1 : 30 juin (${daysRemaining}j restants)`,
        deadline: `${year}-06-30`,
        counterType: 'cf',
        amountToConsume: cfRestantS1,
      });
    }
  }

  // Semestre 2 - toujours afficher si restant
  const cfRestantS2 = getCFRemainingForSemester(2, counters.cfConsoS1, counters.cfConsoS2);
  if (semester === 2 && cfRestantS2 > 0) {
    const urgency = calculateUrgencyPercent(daysRemaining, 180);
    recommendations.push({
      id: generateId(),
      priority: urgency >= 80 ? 'high' : urgency >= 50 ? 'medium' : 'low',
      action: `Consommer ${formatMinutes(cfRestantS2)} de CF`,
      reason: `Deadline semestre 2 : 31 décembre (${daysRemaining}j restants)`,
      deadline: `${year}-12-31`,
      counterType: 'cf',
      amountToConsume: cfRestantS2,
    });
  }

  return recommendations;
}

function checkCAHPCondition(
  counters: Counters,
  currentDate: Date,
  year: number
): Recommendation[] {
  const recommendations: Recommendation[] = [];
  const month = currentDate.getMonth() + 1;

  // Période 1 : 01/01 - 30/04
  if (month >= 1 && month <= 4) {
    const caNeeded = getCANeededForHP(counters.caPosesHorsPeriode);
    if (caNeeded > 0) {
      const deadline = new Date(year, 3, 30); // 30 avril
      const daysRemaining = getDaysUntil(deadline, currentDate);
      const urgency = calculateUrgencyPercent(daysRemaining, 120);

      recommendations.push({
        id: generateId(),
        priority: urgency >= 70 ? 'high' : 'medium',
        action: `Poser ${caNeeded} CA avant le 30 avril`,
        reason: `Pour obtenir les 2 CA Hors Période bonus (${daysRemaining}j restants)`,
        deadline: `${year}-04-30`,
        counterType: 'ca',
        amountToConsume: caNeeded,
      });
    }
  }

  // Période 2 : 01/11 - 31/12 (si période 1 non validée)
  if (month >= 11 && counters.caHP === 0) {
    const caNeeded = getCANeededForHP(counters.caPosesHorsPeriode);
    if (caNeeded > 0 && counters.ca >= caNeeded) {
      const deadline = new Date(year, 11, 31); // 31 décembre
      const daysRemaining = getDaysUntil(deadline, currentDate);

      recommendations.push({
        id: generateId(),
        priority: daysRemaining <= 30 ? 'high' : 'medium',
        action: `Poser ${caNeeded} CA avant le 31 décembre`,
        reason: `Dernière chance pour les 2 CA HP bonus (${daysRemaining}j restants)`,
        deadline: `${year}-12-31`,
        counterType: 'ca',
        amountToConsume: caNeeded,
      });
    }
  }

  return recommendations;
}

function checkRTCLibres(
  counters: Counters,
  currentDate: Date,
  year: number
): Recommendation[] {
  const recommendations: Recommendation[] = [];
  const rtcLibres = getRTCLibres(counters.rtc);

  if (rtcLibres > 0) {
    const deadline = new Date(year, 11, 31);
    const daysRemaining = getDaysUntil(deadline, currentDate);
    const urgency = calculateUrgencyPercent(daysRemaining, 365);

    recommendations.push({
      id: generateId(),
      priority: urgency >= 80 ? 'high' : urgency >= 50 ? 'medium' : 'low',
      action: `Consommer ${formatMinutes(rtcLibres)} de RTC libres`,
      reason: `Perdus au 31/12 (après réserve CET de 83h30)`,
      deadline: `${year}-12-31`,
      counterType: 'rtc',
      amountToConsume: rtcLibres,
    });
  }

  return recommendations;
}

function checkRTCReserves(counters: Counters): Recommendation[] {
  const recommendations: Recommendation[] = [];

  if (isRTCReservesEntames(counters.rtc)) {
    const manque = RTC_RESERVES_CET - counters.rtc;
    recommendations.push({
      id: generateId(),
      priority: 'high',
      action: `ATTENTION : RTC réservés CET entamés de ${formatMinutes(manque)}`,
      reason: `Vous perdez le gain de 37h50 de la conversion avantageuse RTC → CET`,
      counterType: 'rtc',
    });
  }

  return recommendations;
}

function checkCAExcedentaires(
  counters: Counters,
  currentDate: Date,
  year: number
): Recommendation[] {
  const recommendations: Recommendation[] = [];

  // CA qui ne peuvent pas aller au CET (au-delà de 5 + CA HP)
  const caVersCET = Math.min(5, counters.ca);
  const caExcedentaires = Math.max(0, counters.ca - caVersCET - (counters.caHP > 0 ? 0 : getCANeededForHP(counters.caPosesHorsPeriode)));

  if (caExcedentaires > 0) {
    const deadline = new Date(year, 11, 31);
    const daysRemaining = getDaysUntil(deadline, currentDate);
    const urgency = calculateUrgencyPercent(daysRemaining, 365);

    recommendations.push({
      id: generateId(),
      priority: urgency >= 70 ? 'high' : 'medium',
      action: `Consommer ${caExcedentaires} CA excédentaires`,
      reason: `Ces CA ne peuvent pas aller au CET (max 5 CA classiques)`,
      deadline: `${year}-12-31`,
      counterType: 'ca',
      amountToConsume: caExcedentaires,
    });
  }

  return recommendations;
}

function checkRTT(
  counters: Counters,
  currentDate: Date,
  year: number
): Recommendation[] {
  const recommendations: Recommendation[] = [];

  if (counters.rtt && counters.rtt > 0) {
    const deadline = new Date(year, 11, 31);
    const daysRemaining = getDaysUntil(deadline, currentDate);
    const urgency = calculateUrgencyPercent(daysRemaining, 365);

    recommendations.push({
      id: generateId(),
      priority: urgency >= 80 ? 'high' : urgency >= 50 ? 'medium' : 'low',
      action: `Consommer ${formatMinutes(counters.rtt)} de RTT`,
      reason: `Perdus au 31/12`,
      deadline: `${year}-12-31`,
      counterType: 'rtt',
      amountToConsume: counters.rtt,
    });
  }

  return recommendations;
}

function checkHSLimite(counters: Counters): Recommendation[] {
  const recommendations: Recommendation[] = [];

  if (counters.hs >= HS_MAX_STOCKABLES) {
    recommendations.push({
      id: generateId(),
      priority: 'high',
      action: 'HS au maximum (160h) : paiement obligatoire des prochaines',
      reason: `Consommer ou accepter le paiement des futures HS`,
      counterType: 'hs',
    });
  } else if (counters.hs >= HS_MAX_STOCKABLES * 0.9) {
    const restant = HS_MAX_STOCKABLES - counters.hs;
    recommendations.push({
      id: generateId(),
      priority: 'medium',
      action: `HS proches du plafond : ${formatMinutes(restant)} de marge`,
      reason: `Au-delà de 160h, les HS sont obligatoirement payées`,
      counterType: 'hs',
    });
  }

  return recommendations;
}

// ============================================
// RECOMMANDATIONS RÉSUMÉES
// ============================================

/**
 * Génère un résumé des actions prioritaires pour la semaine
 */
export function getWeeklyPriorities(
  counters: Counters,
  cycleConfig: CycleConfig
): string[] {
  const recommendations = generateRecommendations(counters, cycleConfig);
  const highPriority = recommendations.filter((r) => r.priority === 'high');

  return highPriority.slice(0, 3).map((r) => r.action);
}

/**
 * Génère un résumé des objectifs du mois
 */
export function getMonthlyGoals(
  counters: Counters,
  cycleConfig: CycleConfig
): string[] {
  const recommendations = generateRecommendations(counters, cycleConfig);
  const currentDate = new Date();
  const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

  return recommendations
    .filter((r) => {
      if (!r.deadline) return false;
      const deadline = new Date(r.deadline);
      return deadline <= endOfMonth;
    })
    .map((r) => r.action);
}

/**
 * Compte les alertes par niveau de priorité
 */
export function countAlertsByPriority(
  counters: Counters,
  cycleConfig: CycleConfig
): { high: number; medium: number; low: number } {
  const recommendations = generateRecommendations(counters, cycleConfig);

  return {
    high: recommendations.filter((r) => r.priority === 'high').length,
    medium: recommendations.filter((r) => r.priority === 'medium').length,
    low: recommendations.filter((r) => r.priority === 'low').length,
  };
}
