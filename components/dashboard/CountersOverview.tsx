'use client';

import { useMemo, useState } from 'react';
import { CounterDetailsModal } from './CounterDetailsModal';
import { CounterCard } from './CounterCard';
import { CounterHelpModal } from '@/components/shared/CounterHelpModal';
import { Counters } from '@/lib/types';
import {
  CA_TOTAL_ANNUEL,
  CF_TOTAL_ANNUEL,
  CF_PAR_SEMESTRE,
  RTC_TOTAL_ANNUEL,
  RTC_NET_ANNUEL,
  RTC_BRUT_ANNUEL,
  RTC_RESERVES_CET,
  RTC_LIBRES,
  HS_MAX_STOCKABLES,
  CET_PLAFOND,
  ARTT_QUOTA_ANNUEL,
  CONGES_BONIFIES_QUOTA,
  COUNTER_LABELS,
} from '@/lib/constants';
import {
  getCurrentSemester,
  getCFRemainingForSemester,
  getRTCLibres,
  isRTCReservesEntames,
  calculateUrgencyPercent,
  getDaysUntilSemesterDeadline,
} from '@/lib/calculations';

interface CountersOverviewProps {
  counters: Counters;
  onUpdateCounters: (updates: Partial<Counters>) => void;
}

export function CountersOverview({ counters, onUpdateCounters }: CountersOverviewProps) {
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [helpKey, setHelpKey] = useState<string | null>(null);

  const cards = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const semester = getCurrentSemester(now);
    const daysUntilSemester = getDaysUntilSemesterDeadline(now);
    const daysUntilYear = Math.ceil(
      (new Date(year, 11, 31).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

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
    }> = [];

    // CET
    result.push({
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
      max: CA_TOTAL_ANNUEL,
      unit: 'jours',
      deadline: new Date(year, 11, 31),
      status: getStatus(daysUntilYear, counters.ca > 5),
      description: COUNTER_LABELS.ca.description,
    });

    // CA HP
    if (counters.caHP > 0) {
      result.push({
        id: 'caHP',
        label: 'CA Hors Période',
        value: counters.caHP,
        max: 2,
        unit: 'jours',
        deadline: new Date(year, 11, 31),
        status: 'ok',
        description: 'Bonus obtenus !',
        highlight: true,
      });
    }

    // CF Semestre courant
    const cfRestant = getCFRemainingForSemester(
      semester,
      counters.cfConsoS1,
      counters.cfConsoS2
    );
    result.push({
      id: 'cf',
      label: 'CF',
      value: counters.cf,
      max: CF_TOTAL_ANNUEL,
      unit: 'heures',
      deadline: semester === 1 ? new Date(year, 5, 30) : new Date(year, 11, 31),
      status: getStatus(daysUntilSemester, cfRestant > 0),
      description: `~54h36 à consommer ce semestre`,
    });

    // RTC (total)
    result.push({
      id: 'rtc',
      label: 'RTC',
      value: counters.rtc,
      max: RTC_NET_ANNUEL,
      unit: 'heures',
      deadline: new Date(year, 11, 31),
      status: getStatus(daysUntilYear, counters.rtc > 0),
      description: counters.journeeSolidariteAppliquee ? 'Net après journée de solidarité' : 'Récupération Temps de Cycle',
    });

    // RTT si applicable
    if (counters.hasRTT && counters.rtt !== undefined && counters.rtt > 0) {
      result.push({
        id: 'rtt',
        label: 'RTT',
        value: counters.rtt,
        max: counters.rtt, // Variable selon le cycle
        unit: 'heures',
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
      max: counters.rps + 5000, // Pas de max réel
      unit: 'heures',
      status: 'protected',
      description: 'Réserve stratégique - gardés',
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
      const daysToAvril = Math.ceil((deadline30Avril.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
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

    // CA HP Antérieurs (report HP N-1, deadline 30 avril)
    if (counters.caHPAnterieur > 0) {
      const deadline30Avril = new Date(year, 3, 30);
      const daysToAvril = Math.ceil((deadline30Avril.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
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
            const d = new Date(counters.congesBonifiesDateOuverture!);
            d.setMonth(d.getMonth() + 48); // 36 + 12 mois max
            return d;
          })()
        : undefined;
      const daysToDeadline = deadline
        ? Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
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
  }, [counters]);

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 animate-stagger-in">
        {cards.map((card) => (
          <CounterCard key={card.id} {...card} onDetails={setDetailsId} onHelp={setHelpKey} />
        ))}
      </div>
      <CounterDetailsModal
        counterId={detailsId}
        counters={counters}
        onClose={() => setDetailsId(null)}
        onUpdate={onUpdateCounters}
      />
      {helpKey && <CounterHelpModal helpKey={helpKey} onClose={() => setHelpKey(null)} />}
    </>
  );
}
