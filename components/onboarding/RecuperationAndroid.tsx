'use client';

import { useEffect, useState } from 'react';
import { Check, Globe, Loader2, RefreshCw } from 'lucide-react';
import { track } from '@/lib/analytics';
import { ChronosNatif, type Navigateur } from '@/lib/natif-android';
import { decoderTransfert, lireDonneesTransfert, pageTransfert, type ResumeTransfert } from '@/lib/transfert';

type Etat =
  | { nom: 'accueil' }
  | { nom: 'attente' }
  | { nom: 'vide' }
  | { nom: 'invalide' }
  | { nom: 'confirmation'; resume: ResumeTransfert };

const dateFr = (iso?: string) => {
  const d = iso ? new Date(iso) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : null;
};

/**
 * App Android native, premier lancement sans données : récupère celles de
 * l'ancienne app, restées dans le navigateur du téléphone (voir lib/transfert.ts).
 * Le navigateur renvoie les données par un lien ; on les vérifie et on demande
 * confirmation avant de les enregistrer.
 */
export function RecuperationAndroid({ onRecupere }: { onRecupere: (resume: ResumeTransfert) => void }) {
  const [etat, setEtat] = useState<Etat>({ nom: 'accueil' });
  const [navigateurs, setNavigateurs] = useState<Navigateur[]>([]);
  const [dernier, setDernier] = useState<string | undefined>();

  useEffect(() => {
    ChronosNatif.navigateurs()
      .then((r) => setNavigateurs(r.navigateurs))
      .catch(() => {});

    let poignee: { remove: () => Promise<void> } | undefined;
    let annule = false;
    ChronosNatif.addListener('transfert', async ({ donnees }) => {
      if (!donnees) {
        track('transfert_vide');
        setEtat({ nom: 'vide' });
        return;
      }
      try {
        const resume = lireDonneesTransfert(await decoderTransfert(donnees));
        if (!resume) throw new Error('invalide');
        track('transfert_recu');
        setEtat({ nom: 'confirmation', resume });
      } catch {
        track('transfert_invalide');
        setEtat({ nom: 'invalide' });
      }
    }).then((p) => {
      if (annule) void p.remove();
      else poignee = p;
    });
    return () => {
      annule = true;
      void poignee?.remove();
    };
  }, []);

  const ouvrir = async (paquet?: string) => {
    setDernier(paquet);
    track('transfert_ouvert');
    try {
      await ChronosNatif.ouvrirNavigateur({ url: pageTransfert(), paquet });
      setEtat({ nom: 'attente' });
    } catch {
      setEtat({ nom: 'vide' });
    }
  };

  // Autres navigateurs à essayer : tous sauf celui qu'on vient d'ouvrir.
  const defaut = navigateurs.find((n) => n.defaut)?.paquet;
  const autres = navigateurs.filter((n) => n.paquet !== (dernier ?? defaut));

  const boutonsAutres = autres.length > 0 && (
    <div className="space-y-2">
      <p className="text-xs font-medium text-slate-500">Essayer avec un autre navigateur :</p>
      {autres.map((n) => (
        <button
          key={n.paquet}
          type="button"
          onClick={() => void ouvrir(n.paquet)}
          className="w-full h-11 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 inline-flex items-center justify-center gap-2"
        >
          <Globe className="w-4 h-4" />
          {n.nom}
        </button>
      ))}
    </div>
  );

  return (
    <section className="mb-6 rounded-2xl overflow-hidden shadow-lg border border-blue-100 bg-white">
      <div className="px-5 pt-5 pb-4 text-white" style={{ background: 'linear-gradient(135deg, #0a1628 0%, #0d2347 50%, #0055A4 100%)' }}>
        <h2 className="text-lg font-bold leading-tight">Vous utilisiez déjà My Chronos ?</h2>
        <p className="text-blue-100 text-sm mt-1">Récupérez votre planning et vos compteurs en deux appuis.</p>
      </div>

      <div className="px-5 py-4 space-y-3">
        {etat.nom === 'accueil' && (
          <>
            <p className="text-sm text-slate-600 leading-relaxed">
              L’application a été améliorée pour ne plus perdre vos données. Celles de l’ancienne version sont
              restées dans votre navigateur : on va les chercher.
            </p>
            <button
              type="button"
              onClick={() => void ouvrir()}
              className="w-full h-12 rounded-xl text-white font-semibold inline-flex items-center justify-center gap-2"
              style={{ background: 'linear-gradient(135deg, #0055A4, #1a7de8)' }}
            >
              <RefreshCw className="w-4 h-4" />
              Récupérer mes données
            </button>
          </>
        )}

        {etat.nom === 'attente' && (
          <>
            <p className="text-sm text-slate-700 leading-relaxed flex gap-2">
              <Loader2 className="w-4 h-4 mt-0.5 shrink-0 animate-spin text-blue-600" />
              <span>
                Dans le navigateur qui vient de s’ouvrir, appuyez sur <strong>« Envoyer dans l’application »</strong>.
              </span>
            </p>
            {boutonsAutres}
          </>
        )}

        {etat.nom === 'vide' && (
          <>
            <p className="text-sm text-slate-700 leading-relaxed">
              Aucune donnée My Chronos dans ce navigateur. Vos données sont peut-être dans un autre navigateur du téléphone.
            </p>
            {boutonsAutres}
            {!autres.length && (
              <p className="text-sm text-slate-600">
                Si vous avez un fichier de sauvegarde, restaurez-le ci-dessous. Sinon, configurez l’app : cela prend une minute.
              </p>
            )}
          </>
        )}

        {etat.nom === 'invalide' && (
          <p className="text-sm text-slate-700 leading-relaxed">
            Les données reçues sont illisibles. Réessayez, ou restaurez un fichier de sauvegarde ci-dessous.
          </p>
        )}

        {etat.nom === 'confirmation' && (
          <>
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-900">
              <p className="font-semibold">Données trouvées</p>
              <p className="mt-1">
                {etat.resume.poses} congé{etat.resume.poses > 1 ? 's' : ''} posé{etat.resume.poses > 1 ? 's' : ''}
                {dateFr(etat.resume.derniereModif) && <>, dernière modification le {dateFr(etat.resume.derniereModif)}</>}.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                track('transfert_importe');
                onRecupere(etat.resume);
              }}
              className="w-full h-12 rounded-xl text-white font-semibold inline-flex items-center justify-center gap-2"
              style={{ background: 'linear-gradient(135deg, #059669, #10b981)' }}
            >
              <Check className="w-4 h-4" />
              Récupérer ces données
            </button>
            <button
              type="button"
              onClick={() => setEtat({ nom: 'accueil' })}
              className="w-full h-9 rounded-xl text-sm font-medium text-slate-500"
            >
              Annuler
            </button>
          </>
        )}
      </div>
    </section>
  );
}
