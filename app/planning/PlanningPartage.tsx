'use client';

import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { COULEURS_PARTAGE, MOIS_FR, joursDuMois, lirePartage, periodePartage, type NatureJourPartage, type PlanningPartage as Planning } from '@/lib/partage';

const JOURS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

/** Lecture seule du planning partagé, mois par mois. */
export function PlanningPartage() {
  const [planning, setPlanning] = useState<Planning | null | 'chargement'>('chargement');
  const [rang, setRang] = useState(0);

  useEffect(() => {
    const lire = () => void lirePartage(window.location.hash).then((p) => { setPlanning(p); setRang(0); });
    lire();
    window.addEventListener('hashchange', lire);
    return () => window.removeEventListener('hashchange', lire);
  }, []);

  if (planning === 'chargement') return null;
  if (!planning) {
    return (
      <div className="max-w-md mx-auto p-6 text-center text-slate-700">
        <p className="text-lg font-bold text-slate-900 mt-10">Lien incomplet</p>
        <p className="mt-2 text-sm">Ce lien de planning est illisible : demande à la personne de te le renvoyer.</p>
      </div>
    );
  }

  const jours = joursDuMois(planning, rang);
  const d0 = jours[0]!.date;
  const decalage = (d0.getDay() + 6) % 7;
  const presentes = new Set<NatureJourPartage>(jours.map((j) => j.nature));
  const le = new Date(planning.le);

  return (
    <div className="max-w-md mx-auto pb-10">
      <header className="px-5 pt-6 pb-5 text-white" style={{ background: 'linear-gradient(135deg, #0a1628 0%, #0d2347 55%, #0055A4 100%)' }}>
        <h1 className="text-xl font-bold leading-tight">{planning.titre ?? 'Planning partagé'}</h1>
        <p className="text-blue-200 text-sm mt-0.5">{periodePartage(planning).replace(/^./, (c) => c.toUpperCase())}</p>
        <span className="inline-block mt-2 text-xs bg-white/15 rounded-full px-2.5 py-1">
          Partagé le {le.toLocaleDateString('fr-FR')} à {le.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
        </span>
        <div className="mt-4 h-[3px] rounded-full" style={{ background: 'linear-gradient(90deg, #0055A4 33%, #ffffff 33%, #ffffff 66%, #EF4135 66%)' }} />
      </header>

      <section className="m-3 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
        <nav className="flex items-center justify-between px-1 pb-2" aria-label="Mois">
          <button type="button" onClick={() => setRang((r) => r - 1)} disabled={rang === 0} aria-label="Mois précédent"
            className="h-9 w-9 rounded-lg flex items-center justify-center disabled:opacity-25 hover:bg-blue-50">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="text-center">
            <p className="font-semibold text-slate-900">{MOIS_FR[d0.getMonth()]!.replace(/^./, (c) => c.toUpperCase())} {d0.getFullYear()}</p>
            {planning.mois > 1 && <p className="text-[11px] text-slate-500">{rang + 1} / {planning.mois}</p>}
          </div>
          <button type="button" onClick={() => setRang((r) => r + 1)} disabled={rang >= planning.mois - 1} aria-label="Mois suivant"
            className="h-9 w-9 rounded-lg flex items-center justify-center disabled:opacity-25 hover:bg-blue-50">
            <ChevronRight className="w-5 h-5" />
          </button>
        </nav>
        <div className="grid grid-cols-7 text-center text-[11px] text-slate-500 pb-1">{JOURS.map((j) => <div key={j}>{j}</div>)}</div>
        <div className="grid grid-cols-7 border-t border-l border-slate-200 rounded-md overflow-hidden" role="grid">
          {Array.from({ length: decalage }, (_, i) => <div key={`v${i}`} className="min-h-[64px] border-r border-b border-slate-200 bg-slate-50/60" />)}
          {jours.map((j) => {
            const c = COULEURS_PARTAGE[j.nature];
            return (
              <div key={j.date.getDate()} role="gridcell" className="min-h-[64px] border-r border-b border-slate-200 p-0.5 flex flex-col items-center gap-0.5"
                style={{ background: c.fond, color: c.texte }}>
                <span className={`text-xs ${j.nature === 'R' ? 'font-medium' : 'font-bold'}`}>{j.date.getDate()}</span>
                {j.etiquette && <span className="text-[9px] font-bold leading-tight text-center">{j.etiquette}</span>}
                {j.horaires && <span className="text-[8.5px] leading-tight text-blue-700">{j.horaires}</span>}
              </div>
            );
          })}
        </div>
        <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 pt-2 text-[11px] text-slate-600">
          {(['T', 'R', 'C', 'P', 'A'] as NatureJourPartage[]).filter((n) => presentes.has(n)).map((n) => (
            <span key={n} className="inline-flex items-center gap-1">
              <i className="inline-block w-2.5 h-2.5 rounded-sm border border-slate-300" style={{ background: COULEURS_PARTAGE[n].fond }} />
              {COULEURS_PARTAGE[n].nom}
            </span>
          ))}
        </div>
      </section>

      <p className="mx-3 rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-600 leading-relaxed">
        ℹ️ Photo du planning au {le.toLocaleDateString('fr-FR')}. S’il change, demande qu’on te renvoie le lien.
        Le planning est dans le lien lui-même : rien n’est stocké sur un serveur.
      </p>
      <p className="mt-4 text-center text-sm">
        <a href="/telecharger?source=partage" className="font-semibold text-[#0055A4]">Toi aussi tu es policier ? Découvre My Chronos →</a>
      </p>
    </div>
  );
}
