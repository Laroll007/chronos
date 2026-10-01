'use client';

import type { HistoryEntry, JourModifie, PersonalEvent } from '@/lib/types';
import { jourModifieDu } from '@/lib/journees';
import { hasPostedLeaveOnDate, hasCMOOnDate, hasAstreinteOnDate, getPartialMinutesOnDate } from '@/lib/calculations';
import { eventsOnDate } from '@/lib/events';
import { cn } from '@/lib/utils';

export interface LegendFlags {
  travail: boolean;
  conge: boolean;
  cmo: boolean;
  astreinte: boolean;
  heures: boolean;
  evenement: boolean;
  stage: boolean;
  horaires: boolean;
  selection: boolean;
}

/**
 * Éléments de légende réellement visibles sur la période affichée : une légende
 * listant CMO, astreinte, heures… jamais présents alourdissait la page et
 * débordait du cadre sur téléphone.
 * Même priorité d'affichage que les cases (congé > CMO > astreinte > heures).
 */
export function legendFlagsForDays(
  days: { date: Date; isWorking: boolean }[],
  history: HistoryEntry[],
  events: PersonalEvent[] | undefined,
  hasSelection: boolean,
  joursModifies?: JourModifie[]
): LegendFlags {
  const flags: LegendFlags = {
    travail: false, conge: false, cmo: false, astreinte: false, heures: false,
    evenement: false, stage: false, horaires: false, selection: hasSelection,
  };
  for (const { date, isWorking } of days) {
    if (isWorking) flags.travail = true;
    if (hasPostedLeaveOnDate(date, history)) flags.conge = true;
    else if (hasCMOOnDate(date, history)) flags.cmo = true;
    else if (hasAstreinteOnDate(date, history)) flags.astreinte = true;
    else if (getPartialMinutesOnDate(date, history) > 0) flags.heures = true;
    if (!flags.evenement && eventsOnDate(date, events).length > 0) flags.evenement = true;
    const jm = jourModifieDu(date, joursModifies);
    if (jm?.type === 'stage') flags.stage = true;
    else if (jm) flags.horaires = true;
  }
  return flags;
}

const ITEMS: { key: keyof LegendFlags; label: string; swatch: string }[] = [
  { key: 'travail', label: 'Travail', swatch: 'bg-blue-100 border border-blue-200' },
  { key: 'conge', label: 'Congé', swatch: 'bg-emerald-200 border border-emerald-400' },
  { key: 'cmo', label: 'CMO', swatch: 'bg-violet-200 border border-violet-400' },
  { key: 'astreinte', label: 'Astreinte', swatch: 'bg-amber-200 border border-amber-400' },
  { key: 'heures', label: 'Heures', swatch: 'bg-teal-100 border border-teal-400' },
  { key: 'evenement', label: 'Événement', swatch: 'bg-pink-500' },
  { key: 'stage', label: 'Stage', swatch: 'bg-indigo-600' },
  { key: 'horaires', label: 'Horaires modifiés', swatch: 'bg-sky-500' },
  { key: 'selection', label: 'Sélection', swatch: 'bg-emerald-500' },
];

export function CalendarLegend({ flags, shape = 'round' }: { flags: LegendFlags; shape?: 'round' | 'square' }) {
  const visible = ITEMS.filter((item) => flags[item.key]);
  if (visible.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 mt-3 text-xs shrink-0">
      {visible.map((item) => (
        <div key={item.key} className="flex items-center gap-1.5">
          <div
            className={cn(
              'w-2.5 h-2.5',
              ['evenement', 'stage', 'horaires'].includes(item.key) ? 'rounded-full w-2 h-2' : shape === 'round' ? 'rounded-full' : 'rounded',
              item.swatch
            )}
          />
          <span className="text-slate-500">{item.label}</span>
        </div>
      ))}
    </div>
  );
}
