'use client';

import { lazy, Suspense, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRightLeft, PencilLine, Undo2 } from 'lucide-react';
import type { CompteurDote, Counters, CycleConfig, CycleSimple, HistoryEntry } from '@/lib/types';
import { apercuChangement, changementAnnulable, EN_MINUTES, erreurDates } from '@/lib/changementCycle';
import { cycleSimple } from '@/lib/cycleDuJour';
import { formatMinutes } from '@/lib/calculations';

const CycleSetup = lazy(() =>
  import('@/components/onboarding/CycleSetup').then((m) => ({ default: m.CycleSetup }))
);

const LIBELLES: Record<CompteurDote, string> = { ca: 'CA', cf: 'CF', rtc: 'RTC', artt: 'ARTT', rtt: 'RTT' };

const valeur = (k: CompteurDote, v: number) => (EN_MINUTES.has(k) ? formatMinutes(v) : `${String(v).replace('.', ',')} j`);
const dateFr = (cle: string) => {
  const [a, m, j] = cle.split('-').map(Number);
  return new Date(a, m - 1, j).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
};

type Etape = 'choix' | 'correction' | 'dates' | 'cycle' | 'droits';

interface Props {
  cycleConfig: CycleConfig;
  counters: Counters;
  history: HistoryEntry[];
  /** Correction du cycle actuel (toute l'année, comme avant). */
  onCorriger: (config: CycleConfig) => void;
  onChanger: (p: { dernierJour: string; premierJour: string; nouveau: CycleSimple; droitsCorriges: Partial<Record<CompteurDote, number>> }) => void;
  onAnnuler: () => void;
}

/**
 * « Modifier mon cycle » : corriger le cycle (erreur de saisie, horaires), ou
 * changer de cycle en cours d'année (mutation) — l'ancien vaut jusqu'à son
 * dernier jour, les droits de l'année sont recalculés au prorata et les RPS
 * recrédités. Cf. lib/changementCycle.ts.
 */
