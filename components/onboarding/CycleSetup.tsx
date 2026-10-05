'use client';

import { useState } from 'react';
import { CycleConfig, CycleType, WeekType, WeekSchedule, CyclePattern, WeekHours } from '@/lib/types';
import { JOURS_SEMAINE, HEURES_PAR_JOUR, CA_PAR_CYCLE } from '@/lib/constants';
import { DEFAULT_CYCLE_ALTERNE_A, DEFAULT_CYCLE_ALTERNE_B, DEFAULT_HEBDO_HEURES } from '@/lib/types';
import { baremeRPSDepuisHoraires, baremeRPSNuit, baremeRPSParDefaut, minutesDeNuit } from '@/lib/rps';
import { aujourdhuiISO, getWeekType, lundiDeLaSemaine, positionDansRotation, ROTATIONS } from '@/lib/calculations';
import { Clock, ChevronRight, Copy } from 'lucide-react';
import { TimeSelect } from '@/components/shared/TimeSelect';

const JOURS_CLES: (keyof WeekSchedule)[] = [
  'dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi',
];

const formatJour = (d: Date): string =>
  d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

/** « Du lundi 21 au dimanche 27 septembre 2026 » pour la semaine du lundi `iso`. */
const formatSemaine = (iso: string): string => {
  const [a, m, j] = iso.split('-').map(Number);
  const lundi = new Date(a, m - 1, j);
  const dimanche = new Date(a, m - 1, j + 6);
  const debut = lundi.toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric',
    ...(lundi.getMonth() !== dimanche.getMonth() ? { month: 'long' } : {}),
    ...(lundi.getFullYear() !== dimanche.getFullYear() ? { year: 'numeric' } : {}),
  });
  const fin = dimanche.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return `Du ${debut} au ${fin}`;
};

