// Moteur d'optimisation pour générer et scorer les combinaisons de congés

import {
  Counters,
  CounterType,
  Combination,
  CombinationItem,
  ScoreLabel,
} from './types';
import {
  HEURES_PAR_JOUR,
  CA_MAX_VERS_CET,
  CA_REQUIS_POUR_HP,
  RTC_RESERVES_CET,
  HS_MAX_STOCKABLES,
} from './constants';
import {
  getRTCLibres,
  getCANeededForHP,
  isInCAHPPeriod,
} from './calculations';

// ============================================
// HELPERS
// ============================================

/**
 * Génère un ID unique
 */
function generateId(): string {
  return `comb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Convertit une valeur en jours selon le type de compteur
 */
function toWorkingDays(amount: number, type: CounterType): number {
  // CA et CET sont déjà en jours
  if (type === 'ca' || type === 'caHP' || type === 'cet') {
    return amount;
  }
  // CF, RTC, RPS, HS sont en minutes → convertir en jours
  return Math.round((amount / HEURES_PAR_JOUR) * 10) / 10;
}

/**
 * Convertit des jours en minutes pour un type donné
 */
function toMinutes(days: number, type: CounterType): number {
  if (type === 'ca' || type === 'caHP' || type === 'cet') {
    return days; // garde en jours
  }
  return Math.round(days * HEURES_PAR_JOUR);
}

/**
 * Retourne la quantité disponible pour un type de compteur donné (en jours travaillés)
 */
function getAvailableAmount(counters: Counters, type: CounterType): number {
  switch (type) {
    case 'ca':
      return counters.ca;
    case 'caHP':
      return counters.caHP;
    case 'cf':
      return toWorkingDays(counters.cf, 'cf');
    case 'rtc':
      return toWorkingDays(counters.rtc, 'rtc');
    case 'rps':
      return toWorkingDays(counters.rps, 'rps');
    case 'hs':
      return toWorkingDays(counters.hs, 'hs');
    default:
      return 0;
  }
}

/**
 * Retourne le label d'étoiles selon le score
 */
function getScoreLabel(score: number): ScoreLabel {
  if (score >= 90) return '⭐⭐⭐⭐⭐';
  if (score >= 75) return '⭐⭐⭐⭐';
  if (score >= 60) return '⭐⭐⭐';
  return '⭐⭐';
}

/**
 * Retourne le nom lisible d'un type de compteur
 */
function getCounterLabel(type: CounterType): string {
  const labels: Record<CounterType, string> = {
    ca: 'CA',
    caHP: 'CA HP',
    cf: 'CF',
    rtc: 'RTC',
    rtt: 'RTT',
    rps: 'RPS',
    hs: 'HS',
    cet: 'CET',
  };
  return labels[type];
}

/**
 * Formate une durée en minutes en format lisible
 */
function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) return `${hours}h`;
  return `${hours}h${mins.toString().padStart(2, '0')}`;
}

// ============================================
// SCORING - CRITÈRES DE PRIORITÉ
// ============================================

/**
 * Calcule le poids de priorité pour un type de compteur donné
 * Retourne un score sur 40 points
 */
function getPriorityWeight(
  type: CounterType,
  counters: Counters,
  date: Date
): number {
  switch (type) {
    case 'cf':
      return 40; // Toujours prioritaire (à lisser sur semestres)

    case 'ca': {
      const caExcess = counters.ca - CA_MAX_VERS_CET; // Au-delà de la réserve CET
      const caNeededForHP = getCANeededForHP(counters.caPosesHorsPeriode);

      if (caExcess > 0 && caNeededForHP === 0) {
        return 35; // CA excédentaires : priorité haute
      } else if (caNeededForHP > 0 && isInCAHPPeriod(date)) {
        return 25; // CA pendant période HP : moyenne
      } else {
        return 30; // CA normaux
      }
    }

    case 'rtc': {
      const rtcLibres = getRTCLibres(counters.rtc);
      if (rtcLibres > 0) {
        return 30; // RTC libres : priorité
      } else {
        return 5; // RTC réservés : ÉVITER !
      }
    }

    case 'rps':
      return 20; // Gardés mais utilisables

    case 'hs':
      return counters.hs >= HS_MAX_STOCKABLES * 0.9 ? 25 : 15; // Si proche limite

    case 'caHP':
      return 10; // Bonus CA HP

    default:
      return 10;
  }
}

/**
 * Calcule le score d'évitement des pertes (sur 30 points)
 */
function calculateLossPrevention(
  combination: CombinationItem[],
  counters: Counters,
  date: Date
): number {
  let score = 30;

  for (const item of combination) {
    // Pénalité si entame RTC réservés
    if (item.type === 'rtc') {
      const rtcLibres = getRTCLibres(counters.rtc);
      const amountInMinutes = toMinutes(item.amount, 'rtc');
      if (amountInMinutes > rtcLibres) {
        score -= 15; // Pénalité lourde
      }
    }

    // Pénalité si utilise CA alors que CA HP pas obtenus
    if (item.type === 'ca') {
      const caNeeded = getCANeededForHP(counters.caPosesHorsPeriode);
      if (caNeeded > 0 && isInCAHPPeriod(date)) {
        score -= 10;
      }
    }
  }

  return Math.max(score, 0);
}

/**
 * Calcule le score d'optimisation CET (sur 10 points)
 */
function calculateCETOptimization(
  combination: CombinationItem[],
  counters: Counters
): number {
  let score = 0;

  // Bonus si garde RTC réservés intacts
  const usesRTCReserves = combination.some((item) => {
    if (item.type !== 'rtc') return false;
    const rtcLibres = getRTCLibres(counters.rtc);
    const amountInMinutes = toMinutes(item.amount, 'rtc');
    return amountInMinutes > rtcLibres;
  });

  if (!usesRTCReserves) {
    score += 5;
  }

  // Bonus si garde CA pour CET (max 5j)
  const usesCA = combination.find((item) => item.type === 'ca');
  if (usesCA) {
    const caRemaining = counters.ca - usesCA.amount;
    if (caRemaining >= CA_MAX_VERS_CET) {
      score += 5;
    }
  } else {
    score += 5; // Bonus complet si pas de CA utilisés
  }

  return score;
}

/**
 * Calcule le score global d'une combinaison (sur 100 points)
 */
export function calculateScore(
  combination: CombinationItem[],
  counters: Counters,
  date: Date
): number {
  let score = 0;
  const totalDays = combination.reduce((sum, item) => sum + item.amount, 0);

  // 1. Priorité de consommation (40 pts)
  const avgPriority = combination.reduce((sum, item) => {
    const weight = getPriorityWeight(item.type, counters, date);
    return sum + weight * (item.amount / totalDays);
  }, 0);
  score += avgPriority;

  // 2. Éviter les pertes (30 pts)
  const lossScore = calculateLossPrevention(combination, counters, date);
  score += lossScore;

  // 3. Simplicité (20 pts)
  // 1 type = 20pts, 2 types = 15pts, 3+ = 10pts
  const simplicityScore = 20 - (combination.length - 1) * 5;
  score += Math.max(simplicityScore, 10);

  // 4. Optimisation CET (10 pts)
  const cetScore = calculateCETOptimization(combination, counters);
  score += cetScore;

  return Math.min(score, 100);
}

// ============================================
// GÉNÉRATION DES COMBINAISONS
// ============================================

/**
 * Génère les avantages d'une combinaison
 */
function generateAdvantages(
  combination: CombinationItem[],
  counters: Counters,
  score: number
): string[] {
  const advantages: string[] = [];

  // Score élevé
  if (score >= 90) {
    advantages.push('Combinaison optimale');
  }

  // Utilise CF
  if (combination.some((item) => item.type === 'cf')) {
    advantages.push('Utilise CF prioritaires');
  }

  // Utilise CA excédentaires
  const caItem = combination.find((item) => item.type === 'ca');
  if (caItem && counters.ca - caItem.amount >= CA_MAX_VERS_CET) {
    advantages.push('Utilise CA excédentaires');
  }

  // Garde RTC réservés
  const rtcItem = combination.find((item) => item.type === 'rtc');
  if (!rtcItem || toMinutes(rtcItem.amount, 'rtc') <= getRTCLibres(counters.rtc)) {
    advantages.push('Garde RTC réservés CET intacts');
  }

  // Simple (1 seul type)
  if (combination.length === 1) {
    advantages.push('Simple (1 seul type)');
  }

  return advantages;
}

/**
 * Génère les inconvénients d'une combinaison
 */
function generateDisadvantages(
  combination: CombinationItem[],
  counters: Counters,
  date: Date
): string[] {
  const disadvantages: string[] = [];

  // Entame RTC réservés
  const rtcItem = combination.find((item) => item.type === 'rtc');
  if (rtcItem && toMinutes(rtcItem.amount, 'rtc') > getRTCLibres(counters.rtc)) {
    disadvantages.push('⚠️ Entame RTC réservés (perte gain CET)');
  }

  // Utilise CA pendant période HP sans avoir obtenu CA HP
  const caItem = combination.find((item) => item.type === 'ca');
  if (caItem && getCANeededForHP(counters.caPosesHorsPeriode) > 0 && isInCAHPPeriod(date)) {
    disadvantages.push('Utilise CA pendant période HP');
  }

  // Complexe (3+ types)
  if (combination.length >= 3) {
    disadvantages.push('Combinaison complexe (plusieurs types)');
  }

  return disadvantages;
}

/**
 * Calcule l'impact d'une combinaison sur les compteurs
 */
function calculateImpact(
  combination: CombinationItem[],
  counters: Counters
): Array<{ type: CounterType; before: number; after: number }> {
  const impact: Array<{ type: CounterType; before: number; after: number }> = [];

  for (const item of combination) {
    let before: number;
    let after: number;

    switch (item.type) {
      case 'ca':
        before = counters.ca;
        after = counters.ca - item.amount;
        break;
      case 'caHP':
        before = counters.caHP;
        after = counters.caHP - item.amount;
        break;
      case 'cf':
        before = counters.cf;
        after = counters.cf - toMinutes(item.amount, 'cf');
        break;
      case 'rtc':
        before = counters.rtc;
        after = counters.rtc - toMinutes(item.amount, 'rtc');
        break;
      case 'rps':
        before = counters.rps;
        after = counters.rps - toMinutes(item.amount, 'rps');
        break;
      case 'hs':
        before = counters.hs;
        after = counters.hs - toMinutes(item.amount, 'hs');
        break;
      default:
        continue;
    }

    impact.push({ type: item.type, before, after });
  }

  return impact;
}

/**
 * Crée un objet Combination complet
 */
function createCombination(
  items: CombinationItem[],
  counters: Counters,
  date: Date
): Combination {
  const score = calculateScore(items, counters, date);
  const totalDays = items.reduce((sum, item) => sum + item.amount, 0);

  // Enrichir items avec amountMinutes
  const enrichedItems = items.map((item) => ({
    ...item,
    amountMinutes: toMinutes(item.amount, item.type),
  }));

  return {
    id: generateId(),
    items: enrichedItems,
    totalDays,
    score: Math.round(score),
    scoreLabel: getScoreLabel(score),
    advantages: generateAdvantages(enrichedItems, counters, score),
    disadvantages: generateDisadvantages(enrichedItems, counters, date),
    impact: calculateImpact(enrichedItems, counters),
    isValid: true,
  };
}

/**
 * Génère toutes les combinaisons possibles pour couvrir une période donnée
 */
export function generateAllCombinations(
  workingDays: number,
  counters: Counters,
  date: Date
): Combination[] {
  const combinations: Combination[] = [];
  const priorities: CounterType[] = ['cf', 'ca', 'caHP', 'rtc', 'rps', 'hs'];

  // 1. Combinaisons pures (1 seul type)
  for (const type of priorities) {
    const available = getAvailableAmount(counters, type);
    if (available >= workingDays) {
      combinations.push(
        createCombination(
          [
            {
              type,
              amount: workingDays,
            },
          ],
          counters,
          date
        )
      );
    }
  }

  // 2. Combinaisons mixtes (2 types)
  for (let i = 0; i < priorities.length; i++) {
    for (let j = i + 1; j < priorities.length; j++) {
      const type1 = priorities[i];
      const type2 = priorities[j];
      const avail1 = getAvailableAmount(counters, type1);
      const avail2 = getAvailableAmount(counters, type2);

      // Essayer différentes répartitions
      for (let amount1 = 1; amount1 <= Math.min(avail1, workingDays - 1); amount1++) {
        const amount2 = workingDays - amount1;
        if (amount2 <= avail2 && amount2 > 0) {
          combinations.push(
            createCombination(
              [
                { type: type1, amount: amount1 },
                { type: type2, amount: amount2 },
              ],
              counters,
              date
            )
          );
        }
      }
    }
  }

  // Trier par score (meilleur en premier) et limiter à 100
  return combinations
    .filter((c) => c.isValid)
    .sort((a, b) => b.score - a.score)
    .slice(0, 100);
}

/**
 * Retourne un résumé texte d'une combinaison
 */
export function getCombinationSummary(combination: Combination): string {
  if (combination.items.length === 1) {
    const item = combination.items[0];
    return `${item.amount}j ${getCounterLabel(item.type)}`;
  }

  return combination.items
    .map((item) => `${item.amount}j ${getCounterLabel(item.type)}`)
    .join(' + ');
}
