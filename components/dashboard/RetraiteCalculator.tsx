'use client';

import { useMemo, useState } from 'react';
import { Counters, CycleConfig, HistoryEntry, CounterType } from '@/lib/types';
import {
  calculerDepartRetraite,
  COMPTEURS_RETRAITE,
  INDEMNISATION_CET,
  type CategorieAgent,
} from '@/lib/retraite';
import { formatMinutes } from '@/lib/calculations';
import { CET_SEUIL_OPTION, COUNTER_LABELS } from '@/lib/constants';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { Hourglass, X, CalendarCheck, Coins, TriangleAlert } from 'lucide-react';

interface RetraiteCalculatorProps {
  isOpen: boolean;
  onClose: () => void;
  counters: Counters;
  cycleConfig: CycleConfig;
  history: HistoryEntry[];
}

function parseLocalDate(str: string): Date | null {
  const m = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return isNaN(d.getTime()) ? null : d;
}

const formatLong = (d: Date) =>
  d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

const LIBELLE: Partial<Record<CounterType, string>> = {
  ca: 'CA', caHP: 'CA HP', caAnterieur: 'CA antérieurs', caHPAnterieur: 'CA HP antérieurs',
  cf: 'CF', rtc: 'RTC', rtt: 'RTT', artt: 'ARTT', rps: 'RPS', hs: 'HS',
  hsHistorique: 'HS historiques', cet: 'CET', cet2008: 'CET 2008',
  congesBonifies: 'Congés bonifiés',
};

