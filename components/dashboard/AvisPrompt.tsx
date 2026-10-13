'use client';

import { useEffect } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Star } from 'lucide-react';
import { track } from '@/lib/analytics';
import { lienAvisStore, ouvrirFicheStore, type Plateforme } from '@/lib/recommandation';

/**
 * Invitation neutre après un moment utile (Android et web) : laisser un avis
 * sur le Play Store, ou recommander l'app. Aucune question préalable du type
 * « vous aimez l'app ? » (interdit par Google comme par Apple). Sur iPhone,
 * c'est la fenêtre native d'Apple qui s'affiche à la place.
 */
export function AvisPrompt({
  plateforme,
  onRecommander,
  onClose,
}: {
  plateforme: Plateforme;
  onRecommander: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    track('avis_demande');
  }, []);
  const store = lienAvisStore(plateforme) !== null;

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="w-[92vw] max-w-sm p-0 overflow-y-auto overscroll-contain border-0 shadow-2xl rounded-2xl" showCloseButton={false}>
        <div className="px-6 pt-6 pb-5 text-white" style={{ background: 'linear-gradient(135deg, #0a1628 0%, #0d2347 50%, #0055A4 100%)' }}>
          <DialogTitle className="text-lg font-bold leading-tight text-white">Un coup de pouce ?</DialogTitle>
          <div className="mt-4 h-[3px] rounded-full" style={{ background: 'linear-gradient(90deg, #0055A4 33%, #ffffff 33%, #ffffff 66%, #EF4135 66%)' }} />
        </div>
        <div className="px-6 py-5 bg-white space-y-3">
          <p className="text-sm text-slate-600 leading-relaxed">
            My Chronos est gratuit et fait par un collègue, sur son temps libre.
            {store
              ? ' Un avis sur le Play Store aide d’autres policiers à le trouver.'
              : ' Le recommander aide d’autres policiers à le trouver.'}
          </p>
          {store && (
            <button
              type="button"
              onClick={() => {
                ouvrirFicheStore();
                onClose();
              }}
              className="w-full h-12 rounded-xl text-white font-semibold inline-flex items-center justify-center gap-2"
              style={{ background: 'linear-gradient(135deg, #0055A4, #1a7de8)' }}
            >
              <Star className="w-4 h-4" />
              Laisser un avis
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              onClose();
              onRecommander();
            }}
            className={`w-full h-11 rounded-xl text-sm font-semibold ${
              store ? 'border border-slate-200 bg-white text-slate-700' : 'text-white'
            }`}
            style={store ? undefined : { background: 'linear-gradient(135deg, #0055A4, #1a7de8)' }}
          >
            Recommander à un collègue
          </button>
          <button type="button" onClick={onClose} className="w-full h-9 rounded-xl text-sm font-medium text-slate-500 hover:text-slate-700">
            Plus tard
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
