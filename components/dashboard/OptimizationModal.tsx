// Modal d'optimisation affichant toutes les combinaisons possibles

'use client';

import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { Counters, Combination, CounterType } from '@/lib/types';
import { generateAllCombinations, createCombination } from '@/lib/optimization';
import { HEURES_PAR_JOUR, CET_PLAFOND } from '@/lib/constants';
import { CombinationCard } from './CombinationCard';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Loader2, Sparkles, Plus, X, Pencil, PiggyBank, Thermometer, ShieldAlert } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface OptimizationModalProps {
  isOpen: boolean;
  onClose: () => void;
  startDate: Date | null;
  endDate: Date | null;
  workingDaysCount: number;
  counters: Counters;
  onApply: (combination: Combination) => void;
  onEpargneCET?: (joursCA: number) => void;
  onMarkCMO?: () => void;
  onMarkAstreinte?: () => void;
}

export function OptimizationModal({
  isOpen,
  onClose,
  startDate,
  endDate,
  workingDaysCount,
  counters,
  onApply,
  onEpargneCET,
  onMarkCMO,
  onMarkAstreinte,
}: OptimizationModalProps) {
  const [isCalculating, setIsCalculating] = useState(false);
  const [combinations, setCombinations] = useState<Combination[]>([]);
  const [showCustom, setShowCustom] = useState(false);
  const [customItems, setCustomItems] = useState<{ type: CounterType; amount: number }[]>([]);
  const [showCETEpargne, setShowCETEpargne] = useState(false);
  const [cetEpargneAmount, setCetEpargneAmount] = useState<number | ''>('');
  const [showCMO, setShowCMO] = useState(false);
  const [showAstreinte, setShowAstreinte] = useState(false);
  const maxCETEpargnable = Math.min(counters.ca, CET_PLAFOND - counters.cet);

  // Types disponibles avec soldes > 0 (en jours)
  const availableTypes = useMemo(() => {
    const types: { type: CounterType; label: string; available: number }[] = [];
    if (counters.ca > 0) types.push({ type: 'ca', label: 'CA', available: counters.ca });
    if (counters.caHP > 0) types.push({ type: 'caHP', label: 'CA HP', available: counters.caHP });
    if (counters.cf > 0) types.push({ type: 'cf', label: 'CF', available: Math.floor(counters.cf / HEURES_PAR_JOUR) });
    if (counters.rtc > 0) types.push({ type: 'rtc', label: 'RTC', available: Math.floor(counters.rtc / HEURES_PAR_JOUR) });
    if (counters.rps > 0) types.push({ type: 'rps', label: 'RPS', available: Math.floor(counters.rps / HEURES_PAR_JOUR) });
    if (counters.hs > 0) types.push({ type: 'hs', label: 'HS', available: Math.floor(counters.hs / HEURES_PAR_JOUR) });
    // CET utilisation : poser des jours depuis le CET
    if (counters.cet > 0) types.push({ type: 'cet', label: 'CET (utiliser)', available: counters.cet });
    return types;
  }, [counters]);

  const getAvailableForType = useCallback((type: CounterType): number => {
    return availableTypes.find(t => t.type === type)?.available ?? 0;
  }, [availableTypes]);

  const toggleCustom = useCallback(() => {
    if (!showCustom && customItems.length === 0 && availableTypes.length > 0) {
      setCustomItems([{ type: availableTypes[0].type, amount: 0 }]);
    }
    setShowCustom(prev => !prev);
  }, [showCustom, customItems.length, availableTypes]);

  const addCustomItem = useCallback(() => {
    const usedTypes = customItems.map(item => item.type);
    const nextType = availableTypes.find(t => !usedTypes.includes(t.type));
    if (nextType) {
      setCustomItems(prev => [...prev, { type: nextType.type, amount: 0 }]);
    }
  }, [customItems, availableTypes]);

  const removeCustomItem = useCallback((index: number) => {
    setCustomItems(prev => prev.filter((_, i) => i !== index));
  }, []);

  const updateCustomItem = useCallback((index: number, field: 'type' | 'amount', value: string | number) => {
    setCustomItems(prev => prev.map((item, i) => {
      if (i !== index) return item;
      if (field === 'type') return { ...item, type: value as CounterType };
      return { ...item, amount: Number(value) || 0 };
    }));
  }, []);

  const customTotal = useMemo(() =>
    customItems.reduce((sum, item) => sum + (item.amount || 0), 0),
    [customItems]
  );

  const isCustomValid = useMemo(() => {
    if (customItems.length === 0) return false;
    if (customTotal !== workingDaysCount) return false;
    return customItems.every(item =>
      item.amount > 0 && item.amount <= getAvailableForType(item.type)
    );
  }, [customTotal, workingDaysCount, customItems, getAvailableForType]);

  const handleCustomApply = useCallback(() => {
    if (!isCustomValid || !startDate) return;
    const combination = createCombination(
      customItems.map(item => ({ type: item.type, amount: item.amount })),
      counters,
      startDate
    );
    onApply(combination);
    onClose();
  }, [startDate, isCustomValid, customItems, counters, onApply, onClose]);

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

  // Reset formulaires à l'ouverture
  useEffect(() => {
    if (isOpen) {
      setShowCustom(false);
      setCustomItems([]);
      setShowCETEpargne(false);
      setCetEpargneAmount('');
      setShowCMO(false);
      setShowAstreinte(false);
    }
  }, [isOpen]);

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
      <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] p-0 bg-background border-slate-200" showCloseButton={false}>
        <DialogHeader className="p-6 pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg gradient-primary-subtle shrink-0">
              <Sparkles className="w-5 h-5 text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-xl text-slate-800">
                Optimisation des congés
              </DialogTitle>
              <DialogDescription className="mt-1">
                {formattedPeriod} • {workingDaysCount} jour
                {workingDaysCount > 1 ? 's' : ''} travaillé
                {workingDaysCount > 1 ? 's' : ''}
              </DialogDescription>
            </div>
            <DialogClose className="shrink-0 w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-all">
              <X className="w-4 h-4" />
            </DialogClose>
          </div>
        </DialogHeader>

        <ScrollArea className="h-[calc(90vh-140px)]">
          <div className="p-6">
            {/* Formulaire personnalisé */}
            {!isCalculating && availableTypes.length > 0 && (
              <div className="mb-6 border-b border-border pb-6">
                <button
                  onClick={toggleCustom}
                  className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
                >
                  <Pencil className="w-4 h-4" />
                  {showCustom ? 'Masquer le choix libre' : 'Choix libre'}
                </button>

                {showCustom && (
                  <div className="mt-4 space-y-3 p-4 rounded-lg bg-slate-50 border border-slate-200">
                    {customItems.map((item, index) => {
                      const usedTypes = customItems
                        .filter((_, i) => i !== index)
                        .map(ci => ci.type);
                      const selectableTypes = availableTypes.filter(
                        t => t.type === item.type || !usedTypes.includes(t.type)
                      );

                      return (
                        <div key={index} className="flex flex-wrap items-center gap-2">
                          <select
                            value={item.type}
                            onChange={(e) => updateCustomItem(index, 'type', e.target.value)}
                            className="flex-1 min-w-0 rounded-md border border-slate-300 bg-white px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            {selectableTypes.map(t => (
                              <option key={t.type} value={t.type}>
                                {t.label} ({t.available}j)
                              </option>
                            ))}
                          </select>
                          <input
                            type="number"
                            min={1}
                            max={getAvailableForType(item.type)}
                            value={item.amount || ''}
                            onChange={(e) => updateCustomItem(index, 'amount', e.target.value)}
                            className="w-16 sm:w-24 rounded-md border border-slate-300 bg-white px-2 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="j"
                          />
                          {customItems.length > 1 && (
                            <button
                              onClick={() => removeCustomItem(index)}
                              className="p-1 rounded hover:bg-slate-200 transition-colors"
                            >
                              <X className="w-4 h-4 text-slate-400 hover:text-rose-500" />
                            </button>
                          )}
                        </div>
                      );
                    })}

                    {customItems.length < availableTypes.length && (
                      <button
                        onClick={addCustomItem}
                        className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        Ajouter un type
                      </button>
                    )}

                    <div className="flex items-center justify-between pt-3 border-t border-slate-200">
                      <div>
                        <span className={`text-sm font-medium ${
                          customTotal === workingDaysCount
                            ? 'text-emerald-600'
                            : customTotal > workingDaysCount
                              ? 'text-rose-600'
                              : 'text-slate-600'
                        }`}>
                          Total : {customTotal} / {workingDaysCount} jour{workingDaysCount > 1 ? 's' : ''}
                        </span>
                        {customTotal > 0 && customTotal !== workingDaysCount && (
                          <p className="text-xs text-rose-500 mt-1">
                            {customTotal < workingDaysCount
                              ? `Il manque ${workingDaysCount - customTotal} jour(s)`
                              : `${customTotal - workingDaysCount} jour(s) en trop`}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={handleCustomApply}
                        disabled={!isCustomValid}
                        className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors bg-blue-600 hover:bg-blue-700"
                      >
                        Valider
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Section épargne CET — distincte de la pose de congés */}
            {onEpargneCET && maxCETEpargnable > 0 && !isCalculating && (
              <div className="mb-6 border-b border-border pb-6">
                <button
                  onClick={() => setShowCETEpargne(prev => !prev)}
                  className="flex items-center gap-2 text-sm font-medium text-red-600 hover:text-red-700 transition-colors"
                >
                  <PiggyBank className="w-4 h-4" />
                  {showCETEpargne ? 'Masquer épargne CET' : 'Épargner au CET'}
                </button>

                {showCETEpargne && (
                  <div className="mt-4 p-4 rounded-lg bg-red-50 border border-red-200 space-y-3">
                    <p className="text-xs text-red-700 flex items-start gap-1.5">
                      <PiggyBank className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                      <span>Les jours épargnés au CET <strong>ne sont pas posés sur le calendrier</strong> — ils s'ajoutent à votre solde CET et diminuent vos CA.</span>
                    </p>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="p-2 rounded bg-white border border-red-100">
                        <p className="text-[10px] text-slate-500">CA dispo</p>
                        <p className="text-base font-bold text-slate-800">{counters.ca}j</p>
                      </div>
                      <div className="p-2 rounded bg-white border border-red-100">
                        <p className="text-[10px] text-slate-500">CET actuel</p>
                        <p className="text-base font-bold text-red-700">{counters.cet}j</p>
                      </div>
                      <div className="p-2 rounded bg-white border border-red-100">
                        <p className="text-[10px] text-slate-500">CET après</p>
                        <p className={`text-base font-bold ${typeof cetEpargneAmount === 'number' && cetEpargneAmount > 0 && cetEpargneAmount <= maxCETEpargnable ? 'text-emerald-600' : 'text-slate-400'}`}>
                          {typeof cetEpargneAmount === 'number' && cetEpargneAmount > 0 && cetEpargneAmount <= maxCETEpargnable
                            ? `${counters.cet + cetEpargneAmount}j`
                            : '—'}
                        </p>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-slate-600 mb-1 block">CA à épargner (max {maxCETEpargnable}j)</label>
                      <input
                        type="number"
                        min={1}
                        max={maxCETEpargnable}
                        value={cetEpargneAmount}
                        onChange={(e) => setCetEpargneAmount(Number(e.target.value) || '')}
                        className="w-full rounded-md border border-red-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                        placeholder={`Nombre de jours (max ${maxCETEpargnable})`}
                      />
                      {typeof cetEpargneAmount === 'number' && cetEpargneAmount > maxCETEpargnable && (
                        <p className="text-xs text-rose-600 mt-1">Maximum {maxCETEpargnable}j (plafond CET : {CET_PLAFOND}j)</p>
                      )}
                    </div>
                    <div className="flex justify-end">
                      <button
                        onClick={() => {
                          if (typeof cetEpargneAmount === 'number' && cetEpargneAmount > 0 && cetEpargneAmount <= maxCETEpargnable) {
                            onEpargneCET(cetEpargneAmount);
                            onClose();
                          }
                        }}
                        disabled={!(typeof cetEpargneAmount === 'number' && cetEpargneAmount > 0 && cetEpargneAmount <= maxCETEpargnable)}
                        className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                      >
                        <PiggyBank className="w-4 h-4" />
                        Épargner au CET
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Section arrêt maladie (CMO) — aucun impact sur les compteurs */}
            {onMarkCMO && !isCalculating && (
              <div className="mb-6 border-b border-border pb-6">
                <button
                  onClick={() => setShowCMO(prev => !prev)}
                  className="flex items-center gap-2 text-sm font-medium text-violet-600 hover:text-violet-700 transition-colors"
                >
                  <Thermometer className="w-4 h-4" />
                  {showCMO ? "Masquer l'arrêt maladie" : 'Marquer un arrêt maladie (CMO)'}
                </button>

                {showCMO && (
                  <div className="mt-4 p-4 rounded-lg bg-violet-50 border border-violet-200 space-y-3">
                    <p className="text-xs text-violet-700 flex items-start gap-1.5">
                      <Thermometer className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                      <span>L&apos;arrêt maladie (CMO) marque la période sur le calendrier <strong>sans toucher à vos compteurs</strong>. Les jours travaillés correspondants sont déduits du calcul des jours réellement travaillés.</span>
                    </p>
                    <div className="flex justify-end">
                      <button
                        onClick={() => {
                          onMarkCMO();
                          onClose();
                        }}
                        className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-violet-600 hover:bg-violet-700 transition-colors flex items-center gap-2"
                      >
                        <Thermometer className="w-4 h-4" />
                        Marquer en arrêt maladie
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Section astreinte / permanence — ajoute des jours travaillés, pas d'impact compteur auto */}
            {onMarkAstreinte && !isCalculating && (
              <div className="mb-6 border-b border-border pb-6">
                <button
                  onClick={() => setShowAstreinte(prev => !prev)}
                  className="flex items-center gap-2 text-sm font-medium text-amber-600 hover:text-amber-700 transition-colors"
                >
                  <ShieldAlert className="w-4 h-4" />
                  {showAstreinte ? "Masquer l'astreinte" : 'Poser une astreinte / permanence'}
                </button>

                {showAstreinte && (
                  <div className="mt-4 p-4 rounded-lg bg-amber-50 border border-amber-200 space-y-3">
                    <p className="text-xs text-amber-700 flex items-start gap-1.5">
                      <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                      <span>L&apos;astreinte / permanence marque la période sur le calendrier et la <strong>compte comme jours travaillés</strong> (même un week-end), sans toucher aux compteurs. Saisissez vos HS générées manuellement.</span>
                    </p>
                    <div className="flex justify-end">
                      <button
                        onClick={() => {
                          onMarkAstreinte();
                          onClose();
                        }}
                        className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 transition-colors flex items-center gap-2"
                      >
                        <ShieldAlert className="w-4 h-4" />
                        Poser l&apos;astreinte
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {isCalculating ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-4" />
                <p className="text-sm text-muted-foreground">
                  Calcul des meilleures options...
                </p>
              </div>
            ) : combinations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="p-4 rounded-full bg-rose-100 mb-4">
                  <Sparkles className="w-8 h-8 text-rose-600" />
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
                    Top 3 des meilleures options
                  </p>
                </div>

                <div className="space-y-2">
                  {combinations.slice(0, 3).map((combination, index) => (
                    <div
                      key={combination.id}
                      className="animate-in fade-in-0 slide-in-from-bottom-2"
                      style={{
                        animationDelay: `${index * 30}ms`,
                        animationDuration: '300ms',
                      }}
                    >
                      <CombinationCard
                        combination={combination}
                        onSelect={handleSelect}
                        rank={index + 1}
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