export function RetraiteCalculator({
  isOpen, onClose, counters, cycleConfig, history,
}: RetraiteCalculatorProps) {
  // Par défaut, une radiation dans deux ans : la plupart des agents simulent à
  // cet horizon, et ça évite un champ vide au premier affichage.
  const [dateStr, setDateStr] = useState(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 2);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [cetPose, setCetPose] = useState(() => counters.cet);
  const [exclus, setExclus] = useState<Set<CounterType>>(new Set());
  const [categorie, setCategorie] = useState<CategorieAgent>('B');

  const dateRetraite = parseLocalDate(dateStr);
  const cetPlancher = Math.min(CET_SEUIL_OPTION, counters.cet);

  const resultat = useMemo(() => {
    if (!dateRetraite) return null;
    return calculerDepartRetraite(
      dateRetraite, counters, cycleConfig, history,
      { cetPoseEnConges: cetPose, exclus: Array.from(exclus), categorie }
    );
  }, [dateRetraite, counters, cycleConfig, history, cetPose, exclus, categorie]);

  const basculer = (type: CounterType) =>
    setExclus((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });

  // Compteurs réellement possédés : inutile d'afficher une case pour un solde nul.
  const compteursPossedes = useMemo(
    () => COMPTEURS_RETRAITE.filter((t) => {
      switch (t) {
        case 'ca': return counters.ca > 0;
        case 'caHP': return counters.caHP > 0;
        case 'caAnterieur': return counters.caAnterieur > 0;
        case 'caHPAnterieur': return counters.caHPAnterieur > 0;
        case 'artt': return counters.hasARTT && (counters.artt ?? 0) > 0;
        case 'rtt': return counters.hasRTT && (counters.rtt ?? 0) > 0;
        case 'congesBonifies': return counters.hasCongesBonifies && (counters.congesBonifies ?? 0) > 0;
        case 'cet': return counters.cet > 0;
        case 'cet2008': return counters.hasCET2008 && (counters.cet2008 ?? 0) > 0;
        case 'cf': return counters.hasCF !== false && counters.cf > 0;
        case 'rtc': return counters.hasRTC !== false && counters.rtc > 0;
        case 'rps': return counters.rps > 0;
        case 'hs': return counters.hs > 0;
        case 'hsHistorique': return counters.hsHistorique > 0;
        default: return false;
      }
    }),
    [counters]
  );

  return (
    <Dialog open={isOpen} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent
        className="w-[95vw] max-w-lg p-0 rounded-2xl border-0 shadow-2xl overflow-hidden flex flex-col"
        style={{ height: '90vh', maxHeight: '90vh' }}
        showCloseButton={false}
      >
        <div className="shrink-0 px-5 pt-5 pb-4 text-white" style={{ background: 'linear-gradient(135deg, #0a1628 0%, #0d2347 55%, #0055A4 100%)' }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
              <Hourglass className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-base font-bold leading-tight text-white">Simulateur de départ</DialogTitle>
              <p className="text-blue-200 text-xs mt-0.5">Quand puis-je cesser de travailler ?</p>
            </div>
            <DialogClose className="shrink-0 w-8 h-8 rounded-xl bg-white/15 hover:bg-white/25 flex items-center justify-center text-white/80 hover:text-white transition-all">
              <X className="w-4 h-4" />
            </DialogClose>
          </div>
          <div className="mt-3 h-[3px] rounded-full" style={{ background: 'linear-gradient(90deg, #0055A4 33%, #ffffff 33%, #ffffff 66%, #EF4135 66%)' }} />
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain p-5 space-y-5 bg-white">
          {/* Date de radiation */}
          <div>
            <label htmlFor="date-radiation" className="text-sm font-medium text-slate-700 block mb-2">
              Date de radiation des cadres
            </label>
            <input
              id="date-radiation"
              type="date"
              value={dateStr}
              onChange={(e) => setDateStr(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Résultat */}
          {resultat && resultat.dernierJourTravaille ? (
            <div className="rounded-xl border-2 border-blue-200 bg-blue-50 p-4">
              <div className="flex items-center gap-2 mb-2">
                <CalendarCheck className="w-4 h-4 text-blue-600 shrink-0" />
                <span className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                  Dernier jour travaillé
                </span>
              </div>
              <p className="text-lg font-bold text-slate-800 leading-snug">
                {formatLong(resultat.dernierJourTravaille)}
              </p>
              <p className="text-sm text-slate-600 mt-2">
                Absence de <strong>{resultat.dureeCalendaire} jours</strong>, couvrant{' '}
                <strong>{resultat.joursCouverts} jours travaillés</strong>.
              </p>
              {resultat.reliquatMinutes > 0 && (
                <p className="text-xs text-slate-500 mt-1">
                  Reliquat non utilisé : {formatMinutes(resultat.reliquatMinutes)} (insuffisant
                  pour couvrir une journée de plus).
                </p>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-2">
              <TriangleAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800">
                {resultat?.couvreToutePeriode
                  ? "Vos compteurs couvrent plus de 10 ans : vérifiez la date saisie."
                  : "Aucun compteur mobilisable, ou date de radiation déjà passée."}
              </p>
            </div>
          )}

          {/* CET */}
          {counters.cet > 0 && (
            <div className="rounded-xl border border-slate-200 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700">CET posé en congés</span>
                <span className="text-sm font-bold text-blue-700">{cetPose} / {counters.cet} j</span>
              </div>
              <input
                type="range"
                min={cetPlancher}
                max={counters.cet}
                value={cetPose}
                onChange={(e) => setCetPose(Number(e.target.value))}
                className="w-full accent-blue-600"
                aria-label="Jours de CET posés en congés"
              />
              <p className="text-xs text-slate-500">
                Les <strong>{cetPlancher} premiers jours</strong> doivent obligatoirement être pris
                en congés avant la radiation. Le reste est indemnisé.
              </p>
              {resultat && resultat.cetIndemnise > 0 && (
                <div className="flex items-start gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2">
                  <Coins className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="text-xs text-emerald-800">
                    <strong>{resultat.cetIndemnise} jours indemnisés</strong> ≈{' '}
                    {resultat.indemnisationEuros.toLocaleString('fr-FR')} €
                    <div className="flex items-center gap-1.5 mt-1.5">
                      {(['A', 'B', 'C'] as CategorieAgent[]).map((cat) => (
                        <button
                          key={cat}
                          onClick={() => setCategorie(cat)}
                          className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                            categorie === cat
                              ? 'bg-emerald-600 text-white'
                              : 'bg-white border border-emerald-200 text-emerald-700'
                          }`}
                        >
                          Cat. {cat} — {INDEMNISATION_CET[cat]} €/j
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Compteurs pris en compte */}
          {compteursPossedes.length > 0 && (
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-sm font-medium text-slate-700 mb-1">Compteurs mobilisés</p>
              <p className="text-xs text-slate-500 mb-3">
                Décochez ceux que vous préférez vous faire payer ou conserver.
              </p>
              <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                {compteursPossedes.map((type) => (
                  <label key={type} className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!exclus.has(type)}
                      onChange={() => basculer(type)}
                      className="w-4 h-4 accent-blue-600"
                    />
                    {LIBELLE[type] ?? COUNTER_LABELS[type]?.name ?? type}
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Détail */}
          {resultat && resultat.detail.length > 0 && (
            <div className="rounded-xl border border-slate-200 p-4">
              <p className="text-sm font-medium text-slate-700 mb-3">Ce qui est consommé</p>
              <div className="space-y-1.5">
                {resultat.detail.map((d) => (
                  <div key={d.type} className="flex items-center justify-between text-xs">
                    <span className="text-slate-600">{LIBELLE[d.type] ?? d.type}</span>
                    <span className="text-slate-800 font-medium">
                      {d.unite === 'jours' ? `${d.quantite} j` : formatMinutes(d.quantite)}
                      <span className="text-slate-400 font-normal"> · {d.joursCouverts} jours couverts</span>
                    </span>
                  </div>
                ))}
              </div>

              {resultat.dotationsFutures.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-100">
                  <p className="text-xs font-medium text-slate-600 mb-1.5">
                    Dotations à venir, prises par anticipation
                  </p>
                  {resultat.dotationsFutures.map((d) => (
                    <div key={d.annee} className="flex items-center justify-between text-xs text-slate-500">
                      <span>
                        {d.annee}
                        {d.prorata < 1 && ` (${Math.round(d.prorata * 100)} % — année incomplète)`}
                      </span>
                      <span>
                        {d.jours > 0 && `${d.jours} j`}
                        {d.jours > 0 && d.minutes > 0 && ' + '}
                        {d.minutes > 0 && formatMinutes(d.minutes)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <p className="text-[11px] text-slate-400 leading-relaxed">
            Estimation à titre indicatif. Les dotations des années à venir sont calculées sur les
            quotas standards de votre régime, et celle de l&apos;année de radiation est proratisée.
            Seul votre service peut valider les dates définitives.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
