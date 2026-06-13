// Composant central orchestrant l'affichage du calendrier et la sélection de dates

'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { CycleConfig, HistoryEntry, Counters } from '@/lib/types';
import { useDateRangePicker } from './DateRangePicker';
import { CalendarMonth } from './CalendarMonth';
import { CalendarWeek } from './CalendarWeek';
import { CalendarYear } from './CalendarYear';
import { Calendar, CalendarDays, CalendarRange } from 'lucide-react';
import { LeaveList } from './LeaveList';
import {
  CA_REQUIS_POUR_HP,
  CA_HP_BONUS,
  CA_HP_PALIER_1,
  CA_HP_PERIODE_1_DEBUT,
  CA_HP_PERIODE_1_FIN,
  CA_HP_PERIODE_2_DEBUT,
  CA_HP_PERIODE_2_FIN,
} from '@/lib/constants';

function isInCaHPPeriod(date: Date): boolean {
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const mmdd = `${mm}-${dd}`;
  return (
    (mmdd >= CA_HP_PERIODE_1_DEBUT && mmdd <= CA_HP_PERIODE_1_FIN) ||
    (mmdd >= CA_HP_PERIODE_2_DEBUT && mmdd <= CA_HP_PERIODE_2_FIN)
  );
}

type ViewMode = 'month' | 'week' | 'year';

interface CalendarViewProps {
  cycleConfig: CycleConfig;
  counters: Counters;
  onRangeSelected: (start: Date, end: Date, workingDays: number) => void;
  history: HistoryEntry[];
  onDeleteLeave?: (entryId: string) => void;
  onEditLeave?: (entry: HistoryEntry) => void;
  resetTrigger?: number;
}


