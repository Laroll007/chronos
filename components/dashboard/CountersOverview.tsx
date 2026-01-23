'use client';

import { useMemo } from 'react';
import { CounterCard } from './CounterCard';
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
}

export function CountersOverview({ counters }: CountersOverviewProps) {
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
      description: `Objectif: ${counters.objectifCET}j`,
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
      label: `CF Semestre ${semester}`,
      value: counters.cf,
      max: CF_TOTAL_ANNUEL,
      unit: 'heures',
      deadline: semester === 1 ? new Date(year, 5, 30) : new Date(year, 11, 31),
      status: getStatus(daysUntilSemester, cfRestant > 0),
      description: `${semester === 1 ? '54h36' : '54h36'} à consommer ce semestre`,
    });

    // RTC Réservés CET
    const rtcReservesStatus = isRTCReservesEntames(counters.rtc) ? 'critical' : 'protected';
    result.push({
      id: 'rtcReserves',
      label: 'RTC Réservés CET',
      value: Math.min(counters.rtc, RTC_RESERVES_CET),
      max: RTC_RESERVES_CET,
      unit: 'heures',
      status: rtcReservesStatus,
      description: 'À NE PAS TOUCHER',
      highlight: true,
      gain: '+37h50/an',
    });

    // RTC Libres (net après JS)
    const rtcLibres = getRTCLibres(counters.rtc);
    result.push({
      id: 'rtc',
      label: 'RTC Libres',
      value: rtcLibres,
      max: RTC_LIBRES,
      unit: 'heures',
      deadline: new Date(year, 11, 31),
      status: getStatus(daysUntilYear, rtcLibres > 0),
      description: 'Net après JS et réserve CET',
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

    return result;
  }, [counters]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {cards.map((card) => (
        <CounterCard key={card.id} {...card} />
      ))}
    </div>
  );
}
