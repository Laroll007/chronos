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

  return (
    <div className="relative rounded-2xl border border-indigo-200 bg-indigo-50 p-4 pr-11 shadow-sm">
      <button
        type="button"
        onClick={() => {
          masquerEncartCommunaute();
          setVisible(false);
        }}
        aria-label="Ne plus afficher"
        className="absolute top-2.5 right-2.5 w-8 h-8 rounded-xl flex items-center justify-center text-indigo-400 hover:text-indigo-700 hover:bg-indigo-100 transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
      <div className="flex items-start gap-3">
        <div
          className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: DISCORD_BLURPLE }}
        >
          <DiscordLogo className="w-6 h-6" couleur="#FFFFFF" />
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-slate-800">Rejoins la communauté My Chronos</p>
          <p className="text-sm text-slate-600 mt-0.5">
            Une idée, un bug, une question ? Participe au développement de l&apos;app sur Discord, avec Marco, son
            assistant.
          </p>
          <p className="text-xs text-slate-500 mt-1.5">⚠️ {AVERTISSEMENT_COURT}</p>
          <button
            type="button"
            onClick={ouvrirCommunaute}
            className="mt-3 inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl text-sm font-semibold text-white shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all"
            style={{ background: DISCORD_BLURPLE }}
          >
            <DiscordLogo className="w-5 h-5" couleur="#FFFFFF" />
            Rejoindre le Discord
          </button>
        </div>
      </div>
    </div>
  );
}
