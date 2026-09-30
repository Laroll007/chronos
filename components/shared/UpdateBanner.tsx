'use client';

import { RefreshCw, X } from 'lucide-react';

interface UpdateBannerProps {
  onUpdate: () => void;
  onDismiss: () => void;
  /** Clic reçu : rechargement en cours (retour visuel immédiat). */
  updating?: boolean;
}

export function UpdateBanner({ onUpdate, onDismiss, updating = false }: UpdateBannerProps) {
  return (
    <div className="fixed top-14 left-0 right-0 z-40 animate-slide-up">
      <div className="mx-auto max-w-2xl px-4 py-2">
        <div className="gradient-primary-subtle border border-blue-200/60 rounded-xl px-4 py-3 flex items-center gap-3 shadow-lg">
          <div className="gradient-primary rounded-full p-2 shrink-0">
            <RefreshCw className={`w-4 h-4 text-white ${updating ? 'animate-spin' : ''}`} />
          </div>
          <p className="text-sm text-blue-900 flex-1">
            Une nouvelle version de My Chronos est disponible
          </p>
          <button
            onClick={onUpdate}
            disabled={updating}
            className="gradient-primary text-white text-sm font-medium px-4 py-1.5 rounded-lg hover:opacity-90 transition-opacity shrink-0 disabled:opacity-70"
          >
            {updating ? 'Mise à jour…' : 'Mettre à jour'}
          </button>
          <button
            onClick={onDismiss}
            className="text-blue-400 hover:text-blue-600 transition-colors shrink-0"
            aria-label="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
