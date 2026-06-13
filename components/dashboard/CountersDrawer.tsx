// Modale affichant tous les compteurs détaillés

'use client';

import { Counters, Recommendation } from '@/lib/types';
import { CountersOverview } from './CountersOverview';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, BarChart3, Clock, X } from 'lucide-react';

interface CountersDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  counters: Counters;
  recommendations: Recommendation[];
  onUpdateCounters: (updates: Partial<Counters>) => void;
  caTotal?: number;
  dayMinutes?: number;
}

export function CountersDrawer({
  isOpen,
  onClose,
  counters,
  recommendations,
  onUpdateCounters,
  caTotal,
  dayMinutes,
}: CountersDrawerProps) {
  const highPriority = recommendations.filter((r) => r.priority === 'high');
  const mediumPriority = recommendations.filter((r) => r.priority === 'medium');

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        className="w-[95vw] max-w-md p-0 bg-background border-0 shadow-2xl rounded-2xl overflow-hidden flex flex-col"
        style={{ height: '85vh', maxHeight: '85vh' }}
        showCloseButton={false}
      >
        {/* Header gradient bleu foncé */}
        <div
          className="px-6 pt-6 pb-5 text-white shrink-0"
          style={{ background: 'linear-gradient(135deg, #0a1628 0%, #0d2347 55%, #0055A4 100%)' }}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-lg font-bold leading-tight text-white">
                Tous les compteurs
              </DialogTitle>
              <DialogDescription className="text-blue-200 text-xs mt-0.5">
                Vue détaillée de vos congés et compteurs
              </DialogDescription>
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

        {/* Body scrollable */}
        <div className="flex-1 overflow-y-auto overscroll-contain p-6 space-y-6">
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-4 uppercase tracking-wide">
              Compteurs
            </h3>
            <CountersOverview counters={counters} onUpdateCounters={onUpdateCounters} caTotal={caTotal} dayMinutes={dayMinutes} />
          </div>

          {(highPriority.length > 0 || mediumPriority.length > 0) && (
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-4 uppercase tracking-wide flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Alertes et recommandations
              </h3>

              <div className="space-y-3">
                {highPriority.map((rec) => (
                  <div
                    key={rec.id}
                    className="p-4 rounded-lg bg-rose-50 border border-rose-200"
                  >
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="bg-rose-100 text-rose-700">
                            URGENT
                          </Badge>
                          {rec.deadline && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="w-3 h-3" />
                              <span>
                                {new Date(rec.deadline).toLocaleDateString('fr-FR', {
                                  day: 'numeric',
                                  month: 'long',
                                })}
                              </span>
                            </div>
                          )}
                        </div>
                        <p className="font-semibold text-sm text-slate-800">{rec.action}</p>
                        <p className="text-sm text-muted-foreground">{rec.reason}</p>
                      </div>
                    </div>
                  </div>
                ))}

                {mediumPriority.map((rec) => (
                  <div
                    key={rec.id}
                    className="p-4 rounded-lg bg-amber-50 border border-amber-200"
                  >
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="bg-amber-100 text-amber-700">
                            À FAIRE
                          </Badge>
                          {rec.deadline && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="w-3 h-3" />
                              <span>
                                {new Date(rec.deadline).toLocaleDateString('fr-FR', {
                                  day: 'numeric',
                                  month: 'long',
                                })}
                              </span>
                            </div>
                          )}
                        </div>
                        <p className="font-semibold text-sm text-slate-800">{rec.action}</p>
                        <p className="text-sm text-muted-foreground">{rec.reason}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
