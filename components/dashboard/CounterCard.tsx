'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { COUNTER_LABELS, COUNTER_COLORS } from '@/lib/constants';
import { formatMinutes, getDaysUntil } from '@/lib/calculations';
import { AlertTriangle, Clock, Info, Sparkles, Shield } from 'lucide-react';

interface CounterCardProps {
  id: string;
  label: string;
  value: number;
  max: number;
  unit: 'jours' | 'heures';
  deadline?: Date;
  status: 'ok' | 'warning' | 'critical' | 'protected';
  description?: string;
  highlight?: boolean;
  gain?: string;
}

export function CounterCard({
  id,
  label,
  value,
  max,
  unit,
  deadline,
  status,
  description,
  highlight,
  gain,
}: CounterCardProps) {
  const colors = COUNTER_COLORS[id] || COUNTER_COLORS.rtc;
  const percent = max > 0 ? Math.min((value / max) * 100, 100) : 0;

  const displayValue = unit === 'heures' ? formatMinutes(value) : `${value}j`;
  const displayMax = unit === 'heures' ? formatMinutes(max) : `${max}j`;

  const daysRemaining = deadline ? getDaysUntil(deadline) : null;

  const statusConfig = {
    ok: {
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
      glow: '',
      icon: null,
    },
    warning: {
      color: 'text-amber-600',
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      glow: '',
      icon: <Clock className="w-4 h-4" />,
    },
    critical: {
      color: 'text-red-600',
      bg: 'bg-red-50',
      border: 'border-red-200',
      glow: '',
      icon: <AlertTriangle className="w-4 h-4" />,
    },
    protected: {
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      glow: '',
      icon: <Shield className="w-4 h-4" />,
    },
  };

  const config = statusConfig[status];

  return (
    <Card
      className="glass border-slate-200 overflow-hidden transition-all hover:scale-[1.02] hover:shadow-md"
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className={`font-semibold ${colors.text}`}>{label}</h3>
              {gain && (
                <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700">
                  <Sparkles className="w-3 h-3 mr-1" />
                  {gain}
                </Badge>
              )}
            </div>
            {description && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                      <Info className="w-3 h-3" />
                      <span className="truncate max-w-[150px]">{description}</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p>{description}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          {config.icon && (
            <div className={`p-2 rounded-lg ${config.bg} ${config.color}`}>
              {config.icon}
            </div>
          )}
        </div>

        <div className="mb-3">
          <div className="flex items-end justify-between mb-1">
            <span className="text-2xl font-bold">{displayValue}</span>
            <span className="text-sm text-muted-foreground">/ {displayMax}</span>
          </div>
          <Progress
            value={percent}
            className="h-2"
          />
        </div>

        {deadline && daysRemaining !== null && (
          <div
            className={`flex items-center gap-2 text-xs p-2 rounded-lg ${config.bg} ${config.border} border`}
          >
            <Clock className={`w-3 h-3 ${config.color}`} />
            <span className={config.color}>
              {daysRemaining > 0
                ? `${daysRemaining}j restants`
                : daysRemaining === 0
                ? "Aujourd'hui !"
                : 'Dépassé !'}
            </span>
            <span className="text-muted-foreground ml-auto">
              {deadline.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
