'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { UserData, Counters, CycleConfig, HistoryEntry, CounterType, PersonalEvent, JourModifie } from '@/lib/types';
import {
  loadUserData,
  saveUserData,
  DEFAULT_USER_DATA,
  generateId,
} from '@/lib/storage';
import { getCETApportMaxAnnee, simulatePose, isInCAHPPeriod, getCurrentSemester, countWorkingDays, isWorkingDay, countCAHPDays, checkCAHPCondition, getCFS1Share } from '@/lib/calculations';
import { CET_PLAFOND, HS_COUT_PAR_JOUR_CET, RTC_COUT_PAR_JOUR_CET } from '@/lib/constants';
import { generateRecommendations } from '@/lib/recommendations';
import { restoreFromNativeIfNeeded, requestPersistentStorage } from '@/lib/native-backup';
import { computeRPSCredit } from '@/lib/rps';
import { planEpargneCET } from '@/lib/cet';
import { track } from '@/lib/analytics';
import { sanitizeEvents, fromDayKey } from '@/lib/events';
import { effetJournee, sanitizeJoursModifies } from '@/lib/journees';
import { MOTIFS_ABSENCE, type MotifAbsence } from '@/lib/absences';

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

// Référence stable : évite de recalculer les vues du calendrier à chaque rendu.
const EMPTY_EVENTS: PersonalEvent[] = [];
const EMPTY_JOURS: JourModifie[] = [];

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
        // Événements : on écarte silencieusement une entrée illisible plutôt
        // que de faire planter tout le planning.
        if (data?.events) data.events = sanitizeEvents(data.events);
        if (data?.joursModifies) data.joursModifies = sanitizeJoursModifies(data.joursModifies);

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

  // Une bascule d'année vient d'avoir lieu et l'agent n'en a pas été informé :
  // ses soldes ont été recrédités aux quotas STANDARDS, qu'il doit vérifier.
  const basculeAnnuelleAConfirmer = useMemo(
    () => userData?.basculeAConfirmer ?? null,
    [userData]
  );

  const confirmerBasculeAnnuelle = useCallback(() => {
    const current = userDataRef.current;
    if (!current?.basculeAConfirmer) return;
    const { basculeAConfirmer: _vu, ...reste } = current;
    save(reste as typeof current);
  }, [save]);

  // Onboarding terminé sans les soldes GesTT : compteurs encore à saisir.
  const compteursARenseigner = useMemo(
    () => userData?.compteursARenseigner === true,
    [userData]
  );

  // Saisie complète des compteurs depuis le rappel du dashboard.
  const completerCompteurs = useCallback(
    (counters: Counters) => {
      const current = userDataRef.current;
      if (!current) return false;
      const { compteursARenseigner: _fait, ...reste } = current;
      const ok = save({
        ...reste,
        // Même objectif CET qu'à la fin d'un onboarding complet.
        counters: {
          ...counters,
          objectifCET: Math.min(CET_PLAFOND, counters.cet + getCETApportMaxAnnee(counters.cet)),
        },
        lastUpdated: new Date().toISOString(),
      });
      if (ok) track('counters_completed_later');
      return ok;
    },
    [save]
  );

  // « Masquer » : l'agent a saisi ses soldes autrement (tiroir Compteurs) ou
  // ne veut plus du rappel. Les alertes et recommandations reprennent.
  const masquerRappelCompteurs = useCallback(() => {
    const current = userDataRef.current;
    if (!current?.compteursARenseigner) return;
    const { compteursARenseigner: _vu, ...reste } = current;
    if (save(reste)) track('counters_reminder_dismissed');
  }, [save]);

  // ─── Journées modifiées (horaires réels, stage) ─────────────────────────────
  // HS et écart de RPS crédités dès l'enregistrement (choix du 2026-10-01), et
  // mémorisés pour être retirés à l'identique. Le crédit RPS habituel du jour
  // continue de passer par computeRPSCredit : seul l'ÉCART est ajouté ici.

  const enregistrerJoursModifies = useCallback(
    (saisies: { date: string; type: JourModifie['type']; debut?: number; fin?: number }[]) => {
      const current = userDataRef.current;
      if (!current || saisies.length === 0) return null;
      const dates = new Set(saisies.map((s) => s.date));
      const anciens = (current.joursModifies ?? []).filter((j) => dates.has(j.date));
      let hs = current.counters.hs - anciens.reduce((t, j) => t + j.hsCredite, 0);
      let rps = current.counters.rps - anciens.reduce((t, j) => t + j.rpsCredite, 0);
      let hsAjoutees = 0;
      let rpsAjoutes = 0;
      const nouveaux: JourModifie[] = saisies.map((s) => {
        const e = effetJournee(fromDayKey(s.date), s.type, s.debut, s.fin, current.cycleConfig);
        hsAjoutees += e.hs;
        rpsAjoutes += e.rpsDelta;
        return {
          id: generateId(),
          date: s.date,
          type: s.type,
          ...(s.debut !== undefined && { debut: s.debut }),
          ...(s.fin !== undefined && { fin: s.fin }),
          hsCredite: e.hs,
          rpsCredite: e.rpsDelta,
        };
      });
      hs += hsAjoutees;
      rps += rpsAjoutes;
      const ok = save({
        ...current,
        counters: { ...current.counters, hs: Math.max(0, hs), rps },
        joursModifies: [
          ...(current.joursModifies ?? []).filter((j) => !dates.has(j.date)),
          ...nouveaux,
        ].sort((a, b) => a.date.localeCompare(b.date)),
        lastUpdated: new Date().toISOString(),
      });
      if (!ok) return null;
      track(saisies.some((s) => s.type === 'stage') ? 'day_stage' : 'day_hours_edit');
      return { hs: hsAjoutees, rps: rpsAjoutes };
    },
    [save]
  );

  const supprimerJourModifie = useCallback(
    (date: string) => {
      const current = userDataRef.current;
      const jour = current?.joursModifies?.find((j) => j.date === date);
      if (!current || !jour) return false;
      const ok = save({
        ...current,
        counters: {
          ...current.counters,
          hs: Math.max(0, current.counters.hs - jour.hsCredite),
          rps: current.counters.rps - jour.rpsCredite,
        },
        joursModifies: current.joursModifies!.filter((j) => j.date !== date),
        lastUpdated: new Date().toISOString(),
      });
      if (ok) track('day_edit_delete');
      return ok;
    },
    [save]
  );

  // ─── Événements personnels (RDV, formation…) ───────────────────────────────

  const saveEvents = useCallback(
    (events: PersonalEvent[]) => {
      const current = userDataRef.current;
      if (!current) return false;
      return save({ ...current, events, lastUpdated: new Date().toISOString() });
    },
    [save]
  );

  const addEvent = useCallback(
    (event: Omit<PersonalEvent, 'id'>) => {
      const ok = saveEvents([...(userDataRef.current?.events ?? []), { ...event, id: generateId() }]);
      if (ok) track('event_add');
      return ok;
    },
    [saveEvents]
  );

  const updateEvent = useCallback(
    (event: PersonalEvent) => {
      const events = userDataRef.current?.events ?? [];
      if (!events.some((e) => e.id === event.id)) return false;
      const ok = saveEvents(events.map((e) => (e.id === event.id ? event : e)));
      if (ok) track('event_edit');
      return ok;
    },
    [saveEvents]
  );

  const deleteEvent = useCallback(
    (id: string) => {
      const events = userDataRef.current?.events ?? [];
      if (!events.some((e) => e.id === id)) return false;
      const ok = saveEvents(events.filter((e) => e.id !== id));
      if (ok) track('event_delete');
      return ok;
    },
    [saveEvents]
  );

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

  // Absence sans compteur (ASA, Art. 13, CFS, EXN, repos décalé) : marque les
  // jours comme non travaillés, sans débit ni RPS. Cf. lib/absences.ts.
  const poseAbsence = useCallback(
    (motif: MotifAbsence, dateStart: Date, dateEnd?: Date) => {
      const current = userDataRef.current;
      if (!current) return { success: false, error: 'Données non chargées' };
      const end = dateEnd ?? dateStart;
      const historyEntry: HistoryEntry = {
        id: generateId(),
        date: dateStart.toISOString(),
        dateEnd: dateEnd ? dateEnd.toISOString() : undefined,
        action: 'absence',
        type: 'absence',
        amount: Math.max(0, countWorkingDays(dateStart, end, current.cycleConfig)),
        motif,
        description: MOTIFS_ABSENCE[motif].label,
        countersSnapshot: {},
      };
      const success = save({
        ...current,
        history: [...current.history, historyEntry],
        lastUpdated: new Date().toISOString(),
      });
      if (success) track('absence_pose');
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
  // Versement au CET en janvier, tel que demandé dans GesTT : applique le plan
  // calculé sur les reliquats de l'année écoulée (RTC relevés à la bascule,
  // CA / CA HP antérieurs, HS). Remplace l'ancien bouton, qui ne gérait que les
  // CA et les prélevait sur la dotation de l'année qui commence.
  // `avecSurplus` : l'agent a versé le maximum, et le surplus que le CET ne peut
  // conserver est indemnisé (ou versé à la RAFP) — il ne reste pas au CET.
  const enregistrerEpargneCET = useCallback((avecSurplus = false) => {
    const current = userDataRef.current;
    if (!current) return { success: false, error: 'Données non chargées' };
    const plan = planEpargneCET(current);
    if (plan.mode !== 'janvier') {
      return { success: false, error: "Le versement au CET se fait en janvier, au titre de l'année écoulée." };
    }
    const apport = avecSurplus ? plan.maximum : plan.apport;
    if (apport.total <= 0) return { success: false, error: 'Rien à verser au CET' };
    const indemnises = Math.max(0, apport.total - plan.capacite);

    const c = current.counters;
    const counters: Counters = {
      ...c,
      cet: c.cet + apport.total - indemnises,
      caAnterieur: Math.max(0, c.caAnterieur - apport.ca),
      caHPAnterieur: Math.max(0, c.caHPAnterieur - apport.caHP),
      hs: Math.max(0, c.hs - apport.hs * HS_COUT_PAR_JOUR_CET),
    };
    const detail = {
      rtc: apport.rtc, caHP: apport.caHP, ca: apport.ca, hs: apport.hs,
      ...(indemnises > 0 && { indemnises }),
    };
    const parts = [
      apport.rtc && `${apport.rtc}j de RTC`,
      apport.caHP && `${apport.caHP}j de CA HP`,
      apport.ca && `${apport.ca}j de CA`,
      apport.hs && `${apport.hs}j de HS`,
    ].filter(Boolean);
    const entry: HistoryEntry = {
      id: generateId(),
      date: new Date().toISOString(),
      action: 'transfer_cet',
      type: 'cet',
      amount: apport.total,
      description: `Épargne CET ${plan.anneeConges} : ${parts.join(', ')}${
        indemnises > 0 ? ` (dont ${indemnises}j indemnisés ou RAFP)` : ''
      }`,
      countersSnapshot: { cet: counters.cet },
      cetDetail: detail,
    };
    const { reliquatCET: _verse, ...reste } = current;
    const ok = save({
      ...reste,
      counters,
      history: [...current.history, entry],
      lastUpdated: new Date().toISOString(),
    });
    if (ok) track('cet_epargne');
    return ok ? { success: true, apport } : { success: false, error: 'Erreur de sauvegarde' };
  }, [save]);

  // Supprimer une entrée d'historique (congé posé ou épargne CET)
  const deleteHistoryEntry = useCallback(
    (entryId: string) => {
      const current = userDataRef.current;
      if (!current) return false;

      const entry = current.history.find((h) => h.id === entryId);
      if (!entry) return false;

      const updatedCounters = { ...current.counters };

      // Supprimer un arrêt maladie (CMO) ou une astreinte — aucun compteur à restaurer
      if (entry.action === 'cmo' || entry.action === 'astreinte' || entry.action === 'absence') {
        const newData: UserData = {
          ...current,
          history: current.history.filter((h) => h.id !== entryId),
          lastUpdated: new Date().toISOString(),
        };
        return save(newData);
      }

      // Annuler une épargne CET (transfer_cet)
      if (entry.action === 'transfer_cet') {
        const sortis = entry.cetDetail?.indemnises ?? 0;
        updatedCounters.cet = Math.max(0, updatedCounters.cet - (entry.amount - sortis));
        let reliquatCET = current.reliquatCET;
        if (entry.cetDetail) {
          // Versement multi-sources : chaque jour retourne d'où il vient.
          const d = entry.cetDetail;
          updatedCounters.caAnterieur += d.ca;
          updatedCounters.caHPAnterieur += d.caHP;
          updatedCounters.hs += d.hs * HS_COUT_PAR_JOUR_CET;
          // Les RTC n'existent plus au compteur (remplacés à la bascule) : on
          // les rend au reliquat, pour pouvoir refaire le versement.
          if (d.rtc > 0) {
            const annee = new Date(entry.date).getFullYear() - 1;
            reliquatCET = {
              annee,
              rtc: (reliquatCET?.annee === annee ? reliquatCET.rtc : 0) + d.rtc * RTC_COUT_PAR_JOUR_CET,
              caReserves: reliquatCET?.annee === annee ? reliquatCET.caReserves : 0,
            };
          }
        } else {
          // Ancienne épargne : des CA de l'année en cours.
          updatedCounters.ca += entry.amount;
        }
        const newData: UserData = {
          ...current,
          ...(reliquatCET && { reliquatCET }),
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
    events: userData?.events ?? EMPTY_EVENTS,
    joursModifies: userData?.joursModifies ?? EMPTY_JOURS,
    isLoading,
    isOnboarded,
    error,
    recommendations,
    basculeAnnuelleAConfirmer,
    compteursARenseigner,
    // Actions
    initialize,
    updateCounters,
    updateCycle,
    poseConge,
    posePartiel,
    poseCMO,
    poseAstreinte,
    enregistrerEpargneCET,
    deleteHistoryEntry,
    confirmerBasculeAnnuelle,
    completerCompteurs,
    masquerRappelCompteurs,
    poseAbsence,
    enregistrerJoursModifies,
    supprimerJourModifie,
    addEvent,
    updateEvent,
    deleteEvent,
    updateRPS,
    reset,
    save,
  };
}
