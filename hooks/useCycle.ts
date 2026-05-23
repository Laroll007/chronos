'use client';

import { useMemo } from 'react';
import { CycleConfig, WeekType } from '@/lib/types';
import {
  getWeekType,
  isWorkingDay,
  isSundayWorked,
  countSundaysWorked,
  countWorkingDays,
} from '@/lib/calculations';

export interface CycleInfo {
  currentWeekType: WeekType;
  isWorkingToday: boolean;
  isSundayWorkedToday: boolean;
  workingDaysThisMonth: number;
  sundaysWorkedThisMonth: number;
  workingDaysThisYear: number;
  sundaysWorkedThisYear: number;
  nextWorkingDay: Date | null;
  nextRestDay: Date | null;
}

/**
 * Hook pour les calculs liés au cycle de travail
 */
export function useCycle(cycleConfig: CycleConfig | null): CycleInfo | null {
  return useMemo(() => {
    if (!cycleConfig) return null;

    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();

    // Début du mois et de l'année
    const monthStart = new Date(year, month, 1);
    const yearStart = new Date(year, 0, 1);

    // Type de semaine actuelle
    const currentWeekType = getWeekType(today, cycleConfig);

    // Aujourd'hui est-il travaillé ?
    const isWorkingToday = isWorkingDay(today, cycleConfig);
    const isSundayWorkedToday = isSundayWorked(today, cycleConfig);

    // Statistiques du mois
    const workingDaysThisMonth = countWorkingDays(monthStart, today, cycleConfig);
    const sundaysWorkedThisMonth = countSundaysWorked(monthStart, today, cycleConfig);

    // Statistiques de l'année
    const workingDaysThisYear = countWorkingDays(yearStart, today, cycleConfig);
    const sundaysWorkedThisYear = countSundaysWorked(yearStart, today, cycleConfig);

    // Prochain jour travaillé
    let nextWorkingDay: Date | null = null;
    const searchDate = new Date(today);
    searchDate.setDate(searchDate.getDate() + 1);
    for (let i = 0; i < 14; i++) {
      if (isWorkingDay(searchDate, cycleConfig)) {
        nextWorkingDay = new Date(searchDate);
        break;
      }
      searchDate.setDate(searchDate.getDate() + 1);
    }

    // Prochain jour de repos
    let nextRestDay: Date | null = null;
    const restSearchDate = new Date(today);
    restSearchDate.setDate(restSearchDate.getDate() + 1);
    for (let i = 0; i < 14; i++) {
      if (!isWorkingDay(restSearchDate, cycleConfig)) {
        nextRestDay = new Date(restSearchDate);
        break;
      }
      restSearchDate.setDate(restSearchDate.getDate() + 1);
    }

    return {
      currentWeekType,
      isWorkingToday,
      isSundayWorkedToday,
      workingDaysThisMonth,
      sundaysWorkedThisMonth,
      workingDaysThisYear,
      sundaysWorkedThisYear,
      nextWorkingDay,
      nextRestDay,
    };
  }, [cycleConfig]);
}

/**
 * Génère le calendrier du mois avec les jours travaillés
 */
// Logique pure extraite — utilisable hors React (loops, calculs, etc.)
export function computeMonthCalendar(
  cycleConfig: CycleConfig | null,
  year: number,
  month: number
): { date: Date; isWorking: boolean; isSunday: boolean; isToday: boolean }[] {
  if (!cycleConfig) return [];

  const today = new Date();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const days: { date: Date; isWorking: boolean; isSunday: boolean; isToday: boolean }[] = [];

  const current = new Date(firstDay);
  while (current <= lastDay) {
    const date = new Date(current);
    days.push({
      date,
      isWorking: isWorkingDay(date, cycleConfig),
      isSunday: date.getDay() === 0,
      isToday:
        date.getDate() === today.getDate() &&
        date.getMonth() === today.getMonth() &&
        date.getFullYear() === today.getFullYear(),
    });
    current.setDate(current.getDate() + 1);
  }

  return days;
}

export function useMonthCalendar(
  cycleConfig: CycleConfig | null,
  year: number,
  month: number
): { date: Date; isWorking: boolean; isSunday: boolean; isToday: boolean }[] {
  return useMemo(() => computeMonthCalendar(cycleConfig, year, month), [cycleConfig, year, month]);
}

/**
 * Génère le calendrier de l'année complète
 */
export function useYearCalendar(
  cycleConfig: CycleConfig | null,
  year: number
): Map<number, { date: Date; isWorking: boolean; isSunday: boolean }[]> {
  return useMemo(() => {
    const calendar = new Map<number, { date: Date; isWorking: boolean; isSunday: boolean }[]>();

    if (!cycleConfig) return calendar;

    for (let month = 0; month < 12; month++) {
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      const days: { date: Date; isWorking: boolean; isSunday: boolean }[] = [];

      const current = new Date(firstDay);
      while (current <= lastDay) {
        const date = new Date(current);
        days.push({
          date,
          isWorking: isWorkingDay(date, cycleConfig),
          isSunday: date.getDay() === 0,
        });
        current.setDate(current.getDate() + 1);
      }

      calendar.set(month, days);
    }

    return calendar;
  }, [cycleConfig, year]);
}
