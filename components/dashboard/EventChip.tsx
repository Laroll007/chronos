'use client';

import type { PersonalEvent } from '@/lib/types';
import { EVENT_COLORS, eventColor, type EventSlot } from '@/lib/events';
import { cn } from '@/lib/utils';

interface EventChipProps {
  event: PersonalEvent;
  /** Vue Semaine : texte un peu plus grand et heure affichée. */
  large?: boolean;
  /**
   * Vue Mois : position dans une barre sur plusieurs jours. Les bords qui
   * continuent sur la case voisine sont droits et débordent d'un pixel sur le
   * trait de séparation, pour former une barre continue.
   */
  segment?: EventSlot;
  onOpen?: (event: PersonalEvent) => void;
}

/**
 * Événement façon Google Agenda : barre colorée pour un événement sur la
 * journée (ou plusieurs jours), point coloré + titre pour un événement à
 * heure fixe.
 */
export function EventChip({ event, large = false, segment, onOpen }: EventChipProps) {
  const couleur = EVENT_COLORS[eventColor(event)];
  const heure = event.time?.replace(':', 'h');
  const surPlusieursJours = Boolean(event.dateEnd && event.dateEnd > event.date);
  const debut = segment ? segment.debut : true;
  const fin = segment ? segment.fin : true;
  const titreVisible = segment ? segment.titre : true;
  const taille = large
    ? 'text-[11px] leading-4'
    : 'text-[9px] md:text-[11px] leading-[14px] md:leading-4 h-[14px] md:h-4';

  return (
    <div
      className={cn(
        segment?.titre && segment.span > 1 ? 'relative z-20' : 'relative z-10',
        surPlusieursJours ? cn(debut ? 'ml-0.5' : '-ml-px', fin ? 'mr-0.5' : '-mr-px') : 'mx-0.5'
      )}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onOpen?.(event);
        }}
        title={`${heure ? `${heure} · ` : ''}${event.title}`}
        aria-label={`Événement : ${event.title}${heure ? ` à ${heure}` : ''}`}
        className={cn(
          'relative block w-full min-w-0 whitespace-nowrap text-ellipsis text-left px-1 font-medium',
          segment?.titre && segment.span > 1 ? 'overflow-visible' : 'overflow-hidden',
          taille,
          event.time && !surPlusieursJours
            ? 'flex items-center gap-0.5 rounded-[4px] text-slate-700 hover:bg-slate-100'
            : cn(
                couleur.bg,
                'text-white hover:brightness-110',
                debut ? 'rounded-l-[4px]' : 'rounded-l-none',
                fin ? 'rounded-r-[4px]' : 'rounded-r-none'
              )
        )}
      >
        {event.time && !surPlusieursJours ? (
          <>
            <span className={cn('shrink-0 w-1.5 h-1.5 rounded-full', couleur.bg)} aria-hidden="true" />
            {/* L'heure seulement si la place le permet : sur téléphone, le titre d'abord */}
            {large && <span className="hidden md:inline shrink-0 text-slate-500">{heure}</span>}
            <span className="truncate">{event.title}</span>
          </>
        ) : titreVisible && segment && segment.span > 1 ? (
          // Titre étalé sur toute la longueur de la barre dans la semaine
          // (et pas coupé à la largeur d'une case), sans jamais la dépasser.
          <span
            className="absolute inset-y-0 left-1 overflow-hidden text-ellipsis whitespace-nowrap"
            style={{ width: `calc(${segment.span * 100}% + ${segment.span - 1}px - 0.5rem)` }}
          >
            {event.title}
          </span>
        ) : titreVisible ? (
          event.title
        ) : (
          // Suite d'une barre : même hauteur, sans répéter le titre
          ' '
        )}
      </button>
    </div>
  );
}
