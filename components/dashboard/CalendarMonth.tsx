// Calendrier mensuel avec sélection de plage style Booking 2026
// PERF-002: Mémoïsé avec React.memo

'use client';

import { useState, useMemo, useRef, useCallback, memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CycleConfig, HistoryEntry, JourModifie, PersonalEvent } from '@/lib/types';
import { jourModifieDu } from '@/lib/journees';
import { useMonthCalendar } from '@/hooks/useCycle';
import { hasPostedLeaveOnDate, hasCMOOnDate, hasAstreinteOnDate, getPartialMinutesOnDate } from '@/lib/calculations';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DateRangeSelection } from './DateRangePicker';
import { EventChip } from './EventChip';
import { CalendarLegend, legendFlagsForDays } from './CalendarLegend';
import { eventsOnDate, layoutMonthEvents, toDayKey } from '@/lib/events';

interface CalendarMonthProps {
  cycleConfig: CycleConfig;
  dateRange: DateRangeSelection;
  history: HistoryEntry[];
  events?: PersonalEvent[];
  joursModifies?: JourModifie[];
  onOpenEvent?: (event: PersonalEvent) => void;
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

export const CalendarMonth = memo(function CalendarMonth({ cycleConfig, dateRange, history, events, joursModifies, onOpenEvent }: CalendarMonthProps) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const days = useMonthCalendar(cycleConfig, year, month);

  const stats = useMemo(() => {
    // Jours travaillés = jours du cycle + astreintes posées sur des jours de repos
    const astreinte = days.filter((d) => !d.isWorking && hasAstreinteOnDate(d.date, history)).length;
    const working = days.filter((d) => d.isWorking).length + astreinte;
    const sundays = days.filter((d) => d.isWorking && d.isSunday).length;
    return { working, sundays };
  }, [days, history]);

  // Placement des événements (barres continues, lignes alignées par semaine)
  const eventLayout = useMemo(
    () => layoutMonthEvents(days.filter((d) => d.date.getMonth() === month).map((d) => d.date), events),
    [days, month, events]
  );

  const legendFlags = useMemo(
    () =>
      legendFlagsForDays(
        days.filter((d) => d.date.getMonth() === month),
        history,
        events,
        dateRange.selectedStart !== null,
        joursModifies
      ),
    [days, month, history, events, dateRange.selectedStart, joursModifies]
  );

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

        {/* Grille des jours — cases délimitées façon Google Agenda : le numéro
            (pastille d'état : travail, congé, CMO…) puis les événements, qui
            restent dans leur case ; une barre continue pour plusieurs jours. */}
        <div
          // auto-rows-fr : toutes les semaines prennent la hauteur de la plus
          // chargée → cases identiques (un mois sans événement reste compact).
          className="grid grid-cols-7 auto-rows-fr flex-1 border-t border-l border-slate-200 rounded-lg overflow-hidden"
          role="grid"
          aria-label="Calendrier mensuel"
        >
          {emptyDays.map((_, index) => (
            <div key={`empty-${index}`} className="min-h-11 border-r border-b border-slate-200 bg-slate-50/60" role="gridcell" />
          ))}
          {days.map((day, index) => {
            const isCurrentMonth = day.date.getMonth() === month;
            const isInRange = dateRange.isDateInRange(day.date);
            const isInPreview = dateRange.isInPreview(day.date);
            const isStart = dateRange.isRangeStart(day.date);
            const isEnd = dateRange.isRangeEnd(day.date);
            const isSelected = dateRange.isDateSelected(day.date);
            const isPosted = hasPostedLeaveOnDate(day.date, history);
            const isCMO = !isPosted && hasCMOOnDate(day.date, history);
            const isAstreinte = !isPosted && !isCMO && hasAstreinteOnDate(day.date, history);
            const partialMin = !isPosted && !isCMO && !isAstreinte ? getPartialMinutesOnDate(day.date, history) : 0;
            const isPartial = partialMin > 0;
            const dayEvents = eventsOnDate(day.date, events);
            const jourModifie = jourModifieDu(day.date, joursModifies);
            const layout = eventLayout.get(toDayKey(day.date));

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
            if (dayEvents.length > 0) statusParts.push(`événement : ${dayEvents.map((e) => e.title).join(', ')}`);
            if (jourModifie) statusParts.push(jourModifie.type === 'stage' ? 'stage' : 'horaires modifiés');
            if (isSelected) statusParts.push('sélectionné');
            if (isInRange && !isSelected) statusParts.push('dans la sélection');
            const ariaLabel = `${dateLabel}, ${statusParts.join(', ')}`;

            return (
              <div
                key={index}
                // Toute la case est cliquable (le bouton du numéro garde le
                // clavier et le lecteur d'écran ; son clic remonte ici).
                onClick={() => dateRange.handleDateClick(day.date)}
                onMouseEnter={() => {
                  if (dateRange.isSelecting) dateRange.setHoveredDate(day.date);
                }}
                onMouseLeave={() => {
                  if (dateRange.hoveredDate) dateRange.setHoveredDate(null);
                }}
                className={cn(
                  'relative flex flex-col min-h-11 pb-1 border-r border-b border-slate-200 cursor-pointer transition-colors',
                  !isCurrentMonth && 'opacity-30',
                  // L'état du jour teinte toute la case (plus de pastille ronde,
                  // qui jurait avec les cases et les barres rectangulaires).
                  // La sélection passe devant l'état.
                  isStart || isEnd
                    ? 'bg-emerald-200 ring-2 ring-inset ring-emerald-500'
                    : isInRange || isInPreview
                      ? isInPreview ? 'bg-emerald-50' : 'bg-emerald-100'
                      : isPosted
                        ? 'bg-emerald-100'
                        : isCMO
                          ? 'bg-violet-100'
                          : isAstreinte
                            ? 'bg-amber-100'
                            : isPartial
                              ? 'bg-teal-50'
                              : day.isWorking
                                ? 'bg-blue-100/70 hover:bg-blue-100'
                                : 'bg-white hover:bg-slate-50'
                )}
              >
                <button
                  ref={(el) => { dayButtonsRef.current[index] = el; }}
                  onKeyDown={(e) => handleKeyDown(e, index)}
                  role="gridcell"
                  tabIndex={day.isToday ? 0 : -1}
                  aria-label={ariaLabel}
                  aria-selected={isSelected}
                  aria-current={day.isToday ? 'date' : undefined}
                  className={cn(
                    'relative mx-auto mt-1 h-6 min-w-6 px-1 md:h-7 md:min-w-7 shrink-0 flex items-center justify-center text-xs md:text-sm rounded-md',
                    'transition-colors duration-150',
                    'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 focus:z-10',
                    // Aujourd'hui : numéro dans un carré bleu plein
                    day.isToday
                      ? 'bg-blue-600 text-white font-bold'
                      : isStart || isEnd
                        ? 'text-emerald-900 font-bold'
                        : isPosted
                          ? 'text-emerald-800 font-semibold'
                          : isCMO
                            ? 'text-violet-800 font-semibold'
                            : isAstreinte
                              ? 'text-amber-800 font-semibold'
                              : isPartial
                                ? 'text-teal-800 font-semibold'
                                : day.isWorking
                                  ? 'text-blue-700 font-semibold'
                                  : 'text-slate-400 font-medium',
                  )}
                >
                  {day.date.getDate()}
                  {jourModifie && (
                    <span
                      aria-hidden="true"
                      className={cn(
                        'absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full ring-1 ring-white',
                        jourModifie.type === 'stage' ? 'bg-indigo-600' : 'bg-sky-500'
                      )}
                    />
                  )}
                </button>

                {/* Événements : lignes alignées sur la semaine, 2 au plus puis « +N » */}
                {layout && isCurrentMonth && (
                  <div className="mt-1 space-y-0.5">
                    {layout.lanes.map((slot, i) =>
                      slot ? (
                        <EventChip
                          key={slot.event.id}
                          event={slot.event}
                          segment={slot}
                          onOpen={onOpenEvent}
                        />
                      ) : (
                        <div key={`vide-${i}`} className="h-[14px] md:h-4" aria-hidden="true" />
                      )
                    )}
                    {layout.overflow > 0 && (
                      <span className="block px-1 text-[9px] md:text-[10px] leading-3 font-semibold text-slate-500">
                        +{layout.overflow}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          {/* Cases vides pour terminer la dernière semaine (grille fermée) */}
          {Array.from({ length: (7 - ((emptyDays.length + days.length) % 7)) % 7 }, (_, i) => (
            <div key={`fin-${i}`} className="min-h-11 border-r border-b border-slate-200 bg-slate-50/60" aria-hidden="true" />
          ))}
        </div>

        {/* Légende : uniquement ce qui apparaît ce mois-ci (pastilles carrées,
            comme les cases) */}
        <CalendarLegend flags={legendFlags} shape="square" />
      </CardContent>
    </Card>
  );
});

CalendarMonth.displayName = 'CalendarMonth';
