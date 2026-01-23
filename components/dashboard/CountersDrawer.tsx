// Drawer affichant tous les compteurs détaillés

'use client';

import { Counters, Recommendation } from '@/lib/types';
import { CountersOverview } from './CountersOverview';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Clock } from 'lucide-react';

interface CountersDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  counters: Counters;
  recommendations: Recommendation[];
}

export function CountersDrawer({
  isOpen,
  onClose,
  counters,
  recommendations,
}: CountersDrawerProps) {
  // Filtrer les recommandations par priorité
  const highPriority = recommendations.filter((r) => r.priority === 'high');
  const mediumPriority = recommendations.filter((r) => r.priority === 'medium');

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="bottom" className="h-[85vh] p-0 glass border-slate-200">
        <SheetHeader className="p-6 pb-4 border-b border-slate-200">
          <SheetTitle className="text-xl text-slate-800">Tous les compteurs</SheetTitle>
          <SheetDescription>
            Vue détaillée de vos congés et compteurs
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[calc(85vh-100px)]">
          <div className="p-6 space-y-6">
            {/* Compteurs détaillés */}
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-4 uppercase tracking-wide">
                Compteurs
              </h3>
              <CountersOverview counters={counters} />
            </div>

            {/* Séparateur */}
            <Separator className="bg-slate-200" />

            {/* Alertes prioritaires */}
            {(highPriority.length > 0 || mediumPriority.length > 0) && (
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-4 uppercase tracking-wide flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  Alertes et recommandations
                </h3>

                <div className="space-y-3">
                  {/* Alertes haute priorité */}
                  {highPriority.map((rec) => (
                    <div
                      key={rec.id}
                      className="p-4 rounded-lg bg-red-50 border border-red-200"
                    >
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="secondary"
                              className="bg-red-100 text-red-700"
                            >
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

                  {/* Alertes priorité moyenne */}
                  {mediumPriority.map((rec) => (
                    <div
                      key={rec.id}
                      className="p-4 rounded-lg bg-orange-50 border border-orange-200"
                    >
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="secondary"
                              className="bg-orange-100 text-orange-700"
                            >
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

                  {highPriority.length === 0 && mediumPriority.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <p className="text-sm">Aucune alerte prioritaire</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
