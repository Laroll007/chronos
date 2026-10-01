'use client';

import { useMemo, useState } from 'react';
import { GraduationCap, PencilLine, Undo2 } from 'lucide-react';
import type { CycleConfig, JourModifie } from '@/lib/types';
import { effetJournee, joursModifiesEntre, vacationPrevue, type EffetJournee } from '@/lib/journees';
import { formatMinutes, isWorkingDay } from '@/lib/calculations';
import { fromDayKey, toDayKey } from '@/lib/events';

type Saisie = { date: string; type: JourModifie['type']; debut?: number; fin?: number };

interface DayEditSectionProps {
  start: Date;
  end: Date;
  cycleConfig: CycleConfig;
  joursModifies: JourModifie[];
  onSave: (saisies: Saisie[]) => boolean;
  onDelete: (date: string) => boolean;
}

const toHHMM = (min: number) =>
  `${String(Math.floor(min / 60) % 24).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
const fromHHMM = (v: string): number | null => {
  const m = /^(\d{2}):(\d{2})$/.exec(v);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};
const signe = (n: number) => (n >= 0 ? `+${formatMinutes(n)}` : `−${formatMinutes(-n)}`);

const NATURE: Record<EffetJournee['nature'], string> = {
  travail: 'Jour travaillé',
  RC: 'Repos compensateur (RC)',
  RL: 'Repos légal (RL)',
};

function joursDe(start: Date, end: Date): Date[] {
  const out: Date[] = [];
  const d = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const fin = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  while (d <= fin) {
    out.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

function Horaires({
  debut, fin, onDebut, onFin, idPrefix,
}: { debut: number; fin: number; onDebut: (v: number) => void; onFin: (v: number) => void; idPrefix: string }) {
  const input = 'mt-1 w-full h-11 rounded-lg border border-slate-200 bg-white px-3 text-base text-slate-800';
  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label htmlFor={`${idPrefix}-debut`} className="text-xs font-medium text-slate-600">Prise de service</label>
        <input id={`${idPrefix}-debut`} type="time" value={toHHMM(debut)} className={input}
          onChange={(e) => { const v = fromHHMM(e.target.value); if (v !== null) onDebut(v); }} />
      </div>
      <div>
        <label htmlFor={`${idPrefix}-fin`} className="text-xs font-medium text-slate-600">Fin de service</label>
        <input id={`${idPrefix}-fin`} type="time" value={toHHMM(fin)} className={input}
          onChange={(e) => { const v = fromHHMM(e.target.value); if (v !== null) onFin(v); }} />
      </div>
    </div>
  );
}

function Apercu({ e, fin, debut }: { e: EffetJournee; debut: number; fin: number }) {
  return (
    <div className="rounded-lg bg-white border border-sky-100 p-3 text-xs text-slate-700 space-y-1">
      <p>
        {NATURE[e.nature]}{e.ferie && ' · jour férié'} · durée <strong>{formatMinutes(e.duree)}</strong>
        {fin <= debut && ' (fin le lendemain)'}
      </p>
      <p>
        HS : <strong>{e.hs > 0 ? `+${formatMinutes(e.hs)}` : 'aucune'}</strong>
        {' · '}RPS : <strong>{e.rpsDelta !== 0 ? signe(e.rpsDelta) : 'inchangés'}</strong>
      </p>
      {e.manque > 0 && (
        <p className="text-amber-700">
          Fin anticipée : il manque {formatMinutes(e.manque)}. Posez-les en congé (« Poser des heures » plus bas).
        </p>
      )}
    </div>
  );
}

/**
 * « Modifier cette journée » (horaires réels, stage) dans la fenêtre du jour.
 * Un seul jour : horaires ou stage. Plusieurs jours : stage.
 */
export function DayEditSection({ start, end, cycleConfig, joursModifies, onSave, onDelete }: DayEditSectionProps) {
  const jours = useMemo(() => joursDe(start, end), [start, end]);
  const unJour = jours.length === 1;
  const existants = joursModifiesEntre(start, end, joursModifies);
  const existant = unJour ? existants[0] : undefined;
  const travaille = unJour && isWorkingDay(start, cycleConfig);
  const prevue = unJour ? vacationPrevue(start, cycleConfig) : null;

  const [ouvert, setOuvert] = useState(false);
  const [mode, setMode] = useState<JourModifie['type']>(existant?.type ?? (unJour ? 'horaires' : 'stage'));
  const [debut, setDebut] = useState(existant?.debut ?? prevue?.debut ?? 8 * 60);
  const [fin, setFin] = useState(
    existant?.fin ?? (prevue ? (prevue.debut + prevue.duree) % (24 * 60) : 17 * 60)
  );

  // Stage sur plusieurs jours : seuls les repos ont besoin d'horaires (rappel).
  const repos = jours.filter((d) => !isWorkingDay(d, cycleConfig));
  const besoinHoraires = mode === 'horaires' || (mode === 'stage' && (unJour ? !travaille : repos.length > 0));

  const apercus = useMemo(
    () => jours.map((d) => effetJournee(d, mode, debut, fin, cycleConfig)),
    [jours, mode, debut, fin, cycleConfig]
  );
  const total = apercus.reduce((t, e) => ({ hs: t.hs + e.hs, rps: t.rps + e.rpsDelta }), { hs: 0, rps: 0 });

  const enregistrer = () => {
    const saisies: Saisie[] = jours.map((d) => {
      const date = toDayKey(d);
      const surRepos = !isWorkingDay(d, cycleConfig);
      return mode === 'stage' && !surRepos
        ? { date, type: 'stage' }
        : { date, type: mode, debut, fin };
    });
    if (onSave(saisies)) setOuvert(false);
  };

  return (
    <div className="mb-6 border-b border-border pb-6 space-y-2">
      {existants.map((j) => (
        <div key={j.id} className="flex items-center gap-3 p-3 rounded-lg bg-sky-50 border border-sky-200">
          {j.type === 'stage' ? <GraduationCap className="w-4 h-4 text-sky-700 shrink-0" /> : <PencilLine className="w-4 h-4 text-sky-700 shrink-0" />}
          <span className="flex-1 min-w-0 text-sm text-slate-800">
            <strong>{j.type === 'stage' ? 'Stage' : 'Horaires modifiés'}</strong>
            {!unJour && ` · ${fromDayKey(j.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}`}
            {j.debut !== undefined && j.fin !== undefined && ` · ${toHHMM(j.debut).replace(':', 'h')} → ${toHHMM(j.fin).replace(':', 'h')}`}
            {(j.hsCredite > 0 || j.rpsCredite !== 0) && (
              <span className="block text-xs text-slate-500">
                {j.hsCredite > 0 && `HS +${formatMinutes(j.hsCredite)}`}
                {j.hsCredite > 0 && j.rpsCredite !== 0 && ' · '}
                {j.rpsCredite !== 0 && `RPS ${signe(j.rpsCredite)}`}
              </span>
            )}
          </span>
          <button
            type="button"
            onClick={() => onDelete(j.date)}
            className="inline-flex items-center gap-1 text-xs font-medium text-rose-600 hover:text-rose-700"
          >
            <Undo2 className="w-3.5 h-3.5" /> Annuler
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={() => setOuvert((v) => !v)}
        className="flex items-center gap-2 text-left text-sm font-medium text-sky-700 hover:text-sky-800 transition-colors"
      >
        {unJour ? <PencilLine className="w-4 h-4 shrink-0" /> : <GraduationCap className="w-4 h-4 shrink-0" />}
        {ouvert
          ? 'Masquer'
          : unJour
            ? existant ? 'Modifier à nouveau cette journée' : 'Modifier cette journée (horaires réels, stage)'
            : `Marquer ces ${jours.length} jours en stage`}
      </button>

      {ouvert && (
        <div className="mt-3 p-4 rounded-lg bg-sky-50 border border-sky-200 space-y-3">
          {unJour && (
            <div className="grid grid-cols-2 gap-2" role="tablist">
              {(['horaires', 'stage'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="tab"
                  aria-selected={mode === m}
                  onClick={() => setMode(m)}
                  className={`h-10 rounded-lg border text-sm font-medium ${mode === m ? 'border-sky-500 bg-white text-sky-800' : 'border-transparent text-slate-600'}`}
                >
                  {m === 'horaires' ? 'Horaires réels' : 'Stage / formation'}
                </button>
              ))}
            </div>
          )}

          {mode === 'stage' && (
            <p className="text-xs text-slate-600">
              {unJour
                ? travaille
                  ? 'Le stage remplace votre vacation : journée de travail habituelle, sans effet sur vos compteurs.'
                  : 'Stage sur un jour de repos : c’est un rappel, la durée du stage est créditée en HS.'
                : `${jours.length - repos.length} jour(s) travaillé(s) remplacé(s) par le stage, sans effet.`
                  + (repos.length > 0 ? ` ${repos.length} jour(s) de repos : rappel, horaires du stage crédités en HS.` : '')}
            </p>
          )}

          {besoinHoraires && (
            <>
              {!unJour && <p className="text-xs font-medium text-slate-700">Horaires du stage les jours de repos</p>}
              <Horaires debut={debut} fin={fin} onDebut={setDebut} onFin={setFin} idPrefix="jour" />
              {unJour ? (
                <Apercu e={apercus[0]!} debut={debut} fin={fin} />
              ) : (
                <p className="rounded-lg bg-white border border-sky-100 p-3 text-xs text-slate-700">
                  Total : HS <strong>+{formatMinutes(total.hs)}</strong> · RPS <strong>{signe(total.rps)}</strong>
                </p>
              )}
            </>
          )}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={enregistrer}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-sky-600 hover:bg-sky-700"
            >
              Enregistrer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
