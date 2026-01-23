// Modal d'optimisation affichant toutes les combinaisons possibles

'use client';

import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { Counters, Combination } from '@/lib/types';
import { generateAllCombinations } from '@/lib/optimization';
import { CombinationCard } from './CombinationCard';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Loader2, Sparkles } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface OptimizationModalProps {
  isOpen: boolean;
  onClose: () => void;
  startDate: Date | null;
  endDate: Date | null;
  workingDaysCount: number;
  counters: Counters;
  onApply: (combination: Combination) => void;
}

export function OptimizationModal({
  isOpen,
  onClose,
  startDate,
  endDate,
  workingDaysCount,
  counters,
  onApply,
}: OptimizationModalProps) {
  const [isCalculating, setIsCalculating] = useState(false);
  const [combinations, setCombinations] = useState<Combination[]>([]);

  // PERF-009: Ref pour tracker si on doit recalculer
  const lastCalculationRef = useRef<{
    workingDays: number;
    countersHash: string;
    startTime: number;
  } | null>(null);

  // Créer un hash stable des compteurs pour comparaison
  const countersHash = useMemo(() => {
    return `${counters.ca}|${counters.cf}|${counters.rtc}|${counters.rps}|${counters.hs}|${counters.caHP}`;
  }, [counters.ca, counters.cf, counters.rtc, counters.rps, counters.hs, counters.caHP]);

  // PERF-009: Générer les combinaisons seulement si les données ont vraiment changé
  useEffect(() => {
    if (!isOpen || !startDate || !endDate || workingDaysCount <= 0) {
      return;
    }

    const startTime = startDate.getTime();
    const lastCalc = lastCalculationRef.current;

    // Vérifier si on a déjà calculé pour ces mêmes paramètres
    if (
      lastCalc &&
      lastCalc.workingDays === workingDaysCount &&
      lastCalc.countersHash === countersHash &&
      lastCalc.startTime === startTime
    ) {
      return; // Pas besoin de recalculer
    }

    setIsCalculating(true);

    // Délai court pour l'effet visuel de calcul
    const timeoutId = setTimeout(() => {
      const results = generateAllCombinations(
        workingDaysCount,
        counters,
        startDate
      );
      setCombinations(results);
      setIsCalculating(false);

      // Mémoriser ce calcul
      lastCalculationRef.current = {
        workingDays: workingDaysCount,
        countersHash,
        startTime,
      };
    }, 150); // Réduit de 300ms à 150ms

    return () => clearTimeout(timeoutId);
  }, [isOpen, startDate, endDate, workingDaysCount, countersHash, counters]);

  // PERF-009: useCallback pour stabiliser la référence
  const handleSelect = useCallback((combination: Combination) => {
    onApply(combination);
    onClose();
  }, [onApply, onClose]);

  // Formater la période sélectionnée
  const formattedPeriod = useMemo(() => {
    if (!startDate || !endDate) return '';
    const start = startDate.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
    });
    const end = endDate.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    return `${start} - ${end}`;
  }, [startDate, endDate]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0 glass border-slate-200">
        <DialogHeader className="p-6 pb-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100">
              <Sparkles className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <DialogTitle className="text-xl text-slate-800">
                Optimisation des congés
              </DialogTitle>
              <DialogDescription className="mt-1">
                {formattedPeriod} • {workingDaysCount} jour
                {workingDaysCount > 1 ? 's' : ''} travaillé
                {workingDaysCount > 1 ? 's' : ''}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="h-[calc(90vh-140px)]">
          <div className="p-6">
            {isCalculating ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-4" />
                <p className="text-sm text-muted-foreground">
                  Calcul des meilleures options...
                </p>
              </div>
            ) : combinations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="p-4 rounded-full bg-red-100 mb-4">
                  <Sparkles className="w-8 h-8 text-red-600" />
                </div>
                <h3 className="text-lg font-semibold mb-2">
                  Aucune combinaison valide trouvée
                </h3>
                <p className="text-sm text-muted-foreground max-w-md">
                  Vos compteurs sont insuffisants pour cette période ({workingDaysCount}{' '}
                  jours). Essayez de réduire la durée ou vérifiez vos compteurs disponibles.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm text-muted-foreground">
                    {combinations.length} option{combinations.length > 1 ? 's' : ''}{' '}
                    trouvée{combinations.length > 1 ? 's' : ''}, triée
                    {combinations.length > 1 ? 's' : ''} de la meilleure à la pire
                  </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {combinations.map((combination, index) => (
                    <div
                      key={combination.id}
                      className="animate-in fade-in-0 slide-in-from-bottom-4"
                      style={{
                        animationDelay: `${index * 50}ms`,
                        animationDuration: '300ms',
                      }}
                    >
                      <CombinationCard
                        combination={combination}
                        onSelect={handleSelect}
                        isOptimal={index === 0}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
