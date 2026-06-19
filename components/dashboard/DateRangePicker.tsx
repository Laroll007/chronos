// Hook pour la sélection de plage de dates - UX style Booking 2026

import { useState, useMemo, useCallback } from 'react';
import { CycleConfig } from '@/lib/types';
import { countWorkingDays } from '@/lib/calculations';

export interface DateRangeSelection {
  selectedStart: Date | null;
  selectedEnd: Date | null;
  hoveredDate: Date | null;
  workingDaysCount: number;
  previewWorkingDays: number; // Jours en preview pendant le hover
  handleDateClick: (date: Date) => void;
  setHoveredDate: (date: Date | null) => void;
  isDateInRange: (date: Date) => boolean;
  isDateSelected: (date: Date) => boolean;
  isRangeStart: (date: Date) => boolean;
  isRangeEnd: (date: Date) => boolean;
  isInPreview: (date: Date) => boolean;
  reset: () => void;
  isSelecting: boolean; // True quand on a cliqué sur start mais pas encore sur end
}

/**
 * Hook pour gérer la sélection de plage de dates (2 clics)
 * UX optimisée style Booking/Airbnb 2026
 */
export function useDateRangePicker(
  cycleConfig: CycleConfig,
  onRangeSelected?: (start: Date, end: Date, workingDays: number) => void,
  options?: {
    // Vrai si la date porte déjà un congé / CMO / astreinte / pose à l'heure.
    isDateOccupied?: (date: Date) => boolean;
    // Appelé quand un premier clic tombe sur un jour déjà occupé : on ouvre
    // l'édition/suppression au lieu de démarrer une nouvelle pose (anti-chevauchement).
    onOccupiedClick?: (date: Date) => void;
    // Appelé quand le 2e clic créerait une plage traversant un jour déjà occupé :
    // on annule la sélection (anti-chevauchement) et on prévient l'utilisateur.
    onOccupiedRange?: () => void;
  }
): DateRangeSelection {
  const [selectedStart, setSelectedStart] = useState<Date | null>(null);
  const [selectedEnd, setSelectedEnd] = useState<Date | null>(null);
  const [hoveredDate, setHoveredDate] = useState<Date | null>(null);

  // État de sélection en cours
  const isSelecting = selectedStart !== null && selectedEnd === null;

  // Calcul du nombre de jours travaillés dans la plage confirmée
  const workingDaysCount = useMemo(() => {
    if (!selectedStart || !selectedEnd) return 0;
    return countWorkingDays(selectedStart, selectedEnd, cycleConfig);
  }, [selectedStart, selectedEnd, cycleConfig]);

  // Calcul du nombre de jours en preview (pendant le hover)
  const previewWorkingDays = useMemo(() => {
    if (!selectedStart || !hoveredDate || selectedEnd) return 0;
    const start = selectedStart <= hoveredDate ? selectedStart : hoveredDate;
    const end = selectedStart <= hoveredDate ? hoveredDate : selectedStart;
    return countWorkingDays(start, end, cycleConfig);
  }, [selectedStart, hoveredDate, selectedEnd, cycleConfig]);

  // Normaliser une date
  const normalizeDate = useCallback((date: Date): Date => {
    const normalized = new Date(date);
    normalized.setHours(0, 0, 0, 0);
    return normalized;
  }, []);

  // Obtenir les bornes de la plage (actuelle ou preview)
  const getRangeBounds = useCallback((): { start: Date | null; end: Date | null } => {
    if (!selectedStart) return { start: null, end: null };

    const endDate = selectedEnd || hoveredDate;
    if (!endDate) return { start: selectedStart, end: null };

    // Toujours retourner dans le bon ordre
    if (selectedStart <= endDate) {
      return { start: selectedStart, end: endDate };
    }
    return { start: endDate, end: selectedStart };
  }, [selectedStart, selectedEnd, hoveredDate]);

  /**
   * Gère le clic sur une date
   */
  const handleDateClick = useCallback((date: Date) => {
    const normalizedDate = normalizeDate(date);

    // Premier clic sur un jour déjà posé : on n'enchaîne pas une nouvelle pose
    // par-dessus (chevauchement), on ouvre l'édition/suppression du congé existant.
    if (!selectedStart && options?.isDateOccupied?.(normalizedDate)) {
      options.onOccupiedClick?.(normalizedDate);
      return;
    }

    if (!selectedStart) {
      // Premier clic : définir le début
      setSelectedStart(normalizedDate);
      setSelectedEnd(null);
      setHoveredDate(null);
    } else if (!selectedEnd) {
      // Deuxième clic : définir la fin
      let finalStart = selectedStart;
      let finalEnd = normalizedDate;

      // Inverser si nécessaire
      if (normalizedDate < selectedStart) {
        finalStart = normalizedDate;
        finalEnd = selectedStart;
      }

      // Refuser une plage qui traverse un jour déjà posé (chevauchement).
      if (options?.isDateOccupied) {
        const cursor = new Date(finalStart);
        while (cursor <= finalEnd) {
          if (options.isDateOccupied(cursor)) {
            setSelectedStart(null);
            setSelectedEnd(null);
            setHoveredDate(null);
            options.onOccupiedRange?.();
            return;
          }
          cursor.setDate(cursor.getDate() + 1);
        }
      }

      setSelectedStart(finalStart);
      setSelectedEnd(finalEnd);
      setHoveredDate(null);

      // Calculer les jours travaillés et déclencher callback
      const workingDays = countWorkingDays(finalStart, finalEnd, cycleConfig);
      if (onRangeSelected) {
        onRangeSelected(finalStart, finalEnd, workingDays);
      }
    } else {
      // Troisième clic : reset et recommencer
      setSelectedStart(normalizedDate);
      setSelectedEnd(null);
      setHoveredDate(null);
    }
  }, [selectedStart, selectedEnd, normalizeDate, cycleConfig, onRangeSelected, options]);

  /**
   * Vérifie si une date est dans la plage (confirmée ou preview)
   */
  const isDateInRange = useCallback((date: Date): boolean => {
    const { start, end } = getRangeBounds();
    if (!start || !end) return false;

    const normalizedDate = normalizeDate(date);
    return normalizedDate >= start && normalizedDate <= end;
  }, [getRangeBounds, normalizeDate]);

  /**
   * Vérifie si une date est en mode preview (pas encore confirmée)
   */
  const isInPreview = useCallback((date: Date): boolean => {
    if (!selectedStart || selectedEnd || !hoveredDate) return false;

    const normalizedDate = normalizeDate(date);
    const start = selectedStart <= hoveredDate ? selectedStart : hoveredDate;
    const end = selectedStart <= hoveredDate ? hoveredDate : selectedStart;

    return normalizedDate >= start && normalizedDate <= end;
  }, [selectedStart, selectedEnd, hoveredDate, normalizeDate]);

  /**
   * Vérifie si une date est sélectionnée comme début ou fin
   */
  const isDateSelected = useCallback((date: Date): boolean => {
    if (!selectedStart) return false;

    const normalizedDate = normalizeDate(date);

    if (normalizedDate.getTime() === selectedStart.getTime()) {
      return true;
    }

    if (selectedEnd && normalizedDate.getTime() === selectedEnd.getTime()) {
      return true;
    }

    return false;
  }, [selectedStart, selectedEnd, normalizeDate]);

  /**
   * Vérifie si c'est le début de la plage
   */
  const isRangeStart = useCallback((date: Date): boolean => {
    const { start } = getRangeBounds();
    if (!start) return false;
    return normalizeDate(date).getTime() === start.getTime();
  }, [getRangeBounds, normalizeDate]);

  /**
   * Vérifie si c'est la fin de la plage
   */
  const isRangeEnd = useCallback((date: Date): boolean => {
    const { end } = getRangeBounds();
    if (!end) return false;
    return normalizeDate(date).getTime() === end.getTime();
  }, [getRangeBounds, normalizeDate]);

  /**
   * Reset la sélection
   */
  const reset = useCallback(() => {
    setSelectedStart(null);
    setSelectedEnd(null);
    setHoveredDate(null);
  }, []);

  // Wrapper pour setHoveredDate avec normalisation
  const handleSetHoveredDate = useCallback((date: Date | null) => {
    if (date) {
      setHoveredDate(normalizeDate(date));
    } else {
      setHoveredDate(null);
    }
  }, [normalizeDate]);

  return {
    selectedStart,
    selectedEnd,
    hoveredDate,
    workingDaysCount,
    previewWorkingDays,
    handleDateClick,
    setHoveredDate: handleSetHoveredDate,
    isDateInRange,
    isDateSelected,
    isRangeStart,
    isRangeEnd,
    isInPreview,
    reset,
    isSelecting,
  };
}
