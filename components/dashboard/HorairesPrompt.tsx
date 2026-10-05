'use client';

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Clock } from 'lucide-react';
import { track } from '@/lib/analytics';

// Rappel aux agents inscrits avant l'ajout des horaires de vacation : sans eux,
// les RPS restent sur l'ancien barème et les journées modifiées sur une
// estimation. « Plus tard » repousse de 7 jours ; après 3 refus, on n'insiste plus.
const KEY = 'chronos_horaires_prompt';
const REPORT_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_REFUS = 3;

interface EtatRappel {
  refus: number;
  jusqua: number;
}

function lireEtat(): EtatRappel {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as EtatRappel;
  } catch {
    /* état illisible : on repart de zéro */
  }
  return { refus: 0, jusqua: 0 };
}

/** Le rappel doit-il s'afficher maintenant ? */
export function rappelHorairesDu(now: number = Date.now()): boolean {
  const etat = lireEtat();
  return etat.refus < MAX_REFUS && now >= etat.jusqua;
}

export function reporterRappelHoraires(now: number = Date.now()): void {
  const etat = lireEtat();
  try {
    localStorage.setItem(KEY, JSON.stringify({ refus: etat.refus + 1, jusqua: now + REPORT_MS }));
  } catch {
    /* le rappel reviendra à la prochaine ouverture, sans gravité */
  }
}

interface HorairesPromptProps {
  onRenseigner: () => void;
}

/** Monté par le dashboard seulement si les horaires manquent (cf. conditions là-bas). */
export function HorairesPrompt({ onRenseigner }: HorairesPromptProps) {
  const [open, setOpen] = useState(() => rappelHorairesDu());

  useEffect(() => {
    if (open) track('horaires_prompt_seen');
    // une seule fois, à l'affichage
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!open) return null;

  const plusTard = () => {
    reporterRappelHoraires();
    setOpen(false);
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) plusTard(); }}>
      <DialogContent className="w-[92vw] max-w-sm p-0 overflow-y-auto overscroll-contain border-0 shadow-2xl rounded-2xl" showCloseButton={false}>
        <div
          className="px-6 pt-6 pb-5 text-white"
          style={{ background: 'linear-gradient(135deg, #0a1628 0%, #0d2347 50%, #0055A4 100%)' }}
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5 text-white" />
            </div>
            <DialogTitle className="text-lg font-bold leading-tight text-white">
              Vos horaires de vacation
            </DialogTitle>
          </div>
          <div className="mt-4 h-[3px] rounded-full" style={{ background: 'linear-gradient(90deg, #0055A4 33%, #ffffff 33%, #ffffff 66%, #EF4135 66%)' }} />
        </div>
        <div className="px-6 py-5 bg-white space-y-4">
          <p className="text-sm text-slate-600 leading-relaxed">
            Indiquez vos heures de <strong>prise et de fin de service</strong> : vos RPS de nuit et du
            dimanche, ainsi que vos journées modifiées (heures en plus, stage…), seront calculés
            selon les règles APORTT.
          </p>
          <p className="text-xs text-slate-500">Moins d&apos;une minute, modifiable à tout moment.</p>
          <button
            type="button"
            onClick={() => {
              track('horaires_prompt_action');
              setOpen(false);
              onRenseigner();
            }}
            className="w-full h-12 rounded-xl text-white font-semibold"
            style={{ background: 'linear-gradient(135deg, #0055A4, #1a7de8)' }}
          >
            Renseigner mes horaires
          </button>
          <button
            type="button"
            onClick={plusTard}
            className="w-full h-10 rounded-xl text-sm font-medium text-slate-500 hover:text-slate-700"
          >
            Plus tard
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
