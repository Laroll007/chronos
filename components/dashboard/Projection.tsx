'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { CETProjection, Counters } from '@/lib/types';
import { formatMinutes } from '@/lib/calculations';
import {
  CET_PLAFOND,
  RTC_COUT_PAR_JOUR_CET,
  RTC_MAX_JOURS_CET,
  CA_MAX_VERS_CET,
  HS_MAX_VERS_CET,
  HEURES_PAR_JOUR,
} from '@/lib/constants';
import { TrendingUp, AlertTriangle, Check, ChevronRight, Sparkles, Ban } from 'lucide-react';

interface ProjectionProps {
  currentCET: number;
  counters: Counters;
  projection: CETProjection;
}

interface SourceRowProps {
  label: string;
  sublabel?: string;
  balance: string;
  towardsCET: number;
  maxAllowed?: number;
  note?: string;
  gain?: string;
  color: 'emerald' | 'blue' | 'red' | 'orange' | 'slate';
  disabled?: boolean;
  disabledReason?: string;
}

const COLOR_MAP = {
  emerald: {
    dot: '#10b981',
    badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
    text: 'text-emerald-400',
    row: 'border-emerald-500/20 bg-emerald-500/5',
  },
  blue: {
    dot: '#3b82f6',
    badge: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
    text: 'text-blue-400',
    row: 'border-blue-500/20 bg-blue-500/5',
  },
  red: {
    dot: '#ef4444',
    badge: 'bg-red-500/15 text-red-400 border-red-500/20',
    text: 'text-red-400',
    row: 'border-red-500/20 bg-red-500/5',
  },
  orange: {
    dot: '#f97316',
    badge: 'bg-orange-500/15 text-orange-400 border-orange-500/20',
    text: 'text-orange-400',
    row: 'border-orange-500/20 bg-orange-500/5',
  },
  slate: {
    dot: '#94a3b8',
    badge: 'bg-slate-500/10 text-slate-500 border-slate-500/15',
    text: 'text-slate-500',
    row: 'border-white/5 bg-white/[0.02]',
  },
};

