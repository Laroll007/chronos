'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CalendarHeart, ChevronRight, Plus } from 'lucide-react';
import type { PersonalEvent } from '@/lib/types';
import { EVENT_CATEGORIES, EVENT_COLORS, eventColor, formatEventWhen, toDayKey } from '@/lib/events';

interface EventListProps {
  events: PersonalEvent[];
  onAdd: () => void;
  onOpen: (event: PersonalEvent) => void;
}

/** « Mes événements » : à venir (ou en cours) d'abord, passés sur demande. */
export function EventList({ events, onAdd, onOpen }: EventListProps) {
  const [showPast, setShowPast] = useState(false);

  const { upcoming, past } = useMemo(() => {
    const today = toDayKey(new Date());
    const sorted = [...events].sort(
      (a, b) => a.date.localeCompare(b.date) || (a.time ?? '').localeCompare(b.time ?? '')
    );
    return {
      upcoming: sorted.filter((e) => (e.dateEnd ?? e.date) >= today),
      // Les plus récents d'abord
      past: sorted.filter((e) => (e.dateEnd ?? e.date) < today).reverse(),
    };
  }, [events]);

  const visible = showPast ? past : upcoming;

  return (
    <Card className="glass">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <CalendarHeart className="w-4 h-4 text-pink-600" />
          Mes événements
          {upcoming.length > 0 && (
            <Badge variant="secondary" className="bg-pink-100 text-pink-700">{upcoming.length}</Badge>
          )}
          <button
            type="button"
            onClick={onAdd}
            className="ml-auto inline-flex items-center gap-1 h-8 px-3 rounded-lg text-sm font-medium text-pink-700 bg-pink-50 border border-pink-200 hover:bg-pink-100 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Ajouter
          </button>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {visible.length === 0 ? (
          <p className="px-4 pb-4 text-sm text-slate-500">
            {showPast
              ? 'Aucun événement passé.'
              : 'RDV, formation, audience… Ajoutez-les ici ou en sélectionnant des jours dans le calendrier.'}
          </p>
        ) : (
          <div className="max-h-[320px] overflow-y-auto">
            <ul className="px-4 pb-3 space-y-2">
              {visible.map((event) => (
                <li key={event.id}>
                  <button
                    type="button"
                    onClick={() => onOpen(event)}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg bg-white/50 border border-slate-200 border-l-4 ${EVENT_COLORS[eventColor(event)].border} hover:bg-white/80 active:bg-white transition-colors text-left`}
                  >
                    <span className="text-lg shrink-0" aria-hidden="true">
                      {EVENT_CATEGORIES[event.category].emoji}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium text-slate-800 truncate">{event.title}</span>
                      <span className="block text-xs text-slate-500 truncate">{formatEventWhen(event)}</span>
                    </span>
                    <ChevronRight className="w-4 h-4 shrink-0 text-slate-400" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {past.length > 0 && (
          <button
            type="button"
            onClick={() => setShowPast((v) => !v)}
            className="w-full px-4 pb-4 text-left text-xs font-medium text-slate-500 hover:text-slate-700"
          >
            {showPast ? '← Événements à venir' : `Voir les événements passés (${past.length})`}
          </button>
        )}
      </CardContent>
    </Card>
  );
}
