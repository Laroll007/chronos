'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { COUNTER_LABELS, COUNTER_COLORS, HEURES_PAR_JOUR } from '@/lib/constants';
import { formatMinutes, getDaysUntil } from '@/lib/calculations';
import { AlertTriangle, Clock, Info, Sparkles } from 'lucide-react';
import { CounterHelpButton, HELP_CONTENT } from '@/components/shared/CounterHelpModal';

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
  onDetails?: (id: string) => void;
  onHelp?: (id: string) => void;
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
  onDetails,
  onHelp,
}: CounterCardProps) {
  const hasHelp = !!HELP_CONTENT[id];
  const colors = COUNTER_COLORS[id] || COUNTER_COLORS.rtc;
  const percent = max > 0 ? Math.min((value / max) * 100, 100) : 0;

  const displayValue = unit === 'heures' ? formatMinutes(value) : `${value}j`;
  const displayMax = unit === 'heures' ? formatMinutes(max) : `${max}j`;
  const displayDays = unit === 'heures' ? `≈ ${Math.floor(value / HEURES_PAR_JOUR)}j` : null;

  const daysRemaining = deadline ? getDaysUntil(deadline) : null;

  const statusConfig = {
    ok: {
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
      icon: null,
    },
    warning: {
      color: 'text-amber-600',
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      icon: <Clock className="w-4 h-4" />,
    },
    critical: {
      color: 'text-rose-600',
      bg: 'bg-rose-50',
      border: 'border-rose-200',
      icon: <AlertTriangle className="w-4 h-4" />,
    },
    protected: {
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      icon: null,
    },
  };

  const config = statusConfig[status];

  return (
    <Card
      className={`glass overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-md ${onDetails ? 'cursor-pointer active:scale-[0.99]' : ''}`}
      onClick={() => onDetails?.(id)}
      role={onDetails ? 'button' : undefined}
      tabIndex={onDetails ? 0 : undefined}
      aria-label={`${label} : ${displayValue} sur ${displayMax}${deadline && daysRemaining !== null ? `, ${daysRemaining > 0 ? `${daysRemaining} jours restants` : daysRemaining === 0 ? "deadline aujourd'hui" : 'deadline dépassée'}` : ''}. Cliquer pour les détails.`}
      onKeyDown={(e) => {
        if (onDetails && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onDetails(id);
        }
      }}
    >
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h3 className={`font-semibold text-sm sm:text-base ${colors.text}`}>{label}</h3>
              {hasHelp && onHelp && (
                <CounterHelpButton onClick={() => onHelp(id)} className="w-5 h-5" />
              )}
              {gain && (
                <Badge variant="secondary" className="hidden sm:flex text-xs bg-blue-100 text-blue-700">
                  <Sparkles className="w-3 h-3 mr-1" />
                  {gain}
                </Badge>
              )}
            </div>
            {description && (
              <span className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground mt-1">
                <Info className="w-3 h-3 shrink-0" />
                <span className="truncate">{description}</span>
              </span>
            )}
          </div>
          {config.icon && (
            <div className={`p-1.5 sm:p-2 rounded-lg ${config.bg} ${config.color} shrink-0`}>
              {config.icon}
            </div>
          )}
        </div>

        <div className="mb-2">
          <div className="flex items-end justify-between mb-1">
            <div className="flex items-end gap-1.5">
              <span className="text-lg sm:text-2xl font-bold">{displayValue}</span>
              {displayDays && (
                <span className="hidden sm:block text-sm text-muted-foreground mb-0.5">{displayDays}</span>
              )}
            </div>
            <span className="text-xs sm:text-sm text-muted-foreground">/ {displayMax}</span>
          </div>
          <Progress value={percent} className="h-1.5 sm:h-2" />
        </div>

        {deadline && daysRemaining !== null && (
          <div
            className={`hidden sm:flex items-center gap-2 text-xs p-2 rounded-lg ${config.bg} ${config.border} border`}
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
        {/* Badge deadline compact mobile */}
        {deadline && daysRemaining !== null && (
          <div className={`flex sm:hidden items-center gap-1 text-xs ${config.color}`}>
            <Clock className="w-3 h-3" />
            <span>{daysRemaining > 0 ? `${daysRemaining}j` : daysRemaining === 0 ? 'Auj.' : '!'}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
