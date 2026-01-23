'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Counters, CycleConfig, CETProjection } from '@/lib/types';
import { CET_PLAFOND, CET_APPORT_ANNUEL_MAX } from '@/lib/constants';
import { calculateOptimalCETStrategy, formatMinutes } from '@/lib/calculations';
import {
  Target,
  ChevronLeft,
  Check,
  TrendingUp,
  Sparkles,
  AlertTriangle
} from 'lucide-react';

interface ObjectiveSetupProps {
  cycleConfig: CycleConfig;
  counters: Counters;
  onComplete: (counters: Counters) => void;
  onBack: () => void;
}

export function ObjectiveSetup({
  cycleConfig,
  counters,
  onComplete,
  onBack,
}: ObjectiveSetupProps) {
  const [objectifCET, setObjectifCET] = useState(counters.objectifCET || 15);

  const maxPossible = Math.min(
    CET_PLAFOND,
    counters.cet + CET_APPORT_ANNUEL_MAX
  );

  const updatedCounters = { ...counters, objectifCET };
  const projection = calculateOptimalCETStrategy(updatedCounters);

  const handleComplete = () => {
    onComplete({ ...counters, objectifCET });
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full gradient-success mb-4">
          <Target className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-gradient">Objectif CET</h2>
        <p className="text-muted-foreground mt-2">
          Définissez votre objectif d épargne
        </p>
      </div>

      {/* Objectif */}
      <Card className="glass border-white/10">
        <CardHeader>
          <CardTitle className="text-lg">Objectif de fin d année</CardTitle>
          <CardDescription>
            Combien de jours souhaitez-vous avoir au CET au 31/12 ?
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-4">
            <Input
              type="number"
              min={counters.cet}
              max={maxPossible}
              value={objectifCET}
              onChange={(e) => setObjectifCET(parseInt(e.target.value) || counters.cet)}
              className="w-24 bg-white/5 text-center text-2xl font-bold"
            />
            <div className="flex-1">
              <div className="text-sm text-muted-foreground mb-2">
                Actuel: {counters.cet}j → Objectif: {objectifCET}j
              </div>
              <Progress
                value={(objectifCET / CET_PLAFOND) * 100}
                className="h-3"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>0</span>
                <span>Plafond: {CET_PLAFOND}j</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center">
            {[counters.cet + 5, counters.cet + 10, counters.cet + 15].map((val) => (
              <button
                key={val}
                onClick={() => setObjectifCET(Math.min(val, maxPossible))}
                className={`p-3 rounded-lg border transition-all ${
                  objectifCET === val
                    ? 'border-violet-500 bg-violet-500/20'
                    : 'border-white/10 hover:border-white/20 bg-white/5'
                }`}
              >
                <div className="font-bold">{Math.min(val, maxPossible)}j</div>
                <div className="text-xs text-muted-foreground">
                  +{Math.min(val - counters.cet, CET_APPORT_ANNUEL_MAX)}j
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Projection */}
      <Card className="glass border-white/10 glow">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
            Projection optimale
          </CardTitle>
          <CardDescription>
            Stratégie recommandée pour atteindre votre objectif
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {projection.isOptimal ? (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <Check className="w-5 h-5 text-emerald-400" />
              <span className="text-emerald-400 font-medium">
                Objectif atteignable !
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
              <span className="text-amber-400 font-medium">
                Objectif partiellement atteignable
              </span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-white/5">
              <div className="text-sm text-muted-foreground">Apport total</div>
              <div className="text-2xl font-bold text-violet-400">
                +{projection.totalApport}j
              </div>
            </div>
            <div className="p-4 rounded-xl bg-white/5">
              <div className="text-sm text-muted-foreground">CET final</div>
              <div className="text-2xl font-bold text-emerald-400">
                {projection.cetFinal}j
              </div>
            </div>
          </div>

          {/* Détail de l'apport */}
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Répartition recommandée</Label>

            {projection.apportCET.rtc > 0 && (
              <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-500/10">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  <span>RTC → CET</span>
                </div>
                <span className="font-bold text-emerald-400">
                  {projection.apportCET.rtc}j
                </span>
              </div>
            )}

            {projection.apportCET.caHP > 0 && (
              <div className="flex items-center justify-between p-3 rounded-lg bg-indigo-500/10">
                <span>CA Hors Période</span>
                <span className="font-bold text-indigo-400">
                  {projection.apportCET.caHP}j
                </span>
              </div>
            )}

            {projection.apportCET.ca > 0 && (
              <div className="flex items-center justify-between p-3 rounded-lg bg-blue-500/10">
                <span>CA classiques</span>
                <span className="font-bold text-blue-400">
                  {projection.apportCET.ca}j
                </span>
              </div>
            )}

            {projection.apportCET.hs > 0 && (
              <div className="flex items-center justify-between p-3 rounded-lg bg-red-500/10">
                <span>Heures Sup</span>
                <span className="font-bold text-red-400">
                  {projection.apportCET.hs}j
                </span>
              </div>
            )}
          </div>

          {/* Gain RTC */}
          {projection.gainNetRTC > 0 && (
            <div className="p-4 rounded-xl bg-gradient-to-r from-violet-500/20 to-pink-500/20 border border-violet-500/30">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-5 h-5 text-violet-400" />
                <span className="font-semibold text-violet-300">Bonus conversion RTC</span>
              </div>
              <div className="text-2xl font-bold text-white">
                +{formatMinutes(projection.gainNetRTC)}
              </div>
              <div className="text-sm text-violet-300">
                ≈ {projection.joursEconomises} jours gagnés grâce à la conversion avantageuse
              </div>
            </div>
          )}

          {projection.joursPerdus > 0 && (
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <div className="text-amber-400 text-sm">
                <strong>Attention :</strong> Sans action, {projection.joursPerdus} jour(s)
                seront perdus au 31/12.
              </div>
            </div>
          )}
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
          onClick={handleComplete}
          className="flex-1 h-14 text-lg gradient-success hover:opacity-90 transition-opacity"
        >
          <Check className="w-5 h-5 mr-2" />
          Terminer
        </Button>
      </div>
    </div>
  );
}
