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
 * Événement sur le planning : toujours la même barre colorée (titre en blanc),
 * qu'il soit à heure fixe, sur la journée ou sur plusieurs jours. L'heure
 * précède le titre quand la place le permet (vue Semaine, grand écran).
 */
export function EventChip({ event, large = false, segment, onOpen }: EventChipProps) {
  const couleur = EVENT_COLORS[eventColor(event)];
  const heure = event.time?.replace(':', 'h');
  const surPlusieursJours = Boolean(event.dateEnd && event.dateEnd > event.date);
  const debut = segment ? segment.debut : true;
  const fin = segment ? segment.fin : true;
  const titreVisible = segment ? segment.titre : true;
  const taille = large
    ? 'text-[11px] md:text-xs leading-[18px] h-[18px]'
    : 'text-[10.5px] md:text-xs leading-[17px] md:leading-5 h-[17px] md:h-5';
  // Heure : en vue Semaine, et en vue Mois sur grand écran seulement.
  const heureAffichee = heure && !surPlusieursJours && (
    <span className="hidden md:inline shrink-0 font-normal opacity-90 mr-1">{heure}</span>
  );

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
          // Titre coupé net (sans « … ») : une ou deux lettres de plus sur téléphone.
          'relative flex items-center w-full min-w-0 whitespace-nowrap text-left px-1 font-semibold text-white hover:brightness-110',
          segment?.titre && segment.span > 1 ? 'overflow-visible' : 'overflow-hidden',
          taille,
          couleur.bg,
          debut ? 'rounded-l-[4px]' : 'rounded-l-none',
          fin ? 'rounded-r-[4px]' : 'rounded-r-none'
        )}
      >
        {titreVisible && segment && segment.span > 1 ? (
          // Titre étalé sur toute la longueur de la barre dans la semaine
          // (et pas coupé à la largeur d'une case), sans jamais la dépasser.
          <span
            className="absolute inset-y-0 left-1 flex items-center overflow-hidden whitespace-nowrap"
            style={{ width: `calc(${segment.span * 100}% + ${segment.span - 1}px - 0.5rem)` }}
          >
            {event.title}
          </span>
        ) : titreVisible ? (
          <>
            {heureAffichee}
            <span className="overflow-hidden">{event.title}</span>
          </>
        ) : (
          // Suite d'une barre : même hauteur, sans répéter le titre
          ' '
        )}
      </button>
    </div>
  );
}
