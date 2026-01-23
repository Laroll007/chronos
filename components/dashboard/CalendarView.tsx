// Composant central orchestrant l'affichage du calendrier et la sélection de dates

'use client';

import { useState } from 'react';
import { CycleConfig, HistoryEntry } from '@/lib/types';
import { useDateRangePicker } from './DateRangePicker';
import { CalendarMonth } from './CalendarMonth';
import { CalendarWeek } from './CalendarWeek';
import { CalendarYear } from './CalendarYear';
import { Button } from '@/components/ui/button';
import { Calendar, CalendarDays, CalendarRange } from 'lucide-react';
import { toast } from 'sonner';

type ViewMode = 'month' | 'week' | 'year';

interface CalendarViewProps {
  cycleConfig: CycleConfig;
  onRangeSelected: (start: Date, end: Date, workingDays: number) => void;
  history: HistoryEntry[];
}

export function CalendarView({ cycleConfig, onRangeSelected, history }: CalendarViewProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('month');

  // Hook de sélection de plage
  const dateRange = useDateRangePicker(cycleConfig, (start, end, workingDays) => {
    // Callback déclenché quand une plage est sélectionnée
    if (workingDays > 0) {
      onRangeSelected(start, end, workingDays);
    } else {
      // Aucun jour travaillé dans la période - Toast accessible
      toast.error('Aucun jour travaillé', {
        description: 'Sélectionnez une période contenant au moins 1 jour travaillé.',
      });
      dateRange.reset();
    }
  });

  return (
    <div className="h-full flex flex-col gap-4">
      {/* Switcher de vue (pour Phase 6 : Semaine/Année) */}
      <div className="flex items-center justify-center gap-2" role="tablist" aria-label="Mode d'affichage du calendrier">
        <Button
          variant={viewMode === 'month' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setViewMode('month')}
          className="flex items-center gap-2"
          role="tab"
          aria-selected={viewMode === 'month'}
          aria-label="Affichage mensuel"
        >
          <Calendar className="w-4 h-4" aria-hidden="true" />
          <span className="hidden sm:inline">Mois</span>
        </Button>
        <Button
          variant={viewMode === 'week' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setViewMode('week')}
          className="flex items-center gap-2"
          role="tab"
          aria-selected={viewMode === 'week'}
          aria-label="Affichage hebdomadaire"
        >
          <CalendarDays className="w-4 h-4" aria-hidden="true" />
          <span className="hidden sm:inline">Semaine</span>
        </Button>
        <Button
          variant={viewMode === 'year' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setViewMode('year')}
          className="flex items-center gap-2"
          role="tab"
          aria-selected={viewMode === 'year'}
          aria-label="Affichage annuel"
        >
          <CalendarRange className="w-4 h-4" aria-hidden="true" />
          <span className="hidden sm:inline">Année</span>
        </Button>
      </div>

      {/* Vue calendrier avec animations */}
      <div className="flex-1 min-h-0">
        {viewMode === 'month' && (
          <div className="animate-in fade-in-0 slide-in-from-bottom-4 duration-300">
            <CalendarMonth cycleConfig={cycleConfig} dateRange={dateRange} history={history} />
          </div>
        )}
        {viewMode === 'week' && (
          <div className="animate-in fade-in-0 slide-in-from-bottom-4 duration-300">
            <CalendarWeek cycleConfig={cycleConfig} dateRange={dateRange} history={history} />
          </div>
        )}
        {viewMode === 'year' && (
          <div className="animate-in fade-in-0 slide-in-from-bottom-4 duration-300">
            <CalendarYear cycleConfig={cycleConfig} dateRange={dateRange} history={history} />
          </div>
        )}
      </div>

      {/* Info sélection en cours - aria-live pour screen readers */}
      <div aria-live="polite" aria-atomic="true" className="text-center text-sm text-muted-foreground">
        {dateRange.selectedStart && !dateRange.selectedEnd && (
          <span className="animate-pulse">
            Cliquez sur une date de fin pour valider la sélection
          </span>
        )}
      </div>
    </div>
  );
}