function SourceRow({ label, sublabel, balance, towardsCET, maxAllowed, note, gain, color, disabled, disabledReason }: SourceRowProps) {
  const c = COLOR_MAP[disabled ? 'slate' : color];

  return (
    <div className={`rounded-xl border p-3 ${c.row} ${disabled ? 'opacity-60' : ''}`}>
      <div className="flex items-center justify-between gap-3">
        {/* Gauche : label + solde */}
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: disabled ? '#94a3b8' : c.dot }} />
          <div className="min-w-0">
            <div className="text-sm font-medium text-foreground leading-tight">{label}</div>
            {sublabel && <div className="text-xs text-muted-foreground">{sublabel}</div>}
            <div className="text-xs text-muted-foreground mt-0.5">Solde : <span className="font-medium text-foreground/80">{balance}</span></div>
          </div>
        </div>

        {/* Droite : transfert CET */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {!disabled ? (
            towardsCET > 0 ? (
              <div className="flex items-center gap-1.5">
                <ChevronRight className={`w-4 h-4 ${c.text}`} />
                <div className="text-right">
                  <div className={`text-lg font-bold ${c.text}`}>+{towardsCET}j</div>
                  {maxAllowed !== undefined && (
                    <div className="text-[10px] text-muted-foreground">max {maxAllowed}j</div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Ban className="w-3.5 h-3.5" />
                <span>plafond atteint</span>
              </div>
            )
          ) : (
            <div className="text-xs text-slate-500 text-right">{disabledReason}</div>
          )}
        </div>
      </div>

      {/* Notes / gain sous la ligne */}
      {(note || gain) && !disabled && towardsCET > 0 && (
        <div className="mt-2 pt-2 border-t border-white/5 flex flex-wrap gap-2">
          {note && <span className="text-[11px] text-muted-foreground">{note}</span>}
          {gain && (
            <span className={`text-[11px] font-medium ${c.text} flex items-center gap-1`}>
              <Sparkles className="w-3 h-3" /> {gain}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export function Projection({ currentCET, counters, projection }: ProjectionProps) {
  const progressBefore = (currentCET / CET_PLAFOND) * 100;
  const progressAfter = (projection.cetFinal / CET_PLAFOND) * 100;

  // Calculs des soldes lisibles
  const rtcJoursDisponibles = Math.floor(counters.rtc / RTC_COUT_PAR_JOUR_CET);
  const rtcDisabled = counters.rtc < RTC_COUT_PAR_JOUR_CET;
  const caHPDisabled = counters.caHP === 0;
  const caDisabled = counters.ca === 0;
  const hsJours = Math.floor(counters.hs / HEURES_PAR_JOUR);
  const hsDisabled = counters.hs < HEURES_PAR_JOUR;

  return (
    <Card className="glass border-white/10 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-red-500/5" />

      <CardHeader className="relative pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-emerald-400" />
          Projection CET au 31/12
        </CardTitle>
      </CardHeader>

      <CardContent className="relative space-y-5">

        {/* Barre de progression avant/après */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Actuel : <span className="font-semibold text-foreground">{currentCET}j</span></span>
            <span>Projeté : <span className="font-semibold text-emerald-400">{projection.cetFinal}j</span></span>
            <span>Plafond : {CET_PLAFOND}j</span>
          </div>
          {/* Double barre : actuel + apport */}
          <div className="relative h-4 rounded-full bg-white/5 overflow-hidden">
            {/* Base actuelle */}
            <div
              className="absolute left-0 top-0 h-full rounded-full transition-all"
              style={{ width: `${progressBefore}%`, background: '#3b82f6' }}
            />
            {/* Apport */}
            {projection.totalApport > 0 && (
              <div
                className="absolute top-0 h-full rounded-full transition-all"
                style={{
                  left: `${progressBefore}%`,
                  width: `${progressAfter - progressBefore}%`,
                  background: 'linear-gradient(to right, #10b981, #34d399)',
                }}
              />
            )}
          </div>
          <div className="flex items-center justify-center gap-3 text-xs">
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" /> CET actuel</span>
            <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" /> Apport possible</span>
          </div>
        </div>

        {/* Statut global */}
        <div className={`flex items-center gap-3 p-3 rounded-xl border ${
          projection.totalApport >= (projection.cetFinal - currentCET)
            ? 'bg-emerald-500/10 border-emerald-500/20'
            : 'bg-amber-500/10 border-amber-500/20'
        }`}>
          {projection.totalApport > 0 ? (
            <Check className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0" />
          )}
          <div>
            <span className={`font-semibold ${projection.totalApport > 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
              {projection.totalApport > 0
                ? `+${projection.totalApport} jour${projection.totalApport > 1 ? 's' : ''} épargnables`
                : 'Aucun jour épargnable'}
            </span>
            <span className="text-xs text-muted-foreground ml-2">
              → CET : {currentCET}j → {projection.cetFinal}j
            </span>
          </div>
        </div>

        {/* Détail par source */}
        <div className="space-y-2">
          <div className="text-sm font-semibold text-foreground/80 mb-1">Détail par source</div>

          {/* RTC */}
          <SourceRow
            label="RTC (Récupération Temps de Cycle)"
            sublabel={`Max ${RTC_MAX_JOURS_CET}j/an vers CET`}
            balance={`${formatMinutes(counters.rtc)} (≈ ${rtcJoursDisponibles}j)`}
            towardsCET={projection.apportCET.rtc}
            maxAllowed={RTC_MAX_JOURS_CET}
            note={projection.apportCET.rtc > 0 ? `Coût : ${formatMinutes(projection.apportCET.rtc * RTC_COUT_PAR_JOUR_CET)} (8h21/j au lieu de 12h08)` : undefined}
            gain={projection.apportCET.rtc > 0 ? `Gain +${formatMinutes(projection.gainNetRTC)}` : undefined}
            color="emerald"
            disabled={rtcDisabled}
            disabledReason="Solde insuffisant"
          />

          {/* CA Hors Période */}
          <SourceRow
            label="CA Hors Période"
            sublabel="Bonus si ≥ 8 CA posés hors été"
            balance={`${counters.caHP}j`}
            towardsCET={projection.apportCET.caHP}
            note={projection.apportCET.caHP > 0 ? `${counters.caPosesHorsPeriode} CA posés hors période` : undefined}
            color="red"
            disabled={caHPDisabled}
            disabledReason={counters.caPosesHorsPeriode < 8 ? `${counters.caPosesHorsPeriode}/8 CA hors période` : 'Non obtenu'}
          />

          {/* CA classiques */}
          <SourceRow
            label="Congés Annuels (CA)"
            sublabel={`Max ${CA_MAX_VERS_CET}j/an vers CET`}
            balance={`${counters.ca}j restants`}
            towardsCET={projection.apportCET.ca}
            maxAllowed={CA_MAX_VERS_CET}
            note={projection.apportCET.ca > 0 ? `${counters.ca - projection.apportCET.ca}j restants à poser avant le 31/12` : undefined}
            color="blue"
            disabled={caDisabled}
            disabledReason="Aucun CA disponible"
          />

          {/* Heures Supplémentaires */}
          <SourceRow
            label="Heures Supplémentaires (HS)"
            sublabel={`Max ${HS_MAX_VERS_CET}j/an vers CET`}
            balance={`${formatMinutes(counters.hs)} (≈ ${hsJours}j)`}
            towardsCET={projection.apportCET.hs}
            maxAllowed={HS_MAX_VERS_CET}
            color="orange"
            disabled={hsDisabled}
            disabledReason="Solde insuffisant"
          />
        </div>

        {/* Jours perdus */}
        {projection.joursPerdus > 0 && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20">
            <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
            <span className="text-sm text-rose-400">
              <strong>{projection.joursPerdus} jour(s)</strong> seront perdus au 31/12 si aucune action n&apos;est prise (CA excédentaires ou RTC libres non posés).
            </span>
          </div>
        )}

      </CardContent>
    </Card>
  );
}
