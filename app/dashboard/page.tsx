'use client';

import { useEffect, useState, useCallback, lazy, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { SimpleHeader } from '@/components/dashboard/SimpleHeader';
import { CalendarView } from '@/components/dashboard/CalendarView';
import { CountersDrawer } from '@/components/dashboard/CountersDrawer';
import { NotificationsPanel } from '@/components/dashboard/NotificationsPanel';

// PERF-008: Lazy load OptimizationModal
const OptimizationModal = lazy(() =>
  import('@/components/dashboard/OptimizationModal').then((mod) => ({
    default: mod.OptimizationModal,
  }))
);
import { Settings } from '@/components/dashboard/Settings';
import { Projection } from '@/components/dashboard/Projection';
import { useCounters } from '@/hooks/useCounters';
import { useRecommendations } from '@/hooks/useRecommendations';
import { useNotifications } from '@/hooks/useNotifications';
import { useCycle } from '@/hooks/useCycle';
import { Combination } from '@/lib/types';
import { Loader2, User } from 'lucide-react';
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

  const {
    counters,
    cycleConfig,
    history,
    isLoading,
    isOnboarded,
    updateCounters,
    poseConge,
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

  // PERF-001: useCallback pour éviter les re-renders
  const handleRangeSelected = useCallback((start: Date, end: Date, workingDays: number) => {
    setSelectedRange({ start, end, workingDays });
    setShowOptimization(true);
  }, []);

  // PERF-001: useCallback sur handleApplyCombination
  const handleApplyCombination = useCallback((combination: Combination) => {
    // Appliquer chaque item de la combinaison
    try {
      for (const item of combination.items) {
        if (item.amountMinutes) {
          // Types en minutes (CF, RTC, RPS, HS)
          poseConge(item.type, item.amountMinutes, selectedRange!.start);
        } else {
          // Types en jours (CA, CA HP)
          poseConge(item.type, item.amount, selectedRange!.start);
        }
      }

      toast.success('Congés posés avec succès !', {
        description: `${combination.totalDays} jour${
          combination.totalDays > 1 ? 's' : ''
        } enregistré${combination.totalDays > 1 ? 's' : ''}`,
      });

      setShowOptimization(false);
      setSelectedRange(null);
    } catch (error) {
      toast.error('Erreur lors de la pose des congés', {
        description:
          error instanceof Error ? error.message : 'Une erreur est survenue',
      });
    }
  }, [poseConge, selectedRange]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/30">
      {/* Background effects - Subtils bleu/rouge patriotique */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 -left-1/4 w-1/2 h-1/2 bg-blue-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 -right-1/4 w-1/2 h-1/2 bg-red-500/5 rounded-full blur-3xl" />
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
        <main className="flex-1 container max-w-7xl mx-auto px-4 py-6 min-h-0">
          <CalendarView
            cycleConfig={cycleConfig}
            onRangeSelected={handleRangeSelected}
            history={history}
          />
        </main>
      </div>

      {/* Modal Optimisation - PERF-008: Lazy loaded */}
      {showOptimization && (
        <Suspense
          fallback={
            <Dialog open={true}>
              <DialogContent className="max-w-4xl">
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
            }}
            startDate={selectedRange?.start || null}
            endDate={selectedRange?.end || null}
            workingDaysCount={selectedRange?.workingDays || 0}
            counters={counters}
            onApply={handleApplyCombination}
          />
        </Suspense>
      )}

      {/* Drawer Compteurs */}
      <CountersDrawer
        isOpen={showCounters}
        onClose={() => setShowCounters(false)}
        counters={counters}
        recommendations={recommendations}
      />

      {/* Modal Réglages */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="max-w-md glass border-slate-200">
          <Settings
            counters={counters}
            cycleConfig={cycleConfig}
            history={history}
            onUpdateCounters={updateCounters}
            onReset={reset}
          />
        </DialogContent>
      </Dialog>

      {/* Modal Profil */}
      <Dialog open={showProfile} onOpenChange={setShowProfile}>
        <DialogContent className="max-w-md glass border-slate-200">
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-full bg-blue-100">
                <User className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-800">Mon Profil</h2>
                <p className="text-sm text-muted-foreground">
                  Informations de cycle et objectifs
                </p>
              </div>
            </div>

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
                  <p className="text-sm text-muted-foreground mb-2">Pattern</p>
                  <p className="text-lg font-semibold text-slate-800">
                    {cycleConfig.pattern || 'Personnalisé'}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {Math.floor(cycleConfig.heuresParJour / 60)}h
                    {(cycleConfig.heuresParJour % 60)
                      .toString()
                      .padStart(2, '0')}{' '}
                    par jour
                  </p>
                </div>

                {cetProjection && (
                  <Projection
                    currentCET={counters.cet}
                    objectifCET={counters.objectifCET}
                    projection={cetProjection}
                  />
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Panel Notifications */}
      <NotificationsPanel
        isOpen={showNotifications}
        onClose={() => setShowNotifications(false)}
        notifications={notifications}
        onDismiss={dismissNotification}
        onRequestPermission={requestPermission}
        permissionGranted={permissionState.permission === 'granted'}
        isSupported={notificationsSupported}
      />
    </div>
  );
}
