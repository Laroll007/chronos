// Carte compacte affichant une combinaison de congés
// PERF-005: Mémoïsé avec React.memo

'use client';

import { memo } from 'react';
import { Combination } from '@/lib/types';
import { getCombinationSummary } from '@/lib/optimization';
import { Button } from '@/components/ui/button';
import { Check, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CombinationCardProps {
  combination: Combination;
  onSelect: (combination: Combination) => void;
  rank: number;
}

function getRankStyle(rank: number) {
  if (rank === 1) return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  if (rank === 2) return 'bg-blue-50 text-blue-600 border-blue-200';
  if (rank === 3) return 'bg-amber-50 text-amber-600 border-amber-200';
  return 'bg-slate-50 text-slate-500 border-slate-200';
}

function getCardBorder(rank: number) {
  if (rank === 1) return 'border-emerald-200 bg-emerald-50/50';
  if (rank <= 3) return 'border-blue-100 bg-blue-50/30';
  return 'border-slate-200 bg-white';
}

export const CombinationCard = memo(function CombinationCard({
  combination,
  onSelect,
  rank,
}: CombinationCardProps) {
  const summary = getCombinationSummary(combination);
  const hasDetails = combination.advantages.length > 0 || combination.disadvantages.length > 0;

  return (
    <div
      className={cn(
        'border rounded-lg p-3 transition-all duration-200 hover:shadow-md',
        getCardBorder(rank)
      )}
    >
      <div className="flex items-center gap-3">
        {/* Rang */}
        <span
          className={cn(
            'shrink-0 w-7 h-7 rounded-full border flex items-center justify-center text-xs font-bold',
            getRankStyle(rank)
          )}
        >
          {rank}
        </span>

        {/* Contenu */}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-slate-800 truncate">{summary}</p>
          {hasDetails && (
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
              {combination.advantages.map((adv, i) => (
                <span key={`a${i}`} className="inline-flex items-center gap-1 text-xs text-emerald-600">
                  <Check className="w-3 h-3" />
                  {adv}
                </span>
              ))}
              {combination.disadvantages.map((dis, i) => (
                <span key={`d${i}`} className="inline-flex items-center gap-1 text-xs text-orange-600">
                  <AlertTriangle className="w-3 h-3" />
                  {dis}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Bouton */}
        <Button
          onClick={() => onSelect(combination)}
          size="sm"
          className="shrink-0 gradient-primary text-xs h-8 px-3"
          aria-label={`Valider l'option ${rank}: ${summary}`}
        >
          Valider
        </Button>
      </div>
    </div>
  );
});

CombinationCard.displayName = 'CombinationCard';
