'use client';

import { useState } from 'react';
import { CycleConfig, CycleType, WeekType, WeekSchedule, CyclePattern, WeekHours } from '@/lib/types';
import { JOURS_SEMAINE, HEURES_PAR_JOUR, CA_PAR_CYCLE } from '@/lib/constants';
import { DEFAULT_CYCLE_ALTERNE_A, DEFAULT_CYCLE_ALTERNE_B, DEFAULT_HEBDO_HEURES } from '@/lib/types';
import { baremeRPSNuit, baremeRPSParDefaut } from '@/lib/rps';
import { aujourdhuiISO, getWeekType, lundiDeLaSemaine } from '@/lib/calculations';
import { Clock, ChevronRight, Copy } from 'lucide-react';

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
  const [cyclePattern, setCyclePattern] = useState<CyclePattern>('2/2/3/2/2/3');
  const [heuresParJour, setHeuresParJour] = useState(initialConfig?.heuresParJour ?? HEURES_PAR_JOUR);
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
  const choixManquant = cycleType === 'alterne' && semaineActuelle === null;

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
    if (choixManquant) return;
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
      heuresParJour: isHebdo ? (heuresSemaine.lundi || HEURES_PAR_JOUR) : heuresParJour,
      heuresJourCourt: undefined,
      heuresSemaine: isHebdo ? { ...heuresSemaine, samedi: 0, dimanche: 0 } : undefined,
      // Hebdo : on force une semaine de référence stable (lundi du jour J),
      // car la date de réf et l'alternance A/B n'ont pas de sens en hebdo.
      dateDebutCycle: lundiCourant,
      semaineActuelle: isHebdo ? 'A' : semaineActuelle ?? 'A',
      semaineA: isHebdo ? hebdoSchedule : semaineA,
      semaineB: isHebdo ? undefined : semaineB,
      rpsParJour: serviceDeNuit
        ? baremeRPSNuit(isHebdo ? (heuresSemaine.lundi || HEURES_PAR_JOUR) : heuresParJour)
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
              <div className="text-sm text-slate-500">Semaines A/B</div>
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
              <button
                type="button"
                onClick={() => setCyclePattern('2/2/3/2/2/3')}
                className={`w-full px-4 py-3 rounded-xl border-2 text-left transition-all duration-200 hover:scale-[1.01] ${
                  cyclePattern === '2/2/3/2/2/3'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <span className="font-semibold text-slate-800">Cycle 2/2/3/2/2/3</span>
                <span className="ml-2 text-sm text-slate-500">{CA_PAR_CYCLE['2/2/3/2/2/3']} CA</span>
              </button>
              {([
                { value: '4/2', label: 'Cycle 4/2', ca: CA_PAR_CYCLE['4/2'] },
                { value: '2/2', label: 'Cycle 2/2', ca: CA_PAR_CYCLE['2/2'] },
                { value: '3/3', label: 'Cycle 3/3', ca: CA_PAR_CYCLE['3/3'] },
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
            Durée de journée
          </div>
          {cycleType === 'hebdo' && (
            <div className={`${labelClass} mt-1`}>Heures travaillées par jour (Lu-Ve) — samedi/dimanche en repos</div>
          )}
        </div>
        {cycleType === 'alterne' ? (
          <div className="px-6">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <label htmlFor="heures" className="text-sm font-medium text-slate-600">
                  Heures par jour travaillé
                </label>
                <div className="flex items-center gap-2 mt-2">
                  <input
                    id="heures"
                    type="number"
                    min={1}
                    max={24}
                    value={Math.floor(heuresParJour / 60)}
                    onChange={(e) => {
                      const h = parseInt(e.target.value) || 0;
                      setHeuresParJour(h * 60 + (heuresParJour % 60));
                    }}
                    aria-label="Heures"
                    className={`w-20 h-9 ${inputClass}`}
                  />
                  <span className="text-slate-400">h</span>
                  <input
                    type="number"
                    min={0}
                    max={59}
                    value={heuresParJour % 60}
                    onChange={(e) => {
                      const m = parseInt(e.target.value) || 0;
                      setHeuresParJour(Math.floor(heuresParJour / 60) * 60 + m);
                    }}
                    aria-label="Minutes"
                    className={`w-20 h-9 ${inputClass}`}
                  />
                  <span className="text-slate-400">min</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm text-slate-400">Total</div>
                <div className="text-xl font-bold text-blue-600">{formatHeures(heuresParJour)}</div>
              </div>
            </div>
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
      {cycleType === 'alterne' && (
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
      {cycleType === 'alterne' && (
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
      {cycleType === 'alterne' && (
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

      {/* Service de jour / de nuit — barème RPS */}
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

      <button
        type="button"
        onClick={handleSubmit}
        disabled={choixManquant}
        className="inline-flex items-center justify-center gap-2 w-full h-14 text-lg font-semibold rounded-xl text-white hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg disabled:opacity-40 disabled:pointer-events-none"
        style={{
          background: 'linear-gradient(135deg, #0055A4 0%, #1a7de8 45%, #EF4135 100%)',
          boxShadow: '0 8px 24px rgba(0,85,164,0.25)',
        }}
      >
        {choixManquant ? 'Choisissez la semaine en cours' : 'Continuer'}
        <ChevronRight className="w-5 h-5" />
      </button>
    </div>
  );
}
