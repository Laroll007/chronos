'use client';

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { ListChecks } from 'lucide-react';
import { track } from '@/lib/analytics';

// Agents en cycle ayant coché le compteur ARTT : sur la grille officielle, les
// RTC des cycliques s'appellent aussi « ARTT », d'où des RTC saisis deux fois
// (28 % des profils en cycle, stats d'octobre 2026). Message affiché une seule
// fois ; aucune modification automatique, l'agent décide.
const KEY = 'chronos_artt_cycle_vu';

export function rappelArttCycleVu(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

function marquerVu(): void {
  try {
    localStorage.setItem(KEY, '1');
  } catch {
    /* le message reviendra à la prochaine ouverture, sans gravité */
  }
}

interface ArttCyclePromptProps {
  onGerer: () => void;
}

/** Monté par le dashboard seulement pour un agent en cycle avec un compteur ARTT. */
export function ArttCyclePrompt({ onGerer }: ArttCyclePromptProps) {
  const [open, setOpen] = useState(() => !rappelArttCycleVu());

  useEffect(() => {
    if (open) track('artt_prompt_seen');
    // une seule fois, à l'affichage
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!open) return null;

  const garder = () => {
    track('artt_prompt_garde');
    marquerVu();
    setOpen(false);
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) garder(); }}>
      <DialogContent className="w-[92vw] max-w-sm p-0 overflow-y-auto overscroll-contain border-0 shadow-2xl rounded-2xl" showCloseButton={false}>
        <div
          className="px-6 pt-6 pb-5 text-white"
          style={{ background: 'linear-gradient(135deg, #0a1628 0%, #0d2347 50%, #0055A4 100%)' }}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
              <ListChecks className="w-5 h-5 text-white" />
            </div>
            <DialogTitle className="text-lg font-bold leading-tight text-white">
              Votre compteur ARTT
            </DialogTitle>
          </div>
          <div className="mt-4 h-[3px] rounded-full" style={{ background: 'linear-gradient(90deg, #0055A4 33%, #ffffff 33%, #ffffff 66%, #EF4135 66%)' }} />
        </div>
        <div className="px-6 py-5 bg-white space-y-4">
          <p className="text-sm text-slate-600 leading-relaxed">
            Vous travaillez en cycle et vous avez un compteur <strong>ARTT</strong>. En cycle, vos ARTT
            sont en général <strong>vos RTC</strong> : la grille officielle leur donne les deux noms.
          </p>
          <p className="text-sm text-slate-600 leading-relaxed">
            Si c&apos;est le même solde, retirez le compteur ARTT pour ne pas le compter deux fois.
          </p>
          <button
            type="button"
            onClick={() => {
              track('artt_prompt_gerer');
              marquerVu();
              setOpen(false);
              onGerer();
            }}
            className="w-full h-12 rounded-xl text-white font-semibold"
            style={{ background: 'linear-gradient(135deg, #0055A4, #1a7de8)' }}
          >
            Gérer mes compteurs
          </button>
          <button
            type="button"
            onClick={garder}
            className="w-full h-10 rounded-xl text-sm font-medium text-slate-600 hover:text-slate-800"
          >
            C&apos;est bien un autre compteur
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
