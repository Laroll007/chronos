'use client';

import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

/**
 * Après la bascule du 1er janvier, pour un agent qui a eu un congé maternité,
 * un arrêt maladie ou un congé familial dans l'année : ses CA restants sont-ils
 * des CAM (report de 4 semaines, avant le 31 mars de N+2) ou des CA antérieurs
 * habituels (avant le 30 avril) ? GesTT fait foi : l'agent choisit.
 */
export function ReportCAMPrompt({
  annee,
  jours,
  onRepondre,
}: {
  annee: number;
  jours: number;
  onRepondre: (reporter: boolean) => void;
}) {
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onRepondre(false); }}>
      <DialogContent className="w-[92vw] max-w-sm p-0 overflow-y-auto overscroll-contain border-0 shadow-2xl rounded-2xl" showCloseButton={false}>
        <div className="px-6 pt-6 pb-5 text-white" style={{ background: 'linear-gradient(135deg, #0a1628 0%, #0d2347 50%, #0055A4 100%)' }}>
          <DialogTitle className="text-lg font-bold leading-tight text-white">Vos CA {annee} sont-ils reportés ?</DialogTitle>
          <div className="mt-4 h-[3px] rounded-full" style={{ background: 'linear-gradient(90deg, #0055A4 33%, #ffffff 33%, #ffffff 66%, #EF4135 66%)' }} />
        </div>
        <div className="px-6 py-5 bg-white space-y-3 text-sm text-slate-700 leading-relaxed">
          <p>
            En {annee}, vous avez eu un congé maternité, un arrêt maladie ou un congé familial. Les CA que vous n’avez pas pu
            prendre à cause de cette absence sont <strong className="text-slate-900">reportés en CAM</strong> : 4 semaines au plus,
            à poser avant le <strong className="text-slate-900">31 mars {annee + 2}</strong> (et non avant le 30 avril).
          </p>
          <p>
            Il vous reste <strong className="text-slate-900">{jours} CA de {annee}</strong>. Dans GesTT, apparaissent-ils en
            « CAM » ?
          </p>
          <div className="space-y-2 pt-1">
            <button
              type="button"
              onClick={() => onRepondre(true)}
              className="w-full h-12 rounded-xl text-white font-semibold shadow-md"
              style={{ background: 'linear-gradient(135deg, #0055A4, #1a7de8)' }}
            >
              Oui, ce sont des CAM
            </button>
            <button
              type="button"
              onClick={() => onRepondre(false)}
              className="w-full h-11 rounded-xl border-2 border-blue-200 text-[#0055A4] font-semibold"
            >
              Non, des CA antérieurs (30 avril)
            </button>
          </div>
          <p className="text-xs text-slate-500">
            Vous pourrez ajuster le nombre et la date limite dans « Gérer mes compteurs » (CA reportés).
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
