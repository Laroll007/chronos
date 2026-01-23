// Hook pour la sélection de plage de dates en 2 clics

import { useState, useMemo } from 'react';
import { CycleConfig } from '@/lib/types';
import { countWorkingDays } from '@/lib/calculations';

export interface DateRangeSelection {
  selectedStart: Date | null;
  selectedEnd: Date | null;
  hoveredDate: Date | null;
  workingDaysCount: number;
  handleDateClick: (date: Date) => void;
  setHoveredDate: (date: Date | null) => void;
  isDateInRange: (date: Date) => boolean;
  isDateSelected: (date: Date) => boolean;
  reset: () => void;
}

/**
 * Hook pour gérer la sélection de plage de dates (2 clics)
 *
 * Logique:
 * 1. Premier clic : définit selectedStart, reset selectedEnd
 * 2. Survol après 1er clic : hoveredDate (preview visuel)
 * 3. Deuxième clic : définit selectedEnd (ou inverse si date < selectedStart)
 */
export function useDateRangePicker(
  cycleConfig: CycleConfig,
  onRangeSelected?: (start: Date, end: Date, workingDays: number) => void
): DateRangeSelection {
  const [selectedStart, setSelectedStart] = useState<Date | null>(null);
  const [selectedEnd, setSelectedEnd] = useState<Date | null>(null);
  const [hoveredDate, setHoveredDate] = useState<Date | null>(null);

  // Calcul du nombre de jours travaillés dans la plage
  const workingDaysCount = useMemo(() => {
    if (!selectedStart || !selectedEnd) return 0;
    return countWorkingDays(selectedStart, selectedEnd, cycleConfig);
  }, [selectedStart, selectedEnd, cycleConfig]);

  /**
   * Gère le clic sur une date
   */
  const handleDateClick = (date: Date) => {
    // Normaliser la date (enlever les heures/minutes/secondes)
    const normalizedDate = new Date(date);
    normalizedDate.setHours(0, 0, 0, 0);

    if (!selectedStart) {
      // Premier clic : définir le début
      setSelectedStart(normalizedDate);
      setSelectedEnd(null);
      setHoveredDate(null);
    } else if (!selectedEnd) {
      // Deuxième clic : définir la fin
      if (normalizedDate >= selectedStart) {
        setSelectedEnd(normalizedDate);
        setHoveredDate(null);

        // Calculer les jours travaillés et déclencher callback
        const workingDays = countWorkingDays(selectedStart, normalizedDate, cycleConfig);
        if (onRangeSelected) {
          onRangeSelected(selectedStart, normalizedDate, workingDays);
        }
      } else {
        // Si date < selectedStart, inverser
        setSelectedEnd(selectedStart);
        setSelectedStart(normalizedDate);
        setHoveredDate(null);

        // Calculer les jours travaillés et déclencher callback
        const workingDays = countWorkingDays(normalizedDate, selectedStart, cycleConfig);
        if (onRangeSelected) {
          onRangeSelected(normalizedDate, selectedStart, workingDays);
        }
      }
    } else {
      // Troisième clic : reset et recommencer
      setSelectedStart(normalizedDate);
      setSelectedEnd(null);
      setHoveredDate(null);
    }
  };

  /**
   * Vérifie si une date est dans la plage sélectionnée (ou en preview)
   */
  const isDateInRange = (date: Date): boolean => {
    if (!selectedStart) return false;

    const normalizedDate = new Date(date);
    normalizedDate.setHours(0, 0, 0, 0);

    const end = selectedEnd || hoveredDate;
    if (!end) return false;

    // Gérer l'ordre (start peut être > end pendant le survol)
    const rangeStart = selectedStart <= end ? selectedStart : end;
    const rangeEnd = selectedStart <= end ? end : selectedStart;

    return normalizedDate >= rangeStart && normalizedDate <= rangeEnd;
  };

  /**
   * Vérifie si une date est sélectionnée comme début ou fin
   */
  const isDateSelected = (date: Date): boolean => {
    if (!selectedStart) return false;

    const normalizedDate = new Date(date);
    normalizedDate.setHours(0, 0, 0, 0);

    if (selectedStart && normalizedDate.getTime() === selectedStart.getTime()) {
      return true;
    }

    if (selectedEnd && normalizedDate.getTime() === selectedEnd.getTime()) {
      return true;
    }

    return false;
  };

  /**
   * Reset la sélection
   */
  const reset = () => {
    setSelectedStart(null);
    setSelectedEnd(null);
    setHoveredDate(null);
  };

  return {
    selectedStart,
    selectedEnd,
    hoveredDate,
    workingDaysCount,
    handleDateClick,
    setHoveredDate,
    isDateInRange,
    isDateSelected,
    reset,
  };
}
