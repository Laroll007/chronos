// Calendrier hebdomadaire avec sélection de plage de dates
// PERF-003: Mémoïsé avec React.memo

'use client';

import { useState, useMemo, memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CycleConfig, HistoryEntry } from '@/lib/types';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DateRangeSelection } from './DateRangePicker';
import { isWorkingDay, isSundayWorked, hasPostedLeaveOnDate } from '@/lib/calculations';

interface CalendarWeekProps {
  cycleConfig: CycleConfig;
  dateRange: DateRangeSelection;
  history: HistoryEntry[];
}

const JOURS_COMPLETS = [
  'Lundi',
  'Mardi',
  'Mercredi',
  'Jeudi',
  'Vendredi',
  'Samedi',
  'Dimanche',
];

export const CalendarWeek = memo(function CalendarWeek({ cycleConfig, dateRange, history }: CalendarWeekProps) {
  const today = new Date();
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    // Calculer le début de la semaine (lundi)
    const date = new Date(today);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Ajuster si dimanche
    return new Date(date.setDate(diff));
  });

  // Générer les 7 jours de la semaine
  const weekDays = useMemo(() => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(currentWeekStart);
      date.setDate(currentWeekStart.getDate() + i);

      const working = isWorkingDay(date, cycleConfig);
      const sundayWorked = isSundayWorked(date, cycleConfig);
      const isToday =
        date.getDate() === today.getDate() &&
        date.getMonth() === today.getMonth() &&
        date.getFullYear() === today.getFullYear();

      // Mapper getDay() (0=dim, 1=lun) vers l'index du tableau (0=lun, 6=dim)
      const dayIndex = (date.getDay() + 6) % 7;
      days.push({
        date,
        isWorking: working,
        isSunday: sundayWorked,
        isToday,
        dayName: JOURS_COMPLETS[dayIndex],
      });
    }
    return days;
  }, [currentWeekStart, cycleConfig, today]);

  const goToPrevWeek = () => {
    const newDate = new Date(currentWeekStart);
    newDate.setDate(newDate.getDate() - 7);
    setCurrentWeekStart(newDate);
  };

  const goToNextWeek = () => {
    const newDate = new Date(currentWeekStart);
    newDate.setDate(newDate.getDate() + 7);
    setCurrentWeekStart(newDate);
  };

  const goToThisWeek = () => {
    const date = new Date(today);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    setCurrentWeekStart(new Date(date.setDate(diff)));
  };

  // Format de la période de la semaine
  const weekPeriod = useMemo(() => {
    const start = currentWeekStart;
    const end = new Date(currentWeekStart);
    end.setDate(end.getDate() + 6);

    const startStr = start.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
    });
    const endStr = end.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    return `${startStr} - ${endStr}`;
  }, [currentWeekStart]);

  const workingDaysCount = weekDays.filter((d) => d.isWorking).length;
  const sundaysCount = weekDays.filter((d) => d.isSunday).length;

  return (
    <Card className="glass border-slate-200 h-full flex flex-col">
      <CardHeader className="pb-2 shrink-0">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-blue-600" />
            Semaine
          </CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary" className="bg-blue-100 text-blue-700 border border-blue-200">
              {workingDaysCount}j travaillés
            </Badge>
            {sundaysCount > 0 && (
              <Badge variant="secondary" className="bg-red-100 text-red-700 border border-red-200">
                {sundaysCount} dim
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
        <nav className="flex items-center justify-between mb-4" aria-label="Navigation du calendrier hebdomadaire">
          <Button variant="ghost" size="icon" onClick={goToPrevWeek} className="h-8 w-8" aria-label="Semaine précédente">
            <ChevronLeft className="w-4 h-4" aria-hidden="true" />
          </Button>
          <button
            onClick={goToThisWeek}
            className="font-semibold hover:text-blue-600 transition-colors text-xs md:text-sm"
            aria-label={`Revenir à la semaine actuelle. Actuellement : ${weekPeriod}`}
          >
            {weekPeriod}
          </button>
          <Button variant="ghost" size="icon" onClick={goToNextWeek} className="h-8 w-8" aria-label="Semaine suivante">
            <ChevronRight className="w-4 h-4" aria-hidden="true" />
          </Button>
        </nav>

        {/* Grille des jours - Toujours 7 colonnes, compact */}
        <div className="grid grid-cols-7 gap-1 md:gap-2 flex-1" role="grid" aria-label="Calendrier hebdomadaire">
          {weekDays.map((day, index) => {
            const isInRange = dateRange.isDateInRange(day.date);
            const isSelected = dateRange.isDateSelected(day.date);
            const isHovered =
              dateRange.hoveredDate &&
              day.date.getTime() === dateRange.hoveredDate.getTime();
            const isPosted = hasPostedLeaveOnDate(day.date, history);

            // Construire le label accessible
            const dateLabel = day.date.toLocaleDateString('fr-FR', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            });
            const statusParts: string[] = [];
            if (day.isToday) statusParts.push("aujourd'hui");
            if (day.isWorking) statusParts.push('jour travaillé');
            else statusParts.push('jour de repos');
            if (isPosted) statusParts.push('congé posé');
            if (isSelected) statusParts.push('sélectionné');
            if (isInRange && !isSelected) statusParts.push('dans la sélection');
            const ariaLabel = `${dateLabel}, ${statusParts.join(', ')}`;

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
                aria-current={day.isToday ? 'date' : undefined}
                className={cn(
                  'flex flex-col items-center justify-center p-1 md:p-2 rounded-lg',
                  'transition-all cursor-pointer min-h-[60px] md:min-h-[80px]',
                  // États de sélection - VERT
                  {
                    'ring-2 ring-emerald-500 ring-offset-1': isSelected,
                    'ring-2 ring-emerald-400 ring-dashed': isHovered && !isSelected,
                    'bg-emerald-100': isInRange && !isSelected,
                  },
                  // Jour aujourd'hui - BLEU
                  {
                    'ring-2 ring-blue-500 ring-offset-1':
                      day.isToday && !isSelected && !isHovered,
                  },
                  // Jour avec congé posé - EMERAUDE
                  {
                    'bg-emerald-200 border border-emerald-400 text-emerald-800':
                      isPosted && !isInRange && !isSelected,
                  },
                  // États travail/repos - ROUGE pour travail
                  {
                    'bg-red-100 border border-red-200':
                      day.isWorking && !isInRange && !isSelected && !isPosted,
                    'bg-slate-50 border border-slate-200':
                      !day.isWorking && !isInRange && !isSelected && !isPosted,
                  }
                )}
              >
                <span className="text-[10px] md:text-xs text-slate-500 mb-0.5" aria-hidden="true">{day.dayName.slice(0, 3)}</span>
                <span className="text-lg md:text-2xl font-bold" aria-hidden="true">{day.date.getDate()}</span>
                <span className="text-[10px] md:text-xs mt-0.5 hidden md:block" aria-hidden="true">
                  {day.date.toLocaleDateString('fr-FR', { month: 'short' })}
                </span>
                {day.isWorking && (
                  <Badge
                    variant="secondary"
                    className="mt-1 text-[10px] md:text-xs px-1 py-0 bg-red-100 text-red-700"
                    aria-hidden="true"
                  >
                    T
                  </Badge>
                )}
              </button>
            );
          })}
        </div>

        {/* Légende */}
        <div className="flex items-center justify-center gap-3 md:gap-4 mt-3 text-xs shrink-0 flex-wrap">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-red-100 border border-red-200" />
            <span className="text-slate-600">Travail</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-emerald-200 border border-emerald-400" />
            <span className="text-slate-600">Posé</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded ring-2 ring-emerald-500" />
            <span className="text-slate-600">Sélection</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

CalendarWeek.displayName = 'CalendarWeek';
