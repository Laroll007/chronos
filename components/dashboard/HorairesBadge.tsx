'use client';

// Pastille « S » / « M » sur les jours travaillés quand les horaires changent
// (soirée / matinée…), et sa légende. Deux styles sans teinte (plein / contour)
// pour ne pas se confondre avec les couleurs d'état du planning (congé, CMO…).

import type { CycleConfig } from '@/lib/types';
import { jeuHorairesDuJour, rotationValide, abregerNomsJeux, type JeuDuJour } from '@/lib/horaires';
import { cn } from '@/lib/utils';

const STYLES = [
  'bg-slate-700 text-white border border-slate-700',
  'bg-white text-slate-800 border border-slate-500',
];

export function styleJeu(indice: number): string {
  return STYLES[indice % STYLES.length];
}

function hhmm(minutes: number): string {
  const m = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}h${String(m % 60).padStart(2, '0')}`;
}

export function libelleJeu(jeu: Pick<JeuDuJour, 'nom' | 'heureDebut' | 'duree'>): string {
  return `${jeu.nom} ${hhmm(jeu.heureDebut)}–${hhmm(jeu.heureDebut + jeu.duree)}`;
}

export function BadgeHoraires({ jeu, className }: { jeu: JeuDuJour; className?: string }) {
  return (
    <span
      aria-hidden="true"
      title={libelleJeu(jeu)}
      className={cn(
        'inline-flex items-center justify-center rounded px-1 text-[9px] md:text-[10px] font-bold leading-[14px] md:leading-4',
        styleJeu(jeu.indice),
        className
      )}
    >
      {jeu.court}
    </span>
  );
}

/** Légende des jeux d'horaires, si certains jours affichés en portent un. */
export function LegendeHoraires({ cycleConfig, dates }: { cycleConfig: CycleConfig; dates: Date[] }) {
  const r = cycleConfig.type === 'alterne' ? cycleConfig.horairesRotation : undefined;
  if (!rotationValide(r)) return null;
  const presents = new Set(dates.map((d) => jeuHorairesDuJour(d, cycleConfig)?.indice));
  const courts = abregerNomsJeux(r.jeux.map((j) => j.nom));
  const jeux = r.jeux.map((j, indice) => ({ ...j, indice, court: courts[indice] })).filter((j) => presents.has(j.indice));
  if (jeux.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 mt-2 text-xs">
      {jeux.map((j) => (
        <div key={j.indice} className="flex items-center gap-1.5">
          <BadgeHoraires jeu={j} />
          <span className="text-slate-600">{libelleJeu(j)}</span>
        </div>
      ))}
    </div>
  );
}
