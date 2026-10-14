'use client';

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { Download, Send } from 'lucide-react';
import { track } from '@/lib/analytics';
import { isNativeApp } from '@/lib/api';
import { downloadExport } from '@/lib/storage';
import { donneesDuNavigateur, encoderTransfert, lireDonneesTransfert, LIEN_RETOUR, TAILLE_MAX_LIEN } from '@/lib/transfert';

const abonnement = () => () => {};
const lireBrut = () => donneesDuNavigateur();
const lireBrutServeur = () => null;
const lireNatif = () => isNativeApp();
const lireNatifServeur = () => false;

const carte = 'w-full max-w-sm rounded-2xl bg-white shadow-xl overflow-hidden';
const bouton = 'w-full h-12 rounded-xl text-white font-semibold inline-flex items-center justify-center gap-2';
const degrade = { background: 'linear-gradient(135deg, #0055A4, #1a7de8)' };

function Entete({ titre }: { titre: string }) {
  return (
    <div className="px-6 pt-6 pb-5 text-white" style={{ background: 'linear-gradient(135deg, #0a1628 0%, #0d2347 50%, #0055A4 100%)' }}>
      <h1 className="text-lg font-bold leading-tight">{titre}</h1>
      <div className="mt-4 h-[3px] rounded-full" style={{ background: 'linear-gradient(90deg, #0055A4 33%, #ffffff 33%, #ffffff 66%, #EF4135 66%)' }} />
    </div>
  );
}

export function Transfert() {
  const brut = useSyncExternalStore(abonnement, lireBrut, lireBrutServeur);
  const natif = useSyncExternalStore(abonnement, lireNatif, lireNatifServeur);
  const resume = useMemo(() => lireDonneesTransfert(brut), [brut]);
  const [envoye, setEnvoye] = useState(false);
  const [tropGros, setTropGros] = useState(false);

  // Pas de proposition « Installer » du navigateur ici : l'agent passe juste
  // ses données à l'app, une deuxième icône My Chronos l'embrouillerait.
  useEffect(() => {
    const bloquer = (e: Event) => e.preventDefault();
    window.addEventListener('beforeinstallprompt', bloquer);
    return () => window.removeEventListener('beforeinstallprompt', bloquer);
  }, []);

  // Page ouverte dans l'app elle-même : rien à faire ici.
  if (natif) {
    return (
      <div className={carte}>
        <Entete titre="Récupérer mes données" />
        <div className="px-6 py-5 space-y-4 text-sm text-slate-600">
          <p>Cette page sert dans le navigateur du téléphone, pas dans l’application.</p>
          <Link href="/dashboard" className={bouton} style={degrade}>Retour au planning</Link>
        </div>
      </div>
    );
  }

  const envoyer = async () => {
    if (!brut) return;
    const d = await encoderTransfert(brut);
    if (d.length > TAILLE_MAX_LIEN) {
      track('transfert_trop_gros');
      setTropGros(true);
      return;
    }
    track('transfert_envoye');
    setEnvoye(true);
    window.location.href = `${LIEN_RETOUR}?d=${d}`;
  };

  if (!resume) {
    return (
      <div className={carte}>
        <Entete titre="Aucune donnée ici" />
        <div className="px-6 py-5 space-y-4 text-sm text-slate-600 leading-relaxed">
          <p>Ce navigateur ne contient pas de données My Chronos.</p>
          <p>Revenez dans l’application : elle vous proposera d’essayer avec un autre navigateur du téléphone.</p>
          <a href={`${LIEN_RETOUR}?d=`} onClick={() => track('transfert_page_vide')} className={bouton} style={degrade}>
            Revenir dans l’application
          </a>
        </div>
      </div>
    );
  }

  const nb = resume.poses;
  return (
    <div className={carte}>
      <Entete titre="Vos données My Chronos" />
      <div className="px-6 py-5 space-y-4">
        <div className="rounded-xl bg-blue-50 border border-blue-200 px-4 py-3 text-center">
          <p className="text-3xl font-bold text-[#0055A4]">{nb}</p>
          <p className="text-sm font-medium text-blue-900">congé{nb > 1 ? 's' : ''} posé{nb > 1 ? 's' : ''} dans ce navigateur</p>
        </div>
        <p className="text-sm text-slate-600 leading-relaxed">
          Envoyez ces données dans la nouvelle application. Elles restent aussi ici, rien n’est effacé.
        </p>
        <button type="button" onClick={() => void envoyer()} className={bouton} style={degrade}>
          <Send className="w-4 h-4" />
          Envoyer dans l’application
        </button>
        {(envoye || tropGros) && (
          <div className="rounded-xl bg-slate-50 border border-slate-200 px-4 py-3 text-sm text-slate-600 space-y-3">
            <p>
              {tropGros
                ? 'Vos données sont trop volumineuses pour être envoyées directement.'
                : 'L’application ne s’est pas ouverte ?'}{' '}
              Enregistrez une sauvegarde, puis choisissez « La restaurer » dans l’application.
            </p>
            <button
              type="button"
              onClick={() => {
                track('transfert_fichier');
                void downloadExport();
              }}
              className="w-full h-11 rounded-xl border border-slate-300 bg-white text-slate-700 font-semibold inline-flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              Enregistrer une sauvegarde
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
