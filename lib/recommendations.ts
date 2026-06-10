// Algorithme de recommandations pour Chronos

import { Counters, CycleConfig, Recommendation, AlertPriority } from './types';
import {
  CF_PAR_SEMESTRE,
  CA_REQUIS_POUR_HP,
  RTC_RESERVES_CET,
  RTC_LIBRES,
  HS_MAX_STOCKABLES,
  HEURES_PAR_JOUR,
  CONGES_BONIFIES_EXPIRATION_MOIS,
  CONGES_BONIFIES_REPORT_MAX_MOIS,
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

  // 8. CA ANTÉRIEURS (deadline 30 avril — critique jan-avr)
  recommendations.push(...checkCAAnterieurs(counters, currentDate, year));

  // 9. CA HP ANTÉRIEURS (deadline 30 avril)
  recommendations.push(...checkCAHPAnterieurs(counters, currentDate, year));

  // 10. ARTT (perdus au 31/12)
  if (counters.hasARTT && counters.artt !== undefined && counters.artt > 0) {
    recommendations.push(...checkARTT(counters, currentDate, year));
  }

  // 11. CONGÉS BONIFIÉS (deadline selon date d'ouverture)
  if (counters.hasCongesBonifies && counters.congesBonifies !== undefined && counters.congesBonifies > 0) {
    recommendations.push(...checkCongesBonifies(counters, currentDate));
  }

  // 12. HS HISTORIQUE (pas de deadline légale — info si stock important)
  if (counters.hsHistorique > 0) {
    recommendations.push(...checkHSHistorique(counters));
  }

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
  if (counters.hasCF === false) return [];
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
  // Priorité haute dès le début : CA à poser avant CF pour déclencher le bonus CA HP
  if (month >= 1 && month <= 4) {
    const caNeeded = getCANeededForHP(counters.caPosesHorsPeriode);
    if (caNeeded > 0) {
      const deadline = new Date(year, 3, 30); // 30 avril
      const daysRemaining = getDaysUntil(deadline, currentDate);

      recommendations.push({
        id: generateId(),
        priority: 'high',
        action: `Poser ${caNeeded} CA avant le 30 avril`,
        reason: `${counters.caPosesHorsPeriode}/${CA_REQUIS_POUR_HP} CA posés hors période — ${daysRemaining}j pour obtenir les 2 CA HP bonus`,
        deadline: `${year}-04-30`,
        counterType: 'ca',
        amountToConsume: caNeeded,
      });
    }
  }

  // Période 2 : 01/11 - 31/12 (si condition jamais validée, indépendamment du solde caHP restant)
  if (month >= 11 && counters.caPosesHorsPeriode < CA_REQUIS_POUR_HP) {
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
  if (counters.hasRTC === false) return [];
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
  if (counters.hasRTC === false) return [];
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

function checkCAAnterieurs(
  counters: Counters,
  currentDate: Date,
  year: number
): Recommendation[] {
  if (counters.caAnterieur <= 0) return [];
  const recommendations: Recommendation[] = [];
  const deadline = new Date(year, 3, 30); // 30 avril
  const daysRemaining = getDaysUntil(deadline, currentDate);
  const month = currentDate.getMonth() + 1;

  if (month <= 4) {
    recommendations.push({
      id: generateId(),
      priority: daysRemaining <= 30 ? 'high' : 'medium',
      action: `Poser ${counters.caAnterieur} CA antérieurs avant le 30 avril`,
      reason: `Report N-1 — perdus après le 30 avril (${daysRemaining}j restants). Non convertibles au CET.`,
      deadline: `${year}-04-30`,
      counterType: 'caAnterieur',
      amountToConsume: counters.caAnterieur,
    });
  } else {
    // Après le 30 avril : les CA antérieurs sont expirés
    recommendations.push({
      id: generateId(),
      priority: 'high',
      action: `CA antérieurs expirés (${counters.caAnterieur}j)`,
      reason: `La deadline du 30 avril est dépassée. Ces jours sont perdus — pensez à remettre le compteur à 0.`,
      counterType: 'caAnterieur',
    });
  }
  return recommendations;
}

function checkCAHPAnterieurs(
  counters: Counters,
  currentDate: Date,
  year: number
): Recommendation[] {
  if (counters.caHPAnterieur <= 0) return [];
  const recommendations: Recommendation[] = [];
  const deadline = new Date(year, 3, 30); // 30 avril
  const daysRemaining = getDaysUntil(deadline, currentDate);
  const month = currentDate.getMonth() + 1;

  if (month <= 4) {
    recommendations.push({
      id: generateId(),
      priority: daysRemaining <= 30 ? 'high' : 'medium',
      action: `Poser ${counters.caHPAnterieur} CA HP antérieurs avant le 30 avril`,
      reason: `Bonus HP de l'année précédente — perdus après le 30 avril (${daysRemaining}j restants).`,
      deadline: `${year}-04-30`,
      counterType: 'caHPAnterieur',
      amountToConsume: counters.caHPAnterieur,
    });
  } else {
    recommendations.push({
      id: generateId(),
      priority: 'high',
      action: `CA HP antérieurs expirés (${counters.caHPAnterieur}j)`,
      reason: `La deadline du 30 avril est dépassée. Remettez le compteur à 0.`,
      counterType: 'caHPAnterieur',
    });
  }
  return recommendations;
}

function checkARTT(
  counters: Counters,
  currentDate: Date,
  year: number
): Recommendation[] {
  const artt = counters.artt ?? 0;
  if (artt <= 0) return [];
  const deadline = new Date(year, 11, 31); // 31 décembre
  const daysRemaining = getDaysUntil(deadline, currentDate);
  const urgency = calculateUrgencyPercent(daysRemaining, 365);

  return [{
    id: generateId(),
    priority: urgency >= 80 ? 'high' : urgency >= 50 ? 'medium' : 'low',
    action: `Consommer ${artt}j d'ARTT avant le 31 décembre`,
    reason: `Perdus au 31/12 s'ils ne sont pas posés (${daysRemaining}j restants)`,
    deadline: `${year}-12-31`,
    counterType: 'artt',
    amountToConsume: artt,
  }];
}

function checkCongesBonifies(
  counters: Counters,
  currentDate: Date
): Recommendation[] {
  const jours = counters.congesBonifies ?? 0;
  if (jours <= 0) return [];

  if (!counters.congesBonifiesDateOuverture) {
    return [{
      id: generateId(),
      priority: 'medium',
      action: `Planifier ${jours}j de congés bonifiés`,
      reason: `Date d'ouverture du droit non renseignée — configurez-la pour un suivi de deadline précis.`,
      counterType: 'congesBonifies',
    }];
  }

  const ouverture = new Date(counters.congesBonifiesDateOuverture);
  const expirationMs = CONGES_BONIFIES_EXPIRATION_MOIS + CONGES_BONIFIES_REPORT_MAX_MOIS;
  const expiration = new Date(ouverture);
  expiration.setMonth(expiration.getMonth() + expirationMs); // 48 mois max
  const softDeadline = new Date(ouverture);
  softDeadline.setMonth(softDeadline.getMonth() + CONGES_BONIFIES_EXPIRATION_MOIS); // 36 mois sans report

  const daysRemaining = getDaysUntil(expiration, currentDate);
  const daysToSoft = getDaysUntil(softDeadline, currentDate);

  return [{
    id: generateId(),
    priority: daysRemaining <= 90 ? 'high' : daysToSoft <= 180 ? 'medium' : 'low',
    action: `Planifier ${jours}j de congés bonifiés`,
    reason: `Expire ${daysToSoft > 0 ? `dans ${daysToSoft}j` : 'bientôt'} (max ${daysRemaining}j avec report). Droit ouvert le ${ouverture.toLocaleDateString('fr-FR')}.`,
    deadline: expiration.toISOString().split('T')[0],
    counterType: 'congesBonifies',
    amountToConsume: jours,
  }];
}

function checkHSHistorique(counters: Counters): Recommendation[] {
  const minutes = counters.hsHistorique;
  if (minutes <= 0) return [];

  return [{
    id: generateId(),
    priority: 'low',
    action: `${formatMinutes(minutes)} de HS historiques disponibles`,
    reason: `Stock antérieur à 2020. Récupération sur ordre de service ou indemnisation (13,25 €/h). Pas de deadline légale.`,
    counterType: 'hsHistorique',
  }];
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
