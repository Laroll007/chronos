'use client';

import { useEffect, useState, useCallback, lazy, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { SimpleHeader } from '@/components/dashboard/SimpleHeader';
import { CalendarView } from '@/components/dashboard/CalendarView';
// Lazy-load tous les composants modales/drawers — non visibles au démarrage
const OptimizationModal = lazy(() =>
  import('@/components/dashboard/OptimizationModal').then((mod) => ({
    default: mod.OptimizationModal,
  }))
);
const CountersDrawer = lazy(() =>
  import('@/components/dashboard/CountersDrawer').then((mod) => ({
    default: mod.CountersDrawer,
  }))
);
const NotificationsPanel = lazy(() =>
  import('@/components/dashboard/NotificationsPanel').then((mod) => ({
    default: mod.NotificationsPanel,
  }))
);
const Settings = lazy(() =>
  import('@/components/dashboard/Settings').then((mod) => ({
    default: mod.Settings,
  }))
);
const Projection = lazy(() =>
  import('@/components/dashboard/Projection').then((mod) => ({
    default: mod.Projection,
  }))
);
import { WelcomeModal, hasSeenWelcome } from '@/components/dashboard/WelcomeModal';
import { useCounters } from '@/hooks/useCounters';
// ColleaguesDrawer & useColleagues — désactivé v1, réactiver pour la v2
import { useRecommendations } from '@/hooks/useRecommendations';
import { useNotifications } from '@/hooks/useNotifications';
import { useCycle } from '@/hooks/useCycle';
import { Combination, HistoryEntry } from '@/lib/types';
import { countWorkingDays, isWorkingDay, getCATotalForCycle, getWeeklyMinutes, formatMinutes } from '@/lib/calculations';
import { HEURES_PAR_JOUR } from '@/lib/constants';
import { Loader2, User, X } from 'lucide-react';
import { DialogClose } from '@/components/ui/dialog';
import { toast } from 'sonner';

export default function DashboardPage() {
  const router = useRouter();
  const [showCounters, setShowCounters] = useState(false);
  const [showOptimization, setShowOptimization] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [selectedRange, setSelectedRange] = useState<{
    start: Date;
    end: Date;
    workingDays: number;
  } | null>(null);
  const [calendarResetTrigger, setCalendarResetTrigger] = useState(0);
  const [showWelcome, setShowWelcome] = useState(false);

  const {
    counters,
    cycleConfig,
    history,
    isLoading,
    isOnboarded,
    updateCounters,
    poseConge,
    poseCMO,
    poseAstreinte,
    epargnerCET,
    deleteHistoryEntry,
    reset,
  } = useCounters();

  const { all: recommendations, cetProjection } = useRecommendations(
    counters,
    cycleConfig
  );

  const cycleInfo = useCycle(cycleConfig);

  // Hook notifications
  const {
    notifications,
    urgentCount,
    warningCount,
    permissionState,
    requestPermission,
    dismissNotification,
    isSupported: notificationsSupported,
  } = useNotifications({ counters });

  const totalNotificationCount = urgentCount + warningCount;

  // Redirection si non onboarded
  useEffect(() => {
    if (!isLoading && !isOnboarded) {
      router.replace('/onboarding');
    }
  }, [isLoading, isOnboarded, router]);

  // Popup bienvenue à la première ouverture
  useEffect(() => {
    if (!isLoading && isOnboarded && !hasSeenWelcome()) {
      setShowWelcome(true);
    }
  }, [isLoading, isOnboarded]);

  // PERF-001: useCallback pour éviter les re-renders
  const handleRangeSelected = useCallback((start: Date, end: Date, workingDays: number) => {
    setSelectedRange({ start, end, workingDays });
    setShowOptimization(true);
  }, []);

  // Modifier un congé posé : supprime + rouvre le modal avec la même plage
  const handleEditLeave = useCallback((entry: HistoryEntry) => {
    const success = deleteHistoryEntry(entry.id);
    if (!success) {
      toast.error('Impossible de modifier ce congé');
      return;
    }
    const start = new Date(entry.date);
    const end = entry.dateEnd ? new Date(entry.dateEnd) : new Date(entry.date);
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    if (!cycleConfig) return;
    const workingDays = Math.max(1, countWorkingDays(start, end, cycleConfig));
    setSelectedRange({ start, end, workingDays });
    setShowOptimization(true);
  }, [deleteHistoryEntry, cycleConfig]);

  const handleMarkCMO = useCallback(() => {
    if (!selectedRange) return;
    const result = poseCMO(selectedRange.start, selectedRange.end);
    if (result.success) {
      toast.success('Arrêt maladie marqué', {
        description: 'La période est marquée en CMO sur le calendrier (sans impact sur vos compteurs).',
      });
      setShowOptimization(false);
      setSelectedRange(null);
      setCalendarResetTrigger((prev) => prev + 1);
    } else {
      toast.error('Erreur', { description: result.error });
    }
  }, [poseCMO, selectedRange]);

  const handleMarkAstreinte = useCallback(() => {
    if (!selectedRange) return;
    const result = poseAstreinte(selectedRange.start, selectedRange.end);
    if (result.success) {
      toast.success('Astreinte posée', {
        description: 'La période est marquée en astreinte (comptée comme jours travaillés). Pensez à saisir vos HS manuellement.',
      });
      setShowOptimization(false);
      setSelectedRange(null);
      setCalendarResetTrigger((prev) => prev + 1);
    } else {
      toast.error('Erreur', { description: result.error });
    }
  }, [poseAstreinte, selectedRange]);

  const handleEpargneCET = useCallback((joursCA: number) => {
    const result = epargnerCET(joursCA);
    if (result.success) {
      toast.success(`${joursCA}j épargnés au CET !`, {
        description: `Votre solde CET a été mis à jour. CA restants : ${(counters?.ca ?? 0) - joursCA}j`,
      });
    } else {
      toast.error('Erreur épargne CET', { description: result.error });
    }
  }, [epargnerCET, counters]);

  // PERF-001: useCallback sur handleApplyCombination
  const handleApplyCombination = useCallback((combination: Combination) => {
    if (!selectedRange || !cycleConfig) return;

    // Liste des jours travaillés de la plage sélectionnée (chronologiquement)
    const workingDates: Date[] = [];
    const cursor = new Date(selectedRange.start);
    cursor.setHours(0, 0, 0, 0);
    const endCursor = new Date(selectedRange.end);
    endCursor.setHours(0, 0, 0, 0);
    while (cursor <= endCursor) {
      if (isWorkingDay(cursor, cycleConfig)) {
        workingDates.push(new Date(cursor));
      }
      cursor.setDate(cursor.getDate() + 1);
    }

    try {
      let cursorIdx = 0;
      const failed: string[] = [];
      // groupId partagé : les items d'une même combinaison apparaissent
      // groupés dans la liste des congés posés (une bulle par période).
      const groupId =
        combination.items.length > 1 ? `grp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` : undefined;

      for (const item of combination.items) {
        const isMinutes = !!item.amountMinutes;
        const amount = isMinutes ? item.amountMinutes! : item.amount;

        // Nombre de jours travaillés occupés par cet item
        const nbDays = isMinutes
          ? Math.max(1, Math.round(item.amountMinutes! / HEURES_PAR_JOUR))
          : Math.max(1, item.amount);

        const sliceStart = workingDates[cursorIdx] ?? selectedRange.start;
        const sliceEndIdx = Math.min(cursorIdx + nbDays - 1, workingDates.length - 1);
        const sliceEnd = workingDates[sliceEndIdx] ?? sliceStart;
        cursorIdx += nbDays;

        const result = poseConge(item.type, amount, sliceStart, sliceEnd, undefined, groupId);
        if (!result.success) {
          failed.push(`${item.type.toUpperCase()} : ${result.error ?? 'échec'}`);
        }
      }

      if (failed.length > 0) {
        toast.error('Pose partielle', {
          description: failed.join(' · '),
        });
      } else {
        toast.success('Congés posés avec succès !', {
          description: `${combination.totalDays} jour${
            combination.totalDays > 1 ? 's' : ''
          } enregistré${combination.totalDays > 1 ? 's' : ''}`,
        });
      }

      setShowOptimization(false);
      setSelectedRange(null);
    } catch (error) {
      toast.error('Erreur lors de la pose des congés', {
        description:
          error instanceof Error ? error.message : 'Une erreur est survenue',
      });
    }
  }, [poseConge, selectedRange, cycleConfig]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          <span>Chargement...</span>
        </div>
      </div>
    );
  }

  if (!counters || !cycleConfig) {
    return null;
  }

  return (
    <div className="h-screen overflow-hidden bg-background">
      {/* Background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 -left-1/4 w-1/2 h-1/2 bg-blue-500/[0.04] rounded-full blur-3xl" />
        <div className="absolute bottom-0 -right-1/4 w-1/2 h-1/2 bg-red-500/[0.03] rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 flex flex-col h-screen">
        {/* Header */}
        <SimpleHeader
          cycleInfo={cycleInfo}
          onProfileClick={() => setShowProfile(true)}
          onSettingsClick={() => setShowSettings(true)}
          onCountersClick={() => setShowCounters(true)}
          onNotificationsClick={() => setShowNotifications(true)}
          notificationCount={totalNotificationCount}
        />

        {/* Main - Calendrier central */}
        <main className="flex-1 container max-w-7xl mx-auto px-4 py-6 min-h-0 overflow-y-auto">
          <CalendarView
            cycleConfig={cycleConfig}
            counters={counters}
            onRangeSelected={handleRangeSelected}
            history={history}
            onDeleteLeave={deleteHistoryEntry}
            onEditLeave={handleEditLeave}
            resetTrigger={calendarResetTrigger}
          />
          {/* Mentions légales — en bas de la zone scrollable, pas en overlay fixe */}
          <footer className="text-center mt-8 pb-safe-plus-2 flex items-center justify-center gap-4">
            <Link href="/privacy" className="text-xs text-slate-600 hover:text-slate-900 transition-colors">
              Politique de confidentialité
            </Link>
            <span className="text-slate-500 text-xs" aria-hidden="true">·</span>
            <Link href="/cgu" className="text-xs text-slate-600 hover:text-slate-900 transition-colors">
              CGU & Mentions légales
            </Link>
          </footer>
        </main>
      </div>

      {/* Modal Optimisation - PERF-008: Lazy loaded */}
      {showOptimization && (
        <Suspense
          fallback={
            <Dialog open={true}>
              <DialogContent className="max-w-4xl">
                <DialogTitle className="sr-only">Chargement de l&apos;optimisation</DialogTitle>
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                </div>
              </DialogContent>
            </Dialog>
          }
        >
          <OptimizationModal
            isOpen={showOptimization}
            onClose={() => {
              setShowOptimization(false);
              setSelectedRange(null);
              // Reset la sélection du calendrier
              setCalendarResetTrigger(prev => prev + 1);
            }}
            startDate={selectedRange?.start || null}
            endDate={selectedRange?.end || null}
            workingDaysCount={selectedRange?.workingDays || 0}
            counters={counters}
            onApply={handleApplyCombination}
            onEpargneCET={handleEpargneCET}
            onMarkCMO={handleMarkCMO}
            onMarkAstreinte={handleMarkAstreinte}
          />
        </Suspense>
      )}

      {/* Drawer Compteurs */}
      <Suspense fallback={
        showCounters ? (
          <div className="fixed inset-0 z-50 flex items-end justify-center pointer-events-none">
            <div className="w-full h-[85vh] bg-background/80 backdrop-blur-sm border-t border-border rounded-t-2xl flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            </div>
          </div>
        ) : null
      }>
        <CountersDrawer
          isOpen={showCounters}
          onClose={() => setShowCounters(false)}
          counters={counters}
          recommendations={recommendations}
          onUpdateCounters={updateCounters}
          caTotal={getCATotalForCycle(cycleConfig)}
        />
      </Suspense>

      {/* Modal Réglages */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="w-[95vw] max-w-md p-0 bg-background border-0 shadow-2xl rounded-2xl overflow-hidden flex flex-col" style={{ height: '90vh', maxHeight: '90vh' }} showCloseButton={false}>
          <DialogTitle className="sr-only">Paramètres</DialogTitle>
          <Suspense fallback={<div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>}>
            <Settings
              cycleConfig={cycleConfig}
              history={history}
              onReset={reset}
              onShowWelcome={() => { setShowSettings(false); setShowWelcome(true); }}
            />
          </Suspense>
        </DialogContent>
      </Dialog>

      {/* Modal Profil */}
      <Dialog open={showProfile} onOpenChange={setShowProfile}>
        <DialogContent className="w-[95vw] max-w-md p-0 bg-background border-0 shadow-2xl rounded-2xl overflow-hidden flex flex-col" style={{ height: '85vh', maxHeight: '85vh' }} showCloseButton={false}>
          {/* Header */}
          <div
            className="px-6 pt-6 pb-5 text-white shrink-0"
            style={{ background: 'linear-gradient(135deg, #0a1628 0%, #0d2347 55%, #0055A4 100%)' }}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                <User className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-lg font-bold leading-tight text-white">Mon Profil</DialogTitle>
                <p className="text-blue-200 text-xs mt-0.5">Informations de cycle et objectifs</p>
              </div>
              <DialogClose className="shrink-0 w-8 h-8 rounded-xl bg-white/15 hover:bg-white/25 flex items-center justify-center text-white/80 hover:text-white transition-all">
                <X className="w-4 h-4" />
              </DialogClose>
            </div>
            <div className="mt-4 h-[3px] rounded-full" style={{ background: 'linear-gradient(90deg, #0055A4 33%, #ffffff 33%, #ffffff 66%, #EF4135 66%)' }} />
          </div>
          <div className="flex-1 overflow-y-auto overscroll-contain p-6">
          <div className="space-y-6">

            {cycleInfo && (
              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                  <p className="text-sm text-muted-foreground mb-2">Cycle actuel</p>
                  <p className="text-lg font-semibold text-slate-800">
                    Semaine {cycleInfo.currentWeekType}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {cycleInfo.isWorkingToday ? 'Jour de travail' : 'Jour de repos'}
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                  <p className="text-sm text-muted-foreground mb-2">
                    {cycleConfig.type === 'hebdo' ? 'Rythme' : 'Pattern'}
                  </p>
                  <p className="text-lg font-semibold text-slate-800">
                    {cycleConfig.type === 'hebdo' ? 'Hebdomadaire' : (cycleConfig.pattern || 'Personnalisé')}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {cycleConfig.type === 'hebdo' && cycleConfig.heuresSemaine
                      ? `${formatMinutes(getWeeklyMinutes(cycleConfig))} / semaine`
                      : `${Math.floor(cycleConfig.heuresParJour / 60)}h${(cycleConfig.heuresParJour % 60).toString().padStart(2, '0')} par jour`}
                  </p>
                </div>

                {cetProjection && (
                  <Suspense fallback={null}>
                    <Projection
                      currentCET={counters.cet}
                      counters={counters}
                      projection={cetProjection}
                    />
                  </Suspense>
                )}
              </div>
            )}
          </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Popup Bienvenue */}
      <WelcomeModal isOpen={showWelcome} onClose={() => setShowWelcome(false)} />

      {/* Panel Notifications */}
      <Suspense fallback={null}>
        <NotificationsPanel
          isOpen={showNotifications}
          onClose={() => setShowNotifications(false)}
          notifications={notifications}
          onDismiss={dismissNotification}
          onRequestPermission={requestPermission}
          permissionGranted={permissionState.permission === 'granted'}
          isSupported={notificationsSupported}
        />
      </Suspense>
    </div>
  );
}
