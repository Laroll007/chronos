'use client';

import { ClipboardList, X } from 'lucide-react';

interface CountersPendingBannerProps {
  onComplete: () => void;
  onDismiss: () => void;
}

/**
 * Rappel affiché tant que l'agent n'a pas saisi ses soldes GesTT (onboarding
 * terminé via « Je n'ai pas mes compteurs sous la main »).
 */
export function CountersPendingBanner({ onComplete, onDismiss }: CountersPendingBannerProps) {
  return (
    <div className="relative rounded-2xl border border-blue-200 bg-blue-50 p-4 pr-11 shadow-sm">
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Masquer ce rappel"
        className="absolute top-2.5 right-2.5 w-8 h-8 rounded-xl flex items-center justify-center text-blue-400 hover:text-blue-700 hover:bg-blue-100 transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
      <div className="flex items-start gap-3">
        <div
          className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #0055A4, #1a7de8)' }}
        >
          <ClipboardList className="w-5 h-5 text-white" />
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-slate-800">Vos compteurs ne sont pas encore renseignés</p>
          <p className="text-sm text-slate-600 mt-0.5">
            Votre calendrier fonctionne déjà. Munissez-vous de vos soldes (GesTT ou autre relevé) pour activer
            l&apos;optimisation de vos congés, les alertes et les recommandations.
          </p>
          <button
            type="button"
            onClick={onComplete}
            className="mt-3 inline-flex items-center justify-center h-10 px-4 rounded-xl text-sm font-semibold text-white shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all"
            style={{ background: 'linear-gradient(135deg, #0055A4 0%, #1a7de8 100%)' }}
          >
            Renseigner mes compteurs
          </button>
        </div>
      </div>
    </div>
  );
}
