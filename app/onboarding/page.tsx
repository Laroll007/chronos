'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CycleSetup } from '@/components/onboarding/CycleSetup';
import { CountersSetup } from '@/components/onboarding/CountersSetup';
import { ObjectiveSetup } from '@/components/onboarding/ObjectiveSetup';
import { CycleConfig, Counters } from '@/lib/types';
import { saveUserData } from '@/lib/storage';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';

type Step = 'cycle' | 'counters' | 'objective';

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('cycle');
  const [cycleConfig, setCycleConfig] = useState<CycleConfig | null>(null);
  const [counters, setCounters] = useState<Counters | null>(null);

  const steps: Step[] = ['cycle', 'counters', 'objective'];
  const currentIndex = steps.indexOf(step);
  const progress = ((currentIndex + 1) / steps.length) * 100;

  const handleCycleComplete = (config: CycleConfig) => {
    setCycleConfig(config);
    setStep('counters');
  };

  const handleCountersComplete = (data: Counters) => {
    setCounters(data);
    setStep('objective');
  };

  const handleObjectiveComplete = (finalCounters: Counters) => {
    if (!cycleConfig) return;

    const success = saveUserData({
      cycleConfig,
      counters: finalCounters,
      history: [],
      lastUpdated: new Date().toISOString(),
      isOnboarded: true,
    });

    if (success) {
      toast.success('Configuration terminée !', {
        description: 'Bienvenue sur Chronos',
      });
      router.push('/dashboard');
    } else {
      toast.error('Erreur lors de la sauvegarde');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-violet-950/20 to-slate-950">
      {/* Background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-1/4 w-1/2 h-1/2 bg-violet-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-1/4 w-1/2 h-1/2 bg-pink-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 container max-w-lg mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gradient mb-2">Chronos</h1>
          <p className="text-muted-foreground">
            Optimisez la gestion de vos congés
          </p>
        </div>

        {/* Progress */}
        <div className="mb-8">
          <div className="flex justify-between text-sm text-muted-foreground mb-2">
            <span>Étape {currentIndex + 1} / {steps.length}</span>
            <span>
              {step === 'cycle' && 'Cycle de travail'}
              {step === 'counters' && 'Compteurs'}
              {step === 'objective' && 'Objectif CET'}
            </span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Steps */}
        {step === 'cycle' && (
          <CycleSetup
            onNext={handleCycleComplete}
            initialConfig={cycleConfig ?? undefined}
          />
        )}

        {step === 'counters' && cycleConfig && (
          <CountersSetup
            cycleConfig={cycleConfig}
            onNext={handleCountersComplete}
            onBack={() => setStep('cycle')}
            initialCounters={counters ?? undefined}
          />
        )}

        {step === 'objective' && cycleConfig && counters && (
          <ObjectiveSetup
            cycleConfig={cycleConfig}
            counters={counters}
            onComplete={handleObjectiveComplete}
            onBack={() => setStep('counters')}
          />
        )}
      </div>
    </div>
  );
}
