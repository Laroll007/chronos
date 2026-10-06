'use client';

import { useEffect, useState } from 'react';
import { Dialog, DialogClose, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Sparkles, X } from 'lucide-react';
import {
  markReleaseNotesSeen,
  pendingReleaseNotes,
  type ReleaseAction,
  type ReleaseItem,
} from '@/lib/releaseNotes';
import { track } from '@/lib/analytics';
import { DiscordLogo } from '@/components/shared/DiscordLogo';

interface WhatsNewModalProps {
  /** Raccourci depuis une nouveauté (ouvre l'écran concerné). */
  onAction: (target: ReleaseAction) => void;
}

/**
 * « Quoi de neuf » : une seule fois après une mise à jour importante. Monté par
 * le dashboard une fois les données chargées (côté client uniquement) : l'état
 * initial se lit donc directement dans le stockage.
 */
export function WhatsNewModal({ onAction }: WhatsNewModalProps) {
  const [notes] = useState(() => pendingReleaseNotes());
  const [open, setOpen] = useState(notes.length > 0);

  useEffect(() => {
    if (notes.length > 0) track('whats_new_seen');
  }, [notes.length]);

  if (!open) return null;

  // Plusieurs mises à jour manquées : on fusionne, la plus récente en premier.
  const items: ReleaseItem[] = notes.flatMap((n) => n.items);

  const close = () => {
    markReleaseNotesSeen();
    setOpen(false);
  };

  const act = (target: ReleaseAction) => {
    track('whats_new_action');
    close();
    onAction(target);
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) close(); }}>
      <DialogContent
        className="w-[92vw] max-w-sm p-0 overflow-hidden border-0 shadow-2xl rounded-2xl flex flex-col"
        style={{ maxHeight: '90vh' }}
        showCloseButton={false}
      >
        <div
          className="shrink-0 px-6 pt-6 pb-5 text-white"
          style={{ background: 'linear-gradient(135deg, #0a1628 0%, #0d2347 50%, #0055A4 100%)' }}
        >
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-lg font-bold leading-tight text-white">Quoi de neuf ?</DialogTitle>
              <p className="text-blue-200 text-xs mt-0.5">My Chronos {notes[0]!.version.replace(/\.0$/, '')}</p>
            </div>
            <DialogClose className="shrink-0 w-8 h-8 rounded-xl bg-white/15 hover:bg-white/25 flex items-center justify-center text-white/80 hover:text-white transition-all">
              <X className="w-4 h-4" />
            </DialogClose>
          </div>
          <div className="mt-4 h-[3px] rounded-full" style={{ background: 'linear-gradient(90deg, #0055A4 33%, #ffffff 33%, #ffffff 66%, #EF4135 66%)' }} />
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-6 py-5 bg-white space-y-4">
          {items.map((item) => (
            <div key={item.title} className="flex gap-3">
              {item.logo === 'discord' ? (
                <DiscordLogo className="w-7 h-7 shrink-0" />
              ) : (
                <span className="text-2xl leading-none shrink-0" aria-hidden="true">{item.emoji}</span>
              )}
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-800">{item.title}</p>
                <p className="text-sm text-slate-600 leading-relaxed mt-0.5">{item.text}</p>
                {item.note && (
                  <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2 mt-2">⚠️ {item.note}</p>
                )}
                {item.action && (
                  <button
                    type="button"
                    onClick={() => act(item.action!.target)}
                    className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-blue-700 underline underline-offset-4 hover:text-blue-900"
                  >
                    {item.logo === 'discord' && <DiscordLogo className="w-4 h-4" />}
                    {item.action.label} →
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="shrink-0 px-6 pb-6 pt-2 bg-white">
          <button
            type="button"
            onClick={close}
            className="w-full h-12 rounded-xl text-white font-semibold"
            style={{ background: 'linear-gradient(135deg, #0055A4, #1a7de8)' }}
          >
            Compris
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
