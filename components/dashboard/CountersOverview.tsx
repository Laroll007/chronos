'use client';

import type { CreditCME } from '@/lib/creditCME';
import { droitsAnnee } from '@/lib/changementCycle';
import { cfAnnuel, cfParSemestre } from '@/lib/zones';
import { useMemo, useState } from 'react';
import { CounterDetailsModal } from './CounterDetailsModal';
import { CounterCard } from './CounterCard';
import { CounterHelpModal } from '@/components/shared/CounterHelpModal';
import { Counters, CycleConfig } from '@/lib/types';
import {
  CA_TOTAL_ANNUEL,
  RTC_TOTAL_ANNUEL,
  RTC_BRUT_ANNUEL,
  RTC_RESERVES_CET,
  HS_MAX_STOCKABLES,
  CET_PLAFOND,
  ARTT_QUOTA_ANNUEL,
  RTT_QUOTA_HEBDO,
  CONGES_BONIFIES_QUOTA,
  COUNTER_LABELS,
} from '@/lib/constants';
import {
  getCurrentSemester,
  getCFRemainingForSemester,
  formatMinutes,
  getRTCLibres,
  getRTCAnnuel,
  isRTCReservesEntames,
  calculateUrgencyPercent,
  getDaysUntilSemesterDeadline,
  getDaysUntil,
  jourLocal,
} from '@/lib/calculations';

interface CountersOverviewProps {
  /** Élu : crédit d'heures CME du trimestre (carte affichée s'il est renseigné). */
  creditCME?: CreditCME | null;
  counters: Counters;
  onUpdateCounters: (updates: Partial<Counters>) => void;
  caTotal?: number; // nombre de CA annuels selon le cycle (hebdo = 25)
  cycleConfig?: CycleConfig;
  onUpdateCycle?: (updates: Partial<CycleConfig>) => boolean;
  dayMinutes?: number; // durée d'un jour du régime (minutes) pour l'équivalent « ≈ Xj »
}

