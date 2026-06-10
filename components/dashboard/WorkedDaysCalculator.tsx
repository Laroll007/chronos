'use client';

import { useMemo, useState } from 'react';
import { CycleConfig, HistoryEntry } from '@/lib/types';
import { computeWorkedDays } from '@/lib/calculations';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { Briefcase, X, Calendar, Clock, Thermometer, ShieldAlert } from 'lucide-react';

interface WorkedDaysCalculatorProps {
  isOpen: boolean;
  onClose: () => void;
  cycleConfig: CycleConfig;
  history: HistoryEntry[];
}

// Format 'YYYY-MM-DD' → Date locale à minuit (évite les décalages UTC)
function parseLocalDate(str: string): Date | null {
  const m = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return isNaN(d.getTime()) ? null : d;
}

function toInputValue(date: Date): string {
  const y = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${mo}-${d}`;
}

export function WorkedDaysCalculator({
  isOpen,
  onClose,
  cycleConfig,
  history,
}: WorkedDaysCalculatorProps) {
  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  const [startStr, setStartStr] = useState(() => toInputValue(firstOfMonth));
  const [endStr, setEndStr] = useState(() => toInputValue(today));

  const start = useMemo(() => parseLocalDate(startStr), [startStr]);
  const end = useMemo(() => parseLocalDate(endStr), [endStr]);
  const invalidRange = !!start && !!end && end < start;

  const breakdown = useMemo(() => {
    if (!start || !end || invalidRange) return null;
    return computeWorkedDays(start, end, cycleConfig, history);
  }, [start, end, invalidRange, cycleConfig, history]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="w-[92vw] max-w-sm p-0 overflow-hidden border-0 shadow-2xl rounded-2xl"
        showCloseButton={false}
      >
        {/* Header */}
        <div
          className="px-6 pt-6 pb-5 text-white"
          style={{ background: 'linear-gradient(135deg, #0a1628 0%, #0d2347 55%, #0055A4 100%)' }}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
              <Briefcase className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-lg font-bold leading-tight text-white">
                Jours travaillés
              </DialogTitle>
              <p className="text-blue-200 text-xs mt-0.5">
                Calcul net sur une période
              </p>
            </div>
            <DialogClose className="shrink-0 w-8 h-8 rounded-xl bg-white/15 hover:bg-white/25 flex items-center justify-center text-white/80 hover:text-white transition-all">
              <X className="w-4 h-4" />
            </DialogClose>
          </div>
          <div
            className="mt-4 h-[3px] rounded-full"
            style={{ background: 'linear-gradient(90deg, #0055A4 33%, #ffffff 33%, #ffffff 66%, #EF4135 66%)' }}
          />
        </div>

        {/* Corps */}
        <div className="px-6 py-5 bg-white space-y-4">
          {/* Sélection de période */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="wdc-start" className="text-xs font-medium text-slate-500 mb-1 block">
                Date de début
              </label>
              <input
                id="wdc-start"
                type="date"
                value={startStr}
                max={endStr || undefined}
                onChange={(e) => setStartStr(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label htmlFor="wdc-end" className="text-xs font-medium text-slate-500 mb-1 block">
                Date de fin
              </label>
              <input
                id="wdc-end"
                type="date"
                value={endStr}
                min={startStr || undefined}
                onChange={(e) => setEndStr(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {invalidRange && (
            <p className="text-xs text-rose-600">
              La date de fin doit être postérieure ou égale à la date de début.
            </p>
          )}

          {/* Résultat */}
          {breakdown && (
            <div className="space-y-2.5 animate-in fade-in-0 duration-200">
              <div className="flex items-center justify-between py-1.5 text-sm">
                <span className="flex items-center gap-2 text-slate-600">
                  <Briefcase className="w-4 h-4 text-blue-500" />
                  Jours travaillés (cycle)
                </span>
                <span className="font-semibold text-slate-800">{breakdown.workingDays - breakdown.astreinteDays}</span>
              </div>
              {breakdown.astreinteDays > 0 && (
                <>
                  <div className="h-px bg-slate-100" />
                  <div className="flex items-center justify-between py-1.5 text-sm">
                    <span className="flex items-center gap-2 text-slate-600">
                      <ShieldAlert className="w-4 h-4 text-amber-500" />
                      Astreintes / permanences
                    </span>
                    <span className="font-semibold text-amber-600">+{breakdown.astreinteDays}</span>
                  </div>
                </>
              )}
              <div className="h-px bg-slate-100" />
              <div className="flex items-center justify-between py-1.5 text-sm">
                <span className="flex items-center gap-2 text-slate-600">
                  <Clock className="w-4 h-4 text-emerald-500" />
                  Congés posés
                </span>
                <span className="font-semibold text-emerald-600">−{breakdown.leaveDays}</span>
              </div>
              <div className="h-px bg-slate-100" />
              <div className="flex items-center justify-between py-1.5 text-sm">
                <span className="flex items-center gap-2 text-slate-600">
                  <Thermometer className="w-4 h-4 text-violet-500" />
                  Arrêts maladie (CMO)
                </span>
                <span className="font-semibold text-violet-600">−{breakdown.cmoDays}</span>
              </div>

              <div
                className="flex items-center justify-between rounded-xl px-4 py-3 mt-1 text-white"
                style={{ background: 'linear-gradient(135deg, #0055A4, #1a7de8)' }}
              >
                <span className="flex items-center gap-2 text-sm font-medium">
                  <Calendar className="w-4 h-4" />
                  Réellement travaillés
                </span>
                <span className="text-2xl font-bold tabular-nums">
                  {breakdown.netWorkedDays}
                </span>
              </div>
            </div>
          )}

          <p className="text-xs text-slate-400">
            Jours travaillés du cycle (plus les astreintes/permanences posées les jours de repos), moins les congés posés et les arrêts maladie marqués sur le calendrier.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
