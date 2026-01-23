// Calendrier mensuel avec sélection de plage de dates
// PERF-002: Mémoïsé avec React.memo

'use client';

import { useState, useMemo, useRef, useCallback, memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CycleConfig, HistoryEntry } from '@/lib/types';
import { useMonthCalendar } from '@/hooks/useCycle';
import { hasPostedLeaveOnDate } from '@/lib/calculations';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
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

  return (
    <Card className="glass border-slate-200 h-full flex flex-col">
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
              <Badge variant="secondary" className="bg-red-100 text-red-700 border border-red-200">
                {stats.sundays} dim
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
        <nav className="flex items-center justify-between mb-4" aria-label="Navigation du calendrier mensuel">
          <Button
            variant="ghost"
            size="icon"
            onClick={goToPrevMonth}
            className="h-8 w-8"
            aria-label="Mois précédent"
          >
            <ChevronLeft className="w-4 h-4" aria-hidden="true" />
          </Button>
          <button
            onClick={goToToday}
            className="font-semibold hover:text-blue-600 transition-colors"
            aria-label={`Revenir au mois actuel. Actuellement : ${MOIS[month]} ${year}`}
          >
            {MOIS[month]} {year}
          </button>
          <Button
            variant="ghost"
            size="icon"
            onClick={goToNextMonth}
            className="h-8 w-8"
            aria-label="Mois suivant"
          >
            <ChevronRight className="w-4 h-4" aria-hidden="true" />
          </Button>
        </nav>

        {/* Jours de la semaine */}
        <div className="grid grid-cols-7 gap-1 mb-2" role="row" aria-hidden="true">
          {JOURS_COURTS.map((jour) => (
            <div
              key={jour}
              className="text-center text-xs font-medium text-muted-foreground py-2"
            >
              {jour}
            </div>
          ))}
        </div>

        {/* Grille des jours - Compact */}
        <div className="grid grid-cols-7 gap-0.5 flex-1" role="grid" aria-label="Calendrier mensuel">
          {emptyDays.map((_, index) => (
            <div key={`empty-${index}`} className="h-8 md:h-10" role="gridcell" />
          ))}
          {days.map((day, index) => {
            const isCurrentMonth = day.date.getMonth() === month;
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
                ref={(el) => { dayButtonsRef.current[index] = el; }}
                onClick={() => dateRange.handleDateClick(day.date)}
                onKeyDown={(e) => handleKeyDown(e, index)}
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
                tabIndex={day.isToday ? 0 : -1}
                aria-label={ariaLabel}
                aria-selected={isSelected}
                aria-current={day.isToday ? 'date' : undefined}
                className={cn(
                  'h-8 md:h-10 flex items-center justify-center rounded text-xs md:text-sm',
                  'transition-all relative cursor-pointer',
                  'focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2',
                  // États de sélection - VERT
                  {
                    'ring-2 ring-emerald-500 ring-offset-1 ring-offset-background':
                      isSelected,
                    'ring-2 ring-emerald-400 ring-dashed': isHovered && !isSelected,
                    'bg-emerald-100': isInRange && !isSelected,
                  },
                  // Jour aujourd'hui - BLEU
                  {
                    'ring-2 ring-blue-500 ring-offset-1 ring-offset-background':
                      day.isToday && !isSelected && !isHovered,
                  },
                  // Jour avec congé posé - EMERAUDE
                  {
                    'bg-emerald-200 ring-1 ring-emerald-400 text-emerald-800':
                      isPosted && !isInRange && !isSelected,
                  },
                  // États travail/repos - ROUGE pour travail
                  {
                    'bg-red-100 text-red-700 font-semibold':
                      day.isWorking && !isInRange && !isSelected && !isPosted,
                    'text-slate-500 hover:bg-slate-100':
                      !day.isWorking && !isInRange && !isSelected && !isPosted,
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

        {/* Légende */}
        <div className="flex items-center justify-center gap-3 md:gap-4 mt-3 text-xs shrink-0 flex-wrap">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-red-100 border border-red-200" />
            <span className="text-slate-600">Travail</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-emerald-200 ring-1 ring-emerald-400" />
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

CalendarMonth.displayName = 'CalendarMonth';