// Horaires : 'HH:MM' <-> minutes après minuit
const toHHMM = (min: number): string =>
  `${String(Math.floor(min / 60) % 24).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
const fromHHMM = (v: string): number | null => {
  const m = /^(\d{2}):(\d{2})$/.exec(v);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};
/** Date locale 'YYYY-MM-DD' décalée de `jours`. */
const decalerISO = (iso: string, jours: number): string => {
  const [a, m, j] = iso.split('-').map(Number);
  const d = new Date(a, m - 1, j + jours);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const ORDINAUX = ['1er', '2e', '3e', '4e', '5e', '6e'];

// Cycles proposés à l'inscription. Les autres restent « Prochainement ».
const PATTERNS_DISPONIBLES: CyclePattern[] = ['2/2/3/2/2/3', '3/3'];

const DUREE_MIN = 60;
const DUREE_MAX = 16 * 60;

interface CycleSetupProps {
  onNext: (config: CycleConfig) => void;
  initialConfig?: CycleConfig;
}

// Jours travaillés du cycle hebdo (samedi/dimanche = repos officiels, exclus)
const HEBDO_DAYS: { key: keyof WeekHours; label: string }[] = [
  { key: 'lundi', label: 'Lundi' },
  { key: 'mardi', label: 'Mardi' },
  { key: 'mercredi', label: 'Mercredi' },
  { key: 'jeudi', label: 'Jeudi' },
  { key: 'vendredi', label: 'Vendredi' },
];

// Construit la map d'heures hebdo depuis une config (avec rétro-compat legacy 4 longs + 1 court)
function buildHebdoHeures(cfg?: CycleConfig): WeekHours {
  if (cfg?.heuresSemaine) return cfg.heuresSemaine;
  if (cfg?.type === 'hebdo') {
    const normal = cfg.heuresParJour ?? DEFAULT_HEBDO_HEURES.lundi;
    const court = cfg.heuresJourCourt ?? DEFAULT_HEBDO_HEURES.vendredi;
    return { lundi: normal, mardi: normal, mercredi: normal, jeudi: normal, vendredi: court, samedi: 0, dimanche: 0 };
  }
  return DEFAULT_HEBDO_HEURES;
}

export function CycleSetup({ onNext, initialConfig }: CycleSetupProps) {
  const [cycleType, setCycleType] = useState<CycleType>(initialConfig?.type ?? 'alterne');
  const [cyclePattern, setCyclePattern] = useState<CyclePattern>(
    initialConfig?.pattern && PATTERNS_DISPONIBLES.includes(initialConfig.pattern) ? initialConfig.pattern : '2/2/3/2/2/3'
  );
  // Cycle en rotation (3/3) : l'agent dit où il en est aujourd'hui dans la
  // série (0 = 1er jour travaillé). La référence interne est le 1er jour de la
  // série en cours. Modification du cycle : reprise de la position actuelle.
  const rotation = cycleType === 'alterne' ? ROTATIONS[cyclePattern] : undefined;
  const [positionRotation, setPositionRotation] = useState<number | null>(() => {
    const rot = initialConfig?.pattern ? ROTATIONS[initialConfig.pattern] : undefined;
    if (!initialConfig || initialConfig.type !== 'alterne' || !rot) return null;
    return positionDansRotation(new Date(), initialConfig, rot);
  });
  // Horaires de vacation (cycle alterné). Défaut 07h00 → 19h08 : un agent de
  // jour n'a rien à toucher. Agent déjà inscrit sans horaires : on part de son
  // ancien réglage jour/nuit (19h00 pour la nuit), qu'il peut corriger ici.
  const [heureDebut, setHeureDebut] = useState<number>(
    () => initialConfig?.heureDebut ?? ((initialConfig?.rpsParJour?.lundi ?? 0) > 0 ? 19 * 60 : 7 * 60)
  );
  const [heureFin, setHeureFin] = useState<number>(
    () => ((initialConfig?.heureDebut ?? ((initialConfig?.rpsParJour?.lundi ?? 0) > 0 ? 19 * 60 : 7 * 60))
      + (initialConfig?.heuresParJour ?? HEURES_PAR_JOUR)) % (24 * 60)
  );
  // Fin avant le début = fin le lendemain (vacation de nuit ou mixte).
  const dureeVacation = (heureFin - heureDebut + 24 * 60) % (24 * 60);
  const horaireInvalide =
    cycleType === 'alterne' && (dureeVacation < DUREE_MIN || dureeVacation > DUREE_MAX);
  const [heuresSemaine, setHeuresSemaine] = useState<WeekHours>(buildHebdoHeures(initialConfig));

  // Heure locale : l'ancien calcul passait par toISOString() (UTC) et renvoyait
  // le DIMANCHE pour une inscription faite entre minuit et 2 h du matin.
  const getMondayOfCurrentWeek = (): string => lundiDeLaSemaine(aujourdhuiISO());

  const lundiCourant = getMondayOfCurrentWeek();
  // Nouvel agent : aucune semaine présélectionnée, le choix doit être explicite
  // (une valeur par défaut laissée telle quelle donnait un cycle inversé).
  // Modification du cycle : on reprend la semaine que l'ancien réglage donne
  // pour la semaine en cours.
  const [semaineActuelle, setSemaineActuelle] = useState<WeekType | null>(() => {
    if (!initialConfig || initialConfig.type !== 'alterne') return null;
    const [a, m, j] = lundiCourant.split('-').map(Number);
    return getWeekType(new Date(a, m - 1, j), initialConfig);
  });
  const [semaineA, setSemaineA] = useState<WeekSchedule>(initialConfig?.semaineA ?? DEFAULT_CYCLE_ALTERNE_A);
  const [semaineB, setSemaineB] = useState<WeekSchedule>(initialConfig?.semaineB ?? DEFAULT_CYCLE_ALTERNE_B);
  const aujourdhuiTravaille =
    semaineActuelle !== null &&
    (semaineActuelle === 'A' ? semaineA : semaineB)[JOURS_CLES[new Date().getDay()]];
  const choixManquant =
    cycleType === 'alterne' && (rotation ? positionRotation === null : semaineActuelle === null);

  // Service de jour ou de nuit — détermine le barème de crédit des RPS.
  // L'APORTT accorde 0,4 le dimanche et 0,1 pour le travail de nuit (21h–6h) :
  // un agent de nuit récupère à chaque vacation, pas seulement le dimanche.
  // Déduit du barème existant si l'agent revient modifier son cycle.
  const [serviceDeNuit, setServiceDeNuit] = useState<boolean>(
    () => (initialConfig?.rpsParJour?.lundi ?? 0) > 0
  );

  const toggleDay = (week: 'A' | 'B', day: keyof WeekSchedule) => {
    if (week === 'A') setSemaineA((prev) => ({ ...prev, [day]: !prev[day] }));
    else setSemaineB((prev) => ({ ...prev, [day]: !prev[day] }));
  };

  const updateDayHours = (day: keyof WeekHours, minutes: number) =>
    setHeuresSemaine((prev) => ({ ...prev, [day]: Math.max(0, minutes) }));

  // Recopie la durée du lundi sur les autres jours travaillés (Ma-Ve)
  const applyMondayToAll = () =>
    setHeuresSemaine((prev) => ({
      ...prev, mardi: prev.lundi, mercredi: prev.lundi, jeudi: prev.lundi, vendredi: prev.lundi,
    }));

  const hebdoTotal = HEBDO_DAYS.reduce((sum, d) => sum + (heuresSemaine[d.key] || 0), 0);

  const handleSubmit = () => {
    if (choixManquant || horaireInvalide) return;
    const isHebdo = cycleType === 'hebdo';
    // En hebdo, un jour est "travaillé" s'il a des heures > 0 (samedi/dimanche = repos)
    const hebdoSchedule: WeekSchedule = {
      lundi: heuresSemaine.lundi > 0,
      mardi: heuresSemaine.mardi > 0,
      mercredi: heuresSemaine.mercredi > 0,
      jeudi: heuresSemaine.jeudi > 0,
      vendredi: heuresSemaine.vendredi > 0,
      samedi: false,
      dimanche: false,
    };
    onNext({
      type: cycleType,
      pattern: isHebdo ? undefined : cyclePattern,
      heuresParJour: isHebdo ? (heuresSemaine.lundi || HEURES_PAR_JOUR) : dureeVacation,
      heureDebut: isHebdo ? undefined : heureDebut,
      heuresJourCourt: undefined,
      heuresSemaine: isHebdo ? { ...heuresSemaine, samedi: 0, dimanche: 0 } : undefined,
      // Hebdo : on force une semaine de référence stable (lundi du jour J),
      // car la date de réf et l'alternance A/B n'ont pas de sens en hebdo.
      // Rotation : 1er jour de la série travaillée en cours.
      dateDebutCycle: rotation && positionRotation !== null
        ? decalerISO(aujourdhuiISO(), -positionRotation)
        : lundiCourant,
      semaineActuelle: isHebdo ? 'A' : semaineActuelle ?? 'A',
      semaineA: isHebdo ? hebdoSchedule : semaineA,
      semaineB: isHebdo ? undefined : semaineB,
      // Cycle alterné : barème exact d'après les horaires (nuit 21h–6h, dimanche).
      // Hebdo : choix jour / nuit, inchangé.
      rpsParJour: !isHebdo
        ? baremeRPSDepuisHoraires(heureDebut, dureeVacation)
        : serviceDeNuit
          ? baremeRPSNuit(heuresSemaine.lundi || HEURES_PAR_JOUR)
          : baremeRPSParDefaut(),
    });
  };

  const formatHeures = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h}h${m.toString().padStart(2, '0')}`;
  };

  const cardClass = 'rounded-xl border border-slate-200 py-6 shadow-sm bg-white';
  const labelClass = 'text-sm text-slate-500';
  const titleClass = 'font-semibold text-lg text-slate-800 leading-none mb-1';
  const inputClass = 'rounded-md border border-slate-200 bg-white px-3 text-slate-800 text-base outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-colors';

  return (
    <div className="space-y-5">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-slate-800 mb-1">Configuration du cycle</h2>
        <p className={labelClass}>Définissez votre rythme de travail</p>
      </div>

      {/* Type de cycle */}
      <div className={cardClass}>
        <div className="px-6 mb-4">
          <div className={titleClass}>Type de cycle</div>
          <div className={labelClass}>Choisissez votre organisation de travail</div>
        </div>
        <div className="px-6">
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setCycleType('alterne')}
              className={`p-4 rounded-xl border-2 transition-all duration-200 hover:scale-105 text-left ${
                cycleType === 'alterne'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <div className="font-semibold text-slate-800">Cycle alterné</div>
              <div className="text-sm text-slate-500">2/2/3/2/2/3, 3/3…</div>
            </button>
            <button
              type="button"
              onClick={() => setCycleType('hebdo')}
              className={`p-4 rounded-xl border-2 transition-all duration-200 hover:scale-105 text-left ${
                cycleType === 'hebdo'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-slate-200 hover:border-slate-300 bg-white'
              }`}
            >
              <div className="font-semibold text-slate-800">Hebdomadaire</div>
              <div className="text-sm text-slate-500">Même chaque semaine</div>
            </button>
          </div>
        </div>
      </div>

      {/* Rythme de cycle */}
      {cycleType === 'alterne' && (
        <div className={cardClass}>
          <div className="px-6 mb-4">
            <div className={titleClass}>Rythme de cycle (APORTT)</div>
            <div className={labelClass}>Détermine votre nombre de CA annuels</div>
          </div>
          <div className="px-6">
            <div className="flex flex-col gap-2">
              {([
                { value: '2/2/3/2/2/3', label: 'Cycle 2/2/3/2/2/3', detail: 'Semaines A/B' },
                { value: '3/3', label: 'Cycle 3/3', detail: '3 jours travaillés, 3 jours de repos' },
              ] as { value: CyclePattern; label: string; detail: string }[]).map((cycle) => (
                <button
                  key={cycle.value}
                  type="button"
                  onClick={() => setCyclePattern(cycle.value)}
                  aria-pressed={cyclePattern === cycle.value}
                  className={`w-full px-4 py-3 rounded-xl border-2 text-left transition-all duration-200 hover:scale-[1.01] ${
                    cyclePattern === cycle.value
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <span className="font-semibold text-slate-800">{cycle.label}</span>
                  <span className="ml-2 text-sm text-slate-500">{CA_PAR_CYCLE[cycle.value]} CA</span>
                  <span className="block text-xs text-slate-500 mt-0.5">{cycle.detail}</span>
                </button>
              ))}
              {([
                { value: '4/2', label: 'Cycle 4/2', ca: CA_PAR_CYCLE['4/2'] },
                { value: '2/2', label: 'Cycle 2/2', ca: CA_PAR_CYCLE['2/2'] },
                { value: 'vacation_forte', label: 'Vacation Forte', ca: CA_PAR_CYCLE['vacation_forte'] },
              ] as { value: CyclePattern; label: string; ca: number }[]).map((cycle) => (
                <div key={cycle.value} className="relative">
                  <div className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 bg-slate-50 opacity-50 cursor-not-allowed select-none">
                    <span className="font-semibold text-slate-800">{cycle.label}</span>
                    <span className="ml-2 text-sm text-slate-500">{cycle.ca} CA</span>
                  </div>
                  <span className="absolute -top-2 -right-2 px-2 py-0.5 rounded-full text-[10px] font-semibold leading-tight" style={{ background: 'rgba(239,65,53,0.12)', border: '1px solid rgba(239,65,53,0.35)', color: '#c0392b' }}>
                    Prochainement
                  </span>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-400 mt-3">
              Votre cycle détermine le nombre de congés annuels selon la réglementation APORTT.
            </p>
          </div>
        </div>
      )}

      {/* Durée de journée */}
      <div className={cardClass}>
        <div className="px-6 mb-4">
          <div className="font-semibold text-lg text-slate-800 leading-none flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-600" />
            {cycleType === 'alterne' ? 'Vos horaires de vacation' : 'Durée de journée'}
          </div>
          {cycleType === 'alterne' && (
            <div className={`${labelClass} mt-1`}>Jour, nuit ou mixte : ils calculent vos RPS automatiquement</div>
          )}
          {cycleType === 'hebdo' && (
            <div className={`${labelClass} mt-1`}>Heures travaillées par jour (Lu-Ve) — samedi/dimanche en repos</div>
          )}
        </div>
        {cycleType === 'alterne' ? (
          <div className="px-6 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="heure-debut" className="text-sm font-medium text-slate-600">Prise de service</label>
                <div className="mt-2">
                  <TimeSelect
                    id="heure-debut"
                    label="Prise de service"
                    value={toHHMM(heureDebut)}
                    onChange={(val) => {
                      const v = fromHHMM(val);
                      if (v !== null) setHeureDebut(v);
                    }}
                  />
                </div>
              </div>
              <div>
                <label htmlFor="heure-fin" className="text-sm font-medium text-slate-600">Fin de service</label>
                <div className="mt-2">
                  <TimeSelect
                    id="heure-fin"
                    label="Fin de service"
                    value={toHHMM(heureFin)}
                    onChange={(val) => {
                      const v = fromHHMM(val);
                      if (v !== null) setHeureFin(v);
                    }}
                  />
                </div>
              </div>
            </div>
            {horaireInvalide ? (
              <p className="text-sm text-rose-600">Vérifiez vos horaires : une vacation dure entre 1 h et 16 h.</p>
            ) : (
              <div className="rounded-lg bg-blue-50 border border-blue-100 p-3 text-sm text-blue-900 space-y-1">
                <p>
                  <strong>Durée : {formatHeures(dureeVacation)}</strong>
                  {heureFin <= heureDebut && ' (fin le lendemain)'}
                  {minutesDeNuit(heureDebut, dureeVacation) > 0 &&
                    ` · dont ${formatHeures(minutesDeNuit(heureDebut, dureeVacation))} de nuit (21h–6h)`}
                </p>
                {(() => {
                  const b = baremeRPSDepuisHoraires(heureDebut, dureeVacation);
                  return (
                    <p className="text-blue-800">
                      RPS par vacation : {b.lundi > 0 ? `${formatHeures(b.lundi)} en semaine · ` : ''}
                      {formatHeures(b.samedi)} le samedi · {formatHeures(b.dimanche)} le dimanche
                    </p>
                  );
                })()}
              </div>
            )}
          </div>
        ) : (
          <div className="px-6 space-y-3">
            {HEBDO_DAYS.map((d) => {
              const mins = heuresSemaine[d.key] || 0;
              return (
                <div key={d.key} className="flex items-center justify-between gap-2">
                  <label className="text-sm font-medium text-slate-600 w-24">{d.label}</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      max={24}
                      value={Math.floor(mins / 60)}
                      onChange={(e) => updateDayHours(d.key, (parseInt(e.target.value) || 0) * 60 + (mins % 60))}
                      onFocus={(e) => e.target.select()}
                      aria-label={`${d.label} heures`}
                      className={`w-16 h-9 ${inputClass}`}
                    />
                    <span className="text-slate-400">h</span>
                    <input
                      type="number"
                      min={0}
                      max={59}
                      value={mins % 60}
                      onChange={(e) => updateDayHours(d.key, Math.floor(mins / 60) * 60 + (parseInt(e.target.value) || 0))}
                      onFocus={(e) => e.target.select()}
                      aria-label={`${d.label} minutes`}
                      className={`w-16 h-9 ${inputClass}`}
                    />
                    <span className="text-slate-400">min</span>
                  </div>
                </div>
              );
            })}

            <button
              type="button"
              onClick={applyMondayToAll}
              className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              <Copy className="w-4 h-4" />
              Appliquer le lundi à tous les jours
            </button>

            {/* Total hebdo */}
            <div className="mt-2 p-3 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-between">
              <span className="text-sm text-blue-700">Total semaine</span>
              <span className="text-lg font-bold text-blue-700">{formatHeures(hebdoTotal)}</span>
            </div>
            <p className="text-xs text-slate-400">
              Mettez 0h pour un jour de repos. Samedi et dimanche sont des repos officiels (les astreintes se posent sur le calendrier).
            </p>
          </div>
        )}
      </div>

      {/* Semaine en cours — uniquement pour cycle alterné (en hebdo, semaine = Lu-Ve).
          On ne demande plus de date : une date saisie à la main qui n'était pas
          un lundi décalait toute l'alternance A/B. L'agent dit seulement si la
          semaine en cours est A ou B ; la référence interne est son lundi. */}
      {rotation && (
        <div className={cardClass}>
          <div className="px-6 mb-4">
            <div className={titleClass}>Où en êtes-vous aujourd&apos;hui ?</div>
            <div className={labelClass}>{formatJour(new Date())}</div>
          </div>
          <div className="px-6 space-y-3">
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Position dans le cycle">
              {Array.from({ length: rotation[0] + rotation[1] }, (_, i) => {
                const travail = i < rotation[0];
                const rang = travail ? i : i - rotation[0];
                const actif = positionRotation === i;
                return (
                  <button
                    key={i}
                    type="button"
                    role="radio"
                    aria-checked={actif}
                    onClick={() => setPositionRotation(i)}
                    className={`px-2 py-2.5 rounded-xl border-2 text-sm font-medium leading-tight transition-all ${
                      actif
                        ? travail
                          ? 'border-blue-600 bg-blue-600 text-white shadow-md'
                          : 'border-red-500 bg-red-500 text-white shadow-md'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    {ORDINAUX[rang]} jour
                    <span className="block text-xs font-normal opacity-80">{travail ? 'travaillé' : 'de repos'}</span>
                  </button>
                );
              })}
            </div>
            {positionRotation !== null ? (
              <div>
                <p className="text-xs text-slate-500 mb-1.5">Vos 12 prochains jours :</p>
                <div className="grid grid-cols-12 gap-0.5" aria-hidden="true">
                  {Array.from({ length: 12 }, (_, k) => {
                    const d = new Date();
                    d.setDate(d.getDate() + k);
                    const travail = (positionRotation + k) % (rotation[0] + rotation[1]) < rotation[0];
                    return (
                      <div key={k} className="text-center">
                        <div className="text-[10px] text-slate-500 capitalize">
                          {d.toLocaleDateString('fr-FR', { weekday: 'narrow' })}
                        </div>
                        <div className={`h-6 rounded text-[10px] font-semibold flex items-center justify-center ${
                          travail ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'
                        } ${k === 0 ? 'ring-2 ring-offset-1 ring-amber-400' : ''}`}>
                          {d.getDate()}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="text-xs text-slate-500 mt-2">En bleu, les jours travaillés. Si ce n&apos;est pas le cas, changez de case.</p>
              </div>
            ) : (
              <p className="text-xs text-slate-500">Choisissez votre position dans la série d&apos;aujourd&apos;hui.</p>
            )}
          </div>
        </div>
      )}

      {cycleType === 'alterne' && !rotation && (
      <div className={cardClass}>
        <div className="px-6 mb-4">
          <div className={titleClass}>Semaine en cours</div>
          <div className={labelClass}>{formatSemaine(lundiCourant)}</div>
        </div>
        <div className="px-6">
          <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Semaine en cours">
            {(['A', 'B'] as WeekType[]).map((w) => (
              <button
                key={w}
                type="button"
                role="radio"
                aria-checked={semaineActuelle === w}
                onClick={() => setSemaineActuelle(w)}
                className={`h-12 rounded-xl border-2 text-base font-semibold transition-all ${
                  semaineActuelle === w
                    ? w === 'A'
                      ? 'border-blue-600 bg-blue-600 text-white shadow-md'
                      : 'border-red-500 bg-red-500 text-white shadow-md'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                }`}
              >
                Semaine {w}
              </button>
            ))}
          </div>
          {semaineActuelle ? (
            <p className="mt-3 text-xs text-slate-500">
              D&apos;après votre choix, aujourd&apos;hui ({formatJour(new Date())}) est un{' '}
              <strong>{aujourdhuiTravaille ? 'jour travaillé' : 'jour de repos'}</strong>.
              Si ce n&apos;est pas le cas, changez de semaine.
            </p>
          ) : (
            <p className="mt-3 text-xs text-slate-500">
              Choisissez la semaine dans laquelle vous êtes cette semaine.
            </p>
          )}
        </div>
      </div>
      )}

      {/* Semaine A / Jours travaillés — uniquement pour cycle alterné (en hebdo, c'est figé Lu-Ve) */}
      {cycleType === 'alterne' && !rotation && (
      <div className={cardClass}>
        <div className="px-6 mb-4">
          <div className={titleClass}>Semaine A</div>
          <div className={labelClass}>Sélectionnez les jours travaillés</div>
        </div>
        <div className="px-6">
          <div className="flex flex-wrap gap-2">
            {JOURS_SEMAINE.map((jour) => (
              <button
                key={jour.key}
                type="button"
                onClick={() => toggleDay('A', jour.key as keyof WeekSchedule)}
                className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 hover:scale-105 border ${
                  semaineA[jour.key as keyof WeekSchedule]
                    ? 'text-white border-transparent scale-105'
                    : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                }`}
                style={semaineA[jour.key as keyof WeekSchedule] ? {
                  background: 'linear-gradient(135deg, #0055A4, #1a7de8)',
                  boxShadow: '0 4px 12px rgba(0,85,164,0.25)',
                } : undefined}
              >
                {jour.short}
              </button>
            ))}
          </div>
        </div>
      </div>
      )}

      {/* Semaine B — rouge français */}
      {cycleType === 'alterne' && !rotation && (
        <div className={cardClass}>
          <div className="px-6 mb-4">
            <div className={titleClass}>Semaine B</div>
            <div className={labelClass}>Jours travaillés en semaine alternée</div>
          </div>
          <div className="px-6">
            <div className="flex flex-wrap gap-2">
              {JOURS_SEMAINE.map((jour) => (
                <button
                  key={jour.key}
                  type="button"
                  onClick={() => toggleDay('B', jour.key as keyof WeekSchedule)}
                  className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 hover:scale-105 border ${
                    semaineB[jour.key as keyof WeekSchedule]
                      ? 'text-white border-transparent scale-105'
                      : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                  }`}
                  style={semaineB[jour.key as keyof WeekSchedule] ? {
                    background: 'linear-gradient(135deg, #c0392b, #EF4135)',
                    boxShadow: '0 4px 12px rgba(239,65,53,0.25)',
                  } : undefined}
                >
                  {jour.short}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Service de jour / de nuit — barème RPS (hebdo ; en cycle alterné,
          les horaires ci-dessus donnent le barème exact) */}
      {cycleType === 'hebdo' && (
      <div className={cardClass}>
        <div className="px-6 mb-4">
          <div className={titleClass}>Vos vacations</div>
          <div className={`${labelClass} mt-1`}>
            Détermine vos repos de pénibilité (RPS) crédités automatiquement
          </div>
        </div>
        <div className="px-6 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setServiceDeNuit(false)}
            className={`p-4 rounded-xl border-2 text-left transition-all ${
              !serviceDeNuit
                ? 'border-blue-500 bg-blue-50'
                : 'border-slate-200 bg-white hover:border-slate-300'
            }`}
          >
            <div className="font-medium text-slate-800 text-sm">Service de jour</div>
            <div className="text-xs text-slate-500 mt-1">
              RPS les dimanches travaillés
            </div>
          </button>
          <button
            type="button"
            onClick={() => setServiceDeNuit(true)}
            className={`p-4 rounded-xl border-2 text-left transition-all ${
              serviceDeNuit
                ? 'border-indigo-500 bg-indigo-50'
                : 'border-slate-200 bg-white hover:border-slate-300'
            }`}
          >
            <div className="font-medium text-slate-800 text-sm">Service de nuit</div>
            <div className="text-xs text-slate-500 mt-1">
              RPS à chaque vacation travaillée
            </div>
          </button>
        </div>
        <div className="px-6 mt-3">
          <p className="text-xs text-slate-400">
            Modifiable à tout moment, jour par jour, depuis Compteurs → RPS.
          </p>
        </div>
      </div>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={choixManquant || horaireInvalide}
        className="inline-flex items-center justify-center gap-2 w-full h-14 text-lg font-semibold rounded-xl text-white hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg disabled:opacity-40 disabled:pointer-events-none"
        style={{
          background: 'linear-gradient(135deg, #0055A4 0%, #1a7de8 45%, #EF4135 100%)',
          boxShadow: '0 8px 24px rgba(0,85,164,0.25)',
        }}
      >
        {choixManquant ? (rotation ? 'Indiquez où vous en êtes' : 'Choisissez la semaine en cours') : horaireInvalide ? 'Vérifiez vos horaires' : 'Continuer'}
        <ChevronRight className="w-5 h-5" />
      </button>
    </div>
  );
}
