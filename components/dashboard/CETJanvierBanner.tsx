'use client';

import { useState } from 'react';
import { PiggyBank, X } from 'lucide-react';

interface CETJanvierBannerProps {
  jours: number;
  anneeConges: number;
  onOpen: () => void;
}

/** Janvier : rappel de la fenêtre d'alimentation du CET (masquable pour l'année). */
export function CETJanvierBanner({ jours, anneeConges, onOpen }: CETJanvierBannerProps) {
  const key = `chronos_cet_janvier_${anneeConges + 1}`;
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(key) === '1';
    } catch {
      return false;
    }
  });
  if (hidden) return null;

  const hide = () => {
    try {
      localStorage.setItem(key, '1');
    } catch {
      /* le rappel reviendra à la prochaine ouverture, sans gravité */
    }
    setHidden(true);
  };

  return (
    <div className="relative rounded-2xl border border-emerald-200 bg-emerald-50 p-4 pr-11 shadow-sm">
      <button
        type="button"
        onClick={hide}
        aria-label="Masquer ce rappel"
        className="absolute top-2.5 right-2.5 w-8 h-8 rounded-xl flex items-center justify-center text-emerald-500 hover:text-emerald-800 hover:bg-emerald-100 transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
      <div className="flex items-start gap-3">
        <div className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center bg-emerald-600">
          <PiggyBank className="w-5 h-5 text-white" />
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-slate-800">Janvier : alimentez votre CET</p>
          <p className="text-sm text-slate-600 mt-0.5">
            Jusqu&apos;au 31 janvier, vous pouvez y verser jusqu&apos;à {jours} jour{jours > 1 ? 's' : ''} au
            titre de {anneeConges}. Voyez lesquels demander dans GesTT.
          </p>
          <button
            type="button"
            onClick={onOpen}
            className="mt-3 inline-flex items-center justify-center h-10 px-4 rounded-xl text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 shadow-md transition-colors"
          >
            Mon épargne CET
          </button>
        </div>
      </div>
    </div>
  );
}
