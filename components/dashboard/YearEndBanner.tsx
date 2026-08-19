'use client';

import { useMemo, useState, useEffect } from 'react';
import { Counters, CycleConfig } from '@/lib/types';
import { calculateYearEndBalance, formatYearEndSummary } from '@/lib/yearEnd';
import { formatMinutes } from '@/lib/calculations';
import { CalendarClock, X, ChevronDown, PiggyBank } from 'lucide-react';

const DISMISS_KEY = 'chronos_yearend_dismissed';

interface YearEndBannerProps {
  counters: Counters;
  cycleConfig: CycleConfig;
}

/**
 * Bandeau de fin d'année (à partir du 1er septembre) : rappelle ce qui sera perdu
 * au 31/12 si rien n'est posé, une fois déduit ce qui partira réellement au CET.
 *
 * Refermable, mais la signature du bilan est mémorisée : dès que les soldes
 * bougent, le bandeau réapparaît — l'agent n'est pas prévenu une seule fois en
 * septembre puis plus jamais.
 */
export function YearEndBanner({ counters, cycleConfig }: YearEndBannerProps) {
  const bilan = useMemo(
    () => calculateYearEndBalance(counters, cycleConfig),
    [counters, cycleConfig]
  );

  // Signature = état du bilan. Change dès qu'un solde évolue.
  const signature = useMemo(
    () => bilan.items.map((i) => `${i.type}:${i.aSolder}`).join('|'),
    [bilan]
  );

  const [dismissed, setDismissed] = useState(true); // fermé tant qu'on n'a pas lu le localStorage
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(DISMISS_KEY) === signature);
    } catch {
      setDismissed(false);
    }
  }, [signature]);

  const close = () => {
    try {
      localStorage.setItem(DISMISS_KEY, signature);
    } catch {
      /* stockage indisponible : le bandeau réapparaîtra, ce n'est pas bloquant */
    }
    setDismissed(true);
  };

  if (!bilan.actif || bilan.items.length === 0 || dismissed) return null;

  const urgent = bilan.joursRestants <= 45;

  return (
    <div
      className={`rounded-xl border p-3 ${
        urgent ? 'bg-rose-50 border-rose-200' : 'bg-amber-50 border-amber-200'
      }`}
      role="status"
    >
      <div className="flex items-start gap-2.5">
        <CalendarClock
          className={`w-4 h-4 flex-shrink-0 mt-0.5 ${urgent ? 'text-rose-600' : 'text-amber-600'}`}
          aria-hidden="true"
        />
        <div className="flex-1 min-w-0">
          <div className={`text-sm font-semibold ${urgent ? 'text-rose-800' : 'text-amber-800'}`}>
            {bilan.joursASolder} journée{bilan.joursASolder > 1 ? 's' : ''} à poser avant le 31 décembre
          </div>
          <div className={`text-xs mt-0.5 ${urgent ? 'text-rose-700' : 'text-amber-700'}`}>
            {formatYearEndSummary(bilan)}
            <span className="opacity-70"> — {bilan.joursRestants} jours restants</span>
          </div>

          <button
            onClick={() => setExpanded((v) => !v)}
            className={`mt-1.5 inline-flex items-center gap-1 text-xs font-medium underline-offset-2 hover:underline ${
              urgent ? 'text-rose-700' : 'text-amber-700'
            }`}
            aria-expanded={expanded}
          >
            {expanded ? 'Masquer le détail' : 'Voir le détail'}
            <ChevronDown className={`w-3 h-3 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </button>

          {expanded && (
            <div className="mt-2 space-y-1.5">
              {bilan.items.map((item) => (
                <div
                  key={item.type}
                  className="flex items-start justify-between gap-3 rounded-lg bg-white/70 px-2.5 py-1.5"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-slate-700">{item.label}</div>
                    <div className="text-[11px] text-slate-600">{item.raison}</div>
                  </div>
                  <div className="text-xs font-bold text-slate-800 flex-shrink-0">
                    {item.unite === 'jours' ? `${item.aSolder}j` : formatMinutes(item.aSolder)}
                  </div>
                </div>
              ))}

              {bilan.apportCET.total > 0 && (
                <div className="flex items-start gap-1.5 rounded-lg bg-emerald-50 border border-emerald-200 px-2.5 py-1.5">
                  <PiggyBank className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
                  <span className="text-[11px] text-emerald-800">
                    Déjà déduit : <strong>{bilan.apportCET.total}j</strong> partiront au CET
                    {bilan.apportCET.rtc > 0 && ` (${bilan.apportCET.rtc}j de RTC`}
                    {bilan.apportCET.ca > 0 && `${bilan.apportCET.rtc > 0 ? ', ' : ' ('}${bilan.apportCET.ca}j de CA`}
                    {bilan.apportCET.caHP > 0 && `, ${bilan.apportCET.caHP}j de CA HP`}
                    {bilan.apportCET.hs > 0 && `, ${bilan.apportCET.hs}j de HS`}
                    {(bilan.apportCET.rtc > 0 || bilan.apportCET.ca > 0) && ')'}.
                    {' '}Le CET n&apos;accepte que {bilan.capaciteCET} jour
                    {bilan.capaciteCET > 1 ? 's' : ''} cette année — le reste doit être posé.
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        <button
          onClick={close}
          aria-label="Masquer ce rappel"
          className={`flex-shrink-0 w-6 h-6 rounded-lg flex items-center justify-center transition-colors ${
            urgent
              ? 'text-rose-500 hover:bg-rose-100 hover:text-rose-700'
              : 'text-amber-600 hover:bg-amber-100 hover:text-amber-800'
          }`}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
