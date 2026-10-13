'use client';

import { useState } from 'react';
import { Dialog, DialogClose, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Check, Copy, Send, X } from 'lucide-react';
import { track } from '@/lib/analytics';
import { LIEN_TELECHARGER, MESSAGE_RECOMMANDATION, lienSMS, lienWhatsApp, partagerApp } from '@/lib/recommandation';

/**
 * « Recommander My Chronos » : un QR code à montrer à un collègue (en brigade),
 * l'envoi du lien par le partage du téléphone (ou WhatsApp / SMS), et la copie
 * du lien. Le lien unique ouvre le bon store selon le téléphone.
 */
export function RecommanderModal({ onClose }: { onClose: () => void }) {
  const [copie, setCopie] = useState(false);
  const [sansPartage, setSansPartage] = useState(false);

  const envoyer = async () => {
    const ok = await partagerApp();
    if (!ok) setSansPartage(true);
  };

  const copier = async () => {
    try {
      await navigator.clipboard.writeText(`${MESSAGE_RECOMMANDATION} ${LIEN_TELECHARGER}`);
      setCopie(true);
      track('partage_lien_copie');
      setTimeout(() => setCopie(false), 2500);
    } catch {
      setSansPartage(true);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="w-[92vw] max-w-sm p-0 overflow-y-auto overscroll-contain border-0 shadow-2xl rounded-2xl" showCloseButton={false}>
        <div className="px-6 pt-6 pb-5 text-white" style={{ background: 'linear-gradient(135deg, #0a1628 0%, #0d2347 50%, #0055A4 100%)' }}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <DialogTitle className="text-lg font-bold leading-tight text-white">Recommander My Chronos</DialogTitle>
              <p className="text-blue-200 text-xs mt-1">Gratuite, sans compte, faite par un collègue</p>
            </div>
            <DialogClose className="shrink-0 w-8 h-8 rounded-xl bg-white/15 hover:bg-white/25 flex items-center justify-center text-white/80 hover:text-white transition-all">
              <X className="w-4 h-4" />
            </DialogClose>
          </div>
          <div className="mt-4 h-[3px] rounded-full" style={{ background: 'linear-gradient(90deg, #0055A4 33%, #ffffff 33%, #ffffff 66%, #EF4135 66%)' }} />
        </div>

        <div className="px-6 py-5 bg-white space-y-4">
          <div className="text-center">
            {/* eslint-disable-next-line @next/next/no-img-element -- SVG statique, pas d'optimisation utile */}
            <img src="/qr-telecharger.svg" alt="QR code vers le téléchargement de My Chronos" className="mx-auto w-44 h-44" />
            <p className="text-xs text-slate-600 mt-2">
              À montrer à un collègue : son appareil photo ouvre directement le bon store.
            </p>
          </div>

          <button
            type="button"
            onClick={envoyer}
            className="w-full h-12 rounded-xl text-white font-semibold inline-flex items-center justify-center gap-2"
            style={{ background: 'linear-gradient(135deg, #0055A4, #1a7de8)' }}
          >
            <Send className="w-4 h-4" />
            Envoyer le lien
          </button>

          {sansPartage && (
            <div className="grid grid-cols-2 gap-2">
              <a
                href={lienWhatsApp()}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => track('partage_lien_copie')}
                className="h-10 rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-800 text-sm font-semibold flex items-center justify-center"
              >
                WhatsApp
              </a>
              <a
                href={lienSMS()}
                onClick={() => track('partage_lien_copie')}
                className="h-10 rounded-xl border border-slate-300 bg-white text-slate-700 text-sm font-semibold flex items-center justify-center"
              >
                SMS
              </a>
            </div>
          )}

          <button
            type="button"
            onClick={copier}
            className="w-full h-10 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 inline-flex items-center justify-center gap-2"
          >
            {copie ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            {copie ? 'Lien copié' : 'Copier le lien'}
          </button>
          <p className="text-center text-[11px] text-slate-500 break-all">{LIEN_TELECHARGER}</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
