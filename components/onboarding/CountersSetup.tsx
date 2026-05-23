'use client';

import { useState, useMemo } from 'react';
import { Counters, CycleConfig } from '@/lib/types';
import { COUNTER_LABELS, COUNTER_COLORS } from '@/lib/constants';
import { DEFAULT_COUNTERS } from '@/lib/storage';
import { ChevronRight, ChevronLeft, Sparkles, ShieldCheck, ListChecks } from 'lucide-react';
import { CounterHelpButton as HelpButton, CounterHelpModal as HelpModal } from '@/components/shared/CounterHelpModal';

const formatMinutesToInput = (minutes: number): { h: number; m: number } => ({
  h: Math.floor(minutes / 60),
  m: minutes % 60,
});

function TimeInput({
  label, value, onChange, hint, colorKey,
}: {
  label: string; value: number; onChange: (minutes: number) => void; hint?: string; colorKey: string;
}) {
  const { h, m } = formatMinutesToInput(value);
  const colors = COUNTER_COLORS[colorKey] || COUNTER_COLORS.rtc;
  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => e.target.select();

  return (
    <div className={`p-4 rounded-xl bg-slate-50 border border-slate-200 ${colors.ring}`}>
      <div className="mb-3">
        <label className={`text-sm font-medium leading-none ${colors.text}`}>{label}</label>
        {hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
      </div>
      <div className="flex items-center gap-2">
        <input type="number" min={0} max={999} value={h || ''} placeholder="0" onFocus={handleFocus}
          onChange={(e) => { const newH = e.target.value === '' ? 0 : parseInt(e.target.value); onChange(newH * 60 + m); }}
          aria-label={`${label} - heures`}
          className="w-20 h-9 rounded-md border border-slate-200 bg-white px-3 text-slate-800 text-base text-center outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-colors"
        />
        <span className="text-slate-400">h</span>
        <input type="number" min={0} max={59} value={m || ''} placeholder="0" onFocus={handleFocus}
          onChange={(e) => { const newM = e.target.value === '' ? 0 : parseInt(e.target.value); onChange(h * 60 + newM); }}
          aria-label={`${label} - minutes`}
          className="w-20 h-9 rounded-md border border-slate-200 bg-white px-3 text-slate-800 text-base text-center outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-colors"
        />
        <span className="text-slate-400">min</span>
      </div>
    </div>
  );
}

function DaysInput({
  label, value, onChange, max, hint, colorKey,
}: {
  label: string; value: number; onChange: (days: number) => void; max: number; hint?: string; colorKey: string;
}) {
  const colors = COUNTER_COLORS[colorKey] || COUNTER_COLORS.ca;
  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => e.target.select();

  return (
    <div className={`p-4 rounded-xl bg-slate-50 border border-slate-200 ${colors.ring}`}>
      <div className="mb-3">
        <label className={`text-sm font-medium leading-none ${colors.text}`}>{label}</label>
        {hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
      </div>
      <div className="flex items-center gap-2">
        <input type="number" min={0} max={max} value={value || ''} placeholder="0" onFocus={handleFocus}
          onChange={(e) => onChange(e.target.value === '' ? 0 : parseInt(e.target.value))}
          aria-label={label}
          className="w-24 h-9 rounded-md border border-slate-200 bg-white px-3 text-slate-800 text-base text-center outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-colors"
        />
        <span className="text-slate-500">jours</span>
        <span className="text-xs text-slate-500 ml-auto">max {max}</span>
      </div>
    </div>
  );
}

// ============================================================
// Liste des compteurs sélectionnables
// ============================================================
type CounterKey =
  | 'ca' | 'cf' | 'rtc' | 'rps' | 'hs' | 'cet'
  | 'rtt' | 'artt'
  | 'caAnterieur' | 'caHPAnterieur'
  | 'cet2008' | 'congesBonifies' | 'hsHistorique';

interface CounterOption {
  key: CounterKey;
  name: string;
  short: string;
  helpKey?: string;
}

const COUNTER_GROUPS: { title: string; subtitle: string; items: CounterOption[] }[] = [
  {
    title: 'Soldes courants',
    subtitle: 'Compteurs principaux gérés tout au long de l\'année',
    items: [
      { key: 'ca', name: 'Congés Annuels (CA)', short: 'Perdus au 31/12 si non utilisés', helpKey: 'ca' },
      { key: 'cf', name: 'Crédits Fériés (CF)', short: '109h12/an, à lisser sur l\'année', helpKey: 'cf' },
      { key: 'rtc', name: 'RTC', short: 'Récupération Temps de Cycle, 83h30 réservés CET', helpKey: 'rtc' },
      { key: 'rtt', name: 'RTT (cycle hebdo)', short: 'Récupération Temps de Travail, perdus au 31/12', helpKey: 'rtt' },
      { key: 'artt', name: 'ARTT', short: '20j/an, perdus au 31/12 (arrêté 3 mai 2002)', helpKey: 'artt' },
      { key: 'rps', name: 'RPS', short: 'Récupération dimanche, gardés indéfiniment', helpKey: 'rps' },
      { key: 'hs', name: 'Heures Supplémentaires (HS)', short: 'Max 160h stockables', helpKey: 'hs' },
      { key: 'cet', name: 'Compte Épargne Temps (CET)', short: 'Plafond 60 jours', helpKey: 'cet' },
    ],
  },
  {
    title: 'Reports année précédente',
    subtitle: 'Soldes N-1 à consommer avant le 30/04',
    items: [
      { key: 'caAnterieur', name: 'CA Antérieurs', short: 'Report CA N-1, deadline 30 avril', helpKey: 'caAnterieur' },
      { key: 'caHPAnterieur', name: 'CA HP Antérieurs', short: 'Report CA HP N-1, deadline 30 avril', helpKey: 'caHPAnterieur' },
    ],
  },
  {
    title: 'Compteurs spéciaux',
    subtitle: 'À cocher uniquement s\'ils apparaissent dans votre GesTT',
    items: [
      { key: 'cet2008', name: 'CET 2008', short: 'Stock historique gelé avant 2010', helpKey: 'cet2008' },
      { key: 'congesBonifies', name: 'Congés Bonifiés', short: '31j tous les 2 ans (agents DOM/TOM)', helpKey: 'congesBonifies' },
      { key: 'hsHistorique', name: 'HS Historique', short: 'Stock HS gelé depuis 2020', helpKey: 'hsHistorique' },
    ],
  },
];

const DEFAULT_SELECTED: CounterKey[] = ['ca', 'cf', 'rtc', 'rps', 'hs', 'cet'];

// ============================================================
// Composant principal
// ============================================================
interface CountersSetupProps {
  cycleConfig: CycleConfig;
  onNext: (counters: Counters) => void;
  onBack: () => void;
  initialCounters?: Counters;
}

// Compteurs vides pour démarrer l'onboarding sans pré-remplissage.
const EMPTY_COUNTERS: Counters = {
  ...DEFAULT_COUNTERS,
  ca: 0,
  cf: 0,
  rtc: 0,
};

type SubStep = 'intro' | 'selection' | 'values';

export function CountersSetup({ cycleConfig, onNext, onBack, initialCounters }: CountersSetupProps) {
  const [subStep, setSubStep] = useState<SubStep>('intro');
  const [counters, setCounters] = useState<Counters>(initialCounters ?? EMPTY_COUNTERS);
  const [helpKey, setHelpKey] = useState<string | null>(null);

  // Pré-cochage : 6 compteurs quasi-universels + RTT si cycle hebdo
  const initialSelected = useMemo(() => {
    const set = new Set<CounterKey>(DEFAULT_SELECTED);
    if (cycleConfig.type === 'hebdo') set.add('rtt');
    return set;
  }, [cycleConfig.type]);

  const [selectedKeys, setSelectedKeys] = useState<Set<CounterKey>>(initialSelected);

  const updateCounter = (key: keyof Counters, value: number) =>
    setCounters((prev) => ({ ...prev, [key]: value }));

  const toggleCounter = (key: CounterKey) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

    // Synchronise les flags has* et reset les valeurs si on décoche
    setCounters((prev) => {
      const isAdding = !selectedKeys.has(key);
      switch (key) {
        case 'rtt':
          return { ...prev, hasRTT: isAdding, rtt: isAdding ? prev.rtt ?? 0 : 0 };
        case 'artt':
          return { ...prev, hasARTT: isAdding, artt: isAdding ? prev.artt ?? 0 : 0 };
        case 'cet2008':
          return { ...prev, hasCET2008: isAdding, cet2008: isAdding ? prev.cet2008 ?? 0 : 0 };
        case 'congesBonifies':
          return { ...prev, hasCongesBonifies: isAdding, congesBonifies: isAdding ? prev.congesBonifies ?? 0 : 0 };
        // Pour les autres clés : si on décoche, on remet à 0
        case 'ca':
          return isAdding ? prev : { ...prev, ca: 0, caPosesHorsPeriode: 0, caHP: 0 };
        case 'cf':
          return isAdding ? prev : { ...prev, cf: 0 };
        case 'rtc':
          return isAdding ? prev : { ...prev, rtc: 0 };
        case 'rps':
          return isAdding ? prev : { ...prev, rps: 0 };
        case 'hs':
          return isAdding ? prev : { ...prev, hs: 0 };
        case 'cet':
          return isAdding ? prev : { ...prev, cet: 0 };
        case 'caAnterieur':
          return isAdding ? prev : { ...prev, caAnterieur: 0 };
        case 'caHPAnterieur':
          return isAdding ? prev : { ...prev, caHPAnterieur: 0 };
        case 'hsHistorique':
          return isAdding ? prev : { ...prev, hsHistorique: 0 };
        default:
          return prev;
      }
    });
  };

  const handleBack = () => {
    if (subStep === 'values') setSubStep('selection');
    else if (subStep === 'selection') setSubStep('intro');
    else onBack();
  };

  const cardClass = 'rounded-xl border border-slate-200 py-6 shadow-sm bg-white';
  const titleClass = 'font-semibold text-lg text-slate-800 leading-none';
  const subClass = 'text-sm text-slate-500';

  // ───────────────────────────────────────────────────────────
  // Sous-étape 1 : Intro
  // ───────────────────────────────────────────────────────────
  if (subStep === 'intro') {
    return (
      <div className="space-y-5">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-slate-800 mb-1">Vos compteurs</h2>
          <p className={subClass}>Préparation avant la saisie</p>
        </div>

        <div className={cardClass}>
          <div className="px-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="shrink-0 w-12 h-12 rounded-full flex items-center justify-center"
                   style={{ background: 'linear-gradient(135deg, #0055A4, #1a7de8)' }}>
                <ShieldCheck className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-800 mb-1">Munissez-vous de vos compteurs GesTT</h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Pour configurer Chronos correctement, vous avez besoin de vos soldes actuels
                  tels qu&apos;ils apparaissent dans <strong>GesTT</strong> (Gestion des Temps de Travail).
                </p>
              </div>
            </div>

            <div className="rounded-lg bg-blue-50 border border-blue-100 p-4 text-sm text-blue-900 space-y-2">
              <p className="font-medium">Pourquoi&nbsp;?</p>
              <ul className="list-disc list-inside space-y-1 text-blue-800">
                <li>Chaque compteur (CA, RTC, CF, RPS, CET…) a son propre solde</li>
                <li>Les calculs Chronos s&apos;appuient sur ces soldes pour optimiser vos congés</li>
                <li>Vous pourrez les modifier à tout moment depuis le dashboard</li>
              </ul>
            </div>

            <div className="rounded-lg bg-amber-50 border border-amber-100 p-4 text-sm text-amber-900">
              <p>
                <strong>Pas de panique&nbsp;:</strong> si vous n&apos;avez pas vos soldes sous la main,
                vous pouvez aussi les renseigner plus tard depuis le dashboard. Vous pourrez les
                modifier ou les compléter à tout moment.
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-4">
          <button type="button" onClick={handleBack}
            className="inline-flex items-center justify-center gap-2 flex-1 h-14 font-medium rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm"
          >
            <ChevronLeft className="w-5 h-5" />
            Retour
          </button>
          <button type="button" onClick={() => setSubStep('selection')}
            className="inline-flex items-center justify-center gap-2 flex-1 h-14 text-lg font-semibold rounded-xl text-white hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg"
            style={{ background: 'linear-gradient(135deg, #0055A4 0%, #1a7de8 45%, #EF4135 100%)', boxShadow: '0 8px 24px rgba(0,85,164,0.25)' }}
          >
            Suivant
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    );
  }

  // ───────────────────────────────────────────────────────────
  // Sous-étape 2 : Sélection des compteurs
  // ───────────────────────────────────────────────────────────
  if (subStep === 'selection') {
    return (
      <>
        <div className="space-y-5">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-slate-800 mb-1">Quels compteurs possédez-vous&nbsp;?</h2>
            <p className={subClass}>Cochez tous ceux qui apparaissent dans votre GesTT</p>
          </div>

          {COUNTER_GROUPS.map((group) => (
            <div key={group.title} className={cardClass}>
              <div className="px-6 mb-4">
                <div className="flex items-center">
                  <ListChecks className="w-5 h-5 text-blue-600 mr-2" />
                  <span className={titleClass}>{group.title}</span>
                </div>
                <p className={`${subClass} mt-1`}>{group.subtitle}</p>
              </div>
              <div className="px-6 space-y-2">
                {group.items.map((item) => {
                  const checked = selectedKeys.has(item.key);
                  return (
                    <label
                      key={item.key}
                      htmlFor={`counter-${item.key}`}
                      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                        checked
                          ? 'border-blue-300 bg-blue-50/50'
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        id={`counter-${item.key}`}
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleCounter(item.key)}
                        className="mt-0.5 h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500/30"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <span className="font-medium text-slate-800">{item.name}</span>
                          {item.helpKey && <HelpButton onClick={() => setHelpKey(item.helpKey!)} />}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">{item.short}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}

          <div className="flex gap-4">
            <button type="button" onClick={handleBack}
              className="inline-flex items-center justify-center gap-2 flex-1 h-14 font-medium rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm"
            >
              <ChevronLeft className="w-5 h-5" />
              Retour
            </button>
            <button type="button" onClick={() => setSubStep('values')}
              disabled={selectedKeys.size === 0}
              className="inline-flex items-center justify-center gap-2 flex-1 h-14 text-lg font-semibold rounded-xl text-white hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
              style={{ background: 'linear-gradient(135deg, #0055A4 0%, #1a7de8 45%, #EF4135 100%)', boxShadow: '0 8px 24px rgba(0,85,164,0.25)' }}
            >
              Continuer
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {helpKey && <HelpModal helpKey={helpKey} onClose={() => setHelpKey(null)} />}
      </>
    );
  }

  // ───────────────────────────────────────────────────────────
  // Sous-étape 3 : Saisie des valeurs des compteurs cochés
  // ───────────────────────────────────────────────────────────
  return (
    <>
      <div className="space-y-5">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-slate-800 mb-1">Saisissez vos soldes</h2>
          <p className={subClass}>Reprenez les valeurs depuis votre GesTT</p>
        </div>

        {/* CET */}
        {selectedKeys.has('cet') && (
          <div className={cardClass}>
            <div className="px-6 mb-4">
              <div className="flex items-center">
                <Sparkles className="w-5 h-5 text-blue-600 mr-2" />
                <span className={titleClass}>Compte Épargne Temps (CET)</span>
                <HelpButton onClick={() => setHelpKey('cet')} />
              </div>
            </div>
            <div className="px-6">
              <DaysInput label="Stock CET actuel" value={counters.cet} onChange={(v) => updateCounter('cet', v)} max={60} hint="Plafond : 60 jours" colorKey="cet" />
            </div>
          </div>
        )}

        {/* CA */}
        {selectedKeys.has('ca') && (
          <div className={cardClass}>
            <div className="px-6 mb-4">
              <div className="flex items-center">
                <span className={titleClass}>Congés Annuels</span>
                <HelpButton onClick={() => setHelpKey('ca')} />
              </div>
              <div className={`${subClass} mt-1`}>{COUNTER_LABELS.ca.description}</div>
            </div>
            <div className="px-6 space-y-4">
              <DaysInput label="CA restants" value={counters.ca} onChange={(v) => updateCounter('ca', v)} max={18} hint="Perdus au 31/12" colorKey="ca" />
              <div>
                <div className="flex items-center mb-2">
                  <span className="text-sm font-medium text-slate-600">CA posés hors période</span>
                  <HelpButton onClick={() => setHelpKey('caHP')} />
                </div>
                <DaysInput
                  label="CA posés hors période"
                  value={counters.caPosesHorsPeriode}
                  onChange={(v) => { updateCounter('caPosesHorsPeriode', v); updateCounter('caHP', v >= 8 ? 2 : 0); }}
                  max={18}
                  hint="01/01-30/04 ou 01/11-31/12 — Si ≥ 8 : bonus 2 CA HP"
                  colorKey="caHP"
                />
              </div>
              {counters.caPosesHorsPeriode >= 8 && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200">
                  <Sparkles className="w-5 h-5 text-emerald-500" />
                  <span className="text-emerald-700 font-medium">2 CA Hors Période bonus obtenus !</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* CA Antérieurs */}
        {selectedKeys.has('caAnterieur') && (
          <div className={cardClass}>
            <div className="px-6 mb-4">
              <div className="flex items-center">
                <span className={titleClass}>CA Antérieurs (N-1)</span>
                <HelpButton onClick={() => setHelpKey('caAnterieur')} />
              </div>
              <div className={`${subClass} mt-1`}>{COUNTER_LABELS.caAnterieur.description}</div>
            </div>
            <div className="px-6">
              <DaysInput label="CA Antérieurs" value={counters.caAnterieur} onChange={(v) => updateCounter('caAnterieur', v)} max={18} hint="À consommer avant le 30/04" colorKey="ca" />
            </div>
          </div>
        )}

        {/* CA HP Antérieurs */}
        {selectedKeys.has('caHPAnterieur') && (
          <div className={cardClass}>
            <div className="px-6 mb-4">
              <div className="flex items-center">
                <span className={titleClass}>CA HP Antérieurs (N-1)</span>
                <HelpButton onClick={() => setHelpKey('caHPAnterieur')} />
              </div>
              <div className={`${subClass} mt-1`}>{COUNTER_LABELS.caHPAnterieur.description}</div>
            </div>
            <div className="px-6">
              <DaysInput label="CA HP Antérieurs" value={counters.caHPAnterieur} onChange={(v) => updateCounter('caHPAnterieur', v)} max={4} hint="À consommer avant le 30/04" colorKey="caHP" />
            </div>
          </div>
        )}

        {/* CF */}
        {selectedKeys.has('cf') && (
          <div className={cardClass}>
            <div className="px-6 mb-4">
              <div className="flex items-center">
                <span className={titleClass}>Crédits Fériés</span>
                <HelpButton onClick={() => setHelpKey('cf')} />
              </div>
              <div className={`${subClass} mt-1`}>{COUNTER_LABELS.cf.description}</div>
            </div>
            <div className="px-6">
              <TimeInput label="CF total restant" value={counters.cf} onChange={(v) => updateCounter('cf', v)} hint="109h12/an — à lisser sur l'année" colorKey="cf" />
            </div>
          </div>
        )}

        {/* RTC */}
        {selectedKeys.has('rtc') && (
          <div className={`${cardClass} ring-1 ring-blue-100`}>
            <div className="px-6 mb-4">
              <div className="flex items-center">
                <span className={titleClass}>RTC</span>
                <span className="ml-2 text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700 font-medium">Gain CET +37h50/an</span>
                <HelpButton onClick={() => setHelpKey('rtc')} />
              </div>
              <div className={`${subClass} mt-1`}>83h30 à réserver pour le CET</div>
            </div>
            <div className="px-6 space-y-4">
              <TimeInput label="RTC restant" value={counters.rtc} onChange={(v) => updateCounter('rtc', v)} hint="Perdus au 31/12" colorKey="rtc" />
              <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
                <p className="text-sm text-blue-700">
                  <strong>Astuce CET :</strong> Réservez 83h30 de RTC pour les convertir en 10 jours CET (8h21 au lieu de 12h08 par jour = gain 37h50).
                </p>
              </div>
            </div>
          </div>
        )}

        {/* RTT (cycle hebdo uniquement) */}
        {selectedKeys.has('rtt') && (
          <div className={cardClass}>
            <div className="px-6 mb-4">
              <div className="flex items-center">
                <span className={titleClass}>RTT</span>
                <HelpButton onClick={() => setHelpKey('rtt')} />
              </div>
              <div className={`${subClass} mt-1`}>{COUNTER_LABELS.rtt.description}</div>
            </div>
            <div className="px-6">
              <TimeInput label="RTT restants" value={counters.rtt ?? 0} onChange={(v) => setCounters((prev) => ({ ...prev, rtt: v, hasRTT: true }))} hint="Perdus au 31/12" colorKey="rtt" />
            </div>
          </div>
        )}

        {/* ARTT */}
        {selectedKeys.has('artt') && (
          <div className={cardClass}>
            <div className="px-6 mb-4">
              <div className="flex items-center">
                <span className={titleClass}>ARTT</span>
                <HelpButton onClick={() => setHelpKey('artt')} />
              </div>
              <div className={`${subClass} mt-1`}>{COUNTER_LABELS.artt.description}</div>
            </div>
            <div className="px-6">
              <DaysInput label="ARTT restants" value={counters.artt ?? 0} onChange={(v) => setCounters((prev) => ({ ...prev, artt: v, hasARTT: true }))} max={20} hint="Perdus au 31/12" colorKey="artt" />
            </div>
          </div>
        )}

        {/* RPS */}
        {selectedKeys.has('rps') && (
          <div className={cardClass}>
            <div className="px-6 mb-4">
              <div className="flex items-center">
                <span className={titleClass}>RPS (Récupération dimanche)</span>
                <HelpButton onClick={() => setHelpKey('rps')} />
              </div>
              <div className={`${subClass} mt-1`}>{COUNTER_LABELS.rps.description}</div>
            </div>
            <div className="px-6 space-y-4">
              <TimeInput label="RPS total" value={counters.rps} onChange={(v) => updateCounter('rps', v)} colorKey="rps" />
            </div>
          </div>
        )}

        {/* HS */}
        {selectedKeys.has('hs') && (
          <div className={cardClass}>
            <div className="px-6 mb-4">
              <div className="flex items-center">
                <span className={titleClass}>Heures Supplémentaires</span>
                <HelpButton onClick={() => setHelpKey('hs')} />
              </div>
              <div className={`${subClass} mt-1`}>{COUNTER_LABELS.hs.description}</div>
            </div>
            <div className="px-6">
              <TimeInput label="HS accumulées" value={counters.hs} onChange={(v) => updateCounter('hs', v)} hint="Max 160h — Au-delà : paiement obligatoire" colorKey="hs" />
            </div>
          </div>
        )}

        {/* HS Historique */}
        {selectedKeys.has('hsHistorique') && (
          <div className={cardClass}>
            <div className="px-6 mb-4">
              <div className="flex items-center">
                <span className={titleClass}>HS Historique</span>
                <HelpButton onClick={() => setHelpKey('hsHistorique')} />
              </div>
              <div className={`${subClass} mt-1`}>{COUNTER_LABELS.hsHistorique.description}</div>
            </div>
            <div className="px-6">
              <TimeInput label="HS Historique" value={counters.hsHistorique} onChange={(v) => updateCounter('hsHistorique', v)} hint="Stock gelé depuis 2020" colorKey="hs" />
            </div>
          </div>
        )}

        {/* CET 2008 */}
        {selectedKeys.has('cet2008') && (
          <div className={cardClass}>
            <div className="px-6 mb-4">
              <div className="flex items-center">
                <span className={titleClass}>CET 2008</span>
                <HelpButton onClick={() => setHelpKey('cet2008')} />
              </div>
              <div className={`${subClass} mt-1`}>{COUNTER_LABELS.cet2008.description}</div>
            </div>
            <div className="px-6">
              <DaysInput label="Stock CET 2008" value={counters.cet2008 ?? 0} onChange={(v) => setCounters((prev) => ({ ...prev, cet2008: v, hasCET2008: true }))} max={60} hint="Stock gelé avant 2010" colorKey="cet" />
            </div>
          </div>
        )}

        {/* Congés bonifiés */}
        {selectedKeys.has('congesBonifies') && (
          <div className={cardClass}>
            <div className="px-6 mb-4">
              <div className="flex items-center">
                <span className={titleClass}>Congés Bonifiés</span>
                <HelpButton onClick={() => setHelpKey('congesBonifies')} />
              </div>
              <div className={`${subClass} mt-1`}>{COUNTER_LABELS.congesBonifies.description}</div>
            </div>
            <div className="px-6">
              <DaysInput label="Jours restants" value={counters.congesBonifies ?? 0} onChange={(v) => setCounters((prev) => ({ ...prev, congesBonifies: v, hasCongesBonifies: true }))} max={31} hint="Cycle 24 mois (DOM/TOM)" colorKey="ca" />
            </div>
          </div>
        )}

        <div className="flex gap-4">
          <button type="button" onClick={handleBack}
            className="inline-flex items-center justify-center gap-2 flex-1 h-14 font-medium rounded-xl bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm"
          >
            <ChevronLeft className="w-5 h-5" />
            Retour
          </button>
          <button type="button" onClick={() => onNext(counters)}
            className="inline-flex items-center justify-center gap-2 flex-1 h-14 text-lg font-semibold rounded-xl text-white hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg"
            style={{ background: 'linear-gradient(135deg, #0055A4 0%, #1a7de8 45%, #EF4135 100%)', boxShadow: '0 8px 24px rgba(0,85,164,0.25)' }}
          >
            Terminer
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Modal d'aide */}
      {helpKey && <HelpModal helpKey={helpKey} onClose={() => setHelpKey(null)} />}
    </>
  );
}
