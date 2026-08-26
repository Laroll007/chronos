'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { UserData, Counters, CycleConfig, HistoryEntry, CounterType } from '@/lib/types';
import {
  loadUserData,
  saveUserData,
  DEFAULT_USER_DATA,
  generateId,
} from '@/lib/storage';
import { simulatePose, isInCAHPPeriod, getCurrentSemester, countWorkingDays, isWorkingDay, countCAHPDays, checkCAHPCondition, getCFS1Share } from '@/lib/calculations';
import { CET_PLAFOND, CA_MAX_VERS_CET } from '@/lib/constants';
import { generateRecommendations } from '@/lib/recommendations';
import { restoreFromNativeIfNeeded, requestPersistentStorage } from '@/lib/native-backup';
import { computeRPSCredit } from '@/lib/rps';

/**
 * Applique le crédit RPS dû depuis le dernier passage et persiste le résultat.
 * Retourne les données inchangées s'il n'y a rien à créditer ni repère à avancer.
 */
function creditRPSIfNeeded(data: UserData): UserData {
  const credit = computeRPSCredit(data.counters, data.cycleConfig, data.history);
  if (credit.minutes === 0 && credit.marker === data.counters.rpsDernierCredit) {
    return data;
  }

  const updated: UserData = {
    ...data,
    counters: {
      ...data.counters,
      rps: data.counters.rps + credit.minutes,
      rpsDernierCredit: credit.marker,
    },
    lastUpdated: new Date().toISOString(),
  };
  saveUserData(updated);
  return updated;
}

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
    let cancelled = false;

    (async () => {
      try {
        // iOS : si le localStorage a été purgé (politique 7 jours), restaure
        // depuis le miroir natif avant de lire. No-op et quasi-instantané sur
        // le web et pour les utilisateurs ayant déjà des données.
        await restoreFromNativeIfNeeded();

        const loaded = loadUserData();
        if (cancelled) return;

        // Crédit automatique des RPS : ajoute les dimanches réellement travaillés
        // depuis le dernier passage. Incrémental — jamais de recalcul depuis le
        // 1er janvier, qui écraserait la consommation et le stock déclaré.
        const data = loaded ? creditRPSIfNeeded(loaded) : loaded;

        userDataRef.current = data;
        setUserData(data);
      } catch (err) {
        if (!cancelled) {
          setError('Erreur lors du chargement des données');
          console.error(err);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    // Web / Android : empêche l'éviction automatique du stockage (silencieux).
    void requestPersistentStorage();

    return () => {
      cancelled = true;
    };
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

      // Une plage à cheval sur une frontière ne doit pas être imputée en bloc au
      // côté de sa date de début : 28 avril → 5 mai ne crédite que ses jours
      // d'avant le 1er mai, 28 juin → 3 juillet répartit les CF entre S1 et S2.
      const dEnd = dateEnd ?? dateStart;
      const hpDays = type === 'ca'
        ? countCAHPDays(dateStart, dEnd, current.cycleConfig)
        : undefined;
      const cfS1Minutes = type === 'cf'
        ? getCFS1Share(amount, dateStart, dEnd, current.cycleConfig)
        : undefined;

      const result = simulatePose(current.counters, type, amount, dateStart, { hpDays, cfS1Minutes });

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
        caHPDays: hpDays,
        cfS1Minutes,
      };

      const newData: UserData = {
        ...current,
        counters: result.newCounters,
        history: [...current.history, historyEntry],
        lastUpdated: new Date().toISOString(),
      };

      const success = save(newData);
      // `entryId` permet à l'appelant d'annuler cette pose si une pose ultérieure
      // de la même combinaison échoue (application « tout ou rien »).
      return { success, alerts: result.alerts, entryId: success ? historyEntry.id : undefined };
    },
    [save]
  );

  // Pose fractionnée : ne consomme que `minutes` d'un compteur horaire sur un seul jour
  // (sortie anticipée / demi-journée). Le jour reste travaillé pour le reste.
  const posePartiel = useCallback(
    (type: CounterType, minutes: number, date: Date) => {
      const current = userDataRef.current;
      if (!current) return { success: false, error: 'Données non chargées' };
      if (!Number.isFinite(minutes) || minutes <= 0) {
        return { success: false, error: 'Durée invalide' };
      }

      const result = simulatePose(current.counters, type, minutes, date);
      if (!result.isValid) {
        return { success: false, error: result.errorMessage };
      }

      const historyEntry: HistoryEntry = {
        id: generateId(),
        date: date.toISOString(),
        action: 'pose',
        type,
        amount: minutes,
        partialDay: true,
        description: 'Pose à l\'heure',
        countersSnapshot: result.newCounters,
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
        // Reprend exactement ce qui avait été crédité (plage à cheval incluse) ;
        // repli sur l'ancien calcul pour les entrées antérieures au correctif.
        const joursHP = entry.caHPDays ?? (isInCAHPPeriod(poseDate) ? entry.amount : 0);
        if (joursHP > 0) {
          const newHorsPeriode = Math.max(0, updatedCounters.caPosesHorsPeriode - joursHP);
          updatedCounters.caPosesHorsPeriode = newHorsPeriode;
          // Redescendre au palier correspondant (4 CA → 1 jour, 8 CA → 2), sans
          // jamais remonter un bonus que l'agent aurait déjà consommé.
          updatedCounters.caHP = Math.min(
            updatedCounters.caHP,
            checkCAHPCondition(newHorsPeriode)
          );
        }
      } else if (entry.type === 'cf') {
        updatedCounters.cf += entry.amount;
        const poseDate = new Date(entry.date);
        // Reprend la répartition réellement appliquée (plage à cheval incluse) ;
        // repli sur l'ancien calcul pour les entrées antérieures au correctif.
        const partS1 = entry.cfS1Minutes
          ?? (getCurrentSemester(poseDate) === 1 ? entry.amount : 0);
        updatedCounters.cfConsoS1 = Math.max(0, updatedCounters.cfConsoS1 - partS1);
        updatedCounters.cfConsoS2 = Math.max(0, updatedCounters.cfConsoS2 - (entry.amount - partS1));
      } else if (entry.type === 'caHP' || entry.type === 'cet') {
        updatedCounters[entry.type] += entry.amount;
      } else if (entry.type === 'artt') {
        updatedCounters.artt = (updatedCounters.artt ?? 0) + entry.amount;
      } else if (entry.type === 'rtt') {
        updatedCounters.rtt = (updatedCounters.rtt ?? 0) + entry.amount;
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
        // Types en minutes : rtc, rps, hs
        const key = entry.type as 'rtc' | 'rps' | 'hs';
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

  // Crédite les dimanches travaillés depuis le dernier passage.
  // ⚠️ Ne recalcule PAS depuis le 1er janvier : l'ancienne version écrasait le
  // solde, rendant des RPS déjà consommés et effaçant le stock déclaré à
  // l'inscription par un agent arrivé en cours d'année.
  const updateRPS = useCallback(() => {
    const current = userDataRef.current;
    if (!current) return false;

    const credit = computeRPSCredit(current.counters, current.cycleConfig, current.history);
    if (credit.minutes === 0 && credit.marker === current.counters.rpsDernierCredit) {
      return true;
    }

    return save({
      ...current,
      counters: {
        ...current.counters,
        rps: current.counters.rps + credit.minutes,
        rpsDernierCredit: credit.marker,
      },
      lastUpdated: new Date().toISOString(),
    });
  }, [save]);

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
    posePartiel,
    poseCMO,
    poseAstreinte,
    epargnerCET,
    deleteHistoryEntry,
    updateRPS,
    reset,
    save,
  };
}
