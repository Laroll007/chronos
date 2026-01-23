'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { CETProjection } from '@/lib/types';
import { formatMinutes } from '@/lib/calculations';
import { CET_PLAFOND } from '@/lib/constants';
import {
  TrendingUp,
  Target,
  Sparkles,
  AlertTriangle,
  Check,
  ArrowRight,
} from 'lucide-react';

interface ProjectionProps {
  currentCET: number;
  objectifCET: number;
  projection: CETProjection;
}

export function Projection({ currentCET, objectifCET, projection }: ProjectionProps) {
  const progressPercent = (projection.cetFinal / CET_PLAFOND) * 100;
  const objectifPercent = (objectifCET / CET_PLAFOND) * 100;

  return (
    <Card className="glass border-white/10 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 via-transparent to-pink-500/5" />
      <CardHeader className="relative">
        <CardTitle className="text-lg flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-emerald-400" />
          Projection CET 31/12
        </CardTitle>
      </CardHeader>
      <CardContent className="relative space-y-6">
        {/* Visualisation */}
        <div className="relative">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-muted-foreground">Progression</div>
            <div className="text-sm">
              <span className="font-bold text-2xl">{projection.cetFinal}</span>
              <span className="text-muted-foreground">/{CET_PLAFOND}j</span>
            </div>
          </div>
          <div className="relative">
            <Progress value={progressPercent} className="h-4" />
            {/* Marqueur objectif */}
            <div
              className="absolute top-0 h-4 w-0.5 bg-amber-400"
              style={{ left: `${objectifPercent}%` }}
            />
            <div
              className="absolute -top-6 text-xs text-amber-400 transform -translate-x-1/2"
              style={{ left: `${objectifPercent}%` }}
            >
              Objectif
            </div>
          </div>
          <div className="flex justify-between mt-1 text-xs text-muted-foreground">
            <span>Actuel: {currentCET}j</span>
            <span>+{projection.totalApport}j</span>
          </div>
        </div>

        {/* Statut */}
        <div
          className={`flex items-center gap-3 p-4 rounded-xl ${
            projection.isOptimal
              ? 'bg-emerald-500/10 border border-emerald-500/20'
              : 'bg-amber-500/10 border border-amber-500/20'
          }`}
        >
          {projection.isOptimal ? (
            <>
              <div className="p-2 rounded-full bg-emerald-500/20">
                <Check className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <div className="font-semibold text-emerald-400">
                  Objectif atteint !
                </div>
                <div className="text-sm text-emerald-400/80">
                  {projection.cetFinal}j sur {objectifCET}j visés
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="p-2 rounded-full bg-amber-500/20">
                <Target className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <div className="font-semibold text-amber-400">
                  Objectif partiel
                </div>
                <div className="text-sm text-amber-400/80">
                  {projection.cetFinal}j sur {objectifCET}j visés
                </div>
              </div>
            </>
          )}
        </div>

        {/* Répartition */}
        <div>
          <div className="text-sm font-medium mb-3">Répartition optimale</div>
          <div className="space-y-2">
            {projection.apportCET.rtc > 0 && (
              <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-500/10">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  <span>RTC</span>
                  <Badge className="bg-emerald-500/20 text-emerald-300 text-xs">
                    Gain +{formatMinutes(projection.gainNetRTC)}
                  </Badge>
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
              <div className="flex items-center justify-between p-3 rounded-lg bg-orange-500/10">
                <span>Heures Sup</span>
                <span className="font-bold text-orange-400">
                  {projection.apportCET.hs}j
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Gain RTC */}
        {projection.gainNetRTC > 0 && (
          <div className="p-4 rounded-xl bg-gradient-to-r from-violet-500/20 to-pink-500/20 border border-violet-500/30">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-5 h-5 text-violet-400" />
              <span className="font-semibold text-violet-300">
                Bonus conversion RTC
              </span>
            </div>
            <div className="flex items-center gap-4">
              <div>
                <div className="text-3xl font-bold text-white">
                  +{formatMinutes(projection.gainNetRTC)}
                </div>
                <div className="text-sm text-violet-300">
                  ≈ {projection.joursEconomises} jours gagnés
                </div>
              </div>
              <ArrowRight className="w-6 h-6 text-violet-400/50" />
              <div className="text-sm text-violet-300/80">
                Grâce à la conversion avantageuse 8h21 = 1j CET
              </div>
            </div>
          </div>
        )}

        {/* Jours perdus */}
        {projection.joursPerdus > 0 && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20">
            <AlertTriangle className="w-4 h-4 text-rose-400" />
            <span className="text-sm text-rose-400">
              {projection.joursPerdus} jour(s) seront perdus au 31/12 sans action
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
