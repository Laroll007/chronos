'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Counters, CycleConfig } from '@/lib/types';
import { COUNTER_LABELS, COUNTER_COLORS, RTC_RESERVES_CET } from '@/lib/constants';
import { DEFAULT_COUNTERS } from '@/lib/storage';
import {
  Calculator,
  ChevronRight,
  ChevronLeft,
  Info,
  Sparkles
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface CountersSetupProps {
  cycleConfig: CycleConfig;
  onNext: (counters: Counters) => void;
  onBack: () => void;
  initialCounters?: Counters;
}

export function CountersSetup({
  cycleConfig,
  onNext,
  onBack,
  initialCounters,
}: CountersSetupProps) {
  const [counters, setCounters] = useState<Counters>(
    initialCounters ?? DEFAULT_COUNTERS
  );

  const updateCounter = (key: keyof Counters, value: number) => {
    setCounters((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = () => {
    onNext(counters);
  };

  const formatMinutesToInput = (minutes: number): { h: number; m: number } => ({
    h: Math.floor(minutes / 60),
    m: minutes % 60,
  });

  const TimeInput = ({
    label,
    value,
    onChange,
    info,
    colorKey,
  }: {
    label: string;
    value: number;
    onChange: (minutes: number) => void;
    info: string;
    colorKey: string;
  }) => {
    const { h, m } = formatMinutesToInput(value);
    const colors = COUNTER_COLORS[colorKey] || COUNTER_COLORS.rtc;

    return (
      <div className={`p-4 rounded-xl ${colors.bg} border border-white/5`}>
        <div className="flex items-center justify-between mb-3">
          <Label className={`font-semibold ${colors.text}`}>{label}</Label>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Info className="w-4 h-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>{info}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={0}
            max={999}
            value={h}
            onChange={(e) => {
              const newH = parseInt(e.target.value) || 0;
              onChange(newH * 60 + m);
            }}
            className="w-20 bg-white/5 text-center"
          />
          <span className="text-muted-foreground">h</span>
          <Input
            type="number"
            min={0}
            max={59}
            value={m}
            onChange={(e) => {
              const newM = parseInt(e.target.value) || 0;
              onChange(h * 60 + newM);
            }}
            className="w-20 bg-white/5 text-center"
          />
          <span className="text-muted-foreground">min</span>
        </div>
      </div>
    );
  };

  const DaysInput = ({
    label,
    value,
    onChange,
    max,
    info,
    colorKey,
  }: {
    label: string;
    value: number;
    onChange: (days: number) => void;
    max: number;
    info: string;
    colorKey: string;
  }) => {
    const colors = COUNTER_COLORS[colorKey] || COUNTER_COLORS.ca;

    return (
      <div className={`p-4 rounded-xl ${colors.bg} border border-white/5`}>
        <div className="flex items-center justify-between mb-3">
          <Label className={`font-semibold ${colors.text}`}>{label}</Label>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Info className="w-4 h-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>{info}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            min={0}
            max={max}
            value={value}
            onChange={(e) => onChange(parseInt(e.target.value) || 0)}
            className="w-24 bg-white/5 text-center"
          />
          <span className="text-muted-foreground">jours</span>
          <span className="text-xs text-muted-foreground ml-auto">max {max}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full gradient-secondary mb-4">
          <Calculator className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-gradient">Vos compteurs actuels</h2>
        <p className="text-muted-foreground mt-2">
          Saisissez vos soldes de congés
        </p>
      </div>

      {/* CET */}
      <Card className="glass border-white/10">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-violet-400" />
            Compte Épargne Temps (CET)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <DaysInput
            label="Stock CET actuel"
            value={counters.cet}
            onChange={(v) => updateCounter('cet', v)}
            max={60}
            info="Jours actuellement épargnés sur votre CET. Plafond : 60 jours."
            colorKey="cet"
          />
        </CardContent>
      </Card>

      {/* CA */}
      <Card className="glass border-white/10">
        <CardHeader>
          <CardTitle className="text-lg">Congés Annuels</CardTitle>
          <CardDescription>
            {COUNTER_LABELS.ca.description}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <DaysInput
            label="CA restants"
            value={counters.ca}
            onChange={(v) => updateCounter('ca', v)}
            max={18}
            info="Congés annuels disponibles. Max 18 jours, perdus au 31/12."
            colorKey="ca"
          />
          <DaysInput
            label="CA posés hors période (pour bonus HP)"
            value={counters.caPosesHorsPeriode}
            onChange={(v) => {
              updateCounter('caPosesHorsPeriode', v);
              updateCounter('caHP', v >= 8 ? 2 : 0);
            }}
            max={18}
            info="CA posés entre 01/01-30/04 ou 01/11-31/12. Si >= 8, vous obtenez 2 CA HP bonus."
            colorKey="caHP"
          />
          {counters.caPosesHorsPeriode >= 8 && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <Sparkles className="w-5 h-5 text-emerald-400" />
              <span className="text-emerald-400 font-medium">
                2 CA Hors Période bonus obtenus !
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* CF */}
      <Card className="glass border-white/10">
        <CardHeader>
          <CardTitle className="text-lg">Crédits Fériés</CardTitle>
          <CardDescription>
            {COUNTER_LABELS.cf.description}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <TimeInput
            label="CF total restant"
            value={counters.cf}
            onChange={(v) => updateCounter('cf', v)}
            info="Crédits fériés disponibles. 109h12 par an, répartis 54h36 par semestre."
            colorKey="cf"
          />
          <div className="grid grid-cols-2 gap-4">
            <TimeInput
              label="CF consommés S1"
              value={counters.cfConsoS1}
              onChange={(v) => updateCounter('cfConsoS1', v)}
              info="CF consommés entre janvier et juin."
              colorKey="cf"
            />
            <TimeInput
              label="CF consommés S2"
              value={counters.cfConsoS2}
              onChange={(v) => updateCounter('cfConsoS2', v)}
              info="CF consommés entre juillet et décembre."
              colorKey="cf"
            />
          </div>
        </CardContent>
      </Card>

      {/* RTC */}
      <Card className="glass border-white/10 glow">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            RTC
            <span className="text-xs px-2 py-1 rounded-full bg-violet-500/20 text-violet-400">
              Gain CET +37h50/an
            </span>
          </CardTitle>
          <CardDescription>
            Brut 187h09 - Journée solidarité 12h08 = Net 175h01
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <TimeInput
            label="RTC net restant (après JS)"
            value={counters.rtc}
            onChange={(v) => updateCounter('rtc', v)}
            info="175h01 net après déduction JS. 83h30 à réserver pour le CET (gain 37h50)."
            colorKey="rtc"
          />
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <div className="text-sm text-amber-300">
              <strong>Journée de solidarité (APORTT) :</strong> 12h08 déduits automatiquement.
              RTC brut 187h09 → Net 175h01.
            </div>
          </div>
          <div className="p-3 rounded-lg bg-violet-500/10 border border-violet-500/20">
            <div className="text-sm text-violet-300">
              <strong>Astuce CET :</strong> Réservez 83h30 de RTC pour les convertir en 10 jours CET.
              Vous gagnez 37h50 grâce à la conversion avantageuse (8h21 au lieu de 12h08 par jour).
            </div>
          </div>
        </CardContent>
      </Card>

      {/* RTT (si hebdo) */}
      {cycleConfig.type === 'hebdo' && (
        <Card className="glass border-white/10">
          <CardHeader>
            <CardTitle className="text-lg">RTT</CardTitle>
            <CardDescription>
              {COUNTER_LABELS.rtt.description}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TimeInput
              label="RTT restants"
              value={counters.rtt ?? 0}
              onChange={(v) => {
                setCounters((prev) => ({ ...prev, rtt: v, hasRTT: true }));
              }}
              info="Récupération temps de travail. Perdus au 31/12."
              colorKey="rtt"
            />
          </CardContent>
        </Card>
      )}

      {/* RPS */}
      <Card className="glass border-white/10">
        <CardHeader>
          <CardTitle className="text-lg">RPS (Récupération dimanche)</CardTitle>
          <CardDescription>
            {COUNTER_LABELS.rps.description}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <TimeInput
            label="RPS année précédente (report)"
            value={counters.rpsAnneePrec}
            onChange={(v) => updateCounter('rpsAnneePrec', v)}
            info="RPS accumulés les années précédentes. Gardés indéfiniment."
            colorKey="rps"
          />
          <TimeInput
            label="RPS total actuel"
            value={counters.rps}
            onChange={(v) => updateCounter('rps', v)}
            info="Total RPS disponibles (année précédente + cette année)."
            colorKey="rps"
          />
        </CardContent>
      </Card>

      {/* HS */}
      <Card className="glass border-white/10">
        <CardHeader>
          <CardTitle className="text-lg">Heures Supplémentaires</CardTitle>
          <CardDescription>
            {COUNTER_LABELS.hs.description}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TimeInput
            label="HS accumulées"
            value={counters.hs}
            onChange={(v) => updateCounter('hs', v)}
            info="Max 160h stockables. Au-delà = paiement obligatoire."
            colorKey="hs"
          />
        </CardContent>
      </Card>

      <div className="flex gap-4">
        <Button
          variant="outline"
          onClick={onBack}
          className="flex-1 h-14 bg-white/5 border-white/10"
        >
          <ChevronLeft className="w-5 h-5 mr-2" />
          Retour
        </Button>
        <Button
          onClick={handleSubmit}
          className="flex-1 h-14 text-lg gradient-primary hover:opacity-90 transition-opacity"
        >
          Continuer
          <ChevronRight className="w-5 h-5 ml-2" />
        </Button>
      </div>
    </div>
  );
}
