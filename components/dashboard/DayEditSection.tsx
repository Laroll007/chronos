'use client';

import { useMemo, useState } from 'react';
import { GraduationCap, PencilLine, Undo2 } from 'lucide-react';
import type { CycleConfig, JourModifie } from '@/lib/types';
import { horairesDuJour } from '@/lib/horaires';
import {
  effetJournee, heureDebutHabituelle, hsRappel, joursModifiesEntre, vacationPrevue,
  type ChoixRappel, type CompensationRappel, type EffetJournee,
} from '@/lib/journees';
import { formatMinutes, isWorkingDay } from '@/lib/calculations';
import { fromDayKey, toDayKey } from '@/lib/events';
import { TimeSelect } from '@/components/shared/TimeSelect';

type Saisie = { date: string; type: JourModifie['type']; debut?: number; fin?: number; choix?: ChoixRappel };

interface DayEditSectionProps {
  start: Date;
  end: Date;
  cycleConfig: CycleConfig;
  joursModifies: JourModifie[];
  onSave: (saisies: Saisie[]) => boolean;
  onDelete: (date: string) => boolean;
  /** Ouvre « Modifier mon cycle » (horaires habituels non renseignés). */
  onSetHoraires?: () => void;
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
  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label htmlFor={`${idPrefix}-debut`} className="text-xs font-medium text-slate-600">Prise de service</label>
        <div className="mt-1">
          <TimeSelect id={`${idPrefix}-debut`} label="Prise de service" value={toHHMM(debut)}
            onChange={(val) => { const v = fromHHMM(val); if (v !== null) onDebut(v); }} />
        </div>
      </div>
      <div>
        <label htmlFor={`${idPrefix}-fin`} className="text-xs font-medium text-slate-600">Fin de service</label>
        <div className="mt-1">
          <TimeSelect id={`${idPrefix}-fin`} label="Fin de service" value={toHHMM(fin)}
            onChange={(val) => { const v = fromHHMM(val); if (v !== null) onFin(v); }} />
        </div>
      </div>
    </div>
  );
}

const LIBELLE_RAPPEL: Record<CompensationRappel, string> = {
  '100': '100 % des heures',
  '150': '150 % des heures',
  '200': '200 % des heures',
  '1vac': '1 vacation',
  '150vac': '1,5 vacation (150 % de la vacation)',
  '2vac': '2 vacations',
  libre: 'Selon GesTT : je saisis mes HS',
};

/**
 * Rappel sur un repos : barème APORTT présélectionné ; l'agent peut toujours
 * recopier les HS de GesTT (statistique anonyme qui vérifie le barème).
 */
