'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CycleConfig, CycleType, WeekType, WeekSchedule, CyclePattern } from '@/lib/types';
import { JOURS_SEMAINE, HEURES_PAR_JOUR, CA_PAR_CYCLE } from '@/lib/constants';
import {
  DEFAULT_CYCLE_ALTERNE_A,
  DEFAULT_CYCLE_ALTERNE_B,
  DEFAULT_WEEK_SCHEDULE,
} from '@/lib/types';
import { Calendar, Clock, ChevronRight } from 'lucide-react';

interface CycleSetupProps {
  onNext: (config: CycleConfig) => void;
  initialConfig?: CycleConfig;
}

export function CycleSetup({ onNext, initialConfig }: CycleSetupProps) {
  const [cycleType, setCycleType] = useState<CycleType>(initialConfig?.type ?? 'alterne');
  const [cyclePattern, setCyclePattern] = useState<CyclePattern>(
    initialConfig?.pattern ?? '2/2/3/2/2/3'
  );
  const [heuresParJour, setHeuresParJour] = useState(
    initialConfig?.heuresParJour ?? HEURES_PAR_JOUR
  );
  // Calculer le lundi de la semaine courante
  const getMondayOfCurrentWeek = (): string => {
    const today = new Date();
    const day = today.getDay();
    const diff = day === 0 ? -6 : 1 - day; // Si dimanche, reculer de 6 jours
    const monday = new Date(today);
    monday.setDate(today.getDate() + diff);
    return monday.toISOString().split('T')[0];
  };

  const [dateDebutCycle, setDateDebutCycle] = useState(
    initialConfig?.dateDebutCycle ?? getMondayOfCurrentWeek()
  );
  const [semaineActuelle, setSemaineActuelle] = useState<WeekType>(
    initialConfig?.semaineActuelle ?? 'B'
  );
  const [semaineA, setSemaineA] = useState<WeekSchedule>(
    initialConfig?.semaineA ?? DEFAULT_CYCLE_ALTERNE_A
  );
  const [semaineB, setSemaineB] = useState<WeekSchedule>(
    initialConfig?.semaineB ?? DEFAULT_CYCLE_ALTERNE_B
  );

  const toggleDay = (week: 'A' | 'B', day: keyof WeekSchedule) => {
    if (week === 'A') {
      setSemaineA((prev) => ({ ...prev, [day]: !prev[day] }));
    } else {
      setSemaineB((prev) => ({ ...prev, [day]: !prev[day] }));
    }
  };

  const handleSubmit = () => {
    const config: CycleConfig = {
      type: cycleType,
      pattern: cycleType === 'alterne' ? cyclePattern : undefined,
      heuresParJour,
      dateDebutCycle,
      semaineActuelle,
      semaineA,
      semaineB: cycleType === 'alterne' ? semaineB : undefined,
    };
    onNext(config);
  };

  const formatHeures = (minutes: number): string => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}h${m.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full gradient-primary mb-4">
          <Calendar className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-2xl font-bold text-gradient">Configuration du cycle</h2>
        <p className="text-muted-foreground mt-2">
          Définissez votre rythme de travail
        </p>
      </div>

      <Card className="glass border-white/10">
        <CardHeader>
          <CardTitle className="text-lg">Type de cycle</CardTitle>
          <CardDescription>
            Choisissez votre organisation de travail
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setCycleType('alterne')}
              className={`p-4 rounded-xl border-2 transition-all ${
                cycleType === 'alterne'
                  ? 'border-violet-500 bg-violet-500/10 glow'
                  : 'border-white/10 hover:border-white/20'
              }`}
            >
              <div className="font-semibold">Cycle alterné</div>
              <div className="text-sm text-muted-foreground">Semaines A/B</div>
            </button>
            <button
              type="button"
              onClick={() => setCycleType('hebdo')}
              className={`p-4 rounded-xl border-2 transition-all ${
                cycleType === 'hebdo'
                  ? 'border-violet-500 bg-violet-500/10 glow'
                  : 'border-white/10 hover:border-white/20'
              }`}
            >
              <div className="font-semibold">Hebdomadaire</div>
              <div className="text-sm text-muted-foreground">Même chaque semaine</div>
            </button>
          </div>
        </CardContent>
      </Card>

      {cycleType === 'alterne' && (
        <Card className="glass border-white/10">
          <CardHeader>
            <CardTitle className="text-lg">Rythme de cycle (APORTT)</CardTitle>
            <CardDescription>
              Détermine votre nombre de CA annuels
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Select
              value={cyclePattern}
              onValueChange={(v) => setCyclePattern(v as CyclePattern)}
            >
              <SelectTrigger className="bg-white/5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="4/2">Cycle 4/2 ({CA_PAR_CYCLE['4/2']} CA)</SelectItem>
                <SelectItem value="2/2">Cycle 2/2 ({CA_PAR_CYCLE['2/2']} CA)</SelectItem>
                <SelectItem value="3/3">Cycle 3/3 ({CA_PAR_CYCLE['3/3']} CA)</SelectItem>
                <SelectItem value="2/2/3/2/2/3">Cycle 2/2/3/2/2/3 ({CA_PAR_CYCLE['2/2/3/2/2/3']} CA)</SelectItem>
                <SelectItem value="vacation_forte">Vacation Forte ({CA_PAR_CYCLE['vacation_forte']} CA)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-2">
              Votre cycle détermine le nombre de congés annuels selon la réglementation APORTT.
            </p>
          </CardContent>
        </Card>
      )}

      <Card className="glass border-white/10">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="w-5 h-5 text-violet-400" />
            Durée de journée
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Label htmlFor="heures">Heures par jour travaillé</Label>
              <div className="flex items-center gap-2 mt-2">
                <Input
                  id="heures"
                  type="number"
                  min={1}
                  max={24}
                  value={Math.floor(heuresParJour / 60)}
                  onChange={(e) => {
                    const h = parseInt(e.target.value) || 0;
                    setHeuresParJour(h * 60 + (heuresParJour % 60));
                  }}
                  className="w-20 bg-white/5"
                />
                <span>h</span>
                <Input
                  type="number"
                  min={0}
                  max={59}
                  value={heuresParJour % 60}
                  onChange={(e) => {
                    const m = parseInt(e.target.value) || 0;
                    setHeuresParJour(Math.floor(heuresParJour / 60) * 60 + m);
                  }}
                  className="w-20 bg-white/5"
                />
                <span>min</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-muted-foreground">Total</div>
              <div className="text-xl font-bold text-violet-400">
                {formatHeures(heuresParJour)}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="glass border-white/10">
        <CardHeader>
          <CardTitle className="text-lg">
            {cycleType === 'alterne' ? 'Semaine A' : 'Jours travaillés'}
          </CardTitle>
          <CardDescription>
            Sélectionnez les jours travaillés
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {JOURS_SEMAINE.map((jour) => (
              <button
                key={jour.key}
                type="button"
                onClick={() => toggleDay('A', jour.key as keyof WeekSchedule)}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  semaineA[jour.key as keyof WeekSchedule]
                    ? 'gradient-primary text-white'
                    : 'bg-white/5 hover:bg-white/10 text-muted-foreground'
                }`}
              >
                {jour.short}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {cycleType === 'alterne' && (
        <Card className="glass border-white/10">
          <CardHeader>
            <CardTitle className="text-lg">Semaine B</CardTitle>
            <CardDescription>
              Jours travaillés en semaine alternée
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {JOURS_SEMAINE.map((jour) => (
                <button
                  key={jour.key}
                  type="button"
                  onClick={() => toggleDay('B', jour.key as keyof WeekSchedule)}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    semaineB[jour.key as keyof WeekSchedule]
                      ? 'gradient-secondary text-white'
                      : 'bg-white/5 hover:bg-white/10 text-muted-foreground'
                  }`}
                >
                  {jour.short}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="glass border-white/10">
        <CardHeader>
          <CardTitle className="text-lg">Date de référence</CardTitle>
          <CardDescription>
            Date de début de votre cycle actuel
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="dateDebut">Date de début</Label>
              <Input
                id="dateDebut"
                type="date"
                value={dateDebutCycle}
                onChange={(e) => setDateDebutCycle(e.target.value)}
                className="mt-2 bg-white/5"
              />
            </div>
            {cycleType === 'alterne' && (
              <div>
                <Label>Semaine à cette date</Label>
                <Select
                  value={semaineActuelle}
                  onValueChange={(v) => setSemaineActuelle(v as WeekType)}
                >
                  <SelectTrigger className="mt-2 bg-white/5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="A">Semaine A</SelectItem>
                    <SelectItem value="B">Semaine B</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Button
        onClick={handleSubmit}
        className="w-full h-14 text-lg gradient-primary hover:opacity-90 transition-opacity"
      >
        Continuer
        <ChevronRight className="w-5 h-5 ml-2" />
      </Button>
    </div>
  );
}
