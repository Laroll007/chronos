'use client';

// « Partager mon planning » : image sur 1, 3 ou 6 mois, envoyée par la fenêtre
// de partage du téléphone. Jamais de compteurs. (Le partage par lien a été
// retiré : WhatsApp sur iPhone le gardait en attente jusqu'à son ouverture.)

import { useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import type { CycleConfig, HistoryEntry } from '@/lib/types';
import { periodePartage, photoPlanning, type OptionsPartage } from '@/lib/partage';
import { partagerImage } from '@/lib/partageEnvoi';
import { track } from '@/lib/analytics';

export function PartagePlanningModal({
  cycleConfig,
  history,
  onClose,
}: {
  cycleConfig: CycleConfig;
  history: HistoryEntry[];
  onClose: () => void;
}) {
  const [mois, setMois] = useState<OptionsPartage['mois']>(1);
  const [titre, setTitre] = useState('');
  const [masquerTypes, setMasquerTypes] = useState(true);
  const [horaires, setHoraires] = useState(true);
  const [envoi, setEnvoi] = useState(false);

  const partager = async () => {
    setEnvoi(true);
    try {
      const photo = photoPlanning(cycleConfig, history, new Date(), { mois, titre, masquerTypes, horaires });
      const nom = titre.trim() || 'Mon planning';
      const libelle = `${nom} — ${periodePartage(photo)}`;
      const { imagePlanning } = await import('@/lib/partageImage');
      const res = await partagerImage(await imagePlanning(photo), `planning-${photo.du}.png`, libelle);
      if (res === 'annule') return;
      track('partage_image');
      if (res === 'telecharge') toast.success('Image enregistrée', { description: 'Envoyez-la depuis vos téléchargements.' });
      onClose();
    } catch {
      toast.error('Partage impossible', { description: 'Réessayez dans un instant.' });
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="w-[94vw] max-w-sm p-0 overflow-hidden border-0 shadow-2xl rounded-2xl" showCloseButton={false}>
        <div className="px-5 pt-5 pb-4 text-white" style={{ background: 'linear-gradient(135deg, #0a1628 0%, #0d2347 55%, #0055A4 100%)' }}>
          <DialogTitle className="text-base font-bold leading-tight text-white">Partager mon planning</DialogTitle>
          <p className="text-blue-200 text-xs mt-0.5">Avec ta conjointe, ta famille, un collègue…</p>
          <div className="mt-3 h-[3px] rounded-full" style={{ background: 'linear-gradient(90deg, #0055A4 33%, #ffffff 33%, #ffffff 66%, #EF4135 66%)' }} />
        </div>
        <div className="px-5 py-4 bg-white space-y-3 text-sm text-slate-700">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-1.5">Période</p>
            <div className="flex rounded-xl border-2 border-slate-200 overflow-hidden" role="radiogroup" aria-label="Période">
              {([1, 3, 6] as const).map((n) => (
                <button key={n} type="button" role="radio" aria-checked={mois === n} onClick={() => setMois(n)}
                  className={`flex-1 py-1.5 text-xs font-semibold ${mois === n ? 'bg-[#0055A4] text-white' : 'text-slate-600'}`}>
                  {n === 1 ? 'Ce mois' : `${n} mois`}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label htmlFor="titre-partage" className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Titre (facultatif)</label>
            <input id="titre-partage" value={titre} onChange={(e) => setTitre(e.target.value)} maxLength={60} placeholder="Planning de …"
              className="mt-1.5 w-full h-10 rounded-xl border-2 border-slate-200 px-3 text-sm text-slate-800 outline-none focus:border-[#0055A4]" />
          </div>
          <div className="space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Confidentialité</p>
            <label className="flex items-start gap-2 text-xs cursor-pointer">
              <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#0055A4]" checked={masquerTypes} onChange={(e) => setMasquerTypes(e.target.checked)} />
              <span><strong className="text-slate-800">Masquer le type d’absence</strong> : « Congé » et « Absent » au lieu de CA, RTC, CMO…</span>
            </label>
            <label className="flex items-start gap-2 text-xs cursor-pointer">
              <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#0055A4]" checked={horaires} onChange={(e) => setHoraires(e.target.checked)} />
              <span>Afficher les horaires des jours travaillés</span>
            </label>
            <p className="text-[11px] text-slate-500">Tes compteurs ne sont jamais partagés.</p>
          </div>
          <button type="button" onClick={partager} disabled={envoi}
            className="w-full h-12 rounded-xl text-white font-semibold shadow-md disabled:opacity-60"
            style={{ background: 'linear-gradient(135deg, #0055A4, #1a7de8)' }}>
            {envoi ? 'Préparation…' : 'Partager'}
          </button>
          <button type="button" onClick={onClose} className="w-full text-xs font-semibold text-slate-500">Annuler</button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
