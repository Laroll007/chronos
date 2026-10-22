'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { DISCORD_BLURPLE, DiscordLogo } from '@/components/shared/DiscordLogo';
import {
  AVERTISSEMENT_COURT,
  encartCommunauteMasque,
  masquerEncartCommunaute,
  ouvrirCommunaute,
} from '@/lib/communaute';

/**
 * Encart du planning : invitation à la communauté Discord. La croix le masque
 * définitivement ; le lien reste dans Paramètres → À propos.
 */
export function CommunauteBanner() {
  const [visible, setVisible] = useState(() => !encartCommunauteMasque());
  if (!visible) return null;

  // Compact : une seule ligne, pour ne pas repousser le planning vers le bas.
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-indigo-200 bg-indigo-50 py-2 pl-2.5 pr-1.5 shadow-sm">
      <div className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: DISCORD_BLURPLE }}>
        <DiscordLogo className="w-5 h-5" couleur="#FFFFFF" />
      </div>
      <div className="min-w-0 flex-1 leading-tight">
        <p className="text-sm font-semibold text-slate-800">Rejoins la communauté sur Discord</p>
        <p className="text-[11px] text-slate-500" title={AVERTISSEMENT_COURT}>Idées, bugs, questions · ⚠️ reste anonyme</p>
      </div>
      <button
        type="button"
        onClick={ouvrirCommunaute}
        className="shrink-0 h-8 px-3 rounded-lg text-xs font-semibold text-white active:scale-[0.98] transition-transform"
        style={{ background: DISCORD_BLURPLE }}
      >
        Rejoindre
      </button>
      <button
        type="button"
        onClick={() => {
          masquerEncartCommunaute();
          setVisible(false);
        }}
        aria-label="Ne plus afficher"
        className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-indigo-400 hover:text-indigo-700 hover:bg-indigo-100 transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