export function ChangementCycle({ cycleConfig, counters, history, onCorriger, onChanger, onAnnuler }: Props) {
  const [etape, setEtape] = useState<Etape>('choix');
  const [dernierJour, setDernierJour] = useState('');
  const [premierJour, setPremierJour] = useState('');
  const [nouveau, setNouveau] = useState<CycleSimple | null>(null);
  const [corriges, setCorriges] = useState<Partial<Record<CompteurDote, number>>>({});
  const [confirmerAnnulation, setConfirmerAnnulation] = useState(false);

  const erreur = dernierJour || premierJour ? erreurDates(cycleConfig, dernierJour, premierJour) : null;
  const apercu = useMemo(
    () => (nouveau ? apercuChangement(cycleConfig, counters, history, { dernierJour, premierJour, nouveau, droitsCorriges: corriges }) : null),
    [cycleConfig, counters, history, dernierJour, premierJour, nouveau, corriges]
  );
  const annulable = changementAnnulable(cycleConfig);
  const dernierChangement = cycleConfig.cyclesAnterieurs?.at(-1);

  const retour = (vers: Etape) => (
    <button type="button" onClick={() => setEtape(vers)} className="mb-3 inline-flex items-center gap-1 text-sm font-medium text-slate-600">
      <ArrowLeft className="w-4 h-4" /> Retour
    </button>
  );

  if (etape === 'choix') {
    return (
      <div className="space-y-3">
        <button type="button" onClick={() => setEtape('correction')} className="w-full text-left rounded-xl border border-slate-200 bg-white p-4 hover:border-blue-300">
          <span className="flex items-center gap-2 font-semibold text-slate-900"><PencilLine className="w-4 h-4 text-blue-600" /> Je corrige mon cycle</span>
          <span className="block mt-1 text-sm text-slate-600">Erreur à l’inscription, horaires à renseigner ou à ajuster : s’applique à toute l’année.</span>
        </button>
        <button type="button" onClick={() => setEtape('dates')} className="w-full text-left rounded-xl border border-slate-200 bg-white p-4 hover:border-blue-300">
          <span className="flex items-center gap-2 font-semibold text-slate-900"><ArrowRightLeft className="w-4 h-4 text-blue-600" /> Je change de cycle</span>
          <span className="block mt-1 text-sm text-slate-600">
            Mutation, changement de service ou de régime : l’ancien cycle reste valable jusqu’à votre dernier jour, vos
            droits de l’année sont recalculés au prorata et vos RPS selon le nouveau cycle.
          </span>
        </button>
        {annulable && dernierChangement && !confirmerAnnulation && (
          <button type="button" onClick={() => setConfirmerAnnulation(true)} className="w-full inline-flex items-center justify-center gap-2 h-10 text-sm font-medium text-rose-600">
            <Undo2 className="w-4 h-4" /> Annuler mon changement de cycle du {dateFr(cycleConfig.appliqueDepuis!)}
          </button>
        )}
        {confirmerAnnulation && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 space-y-2 text-sm text-rose-900">
            <p>Votre ancien cycle reprend partout et vos compteurs retrouvent leurs soldes d’avant le changement.</p>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setConfirmerAnnulation(false)} className="h-10 rounded-lg border border-slate-300 bg-white font-medium text-slate-700">Garder</button>
              <button type="button" onClick={onAnnuler} className="h-10 rounded-lg bg-rose-600 font-semibold text-white">Confirmer l’annulation</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (etape === 'correction') {
    return (
      <div>
        {retour('choix')}
        <div className="p-3 mb-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
          La correction s’applique <strong>à toute l’année</strong>
          {cycleConfig.appliqueDepuis && ` (depuis votre changement de cycle du ${dateFr(cycleConfig.appliqueDepuis)})`}. Vos congés
          déjà posés restent enregistrés, mais certains peuvent tomber sur des jours devenus des repos : vérifiez-les ensuite.
        </div>
        <Suspense fallback={<div className="py-8 text-center text-sm text-slate-500">Chargement…</div>}>
          <CycleSetup initialConfig={cycleConfig} onNext={onCorriger} />
        </Suspense>
      </div>
    );
  }

  if (etape === 'dates') {
    const champ = 'mt-1 w-full h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm';
    return (
      <div className="space-y-4">
        {retour('choix')}
        <div>
          <label htmlFor="dernier-jour" className="text-sm font-semibold text-slate-800">Dernier jour de l’ancien cycle</label>
          <input id="dernier-jour" type="date" value={dernierJour} onChange={(e) => setDernierJour(e.target.value)} className={champ} />
        </div>
        <div>
          <label htmlFor="premier-jour" className="text-sm font-semibold text-slate-800">Premier jour du nouveau cycle</label>
          <input id="premier-jour" type="date" value={premierJour} onChange={(e) => setPremierJour(e.target.value)} className={champ} />
          <p className="mt-1 text-xs text-slate-500">Les jours entre les deux (mutation) ne sont pas travaillés.</p>
        </div>
        {erreur && dernierJour && premierJour && <p className="text-sm text-rose-600">{erreur}</p>}
        <button
          type="button"
          disabled={!dernierJour || !premierJour || !!erreur}
          onClick={() => setEtape('cycle')}
          className="w-full h-12 rounded-xl text-white font-semibold disabled:opacity-50"
          style={{ background: 'linear-gradient(135deg, #0055A4, #1a7de8)' }}
        >
          Continuer : mon nouveau cycle
        </button>
      </div>
    );
  }

  if (etape === 'cycle') {
    return (
      <div>
        {retour('dates')}
        <p className="mb-3 text-sm text-slate-700">
          Votre nouveau cycle, à partir du <strong>{dateFr(premierJour)}</strong> :
        </p>
        <Suspense fallback={<div className="py-8 text-center text-sm text-slate-500">Chargement…</div>}>
          <CycleSetup
            initialConfig={nouveau ?? cycleConfig}
            onNext={(config) => {
              setNouveau(cycleSimple(config));
              setCorriges({});
              setEtape('droits');
            }}
          />
        </Suspense>
      </div>
    );
  }

  // Droits de l'année
  if (!apercu || !nouveau) return null;
  return (
    <div className="space-y-4">
      {retour('cycle')}
      <div>
        <h3 className="font-semibold text-slate-900">Vos droits pour {apercu.annee}</h3>
        <p className="text-xs text-slate-600 mt-1">
          Au prorata du temps passé dans chaque cycle (ancien jusqu’au {dateFr(dernierJour)}, nouveau à partir du{' '}
          {dateFr(premierJour)}). <strong>GesTT fait foi</strong> : corrigez un montant s’il diffère.
        </p>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100">
        {apercu.lignes.map((l) => {
          const ecart = l.apres - l.avant;
          const minutes = EN_MINUTES.has(l.compteur);
          return (
            <div key={l.compteur} className="p-3 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-slate-900">{LIBELLES[l.compteur]}</span>
                {minutes ? (
                  <span className="flex items-center gap-1">
                    <input
                      type="number" min={0} inputMode="numeric" aria-label={`Droits ${LIBELLES[l.compteur]} — heures`}
                      value={Math.floor(l.apres / 60)}
                      onChange={(e) => setCorriges((c) => ({ ...c, [l.compteur]: (parseInt(e.target.value) || 0) * 60 + (l.apres % 60) }))}
                      className="w-16 rounded-md border border-slate-300 px-2 py-1 text-sm text-center"
                    />
                    <span className="text-xs text-slate-500">h</span>
                    <input
                      type="number" min={0} max={59} inputMode="numeric" aria-label={`Droits ${LIBELLES[l.compteur]} — minutes`}
                      value={l.apres % 60}
                      onChange={(e) => setCorriges((c) => ({ ...c, [l.compteur]: Math.floor(l.apres / 60) * 60 + Math.min(59, parseInt(e.target.value) || 0) }))}
                      className="w-14 rounded-md border border-slate-300 px-2 py-1 text-sm text-center"
                    />
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    <input
                      type="number" min={0} step={0.5} inputMode="decimal" aria-label={`Droits ${LIBELLES[l.compteur]} — jours`}
                      value={l.apres}
                      onChange={(e) => setCorriges((c) => ({ ...c, [l.compteur]: Math.max(0, Math.round((parseFloat(e.target.value.replace(',', '.')) || 0) * 2) / 2) }))}
                      className="w-20 rounded-md border border-slate-300 px-2 py-1 text-sm text-center"
                    />
                    <span className="text-xs text-slate-500">j</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-600">
                Droits de l’année : {valeur(l.compteur, l.avant)} → <strong>{valeur(l.compteur, l.apres)}</strong>
                {ecart !== 0 && <> · solde {valeur(l.compteur, l.solde)} → <strong>{valeur(l.compteur, Math.max(0, l.solde + ecart))}</strong></>}
              </p>
            </div>
          );
        })}
      </div>
      {nouveau.type !== cycleConfig.type && (
        <p className="rounded-lg bg-amber-50 border border-amber-200 p-2.5 text-xs text-amber-800">
          {nouveau.type === 'hebdo'
            ? 'Passage en hebdomadaire : RTC et CF ne sont plus acquis (vous gardez ceux de la période en cycle). Si vous avez des ARTT ou RTT, activez-les ensuite dans Compteurs → « Gérer mes compteurs ».'
            : 'Passage en cycle : vous acquérez des RTC et des CF à partir du changement. Si ces compteurs ne sont pas activés, activez-les ensuite dans Compteurs → « Gérer mes compteurs ».'}
        </p>
      )}
      <p className="text-xs text-slate-600">
        <strong>RPS</strong> :{' '}
        {apercu.rpsEcart === 0
          ? 'calculés selon le nouveau cycle à partir du ' + dateFr(premierJour) + '.'
          : `${apercu.rpsEcart > 0 ? '+' : '−'}${formatMinutes(Math.abs(apercu.rpsEcart))} pour les jours déjà crédités depuis le ${dateFr(premierJour)}, recalculés selon le nouveau cycle.`}{' '}
        Le reste est conservé : CA HP, HS, CET, RPS déjà acquis, congés posés.
      </p>
      <button
        type="button"
        onClick={() => onChanger({ dernierJour, premierJour, nouveau, droitsCorriges: corriges })}
        className="w-full h-12 rounded-xl text-white font-semibold"
        style={{ background: 'linear-gradient(135deg, #0055A4, #1a7de8)' }}
      >
        Valider le changement de cycle
      </button>
    </div>
  );
}
