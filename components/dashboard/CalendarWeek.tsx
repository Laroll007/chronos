// Calendrier hebdomadaire avec sélection de plage style Booking 2026
// PERF-003: Mémoïsé avec React.memo

'use client';

import { useState, useMemo, memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CycleConfig, HistoryEntry } from '@/lib/types';
import { ChevronLeft, ChevronRight, CalendarDays, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DateRangeSelection } from './DateRangePicker';
import { isWorkingDay, isSundayWorked, hasPostedLeaveOnDate, hasCMOOnDate, hasAstreinteOnDate, getPartialMinutesOnDate } from '@/lib/calculations';

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

  // Formater la date pour l'affichage
  const formatDateShort = (date: Date) => {
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  };

  return (
    <Card className="glass h-full flex flex-col">
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
              <Badge variant="secondary" className="bg-rose-100 text-rose-700 border border-rose-200">
                {sundaysCount} dim
              </Badge>
            )}
          </div>
        </div>

        {/* Barre de sélection style Booking */}
        <div className="mt-3">
          {dateRange.isSelecting ? (
            // Mode sélection en cours
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 animate-in fade-in-0 slide-in-from-top-2 duration-200">
              <div className="flex items-center gap-2 flex-wrap min-w-0">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                  <span className="text-xs sm:text-sm font-medium text-emerald-800">
                    {formatDateShort(dateRange.selectedStart!)}
                  </span>
                </div>
                <span className="text-emerald-400 text-xs">→</span>
                <span className="text-xs sm:text-sm text-emerald-600">
                  {dateRange.hoveredDate
                    ? formatDateShort(dateRange.hoveredDate)
                    : 'Choisir fin'
                  }
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {dateRange.previewWorkingDays > 0 && (
                  <Badge className="bg-emerald-500 text-white border-0 text-xs animate-in zoom-in-95 duration-150">
                    {dateRange.previewWorkingDays}j
                  </Badge>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={dateRange.reset}
                  className="h-7 w-7 p-0 hover:bg-emerald-200 text-emerald-600"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ) : dateRange.selectedEnd ? (
            // Sélection confirmée
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-gradient-to-r from-emerald-100 to-teal-100 border border-emerald-300 animate-in fade-in-0 duration-200">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-600 shrink-0" />
                <span className="text-xs sm:text-sm font-medium text-emerald-800">
                  {formatDateShort(dateRange.selectedStart!)} → {formatDateShort(dateRange.selectedEnd)}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge className="bg-emerald-600 text-white border-0 text-xs">
                  {dateRange.workingDaysCount}j travaillés
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={dateRange.reset}
                  className="h-7 w-7 p-0 hover:bg-emerald-200 text-emerald-700"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ) : (
            // Aucune sélection
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-center">
              <span className="text-sm text-slate-500">
                Cliquez sur un jour pour commencer
              </span>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col">
        {/* Navigation */}
        <nav className="flex items-center justify-between mb-4" aria-label="Navigation du calendrier hebdomadaire">
          <Button variant="ghost" size="icon" onClick={goToPrevWeek} className="h-8 w-8 hover:bg-blue-50" aria-label="Semaine précédente">
            <ChevronLeft className="w-4 h-4" aria-hidden="true" />
          </Button>
          <button
            onClick={goToThisWeek}
            className="font-semibold hover:text-blue-600 transition-colors text-xs md:text-sm px-3 py-1 rounded-lg hover:bg-blue-50"
            aria-label={`Revenir à la semaine actuelle. Actuellement : ${weekPeriod}`}
          >
            {weekPeriod}
          </button>
          <Button variant="ghost" size="icon" onClick={goToNextWeek} className="h-8 w-8 hover:bg-blue-50" aria-label="Semaine suivante">
            <ChevronRight className="w-4 h-4" aria-hidden="true" />
          </Button>
        </nav>

        {/* Grille des jours - Style Booking */}
        <div className="grid grid-cols-7 gap-1 flex-1" role="grid" aria-label="Calendrier hebdomadaire">
          {weekDays.map((day, index) => {
            const isInRange = dateRange.isDateInRange(day.date);
            const isInPreview = dateRange.isInPreview(day.date);
            const isStart = dateRange.isRangeStart(day.date);
            const isEnd = dateRange.isRangeEnd(day.date);
            const isSelected = dateRange.isDateSelected(day.date);
            const isPosted = hasPostedLeaveOnDate(day.date, history);
            const isCMO = !isPosted && hasCMOOnDate(day.date, history);
            const isAstreinte = !isPosted && !isCMO && hasAstreinteOnDate(day.date, history);
            const isPartial = !isPosted && !isCMO && !isAstreinte && getPartialMinutesOnDate(day.date, history) > 0;
            const isSingleDay = isStart && isEnd;

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
            if (isCMO) statusParts.push('arrêt maladie');
            if (isAstreinte) statusParts.push('astreinte');
            if (isPartial) statusParts.push('heures posées');
            if (isSelected) statusParts.push('sélectionné');
            if (isInRange && !isSelected) statusParts.push('dans la sélection');
            const ariaLabel = `${dateLabel}, ${statusParts.join(', ')}`;

            // Position dans la semaine
            const isFirstOfWeek = index === 0;
            const isLastOfWeek = index === 6;

            return (
              <div
                key={index}
                className={cn(
                  'relative min-h-[70px] md:min-h-[90px]',
                  // Fond de la plage - style continu
                  (isInRange || isInPreview) && !isSingleDay && {
                    'bg-emerald-100': !isInPreview,
                    'bg-emerald-50': isInPreview,
                  },
                  // Coins arrondis pour le fond de plage
                  (isInRange || isInPreview) && !isSingleDay && {
                    'rounded-l-2xl': isStart || isFirstOfWeek,
                    'rounded-r-2xl': isEnd || isLastOfWeek,
                  }
                )}
              >
                <button
                  onClick={() => dateRange.handleDateClick(day.date)}
                  onMouseEnter={() => {
                    if (dateRange.isSelecting) {
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
                    'absolute inset-1 flex flex-col items-center justify-center rounded-xl',
                    'transition-all duration-150 ease-out cursor-pointer',
                    'hover:scale-105 hover:z-10',
                    // État par défaut (non sélectionné)
                    !isInRange && !isInPreview && !isPosted && !isCMO && !isAstreinte && !isPartial && {
                      'bg-blue-50 border border-blue-100': day.isWorking,
                      'bg-slate-50 border border-slate-100': !day.isWorking,
                    },
                    // Aujourd'hui (non sélectionné)
                    day.isToday && !isInRange && !isInPreview && !isPosted && !isCMO && !isAstreinte && !isPartial && 'ring-2 ring-blue-500 ring-offset-1',
                    // Congé déjà posé
                    isPosted && !isInRange && !isInPreview && 'bg-emerald-200 border border-emerald-300',
                    // Arrêt maladie (CMO)
                    isCMO && !isInRange && !isInPreview && 'bg-violet-200 border border-violet-300',
                    // Astreinte / permanence
                    isAstreinte && !isInRange && !isInPreview && 'bg-amber-200 border border-amber-300',
                    // Pose fractionnée (sortie anticipée)
                    isPartial && !isInRange && !isInPreview && 'bg-teal-100 border border-teal-300',
                    // Dans la plage (preview ou confirmée)
                    (isInPreview || isInRange) && !isStart && !isEnd && 'bg-transparent',
                    // Début ou fin de la plage
                    (isStart || isEnd) && 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30',
                    // Jour unique
                    isSingleDay && 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30',
                    // Preview start/end
                    isInPreview && (isStart || isEnd) && !dateRange.selectedEnd && 'bg-emerald-400 text-white shadow-md',
                  )}
                >
                  <span
                    className={cn(
                      'text-[10px] md:text-xs mb-0.5',
                      (isStart || isEnd || isSingleDay) ? 'text-emerald-100' : 'text-slate-400'
                    )}
                    aria-hidden="true"
                  >
                    {day.dayName.slice(0, 3)}
                  </span>
                  <span
                    className={cn(
                      'text-base md:text-xl font-bold',
                      (isStart || isEnd || isSingleDay) ? 'text-white' : (isInRange || isInPreview) ? 'text-emerald-800' : day.isWorking ? 'text-blue-700' : 'text-slate-500'
                    )}
                    aria-hidden="true"
                  >
                    {day.date.getDate()}
                  </span>
                  <span
                    className={cn(
                      'text-[10px] md:text-xs mt-0.5 hidden md:block',
                      (isStart || isEnd || isSingleDay) ? 'text-emerald-100' : 'text-slate-400'
                    )}
                    aria-hidden="true"
                  >
                    {day.date.toLocaleDateString('fr-FR', { month: 'short' })}
                  </span>
                  {day.isWorking && !isStart && !isEnd && !isSingleDay && (
                    <Badge
                      variant="secondary"
                      className={cn(
                        'mt-1 text-[10px] px-1.5 py-0',
                        (isInRange || isInPreview) ? 'bg-emerald-200 text-emerald-700' : 'bg-blue-100 text-blue-600'
                      )}
                      aria-hidden="true"
                    >
                      T
                    </Badge>
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {/* Légende minimaliste */}
        <div className="flex items-center justify-center gap-4 mt-3 text-xs shrink-0">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded bg-blue-50 border border-blue-200" />
            <span className="text-slate-500">Travail</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded bg-emerald-200 border border-emerald-300" />
            <span className="text-slate-500">Congé</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded bg-violet-200 border border-violet-300" />
            <span className="text-slate-500">CMO</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded bg-amber-200 border border-amber-300" />
            <span className="text-slate-500">Astreinte</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded bg-teal-100 border border-teal-300" />
            <span className="text-slate-500">Heures</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded bg-emerald-500" />
            <span className="text-slate-500">Sélection</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

CalendarWeek.displayName = 'CalendarWeek';
