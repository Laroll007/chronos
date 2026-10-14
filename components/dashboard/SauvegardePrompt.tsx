'use client';

import { useEffect } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Download } from 'lucide-react';
import { toast } from 'sonner';
import { track } from '@/lib/analytics';
import { downloadExport } from '@/lib/storage';

/**
 * Rappel « mettez votre planning à l'abri » (Android et web) : un problème
 * identifié peut effacer les données sur certains téléphones ; une correction
 * est en préparation. En attendant, une sauvegarde permet de tout restaurer.
 */
export function SauvegardePrompt({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    track('sauvegarde_rappel');
  }, []);

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="w-[92vw] max-w-sm p-0 overflow-y-auto overscroll-contain border-0 shadow-2xl rounded-2xl" showCloseButton={false}>
        <div className="px-6 pt-6 pb-5 text-white" style={{ background: 'linear-gradient(135deg, #0a1628 0%, #0d2347 50%, #0055A4 100%)' }}>
          <DialogTitle className="text-lg font-bold leading-tight text-white">Mettez votre planning à l’abri</DialogTitle>
          <div className="mt-4 h-[3px] rounded-full" style={{ background: 'linear-gradient(90deg, #0055A4 33%, #ffffff 33%, #ffffff 66%, #EF4135 66%)' }} />
        </div>
        <div className="px-6 py-5 bg-white space-y-3">
          <p className="text-sm text-slate-700 leading-relaxed">
            Sur certains téléphones Android, <strong>un bug peut effacer les données de My Chronos</strong> (cycle,
            compteurs, congés). Il a été identifié et <strong>nous travaillons sur une correction</strong>.
          </p>
          <p className="text-sm text-slate-600 leading-relaxed">
            En attendant, gardez une <strong>sauvegarde</strong> : un petit fichier enregistré sur votre téléphone, qui
            permet de tout restaurer en une minute (Paramètres → Sauvegarde, ou dès l’écran d’inscription).
          </p>
          <button
            type="button"
            onClick={async () => {
              const res = await downloadExport();
              if (res === 'ok') {
                track('sauvegarde_rappel_export');
                toast.success('Sauvegarde enregistrée', { description: 'Fichier « chronos-backup » sur votre téléphone.' });
              } else if (res === 'erreur') {
                toast.error("Impossible d'enregistrer la sauvegarde");
              }
              onClose();
            }}
            className="w-full h-12 rounded-xl text-white font-semibold inline-flex items-center justify-center gap-2"
            style={{ background: 'linear-gradient(135deg, #0055A4, #1a7de8)' }}
          >
            <Download className="w-4 h-4" />
            Enregistrer ma sauvegarde
          </button>
          <button type="button" onClick={onClose} className="w-full h-9 rounded-xl text-sm font-medium text-slate-500 hover:text-slate-700">
            Plus tard
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
