'use client';

import { useState, useEffect, useMemo, useCallback, useSyncExternalStore, lazy, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { CycleConfig, Counters } from '@/lib/types';
import {
  saveUserData,
  ONBOARDING_DRAFT_KEY,
  parseOnboardingDraft,
  saveOnboardingDraft,
  clearOnboardingDraft,
} from '@/lib/storage';
import type { CountersDraft } from '@/components/onboarding/CountersSetup';
import { markReleaseNotesSeen } from '@/lib/releaseNotes';
import { track } from '@/lib/analytics';
import { getCETApportMaxAnnee } from '@/lib/calculations';
import { CET_PLAFOND } from '@/lib/constants';
import { Calendar, Calculator, Check } from 'lucide-react';
import { toast } from 'sonner';

const CycleSetup = dynamic(
  () => import('@/components/onboarding/CycleSetup').then((mod) => ({ default: mod.CycleSetup })),
  {
    loading: () => (
      <div className="space-y-4">
        <div className="rounded-xl border border-slate-200 py-6 shadow-sm bg-white">
          <div className="px-6 mb-4">
            <div className="h-5 bg-slate-100 rounded w-1/2 mb-2 animate-pulse" />
            <div className="h-3 bg-slate-50 rounded w-2/3 animate-pulse" />
          </div>
          <div className="px-6">
            <div className="grid grid-cols-2 gap-3">
              <div className="h-20 rounded-xl border-2 border-slate-200 bg-slate-50 animate-pulse" />
              <div className="h-20 rounded-xl border-2 border-slate-200 bg-slate-50 animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    ),
  }
);

const CountersSetup = lazy(() =>
  import('@/components/onboarding/CountersSetup').then((mod) => ({ default: mod.CountersSetup }))
);

// Lecture du brouillon d'onboarding. useSyncExternalStore : rendu serveur sans
// brouillon, puis reprise côté client sans décalage d'hydratation ni setState
// dans un effet.
const subscribeNoop = () => () => {};
const readDraftRaw = () => {
  try {
    return localStorage.getItem(ONBOARDING_DRAFT_KEY);
  } catch {
    return null;
  }
};
const readDraftServer = () => null;

type Step = 'cycle' | 'counters';

const STEP_CONFIG = [
  { key: 'cycle' as Step, label: 'Cycle', icon: Calendar },
  { key: 'counters' as Step, label: 'Compteurs', icon: Calculator },
];

export function OnboardingWizard() {
  const router = useRouter();
  const draftRaw = useSyncExternalStore(subscribeNoop, readDraftRaw, readDraftServer);
  const resumed = useMemo(() => parseOnboardingDraft(draftRaw), [draftRaw]);

  const [stepState, setStep] = useState<Step | null>(null);
  const [cycleState, setCycleConfig] = useState<CycleConfig | null>(null);
  const cycleConfig = cycleState ?? resumed?.cycleConfig ?? null;
  const step: Step = stepState ?? (resumed ? 'counters' : 'cycle');

  // Mesure : l'agent revient finir une inscription commencée plus tôt. Lu une
  // seule fois au montage — le brouillon est aussi créé pendant une première
  // inscription, qui ne doit pas compter comme une reprise.
  useEffect(() => {
    if (parseOnboardingDraft(readDraftRaw())) track('onboarding_resume');
  }, []);

  const handleDraftChange = useCallback(
    (d: CountersDraft) => {
      if (cycleConfig) saveOnboardingDraft({ cycleConfig, ...d });
    },
    [cycleConfig]
  );

  const steps: Step[] = ['cycle', 'counters'];
  const currentIndex = steps.indexOf(step);

  useEffect(() => {
    // Scroll is internal to <main> now (cf. app/onboarding/page.tsx) — window scroll is 0.
    const scrollable = document.querySelector('main');
    if (scrollable) scrollable.scrollTop = 0;
    else window.scrollTo(0, 0);
  }, [step]);

  const handleCycleComplete = (config: CycleConfig) => {
    setCycleConfig(config);
    setStep('counters');
    saveOnboardingDraft({ cycleConfig: config });
    track('onboarding_cycle_done');
  };

  const finishOnboarding = (data: Counters, compteursARenseigner: boolean) => {
    if (!cycleConfig) return;

    const objectifCET = Math.min(CET_PLAFOND, data.cet + getCETApportMaxAnnee(data.cet));
    const finalCounters: Counters = { ...data, objectifCET };

    const success = saveUserData({
      cycleConfig,
      counters: finalCounters,
      history: [],
      lastUpdated: new Date().toISOString(),
      // Sans cette ligne, migrateUserData() croit qu'on change d'année au premier
      // chargement du dashboard et remet à zéro ce que l'agent vient de saisir
      // (CA posés hors période, CA HP, conso CF du semestre, RTT).
      lastResetYear: new Date().getFullYear(),
      ...(compteursARenseigner && { compteursARenseigner: true }),
      isOnboarded: true,
    });

    if (success) {
      clearOnboardingDraft();
      // Nouvel inscrit : tout est nouveau pour lui, pas de « Quoi de neuf ».
      markReleaseNotesSeen();
      if (compteursARenseigner) {
        track('onboarding_skip_counters');
        toast.success('Votre calendrier est prêt !', {
          description: 'Renseignez vos compteurs dès que vous avez vos soldes sous les yeux.',
        });
      } else {
        track('onboarding_done');
        toast.success('Configuration terminée !', { description: 'Bienvenue sur My Chronos' });
      }
      router.push('/dashboard');
    } else {
      toast.error('Erreur lors de la sauvegarde');
    }
  };

  return (
    <>
      {/* Stepper */}
      <div className="flex items-center justify-center gap-2 mb-8">
        {STEP_CONFIG.map((s, index) => {
          const Icon = s.icon;
          const isCompleted = index < currentIndex;
          const isActive = s.key === step;

          return (
            <div key={s.key} className="flex items-center gap-2">
              {index > 0 && (
                <div
                  className={`w-8 h-0.5 rounded-full transition-all duration-300 ${
                    isCompleted ? 'bg-emerald-400' : 'bg-slate-200'
                  }`}
                />
              )}
              <div
                className={`flex items-center gap-2 px-3 py-2 rounded-full transition-all duration-300 text-sm font-medium ${
                  isCompleted
                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                    : isActive
                    ? 'text-white shadow-md'
                    : 'bg-slate-100 text-slate-400 border border-slate-200'
                }`}
                style={isActive ? {
                  background: 'linear-gradient(135deg, #0055A4, #1a7de8)',
                  boxShadow: '0 4px 14px rgba(0,85,164,0.25)',
                } : undefined}
              >
                {isCompleted ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                <span className="hidden sm:inline">{s.label}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Contenu */}
      <div key={step} className="animate-scale-in">
        {step === 'cycle' && (
          <CycleSetup
            onNext={handleCycleComplete}
            initialConfig={cycleConfig ?? undefined}
          />
        )}
        {step === 'counters' && cycleConfig && (
          <Suspense fallback={null}>
            <CountersSetup
              cycleConfig={cycleConfig}
              onNext={(data) => finishOnboarding(data, false)}
              onSkip={(data) => finishOnboarding(data, true)}
              onBack={() => setStep('cycle')}
              initialDraft={resumed?.counters ? {
                counters: resumed.counters,
                selected: resumed.selected as CountersDraft['selected'],
                subStep: resumed.subStep,
              } : undefined}
              onDraftChange={handleDraftChange}
            />
          </Suspense>
        )}
      </div>
    </>
  );
}
