'use client';

import type { PersonalEvent } from '@/lib/types';
import { EVENT_COLORS, eventColor } from '@/lib/events';
import { cn } from '@/lib/utils';

interface EventChipProps {
  event: PersonalEvent;
  /** Vue Semaine : texte un peu plus grand et heure affichée. */
  large?: boolean;
  onOpen?: (event: PersonalEvent) => void;
}

/**
 * Événement façon Google Agenda : barre colorée pour un événement sur la
 * journée, point coloré + heure + titre pour un événement à heure fixe.
 */
export function EventChip({ event, large = false, onOpen }: EventChipProps) {
  const couleur = EVENT_COLORS[eventColor(event)];
  const heure = event.time?.replace(':', 'h');
  const taille = large ? 'text-[11px] leading-4' : 'text-[9px] md:text-[11px] leading-[14px] md:leading-4';

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onOpen?.(event);
      }}
      title={`${heure ? `${heure} · ` : ''}${event.title}`}
      aria-label={`Événement : ${event.title}${heure ? ` à ${heure}` : ''}`}
      className={cn(
        'block w-full min-w-0 truncate text-left rounded-[5px] px-1 font-medium',
        taille,
        event.time
          ? 'flex items-center gap-0.5 text-slate-700 hover:bg-slate-100'
          : cn(couleur.bg, 'text-white hover:brightness-110')
      )}
    >
      {event.time && (
        <>
          <span className={cn('shrink-0 w-1.5 h-1.5 rounded-full', couleur.bg)} aria-hidden="true" />
          {/* L'heure seulement si la place le permet : sur téléphone, le titre d'abord */}
          {large && <span className="hidden md:inline shrink-0 text-slate-500">{heure}</span>}
          <span className="truncate">{event.title}</span>
        </>
      )}
      {!event.time && event.title}
    </button>
  );
}
