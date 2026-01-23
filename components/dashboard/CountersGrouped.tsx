'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Counters } from '@/lib/types';
import {
  CET_PLAFOND,
  CF_TOTAL_ANNUEL,
  CA_TOTAL_ANNUEL,
  RTC_RESERVES_CET,
  HS_MAX_STOCKABLES,
} from '@/lib/constants';
import { getRTCLibres, formatMinutes } from '@/lib/calculations';
import { Target, TrendingDown, Shield } from 'lucide-react';

interface CountersGroupedProps {
  counters: Counters;
}

export function CountersGrouped({ counters }: CountersGroupedProps) {
  const groups = useMemo(() => {
    const rtcLibres = getRTCLibres(counters.rtc);
    const rtcReserves = Math.min(counters.rtc, RTC_RESERVES_CET);

    return {
      // Groupe 1 : CET (objectif)
      cet: {
        value: counters.cet,
        objectif: counters.objectifCET,
        max: CET_PLAFOND,
        progress: (counters.cet / counters.objectifCET) * 100,
      },
      // Groupe 2 : À consommer (éviter pertes)
      aConsommer: {
        cf: { value: counters.cf, max: CF_TOTAL_ANNUEL },
        ca: { value: counters.ca, max: CA_TOTAL_ANNUEL },
        rtcLibres: { value: rtcLibres, max: RTC_RESERVES_CET },
      },
      // Groupe 3 : Réserves (à garder)
      reserves: {
        rtcReserves: { value: rtcReserves, max: RTC_RESERVES_CET },
        rps: { value: counters.rps },
        hs: { value: counters.hs, max: HS_MAX_STOCKABLES },
      },
    };
  }, [counters]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Groupe 1 : CET */}
      <Card className="glass border-white/10 glow">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2 text-violet-400">
            <Target className="w-4 h-4" />
            Objectif CET
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-white mb-2">
            {groups.cet.value}
            <span className="text-lg text-muted-foreground">
              /{groups.cet.objectif}j
            </span>
          </div>
          <Progress
            value={Math.min(groups.cet.progress, 100)}
            className="h-2"
          />
          <p className="text-xs text-muted-foreground mt-2">
            Plafond max : {groups.cet.max} jours
          </p>
        </CardContent>
      </Card>

      {/* Groupe 2 : À consommer */}
      <Card className="glass border-white/10">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2 text-amber-400">
            <TrendingDown className="w-4 h-4" />
            À poser (éviter pertes)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">CF</span>
            <span className="font-medium">{formatMinutes(groups.aConsommer.cf.value)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">CA</span>
            <span className="font-medium">{groups.aConsommer.ca.value}j</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">RTC libres</span>
            <span className="font-medium">{formatMinutes(groups.aConsommer.rtcLibres.value)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Groupe 3 : Réserves */}
      <Card className="glass border-white/10">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2 text-emerald-400">
            <Shield className="w-4 h-4" />
            Réserves (à garder)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">RTC CET</span>
            <span className="font-medium text-violet-400">
              {formatMinutes(groups.reserves.rtcReserves.value)}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">RPS</span>
            <span className="font-medium">{formatMinutes(groups.reserves.rps.value)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">HS</span>
            <span className="font-medium">{formatMinutes(groups.reserves.hs.value)}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
