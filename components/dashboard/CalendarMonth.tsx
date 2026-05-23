// Calendrier mensuel avec sélection de plage style Booking 2026
// PERF-002: Mémoïsé avec React.memo

'use client';

import { useState, useMemo, useRef, useCallback, memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CycleConfig, HistoryEntry } from '@/lib/types';
import { useMonthCalendar } from '@/hooks/useCycle';
import { hasPostedLeaveOnDate } from '@/lib/calculations';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DateRangeSelection } from './DateRangePicker';

interface CalendarMonthProps {
  cycleConfig: CycleConfig;
  dateRange: DateRangeSelection;
  history: HistoryEntry[];
}

const MOIS = [
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

const JOURS_COURTS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

export const CalendarMonth = memo(function CalendarMonth({ cycleConfig, dateRange, history }: CalendarMonthProps) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const days = useMonthCalendar(cycleConfig, year, month);

  const stats = useMemo(() => {
    const working = days.filter((d) => d.isWorking).length;
    const sundays = days.filter((d) => d.isWorking && d.isSunday).length;
    return { working, sundays };
  }, [days]);


  // Ref pour les boutons des jours (navigation clavier)
  const dayButtonsRef = useRef<(HTMLButtonElement | null)[]>([]);

  // Navigation clavier dans la grille
  const handleKeyDown = useCallback((e: React.KeyboardEvent, currentIndex: number) => {
    const totalDays = days.length;
    let newIndex = currentIndex;

    switch (e.key) {
      case 'ArrowRight':
        e.preventDefault();
        newIndex = currentIndex + 1 < totalDays ? currentIndex + 1 : currentIndex;
        break;
      case 'ArrowLeft':
        e.preventDefault();
        newIndex = currentIndex - 1 >= 0 ? currentIndex - 1 : currentIndex;
        break;
      case 'ArrowDown':
        e.preventDefault();
        newIndex = currentIndex + 7 < totalDays ? currentIndex + 7 : currentIndex;
        break;
      case 'ArrowUp':
        e.preventDefault();
        newIndex = currentIndex - 7 >= 0 ? currentIndex - 7 : currentIndex;
        break;
      case 'Home':
        e.preventDefault();
        newIndex = 0;
        break;
      case 'End':
        e.preventDefault();
        newIndex = totalDays - 1;
        break;
      case 'Escape':
        e.preventDefault();
        dateRange.reset();
        return;
      default:
        return;
    }

    // Focus sur le nouveau jour
    if (newIndex !== currentIndex && dayButtonsRef.current[newIndex]) {
      dayButtonsRef.current[newIndex]?.focus();
    }
  }, [days.length, dateRange]);

  // Ajuster pour que la semaine commence par lundi (0=lundi, 6=dimanche)
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const firstDayOfMonth = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
  const emptyDays = Array(firstDayOfMonth).fill(null);

  const goToPrevMonth = () => {
    if (month === 0) {
      setMonth(11);
      setYear(year - 1);
    } else {
      setMonth(month - 1);
    }
  };

  const goToNextMonth = () => {
    if (month === 11) {
      setMonth(0);
      setYear(year + 1);
    } else {
      setMonth(month + 1);
    }
  };

  const goToToday = () => {
    setYear(today.getFullYear());
    setMonth(today.getMonth());
  };

  // Formater la date pour l'affichage
  const formatDateShort = (date: Date) => {
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
  };

  return (
    <Card className="glass h-full flex flex-col">
      <CardHeader className="pb-2 shrink-0">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-blue-600" />
            Calendrier
          </CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="secondary" className="bg-blue-100 text-blue-700 border border-blue-200">
              {stats.working}j travaillés
            </Badge>
            {stats.sundays > 0 && (
              <Badge variant="secondary" className="bg-rose-100 text-rose-700 border border-rose-200">
                {stats.sundays} dim
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
              <span className="text-xs sm:text-sm text-slate-500 whitespace-nowrap">
                Cliquez sur un jour pour commencer à poser
              </span>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col">
        {/* Navigation */}
        <nav className="flex items-center justify-between mb-4" aria-label="Navigation du calendrier mensuel">
          <Button
            variant="ghost"
            size="icon"
            onClick={goToPrevMonth}
            className="h-8 w-8 hover:bg-blue-50"
            aria-label="Mois précédent"
          >
            <ChevronLeft className="w-4 h-4" aria-hidden="true" />
          </Button>
          <button
            onClick={goToToday}
            className="font-semibold hover:text-blue-600 transition-colors px-3 py-1 rounded-lg hover:bg-blue-50"
            aria-label={`Revenir au mois actuel. Actuellement : ${MOIS[month]} ${year}`}
          >
            {MOIS[month]} {year}
          </button>
          <Button
            variant="ghost"
            size="icon"
            onClick={goToNextMonth}
            className="h-8 w-8 hover:bg-blue-50"
            aria-label="Mois suivant"
          >
            <ChevronRight className="w-4 h-4" aria-hidden="true" />
          </Button>
        </nav>

        {/* Jours de la semaine */}
        <div className="grid grid-cols-7 gap-0 mb-1" role="row" aria-hidden="true">
          {JOURS_COURTS.map((jour) => (
            <div
              key={jour}
              className="text-center text-xs font-medium text-slate-400 py-2"
            >
              {jour}
            </div>
          ))}
        </div>

        {/* Grille des jours - Style Booking avec plage continue */}
        <div className="grid grid-cols-7 gap-y-1 flex-1" role="grid" aria-label="Calendrier mensuel">
          {emptyDays.map((_, index) => (
            <div key={`empty-${index}`} className="h-10 md:h-11" role="gridcell" />
          ))}
          {days.map((day, index) => {
            const isCurrentMonth = day.date.getMonth() === month;
            const isInRange = dateRange.isDateInRange(day.date);
            const isInPreview = dateRange.isInPreview(day.date);
            const isStart = dateRange.isRangeStart(day.date);
            const isEnd = dateRange.isRangeEnd(day.date);
            const isSelected = dateRange.isDateSelected(day.date);
            const isPosted = hasPostedLeaveOnDate(day.date, history);
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
            if (isSelected) statusParts.push('sélectionné');
            if (isInRange && !isSelected) statusParts.push('dans la sélection');
            const ariaLabel = `${dateLabel}, ${statusParts.join(', ')}`;

            // Calculer la position dans la semaine (0-6, lundi=0)
            const dayOfWeek = day.date.getDay();
            const adjustedDayOfWeek = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
            const isFirstOfWeek = adjustedDayOfWeek === 0;
            const isLastOfWeek = adjustedDayOfWeek === 6;

            return (
              <div
                key={index}
                className={cn(
                  'relative h-10 md:h-11',
                  // Fond de la plage - style continu
                  (isInRange || isInPreview) && !isSingleDay && {
                    'bg-emerald-100': !isInPreview,
                    'bg-emerald-50': isInPreview,
                  },
                  // Coins arrondis pour le fond de plage
                  (isInRange || isInPreview) && !isSingleDay && {
                    'rounded-l-full': isStart || isFirstOfWeek,
                    'rounded-r-full': isEnd || isLastOfWeek,
                  }
                )}
              >
                <button
                  ref={(el) => { dayButtonsRef.current[index] = el; }}
                  onClick={() => dateRange.handleDateClick(day.date)}
                  onKeyDown={(e) => handleKeyDown(e, index)}
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
                  tabIndex={day.isToday ? 0 : -1}
                  aria-label={ariaLabel}
                  aria-selected={isSelected}
                  aria-current={day.isToday ? 'date' : undefined}
                  className={cn(
                    'absolute inset-0.5 flex items-center justify-center text-sm font-medium',
                    'transition-all duration-150 ease-out cursor-pointer',
                    'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 focus:z-10',
                    'hover:scale-110 hover:z-10',
                    // Forme de base
                    'rounded-full',
                    // État par défaut (non sélectionné)
                    !isInRange && !isInPreview && !isPosted && {
                      // Jour travaillé
                      'bg-blue-50 text-blue-700 hover:bg-blue-100': day.isWorking && isCurrentMonth,
                      // Jour de repos
                      'text-slate-400 hover:bg-slate-100': !day.isWorking && isCurrentMonth,
                      // Hors mois
                      'opacity-30': !isCurrentMonth,
                    },
                    // Aujourd'hui (non sélectionné)
                    day.isToday && !isInRange && !isInPreview && !isPosted && 'ring-2 ring-blue-500 ring-offset-1',
                    // Congé déjà posé
                    isPosted && !isInRange && !isInPreview && 'bg-emerald-200 text-emerald-800 ring-1 ring-emerald-400',
                    // Dans la plage (preview)
                    isInPreview && !isStart && !isEnd && 'bg-transparent text-emerald-700',
                    // Dans la plage (confirmée)
                    isInRange && !isInPreview && !isStart && !isEnd && 'bg-transparent text-emerald-800',
                    // Début de la plage
                    isStart && !isSingleDay && 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30',
                    // Fin de la plage
                    isEnd && !isSingleDay && 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30',
                    // Jour unique (début = fin)
                    isSingleDay && 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30',
                    // Preview start/end
                    isInPreview && (isStart || isEnd) && !dateRange.selectedEnd && 'bg-emerald-400 text-white shadow-md',
                  )}
                >
                  {day.date.getDate()}
                </button>
              </div>
            );
          })}
        </div>

        {/* Légende minimaliste */}
        <div className="flex items-center justify-center gap-4 mt-3 text-xs shrink-0">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-blue-100 border border-blue-200" />
            <span className="text-slate-500">Travail</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-200 border border-emerald-400" />
            <span className="text-slate-500">Congé</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span className="text-slate-500">Sélection</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

CalendarMonth.displayName = 'CalendarMonth';