function CompensationRappelChoix({
  e, mode, libre, onMode, onLibre,
}: {
  e: EffetJournee;
  mode: CompensationRappel | undefined;
  libre: number;
  onMode: (m: CompensationRappel) => void;
  onLibre: (minutes: number) => void;
}) {
  const r = e.rappel!;
  const choix = [...r.modes, 'libre' as const];
  return (
    <fieldset className="rounded-lg bg-white border border-sky-100 p-3 space-y-2">
      <legend className="px-1 text-xs font-semibold text-slate-700">Compensation du rappel</legend>
      <p className="text-xs text-slate-600">
        Travail sur un {e.nature === 'RL' ? 'repos légal' : 'repos compensateur'} : c’est un rappel, crédité
        en HS, <strong>sans RPS</strong>.
        {' '}Barème APORTT des gardiens et gradés ; officiers, ou montant différent dans GesTT : saisissez vos HS.
      </p>
      {choix.map((m) => (
        <label key={m} className="flex items-center gap-2 text-sm text-slate-800 cursor-pointer">
          <input type="radio" name="compensation-rappel" checked={mode === m} onChange={() => onMode(m)} />
          <span className="flex-1">
            {LIBELLE_RAPPEL[m]}
            {m === r.defaut && <span className="ml-1 text-xs text-emerald-700">(barème APORTT)</span>}
          </span>
          {m !== 'libre' && (
            <span className="text-xs font-semibold text-slate-600">+{formatMinutes(hsRappel(m, e.duree, r.vacation))}</span>
          )}
        </label>
      ))}
      {mode === 'libre' && (
        <div className="flex items-center gap-2 pl-6">
          <input
            type="number" min={0} max={99} inputMode="numeric" aria-label="HS créditées — heures"
            value={Math.floor(libre / 60) || ''} placeholder="0"
            onChange={(ev) => onLibre((parseInt(ev.target.value) || 0) * 60 + (libre % 60))}
            className="w-16 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-center"
          />
          <span className="text-xs text-slate-500">h</span>
          <input
            type="number" min={0} max={59} inputMode="numeric" aria-label="HS créditées — minutes"
            value={libre % 60 || ''} placeholder="0"
            onChange={(ev) => onLibre(Math.floor(libre / 60) * 60 + Math.min(59, parseInt(ev.target.value) || 0))}
            className="w-16 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-center"
          />
          <span className="text-xs text-slate-500">min</span>
        </div>
      )}
      <p className="text-[11px] text-slate-500">
        Une saisie GesTT est comptée anonymement : elle nous aide à vérifier le barème sur le terrain.
      </p>
    </fieldset>
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
        {' · '}RPS : <strong>{e.rappel ? 'aucun (rappel)' : e.rpsDelta !== 0 ? signe(e.rpsDelta) : 'inchangés'}</strong>
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
export function DayEditSection({ start, end, cycleConfig, joursModifies, onSave, onDelete, onSetHoraires }: DayEditSectionProps) {
  const jours = useMemo(() => joursDe(start, end), [start, end]);
  const unJour = jours.length === 1;
  const existants = joursModifiesEntre(start, end, joursModifies);
  const existant = unJour ? existants[0] : undefined;
  const travaille = unJour && isWorkingDay(start, cycleConfig);
  const prevue = unJour ? vacationPrevue(start, cycleConfig) : null;

  const [ouvert, setOuvert] = useState(false);
  const [mode, setMode] = useState<JourModifie['type']>(existant?.type ?? (unJour ? 'horaires' : 'stage'));
  // Pré-remplissage : la journée déjà saisie, sinon les horaires habituels de
  // l'agent (y compris sur un repos, s'il les a renseignés), sinon 08h–17h.
  const habituelle = cycleConfig.heureDebut !== undefined || prevue
    ? { debut: heureDebutHabituelle(cycleConfig, start), duree: horairesDuJour(start, cycleConfig).duree }
    : null;
  const [debut, setDebut] = useState(existant?.debut ?? habituelle?.debut ?? 8 * 60);
  const [fin, setFin] = useState(
    existant?.fin ?? (habituelle ? (habituelle.debut + habituelle.duree) % (24 * 60) : 17 * 60)
  );
  const horairesInconnus = cycleConfig.type !== 'hebdo' && cycleConfig.heureDebut === undefined;
  // Rappel sur un repos (un seul jour) : formule choisie et HS saisies d'après GesTT.
  const [modeRappel, setModeRappel] = useState<CompensationRappel | undefined>(existant?.compensation);
  const [hsLibre, setHsLibre] = useState(existant?.hsLibre ?? 0);

  // Stage sur plusieurs jours : seuls les repos ont besoin d'horaires (rappel).
  const repos = jours.filter((d) => !isWorkingDay(d, cycleConfig));
  const besoinHoraires = mode === 'horaires' || (mode === 'stage' && (unJour ? !travaille : repos.length > 0));

  // Formule proposée selon la durée (≤ 4h / > 4h) : un choix devenu impossible
  // (durée modifiée) retombe sur la règle.
  const rappelSansChoix = unJour ? effetJournee(start, mode, debut, fin, cycleConfig).rappel : undefined;
  const choixRappel: ChoixRappel | undefined = (() => {
    if (!rappelSansChoix) return undefined;
    const m = modeRappel === 'libre' || (modeRappel && rappelSansChoix.modes.includes(modeRappel)) ? modeRappel : rappelSansChoix.defaut;
    return m ? { mode: m, ...(m === 'libre' && { libre: hsLibre }) } : undefined;
  })();
  const choixManquant = !!rappelSansChoix && !choixRappel;

  const apercus = useMemo(
    () => jours.map((d) => effetJournee(d, mode, debut, fin, cycleConfig, unJour ? choixRappel : undefined)),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- choixRappel dérive de modeRappel / hsLibre
    [jours, mode, debut, fin, cycleConfig, unJour, modeRappel, hsLibre]
  );
  const total = apercus.reduce((t, e) => ({ hs: t.hs + e.hs, rps: t.rps + e.rpsDelta }), { hs: 0, rps: 0 });

  const enregistrer = () => {
    const saisies: Saisie[] = jours.map((d) => {
      const date = toDayKey(d);
      const surRepos = !isWorkingDay(d, cycleConfig);
      return mode === 'stage' && !surRepos
        ? { date, type: 'stage' }
        : { date, type: mode, debut, fin, ...(unJour && choixRappel && { choix: choixRappel }) };
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
                  : 'Stage sur un jour de repos : c’est un rappel, compensé en HS (sans RPS).'
                : `${jours.length - repos.length} jour(s) travaillé(s) remplacé(s) par le stage, sans effet.`
                  + (repos.length > 0 ? ` ${repos.length} jour(s) de repos : rappel, horaires du stage crédités en HS.` : '')}
            </p>
          )}

          {besoinHoraires && horairesInconnus && (
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
              Vos horaires habituels ne sont pas renseignés : le calcul suppose une prise de
              service à {toHHMM(heureDebutHabituelle(cycleConfig)).replace(':', 'h')}.{' '}
              {onSetHoraires && (
                <button type="button" onClick={onSetHoraires} className="font-semibold underline underline-offset-2">
                  Renseigner mes horaires
                </button>
              )}
            </p>
          )}

          {besoinHoraires && (
            <>
              {!unJour && <p className="text-xs font-medium text-slate-700">Horaires du stage les jours de repos</p>}
              <Horaires debut={debut} fin={fin} onDebut={setDebut} onFin={setFin} idPrefix="jour" />
              {unJour && apercus[0]!.rappel && (
                <CompensationRappelChoix
                  e={apercus[0]!}
                  mode={choixRappel?.mode}
                  libre={hsLibre}
                  onMode={setModeRappel}
                  onLibre={setHsLibre}
                />
              )}
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
            {choixManquant && (
              <p className="mr-3 self-center text-xs text-amber-700">Choisissez la compensation du rappel.</p>
            )}
            <button
              type="button"
              onClick={enregistrer}
              disabled={choixManquant}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 disabled:opacity-50"
            >
              Enregistrer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