export function CountersOverview({ counters, onUpdateCounters, caTotal = CA_TOTAL_ANNUEL, dayMinutes, cycleConfig, onUpdateCycle, creditCME }: CountersOverviewProps) {
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [helpKey, setHelpKey] = useState<string | null>(null);

  const cards = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const semester = getCurrentSemester(now);
    const daysUntilSemester = getDaysUntilSemesterDeadline(now);
    const daysUntilYear = getDaysUntil(new Date(year, 11, 31), now);

    const getStatus = (daysRemaining: number, hasValue: boolean): 'ok' | 'warning' | 'critical' => {
      if (!hasValue) return 'ok';
      if (daysRemaining <= 14) return 'critical';
      if (daysRemaining <= 60) return 'warning';
      return 'ok';
    };

    const result: Array<{
      id: string;
      label: string;
      value: number;
      max: number;
      unit: 'jours' | 'heures';
      deadline?: Date;
      status: 'ok' | 'warning' | 'critical' | 'protected';
      description?: string;
      highlight?: boolean;
      gain?: string;
      unlimited?: boolean;
    }> = [];

    // CET (pas de carte pour un agent qui n'en a pas encore : élève, stagiaire)
    if (!counters.sansCET || counters.cet > 0) result.push({
      id: 'cet',
      label: 'CET',
      value: counters.cet,
      max: CET_PLAFOND,
      unit: 'jours',
      status: 'protected',
      description: `Plafond: ${CET_PLAFOND}j`,
      highlight: true,
    });

    // CA
    result.push({
      id: 'ca',
      label: 'Congés Annuels',
      value: counters.ca,
      max: caTotal,
      unit: 'jours',
      deadline: new Date(year, 11, 31),
      status: getStatus(daysUntilYear, counters.ca > 5),
      description: COUNTER_LABELS.ca.description,
    });

    // CA HP : affiché même à 0, sinon impossible d'ouvrir la carte pour saisir
    // des CA HP obtenus avant l'inscription (ou posés hors de l'app).
    result.push({
      id: 'caHP',
      label: 'CA Hors Période',
      value: counters.caHP,
      max: 2,
      unit: 'jours',
      deadline: new Date(year, 11, 31),
      status: 'ok',
      description: counters.caHP > 0 ? 'Bonus obtenus !' : 'Touchez pour ajouter vos CA HP',
      highlight: counters.caHP > 0,
    });

    // CF Semestre courant (masqué si l'agent n'a pas de CF)
    if (counters.hasCF !== false) {
      const cfRestant = getCFRemainingForSemester(
        semester,
        counters.cfConsoS1,
        counters.cfConsoS2,
        counters.cf,
        cfParSemestre(cycleConfig?.zone)
      );
      result.push({
        id: 'cf',
        label: 'CF',
        value: counters.cf,
        max: cycleConfig ? droitsAnnee(cycleConfig, counters, 'cf') : cfAnnuel(undefined),
        unit: 'heures',
        deadline: semester === 1 ? new Date(year, 5, 30) : new Date(year, 11, 31),
        status: getStatus(daysUntilSemester, cfRestant > 0),
        description: cfRestant > 0 ? `${formatMinutes(cfRestant)} à consommer ce semestre` : 'Rien à poser ce semestre',
      });
    }

    // RTC (total) — masqué si l'agent n'a pas de RTC
    if (counters.hasRTC !== false) {
      result.push({
        id: 'rtc',
        label: 'RTC',
        value: counters.rtc,
        // Droits de l'année (au prorata l'année d'un changement de cycle)
        max: cycleConfig ? droitsAnnee(cycleConfig, counters, 'rtc') : getRTCAnnuel(cycleConfig),
        unit: 'heures',
        deadline: new Date(year, 11, 31),
        status: getStatus(daysUntilYear, counters.rtc > 0),
        description: 'Récupération Temps de Cycle',
      });
    }

    // RTT si applicable
    if (counters.hasRTT && counters.rtt !== undefined && counters.rtt > 0) {
      result.push({
        id: 'rtt',
        label: 'RTT',
        value: counters.rtt,
        max: RTT_QUOTA_HEBDO, // 16j/an (cycle hebdo)
        unit: 'jours',
        deadline: new Date(year, 11, 31),
        status: getStatus(daysUntilYear, true),
        description: COUNTER_LABELS.rtt.description,
      });
    }

    // RPS
    result.push({
      id: 'rps',
      label: 'RPS',
      value: counters.rps,
      max: counters.rps, // Stock illimité — pas de plafond
      unit: 'heures',
      status: 'protected',
      description: 'Réserve stratégique - gardés',
      unlimited: true,
    });

    // HS
    result.push({
      id: 'hs',
      label: 'Heures Sup',
      value: counters.hs,
      max: HS_MAX_STOCKABLES,
      unit: 'heures',
      status: counters.hs >= HS_MAX_STOCKABLES ? 'critical' : 'protected',
      description: counters.hs >= HS_MAX_STOCKABLES * 0.9 ? 'Proche du plafond !' : 'Réserve stratégique',
    });

    // ─── Compteurs optionnels ─────────────────────────────────────────────────

    // CA Antérieurs (report N-1, deadline 30 avril)
    if (counters.caAnterieur > 0) {
      const deadline30Avril = new Date(year, 3, 30);
      const daysToAvril = getDaysUntil(deadline30Avril, now);
      result.push({
        id: 'caAnterieur',
        label: 'CA Antérieurs',
        value: counters.caAnterieur,
        max: counters.caAnterieur,
        unit: 'jours',
        deadline: deadline30Avril,
        status: getStatus(daysToAvril, true),
        description: 'Report N-1 — deadline 30 avril',
        highlight: true,
      });
    }

    // CA reportés (CAM) : congé maternité, maladie, congé familial ; date limite propre
    if ((counters.caReporte ?? 0) > 0) {
      const limite = counters.caReporteLimite ? jourLocal(counters.caReporteLimite) : new Date(year + 1, 2, 31);
      result.push({
        id: 'caReporte',
        label: 'CA reportés (CAM)',
        value: counters.caReporte ?? 0,
        max: 20,
        unit: 'jours',
        deadline: limite,
        status: getStatus(getDaysUntil(limite, now), true),
        description: `À poser avant le ${limite.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`,
        highlight: true,
      });
    }

    // CA HP Antérieurs (report HP N-1, deadline 30 avril)
    if (counters.caHPAnterieur > 0) {
      const deadline30Avril = new Date(year, 3, 30);
      const daysToAvril = getDaysUntil(deadline30Avril, now);
      result.push({
        id: 'caHPAnterieur',
        label: 'CA HP Antérieurs',
        value: counters.caHPAnterieur,
        max: 2,
        unit: 'jours',
        deadline: deadline30Avril,
        status: getStatus(daysToAvril, true),
        description: 'Bonus HP N-1 — deadline 30 avril',
        highlight: true,
      });
    }

    // ARTT (perdus au 31/12)
    if (counters.hasARTT && counters.artt !== undefined) {
      result.push({
        id: 'artt',
        label: 'ARTT',
        value: counters.artt,
        max: ARTT_QUOTA_ANNUEL,
        unit: 'jours',
        deadline: new Date(year, 11, 31),
        status: getStatus(daysUntilYear, counters.artt > 0),
        description: COUNTER_LABELS.artt.description,
      });
    }

    // CET 2008 (stock historique gelé)
    if (counters.hasCET2008 && counters.cet2008 !== undefined && counters.cet2008 > 0) {
      result.push({
        id: 'cet2008',
        label: 'CET 2008',
        value: counters.cet2008,
        max: counters.cet2008,
        unit: 'jours',
        status: 'protected',
        description: 'Stock gelé — pas de deadline',
      });
    }

    // Congés bonifiés
    if (counters.hasCongesBonifies && counters.congesBonifies !== undefined && counters.congesBonifies > 0) {
      const deadline = counters.congesBonifiesDateOuverture
        ? (() => {
            const d = jourLocal(counters.congesBonifiesDateOuverture!);
            d.setMonth(d.getMonth() + 48); // 36 + 12 mois max
            return d;
          })()
        : undefined;
      const daysToDeadline = deadline
        ? getDaysUntil(deadline, now)
        : 999;
      result.push({
        id: 'congesBonifies',
        label: 'Congés Bonifiés',
        value: counters.congesBonifies,
        max: CONGES_BONIFIES_QUOTA,
        unit: 'jours',
        deadline,
        status: getStatus(daysToDeadline, true),
        description: 'DOM/TOM — tous les 2 ans',
        highlight: true,
      });
    }

    // Élu : crédit d'heures CME du trimestre (non reportable)
    if (creditCME) {
      result.push({
        id: 'cme',
        label: 'Crédit CME (élu)',
        value: creditCME.reste,
        max: creditCME.dotation,
        unit: 'heures',
        deadline: creditCME.finTrimestre,
        status: getStatus(getDaysUntil(creditCME.finTrimestre, now), creditCME.reste > 0),
        description: 'Trimestre en cours, sans report',
      });
    }

    // HS Historique (compte gelé depuis 2020)
    if (counters.hsHistorique > 0) {
      result.push({
        id: 'hsHistorique',
        label: 'HS Historique',
        value: counters.hsHistorique,
        max: counters.hsHistorique,
        unit: 'heures',
        status: 'protected',
        description: 'Stock antérieur 2020 — 13,25 €/h',
      });
    }

    return result;
  }, [counters, caTotal, creditCME, cycleConfig]);

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 animate-stagger-in">
        {cards.map((card) => (
          <CounterCard key={card.id} {...card} dayMinutes={dayMinutes} onDetails={card.id === 'cme' ? undefined : setDetailsId} onHelp={card.id === 'cme' ? undefined : setHelpKey} />
        ))}
      </div>
      <CounterDetailsModal
        counterId={detailsId}
        counters={counters}
        caTotal={caTotal}
        cycleConfig={cycleConfig}
        onUpdateCycle={onUpdateCycle}
        onClose={() => setDetailsId(null)}
        onUpdate={onUpdateCounters}
      />
      {helpKey && <CounterHelpModal helpKey={helpKey} cycleConfig={cycleConfig} onClose={() => setHelpKey(null)} />}
    </>
  );
}
