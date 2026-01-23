'use client';

import { useMemo } from 'react';
import { Counters, CycleConfig, Recommendation, CETProjection } from '@/lib/types';
import {
  generateRecommendations,
  getWeeklyPriorities,
  getMonthlyGoals,
  countAlertsByPriority,
} from '@/lib/recommendations';
import { calculateOptimalCETStrategy } from '@/lib/calculations';

interface RecommendationsData {
  all: Recommendation[];
  high: Recommendation[];
  medium: Recommendation[];
  low: Recommendation[];
  weeklyPriorities: string[];
  monthlyGoals: string[];
  alertCounts: { high: number; medium: number; low: number };
  cetProjection: CETProjection | null;
}

/**
 * Hook pour accéder aux recommandations et projections
 */
export function useRecommendations(
  counters: Counters | null,
  cycleConfig: CycleConfig | null
): RecommendationsData {
  return useMemo(() => {
    if (!counters || !cycleConfig) {
      return {
        all: [],
        high: [],
        medium: [],
        low: [],
        weeklyPriorities: [],
        monthlyGoals: [],
        alertCounts: { high: 0, medium: 0, low: 0 },
        cetProjection: null,
      };
    }

    const all = generateRecommendations(counters, cycleConfig);

    return {
      all,
      high: all.filter((r) => r.priority === 'high'),
      medium: all.filter((r) => r.priority === 'medium'),
      low: all.filter((r) => r.priority === 'low'),
      weeklyPriorities: getWeeklyPriorities(counters, cycleConfig),
      monthlyGoals: getMonthlyGoals(counters, cycleConfig),
      alertCounts: countAlertsByPriority(counters, cycleConfig),
      cetProjection: calculateOptimalCETStrategy(counters),
    };
  }, [counters, cycleConfig]);
}

/**
 * Hook pour la projection CET uniquement
 */
export function useCETProjection(counters: Counters | null): CETProjection | null {
  return useMemo(() => {
    if (!counters) return null;
    return calculateOptimalCETStrategy(counters);
  }, [counters]);
}
