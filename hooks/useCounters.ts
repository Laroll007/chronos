'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { UserData, Counters, CycleConfig, HistoryEntry, CounterType } from '@/lib/types';
import {
  loadUserData,
  saveUserData,
  DEFAULT_USER_DATA,
  generateId,
} from '@/lib/storage';
import { simulatePose, calculateRPSAccumulated, isInCAHPPeriod, getCurrentSemester, countWorkingDays, isWorkingDay } from '@/lib/calculations';
import { CET_PLAFOND, CA_MAX_VERS_CET, CA_REQUIS_POUR_HP } from '@/lib/constants';
import { generateRecommendations } from '@/lib/recommendations';

/**
 * Hook principal pour la gestion des compteurs et données utilisateur
 */
export function useCounters() {
  const [userData, setUserData] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Ref synchrone pour permettre les opérations en chaîne (boucle de pose)
  // sans subir le retard d'un setState batch React.
  const userDataRef = useRef<UserData | null>(null);

  // Chargement initial
  useEffect(() => {
    try {
      const data = loadUserData();
      userDataRef.current = data;
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
      userDataRef.current = data;
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
    (
      type: CounterType,
      amount: number,
      dateStart: Date,
      dateEnd?: Date,
      description?: string,
      groupId?: string,
    ) => {
      const current = userDataRef.current;
      if (!current) return { success: false, error: 'Données non chargées' };

      const result = simulatePose(current.counters, type, amount, dateStart);

      if (!result.isValid) {
        return { success: false, error: result.errorMessage };
      }

      const historyEntry: HistoryEntry = {
        id: generateId(),
        date: dateStart.toISOString(),
        dateEnd: dateEnd ? dateEnd.toISOString() : undefined,
        action: 'pose',
        type,
        amount,
        description,
        countersSnapshot: result.newCounters,
        groupId,
      };

      const newData: UserData = {
        ...current,
        counters: result.newCounters,
        history: [...current.history, historyEntry],
        lastUpdated: new Date().toISOString(),
      };

      const success = save(newData);
      return { success, alerts: result.alerts };
    },
    [save]
  );

  // Marquer un arrêt maladie (CMO) — aucun impact compteur, marquage calendrier
  const poseCMO = useCallback(
    (dateStart: Date, dateEnd?: Date) => {
      const current = userDataRef.current;
      if (!current) return { success: false, error: 'Données non chargées' };

      const end = dateEnd ?? dateStart;
      // amount = jours travaillés couverts (pour affichage uniquement)
      const amount = Math.max(0, countWorkingDays(dateStart, end, current.cycleConfig));

      const historyEntry: HistoryEntry = {
        id: generateId(),
        date: dateStart.toISOString(),
        dateEnd: dateEnd ? dateEnd.toISOString() : undefined,
        action: 'cmo',
        type: 'cmo',
        amount,
        description: 'Arrêt maladie (CMO)',
        countersSnapshot: {},
      };

      const newData: UserData = {
        ...current,
        history: [...current.history, historyEntry],
        lastUpdated: new Date().toISOString(),
      };

      const success = save(newData);
      return { success };
    },
    [save]
  );

  // Poser une astreinte / permanence — ajoute des jours travaillés (week-end), pas d'impact compteur
  const poseAstreinte = useCallback(
    (dateStart: Date, dateEnd?: Date) => {
      const current = userDataRef.current;
      if (!current) return { success: false, error: 'Données non chargées' };

      const end = dateEnd ?? dateStart;
      // amount = jours de repos couverts par l'astreinte (qui deviennent travaillés)
      let amount = 0;
      const cur = new Date(dateStart);
      cur.setHours(0, 0, 0, 0);
      const last = new Date(end);
      last.setHours(0, 0, 0, 0);
      while (cur <= last) {
        if (!isWorkingDay(cur, current.cycleConfig)) amount++;
        cur.setDate(cur.getDate() + 1);
      }

      const historyEntry: HistoryEntry = {
        id: generateId(),
        date: dateStart.toISOString(),
        dateEnd: dateEnd ? dateEnd.toISOString() : undefined,
        action: 'astreinte',
        type: 'astreinte',
        amount,
        description: 'Astreinte / permanence',
        countersSnapshot: {},
      };

      const newData: UserData = {
        ...current,
        history: [...current.history, historyEntry],
        lastUpdated: new Date().toISOString(),
      };

      const success = save(newData);
      return { success };
    },
    [save]
  );

  // Épargner des CA vers le CET
  const epargnerCET = useCallback(
    (joursCA: number) => {
      if (!userData) return { success: false, error: 'Données non chargées' };
      if (joursCA <= 0) return { success: false, error: 'Nombre de jours invalide' };
      if (joursCA > CA_MAX_VERS_CET) {
        return { success: false, error: `Max ${CA_MAX_VERS_CET}j de CA classiques vers le CET par an (règle APORTT)` };
      }
      if (joursCA > userData.counters.ca) {
        return { success: false, error: `Seulement ${userData.counters.ca} CA disponibles` };
      }
      if (userData.counters.cet + joursCA > CET_PLAFOND) {
        return {
          success: false,
          error: `Dépasse le plafond CET (${CET_PLAFOND}j). Vous pouvez épargner max ${CET_PLAFOND - userData.counters.cet}j`,
        };
      }

      const historyEntry: HistoryEntry = {
        id: generateId(),
        date: new Date().toISOString(),
        action: 'transfer_cet',
        type: 'cet',
        amount: joursCA,
        description: `Épargne CET : ${joursCA}j de CA`,
        countersSnapshot: {
          ca: userData.counters.ca - joursCA,
          cet: userData.counters.cet + joursCA,
        },
      };

      const newData: UserData = {
        ...userData,
        counters: {
          ...userData.counters,
          ca: userData.counters.ca - joursCA,
          caConsommes: userData.counters.caConsommes, // CA épargnés ne comptent pas comme consommés
          cet: userData.counters.cet + joursCA,
        },
        history: [...userData.history, historyEntry],
        lastUpdated: new Date().toISOString(),
      };

      const success = save(newData);
      return { success };
    },
    [userData, save]
  );

  // Supprimer une entrée d'historique (congé posé ou épargne CET)
  const deleteHistoryEntry = useCallback(
    (entryId: string) => {
      const current = userDataRef.current;
      if (!current) return false;

      const entry = current.history.find((h) => h.id === entryId);
      if (!entry) return false;

      const updatedCounters = { ...current.counters };

      // Supprimer un arrêt maladie (CMO) ou une astreinte — aucun compteur à restaurer
      if (entry.action === 'cmo' || entry.action === 'astreinte') {
        const newData: UserData = {
          ...current,
          history: current.history.filter((h) => h.id !== entryId),
          lastUpdated: new Date().toISOString(),
        };
        return save(newData);
      }

      // Annuler une épargne CET (transfer_cet)
      if (entry.action === 'transfer_cet') {
        updatedCounters.ca += entry.amount;
        updatedCounters.cet = Math.max(0, updatedCounters.cet - entry.amount);
        const newData: UserData = {
          ...current,
          counters: updatedCounters,
          history: current.history.filter((h) => h.id !== entryId),
          lastUpdated: new Date().toISOString(),
        };
        return save(newData);
      }

      if (entry.action !== 'pose') return false;

      // Restaurer les compteurs selon le type (avec compteurs secondaires)
      if (entry.type === 'ca') {
        updatedCounters.ca += entry.amount;
        updatedCounters.caConsommes = Math.max(0, updatedCounters.caConsommes - entry.amount);
        const poseDate = new Date(entry.date);
        if (isInCAHPPeriod(poseDate)) {
          const newHorsPeriode = Math.max(0, updatedCounters.caPosesHorsPeriode - entry.amount);
          updatedCounters.caPosesHorsPeriode = newHorsPeriode;
          // Retirer le bonus CA HP si le seuil n'est plus atteint
          if (newHorsPeriode < CA_REQUIS_POUR_HP) {
            updatedCounters.caHP = 0;
          }
        }
      } else if (entry.type === 'cf') {
        updatedCounters.cf += entry.amount;
        const poseDate = new Date(entry.date);
        if (getCurrentSemester(poseDate) === 1) {
          updatedCounters.cfConsoS1 = Math.max(0, updatedCounters.cfConsoS1 - entry.amount);
        } else {
          updatedCounters.cfConsoS2 = Math.max(0, updatedCounters.cfConsoS2 - entry.amount);
        }
      } else if (entry.type === 'caHP' || entry.type === 'cet') {
        updatedCounters[entry.type] += entry.amount;
      } else if (entry.type === 'artt') {
        updatedCounters.artt = (updatedCounters.artt ?? 0) + entry.amount;
      } else if (entry.type === 'caAnterieur') {
        updatedCounters.caAnterieur += entry.amount;
      } else if (entry.type === 'caHPAnterieur') {
        updatedCounters.caHPAnterieur += entry.amount;
      } else if (entry.type === 'cet2008') {
        updatedCounters.cet2008 = (updatedCounters.cet2008 ?? 0) + entry.amount;
      } else if (entry.type === 'congesBonifies') {
        updatedCounters.congesBonifies = (updatedCounters.congesBonifies ?? 0) + entry.amount;
      } else if (entry.type === 'hsHistorique') {
        updatedCounters.hsHistorique += entry.amount;
      } else {
        // Types en minutes : rtc, rtt, rps, hs
        const key = entry.type as 'rtc' | 'rtt' | 'rps' | 'hs';
        if (updatedCounters[key] !== undefined) {
          (updatedCounters[key] as number) += entry.amount;
        }
      }

      const newData: UserData = {
        ...current,
        counters: updatedCounters,
        history: current.history.filter((h) => h.id !== entryId),
        lastUpdated: new Date().toISOString(),
      };

      return save(newData);
    },
    [save]
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
    poseCMO,
    poseAstreinte,
    epargnerCET,
    deleteHistoryEntry,
    updateRPS,
    reset,
    save,
  };
}
