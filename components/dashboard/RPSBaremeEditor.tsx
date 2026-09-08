'use client';

import { useState } from 'react';
import { CycleConfig, WeekHours } from '@/lib/types';
import { baremeRPSParDefaut, baremeRPSNuit } from '@/lib/rps';
import { formatMinutes } from '@/lib/calculations';
import { JOURS_SEMAINE } from '@/lib/constants';
import { Moon, Sun, RotateCcw, Check } from 'lucide-react';

interface RPSBaremeEditorProps {
  cycleConfig: CycleConfig;
  onSave: (rpsParJour: WeekHours) => void;
}

/**
 * Paramétrage du crédit automatique de RPS, jour de semaine par jour de semaine.
 *
 * L'APORTT définit des coefficients non cumulables appliqués aux heures
 * travaillées : 0,4 le dimanche, 0,1 pour le travail de nuit (créneau 21h–6h).
 * La règle « dimanche uniquement » codée à l'origine ne convenait donc pas aux
 * agents de nuit, qui récupèrent à chaque vacation.
 *
 * Le barème est exprimé en durée plutôt qu'en coefficient : c'est ce que l'agent
 * lit sur son bulletin GesTT, et cela reste juste quand la vacation ne couvre
 * qu'une partie du créneau de nuit.
 */
export function RPSBaremeEditor({ cycleConfig, onSave }: RPSBaremeEditorProps) {
  const jourMinutes = cycleConfig.heuresParJour || 728;
  const [bareme, setBareme] = useState<WeekHours>(
    () => cycleConfig.rpsParJour ?? baremeRPSParDefaut()
  );
  const [enregistre, setEnregistre] = useState(false);

  const modifier = (jour: keyof WeekHours, valeur: number) => {
    setBareme((prev) => ({ ...prev, [jour]: Math.max(0, Math.min(1440, valeur)) }));
    setEnregistre(false);
  };

  const appliquerPreset = (next: WeekHours) => {
    setBareme(next);
    setEnregistre(false);
  };

  const total = JOURS_SEMAINE.reduce((s, j) => s + (bareme[j.key as keyof WeekHours] || 0), 0);

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-600">
        Durée créditée automatiquement pour <strong>chaque jour travaillé</strong>, selon
        le jour de la semaine. Un jour en congé ou en arrêt maladie ne crédite rien.
      </p>

      {/* Barèmes types */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => appliquerPreset(baremeRPSParDefaut())}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-600 hover:border-blue-300 hover:text-blue-700 transition-colors"
        >
          <Sun className="w-3.5 h-3.5" />
          Service de jour
        </button>
        <button
          onClick={() => appliquerPreset(baremeRPSNuit(jourMinutes))}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-600 hover:border-indigo-300 hover:text-indigo-700 transition-colors"
        >
          <Moon className="w-3.5 h-3.5" />
          Service de nuit
        </button>
        <button
          onClick={() => appliquerPreset(baremeRPSParDefaut())}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-600 transition-colors"
          aria-label="Réinitialiser le barème"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Saisie jour par jour */}
      <div className="space-y-1.5">
        {JOURS_SEMAINE.map((j) => {
          const cle = j.key as keyof WeekHours;
          const minutes = bareme[cle] || 0;
          return (
            <div key={j.key} className="flex items-center gap-2">
              <label htmlFor={`rps-${j.key}`} className="text-xs text-slate-600 w-20 shrink-0">
                {j.label}
              </label>
              <input
                id={`rps-${j.key}`}
                type="number"
                min={0}
                max={999}
                value={Math.floor(minutes / 60) || ''}
                placeholder="0"
                inputMode="numeric"
                aria-label={`${j.label} — heures`}
                onChange={(e) =>
                  modifier(cle, (parseInt(e.target.value) || 0) * 60 + (minutes % 60))
                }
                className="w-14 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-xs text-slate-400">h</span>
              <input
                type="number"
                min={0}
                max={59}
                value={minutes % 60 || ''}
                placeholder="0"
                inputMode="numeric"
                aria-label={`${j.label} — minutes`}
                onChange={(e) =>
                  modifier(cle, Math.floor(minutes / 60) * 60 + (parseInt(e.target.value) || 0))
                }
                className="w-14 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-xs text-slate-400">min</span>
              {minutes > 0 && (
                <span className="text-[11px] text-emerald-600 ml-auto">
                  {formatMinutes(minutes)} / jour travaillé
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-slate-200">
        <span className="text-[11px] text-slate-500">
          {total === 0
            ? 'Aucun crédit automatique'
            : `Semaine complète travaillée : ${formatMinutes(total)}`}
        </span>
        <button
          onClick={() => {
            onSave(bareme);
            setEnregistre(true);
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors"
        >
          {enregistre ? <Check className="w-3.5 h-3.5" /> : null}
          {enregistre ? 'Enregistré' : 'Enregistrer'}
        </button>
      </div>

      <p className="text-[11px] text-slate-400">
        Repère APORTT : coefficients non cumulables appliqués aux heures travaillées —
        0,4 le dimanche, 0,1 pour le travail de nuit (21h–6h).
      </p>
    </div>
  );
}
