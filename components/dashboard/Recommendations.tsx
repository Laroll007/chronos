'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Recommendation } from '@/lib/types';
import { formatMinutes } from '@/lib/calculations';
import {
  AlertTriangle,
  Clock,
  Lightbulb,
  ChevronRight,
  Sparkles,
  TrendingUp,
} from 'lucide-react';

interface RecommendationsProps {
  recommendations: Recommendation[];
  weeklyPriorities: string[];
}

export function Recommendations({ recommendations, weeklyPriorities }: RecommendationsProps) {
  const highPriority = recommendations.filter((r) => r.priority === 'high');
  const mediumPriority = recommendations.filter((r) => r.priority === 'medium');

  if (recommendations.length === 0) {
    return (
      <Card className="glass border-white/10">
        <CardContent className="p-6 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-500/20 mb-4">
            <Sparkles className="w-6 h-6 text-emerald-400" />
          </div>
          <h3 className="font-semibold text-emerald-400 mb-2">Tout est optimal !</h3>
          <p className="text-sm text-muted-foreground">
            Vos congés sont bien gérés. Continuez comme ça.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Priorités de la semaine */}
      {weeklyPriorities.length > 0 && (
        <Card className="glass border-white/10 border-l-4 border-l-violet-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-violet-400" />
              Cette semaine
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ul className="space-y-2">
              {weeklyPriorities.slice(0, 3).map((priority, index) => (
                <li key={index} className="flex items-center gap-2 text-sm">
                  <ChevronRight className="w-4 h-4 text-violet-400" />
                  <span>{priority}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Alertes critiques */}
      {highPriority.length > 0 && (
        <Card className="glass border-white/10 border-l-4 border-l-rose-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400" />
              Alertes urgentes
              <Badge variant="destructive" className="ml-auto">
                {highPriority.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-3">
            {highPriority.map((rec) => (
              <div
                key={rec.id}
                className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20"
              >
                <div className="font-medium text-rose-300 mb-1">{rec.action}</div>
                <div className="text-xs text-rose-400/80 flex items-center gap-2">
                  <span>{rec.reason}</span>
                  {rec.deadline && (
                    <>
                      <Clock className="w-3 h-3" />
                      <span>
                        {new Date(rec.deadline).toLocaleDateString('fr-FR', {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </span>
                    </>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Recommandations moyennes */}
      {mediumPriority.length > 0 && (
        <Card className="glass border-white/10 border-l-4 border-l-amber-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-amber-400" />
              Recommandations
              <Badge variant="secondary" className="ml-auto bg-amber-500/20 text-amber-300">
                {mediumPriority.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-2">
            {mediumPriority.slice(0, 5).map((rec) => (
              <div
                key={rec.id}
                className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/10 hover:bg-amber-500/10 transition-colors"
              >
                <div className="font-medium text-amber-200 text-sm mb-1">
                  {rec.action}
                </div>
                <div className="text-xs text-muted-foreground flex items-center gap-2">
                  <span>{rec.reason}</span>
                  {rec.deadline && (
                    <span className="text-amber-400/60">
                      →{' '}
                      {new Date(rec.deadline).toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
