'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { UserData, Counters, CycleConfig, HistoryEntry, CounterType } from '@/lib/types';
import {
  loadUserData,
  saveUserData,
  DEFAULT_USER_DATA,
  generateId,
} from '@/lib/storage';
import { simulatePose, calculateRPSAccumulated } from '@/lib/calculations';
import { generateRecommendations } from '@/lib/recommendations';

/**
 * Hook principal pour la gestion des compteurs et données utilisateur
 */
export function useCounters() {
  const [userData, setUserData] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Chargement initial
  useEffect(() => {
    try {
      const data = loadUserData();
      setUserData(data);
    } catch (err) {
      setError('Erreur lors du chargement des données');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Vérifier si onboarded
  const isOnboarded = useMemo(() => userData?.isOnboarded ?? false, [userData]);

  // Sauvegarder les données
  const save = useCallback((data: UserData) => {
    const success = saveUserData(data);
    if (success) {
      setUserData(data);
    } else {
      setError('Erreur lors de la sauvegarde');
    }
    return success;
  }, []);

  // Initialiser avec les valeurs par défaut
  const initialize = useCallback((cycleConfig: CycleConfig, counters: Counters) => {
    const newData: UserData = {
      cycleConfig,
      counters,
      history: [],
      lastUpdated: new Date().toISOString(),
      isOnboarded: true,
    };
    return save(newData);
  }, [save]);

  // Mettre à jour les compteurs
  const updateCounters = useCallback(
    (updates: Partial<Counters>) => {
      if (!userData) return false;

      const newData: UserData = {
        ...userData,
        counters: { ...userData.counters, ...updates },
        lastUpdated: new Date().toISOString(),
      };
      return save(newData);
    },
    [userData, save]
  );

  // Mettre à jour le cycle
  const updateCycle = useCallback(
    (updates: Partial<CycleConfig>) => {
      if (!userData) return false;

      const newData: UserData = {
        ...userData,
        cycleConfig: { ...userData.cycleConfig, ...updates },
        lastUpdated: new Date().toISOString(),
      };
      return save(newData);
    },
    [userData, save]
  );

  // Poser un congé
  const poseConge = useCallback(
    (type: CounterType, amount: number, date: Date, description?: string) => {
      if (!userData) return { success: false, error: 'Données non chargées' };

      const result = simulatePose(userData.counters, type, amount, date);

      if (!result.isValid) {
        return { success: false, error: result.errorMessage };
      }

      const historyEntry: HistoryEntry = {
        id: generateId(),
        date: date.toISOString(),
        action: 'pose',
        type,
        amount,
        description,
        countersSnapshot: result.newCounters,
      };

      const newData: UserData = {
        ...userData,
        counters: result.newCounters,
        history: [...userData.history, historyEntry],
        lastUpdated: new Date().toISOString(),
      };

      const success = save(newData);
      return { success, alerts: result.alerts };
    },
    [userData, save]
  );

  // Mettre à jour les RPS accumulés
  const updateRPS = useCallback(() => {
    if (!userData) return false;

    const rpsTotal = calculateRPSAccumulated(
      new Date(),
      userData.cycleConfig,
      userData.counters.rpsAnneePrec
    );

    return updateCounters({ rps: rpsTotal });
  }, [userData, updateCounters]);

  // Recommandations
  const recommendations = useMemo(() => {
    if (!userData) return [];
    return generateRecommendations(userData.counters, userData.cycleConfig);
  }, [userData]);

  // Reset complet
  const reset = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('chronos_data');
    }
    setUserData(null);
    setError(null);
  }, []);

  return {
    userData,
    counters: userData?.counters ?? null,
    cycleConfig: userData?.cycleConfig ?? null,
    history: userData?.history ?? [],
    isLoading,
    isOnboarded,
    error,
    recommendations,
    // Actions
    initialize,
    updateCounters,
    updateCycle,
    poseConge,
    updateRPS,
    reset,
    save,
  };
}
