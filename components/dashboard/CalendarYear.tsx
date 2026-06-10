// Calendrier annuel avec 12 mini-calendriers
// PERF-004: Mémoïsé avec React.memo

'use client';

import { useState, useMemo, memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CycleConfig, HistoryEntry } from '@/lib/types';
import { useMonthCalendar, computeMonthCalendar } from '@/hooks/useCycle';
import { hasPostedLeaveOnDate, hasCMOOnDate, hasAstreinteOnDate } from '@/lib/calculations';
import { ChevronLeft, ChevronRight, CalendarRange } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DateRangeSelection } from './DateRangePicker';

interface CalendarYearProps {
  cycleConfig: CycleConfig;
  dateRange: DateRangeSelection;
  history: HistoryEntry[];
}

const MOIS = [
  'Jan',
  'Fév',
  'Mar',
  'Avr',
  'Mai',
  'Jun',
  'Jul',
  'Aoû',
  'Sep',
  'Oct',
  'Nov',
  'Déc',
];

const MOIS_COMPLETS = [
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre',
];

const JOURS_COURTS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

function MiniMonth({
  year,
  month,
  cycleConfig,
  dateRange,
  history,
}: {
  year: number;
  month: number;
  cycleConfig: CycleConfig;
  dateRange: DateRangeSelection;
  history: HistoryEntry[];
}) {
  const days = useMonthCalendar(cycleConfig, year, month);
  // Ajuster pour que la semaine commence par lundi (0=lundi, 6=dimanche)
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const firstDayOfMonth = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
  const emptyDays = Array(firstDayOfMonth).fill(null);

  return (
    <div className="glass rounded-lg p-1.5 md:p-2" role="region" aria-label={`Calendrier ${MOIS_COMPLETS[month]} ${year}`}>
      {/* Nom du mois */}
      <div className="text-center font-semibold text-[10px] md:text-xs mb-1" aria-hidden="true">{MOIS[month]}</div>

      {/* Jours de la semaine - masqués sur mobile */}
      <div className="hidden md:grid grid-cols-7 gap-px mb-0.5" aria-hidden="true">
        {JOURS_COURTS.map((jour, i) => (
          <div
            key={i}
            className="text-center text-[8px] text-slate-400 font-medium"
          >
            {jour}
          </div>
        ))}
      </div>

      {/* Grille des jours - ultra compact */}
      <div className="grid grid-cols-7 gap-px" role="grid">
        {emptyDays.map((_, index) => (
          <div key={`empty-${index}`} className="h-3 md:h-4" role="gridcell" />
        ))}
        {days.map((day, index) => {
          const isCurrentMonth = day.date.getMonth() === month;
          const isInRange = dateRange.isDateInRange(day.date);
          const isSelected = dateRange.isDateSelected(day.date);
          const isPosted = hasPostedLeaveOnDate(day.date, history);
          const isCMO = !isPosted && hasCMOOnDate(day.date, history);
          const isAstreinte = !isPosted && !isCMO && hasAstreinteOnDate(day.date, history);

          // Label accessible simplifié pour vue annuelle
          const ariaLabel = `${day.date.getDate()} ${MOIS_COMPLETS[day.date.getMonth()]}${day.isWorking ? ', travaillé' : ''}${isPosted ? ', congé posé' : ''}${isCMO ? ', arrêt maladie' : ''}${isAstreinte ? ', astreinte' : ''}${isSelected ? ', sélectionné' : ''}`;

          return (
            <button
              key={index}
              onClick={() => dateRange.handleDateClick(day.date)}
              onMouseEnter={() => {
                if (dateRange.selectedStart && !dateRange.selectedEnd) {
                  dateRange.setHoveredDate(day.date);
                }
              }}
              onMouseLeave={() => {
                if (dateRange.hoveredDate) {
                  dateRange.setHoveredDate(null);
                }
              }}
              role="gridcell"
              aria-label={ariaLabel}
              aria-selected={isSelected}
              className={cn(
                'h-3 md:h-4 flex items-center justify-center rounded-sm text-[8px] md:text-[10px]',
                'transition-all cursor-pointer',
                // États de sélection - VERT
                {
                  'ring-1 ring-emerald-500': isSelected,
                  'bg-emerald-100': isInRange && !isSelected,
                },
                // Jour aujourd'hui - INDIGO
                {
                  'ring-1 ring-blue-500': day.isToday && !isSelected,
                },
                // Jour avec congé posé - EMERAUDE
                {
                  'bg-emerald-200 text-emerald-800':
                    isPosted && !isInRange && !isSelected,
                },
                // Arrêt maladie (CMO) - VIOLET
                {
                  'bg-violet-200 text-violet-800':
                    isCMO && !isInRange && !isSelected,
                },
                // Astreinte / permanence - AMBRE
                {
                  'bg-amber-200 text-amber-800':
                    isAstreinte && !isInRange && !isSelected,
                },
                // États travail/repos - INDIGO pour travail
                {
                  'bg-blue-100 text-blue-700 font-bold':
                    day.isWorking && !isInRange && !isSelected && !isPosted && !isCMO && !isAstreinte,
                  'text-slate-400': !day.isWorking && !isInRange && !isSelected && !isPosted && !isCMO && !isAstreinte,
                },
                // Mois courant
                {
                  'opacity-30': !isCurrentMonth,
                }
              )}
            >
              {day.date.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export const CalendarYear = memo(function CalendarYear({ cycleConfig, dateRange, history }: CalendarYearProps) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());

  // Calculer statistiques annuelles
  const yearStats = useMemo(() => {
    let totalWorking = 0;
    let totalSundays = 0;

    for (let month = 0; month < 12; month++) {
      const days = computeMonthCalendar(cycleConfig, year, month);
      totalWorking += days.filter((d) => d.isWorking).length;
      totalSundays += days.filter((d) => d.isWorking && d.isSunday).length;
    }

    return { working: totalWorking, sundays: totalSundays };
  }, [year, cycleConfig]);

  const goToPrevYear = () => setYear(year - 1);
  const goToNextYear = () => setYear(year + 1);
  const goToThisYear = () => setYear(today.getFullYear());

  return (
    <Card className="glass h-full flex flex-col">
      <CardHeader className="pb-2 shrink-0">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <CalendarRange className="w-5 h-5 text-blue-600" />
            Année
          </CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary" className="bg-blue-100 text-blue-700 border border-blue-200">
              {yearStats.working}j travaillés
            </Badge>
            {yearStats.sundays > 0 && (
              <Badge variant="secondary" className="bg-rose-100 text-rose-700 border border-rose-200">
                {yearStats.sundays} dim
              </Badge>
            )}
            {dateRange.workingDaysCount > 0 && (
              <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 border border-emerald-200">
                {dateRange.workingDaysCount}j sélectionnés
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col">
        {/* Navigation */}
        <nav className="flex items-center justify-between mb-3" aria-label="Navigation du calendrier annuel">
          <Button variant="ghost" size="icon" onClick={goToPrevYear} className="h-8 w-8" aria-label="Année précédente">
            <ChevronLeft className="w-4 h-4" aria-hidden="true" />
          </Button>
          <button
            onClick={goToThisYear}
            className="font-semibold hover:text-blue-600 transition-colors"
            aria-label={`Revenir à l'année actuelle. Actuellement : ${year}`}
          >
            {year}
          </button>
          <Button variant="ghost" size="icon" onClick={goToNextYear} className="h-8 w-8" aria-label="Année suivante">
            <ChevronRight className="w-4 h-4" aria-hidden="true" />
          </Button>
        </nav>

        {/* Grille 12 mois - SANS SCROLL */}
        <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 flex-1">
          {Array.from({ length: 12 }, (_, month) => (
            <MiniMonth
              key={month}
              year={year}
              month={month}
              cycleConfig={cycleConfig}
              dateRange={dateRange}
              history={history}
            />
          ))}
        </div>

        {/* Légende */}
        <div className="flex items-center justify-center gap-3 md:gap-4 mt-3 text-xs shrink-0 flex-wrap">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-blue-100 border border-blue-200" />
            <span className="text-slate-600">Travail</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-emerald-200" />
            <span className="text-slate-600">Posé</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-violet-200" />
            <span className="text-slate-600">CMO</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-amber-200" />
            <span className="text-slate-600">Astreinte</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded ring-1 ring-emerald-500" />
            <span className="text-slate-600">Sélection</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

CalendarYear.displayName = 'CalendarYear';