function CaHPBand({ counters }: { counters: Counters }) {
  const [open, setOpen] = useState(false);
  const today = useMemo(() => new Date(), []);
  const inPeriod = useMemo(() => isInCaHPPeriod(today), [today]);
  const posed = counters.caPosesHorsPeriode;
  const caHPObtained = posed >= CA_REQUIS_POUR_HP ? 2 : posed >= CA_HP_PALIER_1 ? 1 : 0;
  const allObtained = caHPObtained >= CA_HP_BONUS;
  const pct = (Math.min(posed, CA_REQUIS_POUR_HP) / CA_REQUIS_POUR_HP) * 100;
  const close = useCallback(() => setOpen(false), []);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl border text-xs text-left cursor-pointer transition-opacity hover:opacity-80 ${
          allObtained
            ? 'bg-emerald-500/10 border-emerald-500/25'
            : inPeriod
            ? 'bg-blue-500/8 border-blue-500/20'
            : 'bg-amber-500/8 border-amber-500/20'
        }`}
      >
        <span
          className={`inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 ring-2 ring-offset-1 ${
            allObtained
              ? 'bg-emerald-500 ring-emerald-500/25'
              : inPeriod
              ? 'bg-emerald-500 ring-emerald-500/25'
              : 'bg-rose-500 ring-rose-500/25'
          }`}
          aria-hidden="true"
        />
        <span className="font-semibold flex-shrink-0 text-slate-700">
          CA HP <span className={`font-normal ${
            allObtained
              ? 'text-emerald-600'
              : inPeriod
              ? 'text-emerald-600'
              : 'text-rose-600'
          }`}>· {allObtained ? 'Obtenu' : inPeriod ? 'Actif' : 'Inactif'}</span>
        </span>
        <div className="relative flex-1 h-1.5 rounded-full bg-black/10 overflow-visible">
          <div
            className={`h-full rounded-full transition-all duration-500 ${allObtained ? 'bg-emerald-500' : inPeriod ? 'bg-blue-500' : 'bg-amber-400'}`}
            style={{ width: `${pct}%` }}
          />
          <div className="absolute top-1/2 -translate-y-1/2 w-px h-2.5 bg-white/50" style={{ left: '50%' }} />
        </div>
        <span className="text-muted-foreground flex-shrink-0">{posed}/{CA_REQUIS_POUR_HP} CA</span>
        <div className="flex items-center gap-0.5 flex-shrink-0">
          {[1, 2].map((n) => (
            <span key={n} className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold border ${
              caHPObtained >= n ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-current opacity-25'
            }`}>{n}</span>
          ))}
          <span className="text-muted-foreground ml-0.5 hidden sm:inline">CA HP</span>
        </div>
        <span className="text-muted-foreground flex-shrink-0 hidden sm:inline">
          {allObtained ? '+2j bonus CET' : inPeriod ? 'bonus en validation' : 'CA non comptabilisés'}
        </span>
      </button>

      {/* Pop-up explicatif */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="presentation"
          onClick={close}
          onKeyDown={(e) => { if (e.key === 'Escape') close(); }}
        >
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" aria-hidden="true" />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="cahp-dialog-title"
            className="relative bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Bande tricolore */}
            <div className="h-1 w-full" style={{ background: 'linear-gradient(to right, #0055A4 33.3%, #ffffff 33.3%, #ffffff 66.6%, #EF4135 66.6%)' }} />
            <div className="p-5">
              <div className="flex items-start justify-between mb-3">
                <h3 id="cahp-dialog-title" className="text-base font-bold text-slate-800">CA Hors Période (CA HP)</h3>
                <button type="button" aria-label="Fermer" onClick={close} className="text-slate-500 hover:text-slate-800 ml-3 flex-shrink-0">✕</button>
              </div>
              <p className="text-sm text-slate-600 mb-4">
                L'APORTT accorde <strong>2 jours de CA bonus</strong> si vous posez au moins <strong>8 CA en dehors de la période estivale</strong>. Ces jours supplémentaires peuvent être transférés au CET.
              </p>
              <div className="space-y-2 mb-4">
                <div className="flex items-start gap-2 text-sm">
                  <span className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />
                  <span className="text-slate-600"><strong>Périodes valides :</strong> janvier–avril et novembre–décembre</span>
                </div>
                <div className="flex items-start gap-2 text-sm">
                  <span className="w-2 h-2 rounded-full bg-amber-400 mt-1.5 flex-shrink-0" />
                  <span className="text-slate-600"><strong>Période estivale :</strong> mai–octobre — les CA posés ne comptent pas</span>
                </div>
                <div className="flex items-start gap-2 text-sm">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0" />
                  <span className="text-slate-600"><strong>Paliers :</strong> 4 CA hors période = 1 CA HP, 8 CA hors période = 2 CA HP</span>
                </div>
              </div>
              <button
                onClick={close}
                className="w-full py-2 rounded-xl text-sm font-semibold text-white"
                style={{ background: 'linear-gradient(135deg, #0055A4, #1a7de8)' }}
              >
                Compris
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function CalendarView({ cycleConfig, counters, onRangeSelected, history, onDeleteLeave, onEditLeave, resetTrigger = 0 }: CalendarViewProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('month');
  const prevResetTrigger = useRef(resetTrigger);

  const dateRange = useDateRangePicker(cycleConfig, (start, end, workingDays) => {
    // On ouvre toujours la modale, même à 0 jour travaillé : une période de
    // repos (ex. week-end en cycle hebdo) doit pouvoir être marquée en
    // astreinte / permanence ou en arrêt maladie.
    onRangeSelected(start, end, workingDays);
  });

  useEffect(() => {
    if (resetTrigger !== prevResetTrigger.current) {
      dateRange.reset();
      prevResetTrigger.current = resetTrigger;
    }
  }, [resetTrigger, dateRange]);

  return (
    <div className="flex flex-col gap-4">
      {/* Switcher de vue */}
      <div className="flex items-center justify-center" role="tablist" aria-label="Mode d'affichage du calendrier">
        <div className="inline-flex items-center gap-1 bg-muted/50 rounded-xl p-1">
          <button
            onClick={() => setViewMode('month')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              viewMode === 'month'
                ? 'gradient-primary text-white shadow-md shadow-blue-500/20'
                : 'text-muted-foreground hover:text-foreground hover:bg-white/60'
            }`}
            role="tab"
            aria-selected={viewMode === 'month'}
            aria-label="Affichage mensuel"
          >
            <Calendar className="w-4 h-4" aria-hidden="true" />
            <span className="hidden sm:inline">Mois</span>
          </button>
          <button
            onClick={() => setViewMode('week')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              viewMode === 'week'
                ? 'gradient-primary text-white shadow-md shadow-blue-500/20'
                : 'text-muted-foreground hover:text-foreground hover:bg-white/60'
            }`}
            role="tab"
            aria-selected={viewMode === 'week'}
            aria-label="Affichage hebdomadaire"
          >
            <CalendarDays className="w-4 h-4" aria-hidden="true" />
            <span className="hidden sm:inline">Semaine</span>
          </button>
          <button
            onClick={() => setViewMode('year')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              viewMode === 'year'
                ? 'gradient-primary text-white shadow-md shadow-blue-500/20'
                : 'text-muted-foreground hover:text-foreground hover:bg-white/60'
            }`}
            role="tab"
            aria-selected={viewMode === 'year'}
            aria-label="Affichage annuel"
          >
            <CalendarRange className="w-4 h-4" aria-hidden="true" />
            <span className="hidden sm:inline">Année</span>
          </button>
        </div>
      </div>

      {/* Vue calendrier */}
      <div>
        {viewMode === 'month' && (
          <div className="animate-in fade-in-0 slide-in-from-bottom-4 duration-300">
            <CalendarMonth cycleConfig={cycleConfig} dateRange={dateRange} history={history} />
          </div>
        )}
        {viewMode === 'week' && (
          <div className="animate-in fade-in-0 slide-in-from-bottom-4 duration-300">
            <CalendarWeek cycleConfig={cycleConfig} dateRange={dateRange} history={history} />
          </div>
        )}
        {viewMode === 'year' && (
          <div className="animate-in fade-in-0 slide-in-from-bottom-4 duration-300">
            <CalendarYear cycleConfig={cycleConfig} dateRange={dateRange} history={history} />
          </div>
        )}
      </div>

      {/* Bande CA HP */}
      <CaHPBand counters={counters} />

      {/* Liste des congés posés */}
      <LeaveList
        history={history}
        onDelete={onDeleteLeave ?? (() => {})}
        onEdit={onEditLeave}
      />
    </div>
  );
}
