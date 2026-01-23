// Carte affichant une combinaison de congés avec son score et détails
// PERF-005: Mémoïsé avec React.memo

'use client';

import { memo } from 'react';
import { Combination } from '@/lib/types';
import { getCombinationSummary } from '@/lib/optimization';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CombinationCardProps {
  combination: Combination;
  onSelect: (combination: Combination) => void;
  isOptimal?: boolean;
}

/**
 * Retourne la couleur selon le score
 */
function getScoreColor(score: number): {
  bg: string;
  text: string;
  border: string;
  label: string;
} {
  if (score >= 90) {
    return {
      bg: 'bg-emerald-50',
      text: 'text-emerald-600',
      border: 'border-emerald-200',
      label: 'OPTIMAL',
    };
  } else if (score >= 75) {
    return {
      bg: 'bg-yellow-50',
      text: 'text-yellow-600',
      border: 'border-yellow-200',
      label: 'BON',
    };
  } else if (score >= 60) {
    return {
      bg: 'bg-orange-50',
      text: 'text-orange-600',
      border: 'border-orange-200',
      label: 'ACCEPTABLE',
    };
  } else {
    return {
      bg: 'bg-red-50',
      text: 'text-red-600',
      border: 'border-red-200',
      label: 'NON RECOMMANDÉ',
    };
  }
}

/**
 * Formate une valeur de compteur (minutes ou jours) en texte lisible
 */
function formatCounterValue(value: number, type: string): string {
  // CA, CET, CA HP sont en jours
  if (type === 'ca' || type === 'caHP' || type === 'cet') {
    return `${value}j`;
  }
  // CF, RTC, RPS, HS sont en minutes → convertir en heures
  const hours = Math.floor(value / 60);
  const mins = value % 60;
  if (mins === 0) return `${hours}h`;
  return `${hours}h${mins.toString().padStart(2, '0')}`;
}

export const CombinationCard = memo(function CombinationCard({
  combination,
  onSelect,
  isOptimal = false,
}: CombinationCardProps) {
  const scoreColor = getScoreColor(combination.score);
  const summary = getCombinationSummary(combination);

  return (
    <Card
      className={cn(
        'glass border transition-all hover:shadow-lg',
        scoreColor.border,
        scoreColor.bg
      )}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className={cn('text-2xl font-bold', scoreColor.text)} aria-hidden="true">
                {combination.score}
              </span>
              <span className="text-sm text-muted-foreground" aria-hidden="true">/100</span>
              <span className="text-lg" aria-hidden="true">{combination.scoreLabel}</span>
              {/* Label textuel toujours visible pour accessibilité */}
              <Badge
                variant="secondary"
                className={cn(
                  'ml-auto',
                  isOptimal ? 'bg-emerald-100 text-emerald-700' : `${scoreColor.bg} ${scoreColor.text}`
                )}
              >
                {scoreColor.label}
              </Badge>
              {/* Texte accessible pour screen readers */}
              <span className="sr-only">
                Score {combination.score} sur 100, {scoreColor.label}
              </span>
            </div>
            <h3 className="text-lg font-semibold text-slate-800">{summary}</h3>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Avantages */}
        {combination.advantages.length > 0 && (
          <div className="space-y-2">
            {combination.advantages.map((advantage, index) => (
              <div key={index} className="flex items-start gap-2 text-sm">
                <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span className="text-emerald-700">{advantage}</span>
              </div>
            ))}
          </div>
        )}

        {/* Inconvénients */}
        {combination.disadvantages.length > 0 && (
          <div className="space-y-2">
            {combination.disadvantages.map((disadvantage, index) => (
              <div key={index} className="flex items-start gap-2 text-sm">
                <AlertTriangle className="w-4 h-4 text-orange-600 shrink-0 mt-0.5" />
                <span className="text-orange-700">{disadvantage}</span>
              </div>
            ))}
          </div>
        )}

        {/* Impact sur les compteurs */}
        {combination.impact.length > 0 && (
          <div className="space-y-1.5 pt-2 border-t border-slate-200">
            <p className="text-xs font-medium text-muted-foreground mb-2">
              Impact sur les compteurs :
            </p>
            {combination.impact.map((impact, index) => (
              <div
                key={index}
                className="flex items-center justify-between text-sm"
              >
                <span className="text-muted-foreground uppercase text-xs">
                  {impact.type}
                </span>
                <span>
                  <span className="text-muted-foreground">
                    {formatCounterValue(impact.before, impact.type)}
                  </span>
                  <span className="mx-2 text-blue-600">→</span>
                  <span className={scoreColor.text}>
                    {formatCounterValue(impact.after, impact.type)}
                  </span>
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Bouton de validation */}
        <Button
          onClick={() => onSelect(combination)}
          className="w-full gradient-primary"
          size="lg"
          aria-label={`Valider l'option ${summary}, score ${combination.score} sur 100, ${scoreColor.label}`}
        >
          Valider cette option
        </Button>
      </CardContent>
    </Card>
  );
});

CombinationCard.displayName = 'CombinationCard';
