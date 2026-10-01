'use client';

import { useState } from 'react';
import { X } from 'lucide-react';

const KEY = 'chronos_hint_poser_ferme';

/**
 * « Cliquez sur un jour pour commencer à poser » : utile au début, encombrant
 * ensuite. Une croix la ferme pour de bon (mémorisé sur l'appareil).
 */
export function HintPoser({ texte }: { texte: string }) {
  const [ferme, setFerme] = useState(() => {
    try {
      return localStorage.getItem(KEY) === '1';
    } catch {
      return false;
    }
  });
  if (ferme) return null;

  const fermer = () => {
    try {
      localStorage.setItem(KEY, '1');
    } catch {
      /* stockage indisponible : la bulle reviendra, sans gravité */
    }
    setFerme(true);
  };

  return (
    <div className="mt-3 flex items-center gap-2 pl-3 pr-1.5 py-2 rounded-xl bg-slate-50 border border-slate-200">
      <span className="flex-1 text-center text-xs sm:text-sm text-slate-500">{texte}</span>
      <button
        type="button"
        onClick={fermer}
        aria-label="Fermer cette aide"
        className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
