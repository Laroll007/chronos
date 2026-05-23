'use client';

import { useState } from 'react';
import { HistoryEntry, CounterType } from '@/lib/types';
import { formatMinutes } from '@/lib/calculations';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Calendar, Trash2, ListChecks, Pencil, ChevronRight, X } from 'lucide-react';

interface LeaveListProps {
  history: HistoryEntry[];
  onDelete: (entryId: string) => void;
  onEdit?: (entry: HistoryEntry) => void;
}

const TYPE_LABELS: Record<CounterType, { label: string; color: string }> = {
  ca: { label: 'CA', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  caHP: { label: 'CA HP', color: 'bg-red-100 text-red-700 border-red-200' },
  cf: { label: 'CF', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  rtc: { label: 'RTC', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  rtt: { label: 'RTT', color: 'bg-teal-100 text-teal-700 border-teal-200' },
  rps: { label: 'RPS', color: 'bg-slate-100 text-slate-700 border-slate-200' },
  hs: { label: 'HS', color: 'bg-rose-100 text-rose-700 border-rose-200' },
  cet: { label: 'CET', color: 'bg-purple-100 text-purple-700 border-purple-200' },
  artt: { label: 'ARTT', color: 'bg-slate-100 text-slate-700 border-slate-200' },
  caAnterieur: { label: 'CA Ant.', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  caHPAnterieur: { label: 'CA HP Ant.', color: 'bg-orange-100 text-orange-700 border-orange-200' },
  cet2008: { label: 'CET 2008', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  congesBonifies: { label: 'Congés Bon.', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  hsHistorique: { label: 'HS Hist.', color: 'bg-rose-100 text-rose-700 border-rose-200' },
};

function formatShortDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
  });
}

function formatLongDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatRange(entry: HistoryEntry): string {
  if (!entry.dateEnd || entry.dateEnd === entry.date) {
    return formatShortDate(entry.date);
  }
  const start = new Date(entry.date);
  const end = new Date(entry.dateEnd);
  const sameMonth =
    start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  if (sameMonth) {
    const startDay = start.toLocaleDateString('fr-FR', { day: 'numeric' });
    const endPart = end.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    return `du ${startDay} au ${endPart}`;
  }
  return `du ${formatShortDate(entry.date)} au ${formatShortDate(entry.dateEnd)}`;
}

function formatAmount(type: CounterType, amount: number): string {
  if (type === 'ca' || type === 'caHP' || type === 'cet') {
    return `${amount}j`;
  }
  return formatMinutes(amount);
}

function countDays(entry: HistoryEntry): number {
  if (!entry.dateEnd || entry.dateEnd === entry.date) return 1;
  const start = new Date(entry.date);
  const end = new Date(entry.dateEnd);
  const diff = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  return Math.max(1, diff);
}

export function LeaveList({ history, onDelete, onEdit }: LeaveListProps) {
  const [deleteTarget, setDeleteTarget] = useState<HistoryEntry | null>(null);
  const [detailTarget, setDetailTarget] = useState<HistoryEntry | null>(null);

  const leaves = history
    .filter((entry) => entry.action === 'pose' || entry.action === 'transfer_cet')
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const handleDelete = () => {
    if (deleteTarget) {
      onDelete(deleteTarget.id);
      setDeleteTarget(null);
      setDetailTarget(null);
    }
  };

  if (leaves.length === 0) {
    return (
      <Card className="glass">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ListChecks className="w-4 h-4 text-blue-600" />
            Congés posés
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            Aucun congé posé pour le moment
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="glass">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ListChecks className="w-4 h-4 text-blue-600" />
            Congés posés
            <Badge variant="secondary" className="ml-auto">
              {leaves.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[320px] overflow-y-auto">
            <div className="px-4 pb-4 space-y-2">
              {leaves.map((entry) => {
                const isCETTransfer = entry.action === 'transfer_cet';
                const typeInfo = TYPE_LABELS[entry.type];
                const badgeLabel = isCETTransfer ? 'CET ↑ Épargne' : typeInfo.label;
                const badgeColor = isCETTransfer
                  ? 'bg-blue-100 text-blue-700 border-blue-200'
                  : typeInfo.color;
                const rangeText = formatRange(entry);

                return (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => setDetailTarget(entry)}
                    className="w-full flex items-center gap-3 p-3 rounded-lg bg-white/50 border border-slate-200 hover:bg-white/80 hover:border-blue-300 active:bg-white transition-colors text-left"
                  >
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={`shrink-0 ${badgeColor}`}>
                          {badgeLabel}
                        </Badge>
                        <span className="text-sm font-semibold text-slate-800 shrink-0">
                          {formatAmount(entry.type, entry.amount)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-sm text-slate-600">
                        <Calendar className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                        <span className="truncate">{rangeText}</span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 shrink-0 text-slate-400" />
                  </button>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Modal détail du congé */}
      <Dialog
        open={!!detailTarget}
        onOpenChange={(open) => !open && setDetailTarget(null)}
      >
        <DialogContent
          className="w-[92vw] max-w-sm p-0 overflow-hidden border-0 shadow-2xl rounded-2xl"
          showCloseButton={false}
        >
          {detailTarget && (() => {
            const isCETTransfer = detailTarget.action === 'transfer_cet';
            const typeInfo = TYPE_LABELS[detailTarget.type];
            const badgeLabel = isCETTransfer ? 'CET ↑ Épargne' : typeInfo.label;
            const badgeColor = isCETTransfer
              ? 'bg-blue-100 text-blue-700 border-blue-200'
              : typeInfo.color;
            const isRange = detailTarget.dateEnd && detailTarget.dateEnd !== detailTarget.date;
            const nbDays = countDays(detailTarget);

            return (
              <>
                {/* Header */}
                <div
                  className="px-6 pt-6 pb-5 text-white"
                  style={{ background: 'linear-gradient(135deg, #0a1628 0%, #0d2347 50%, #0055A4 100%)' }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <DialogTitle className="text-lg font-bold leading-tight text-white">
                        Détail du congé
                      </DialogTitle>
                      <p className="text-blue-200 text-xs mt-1">
                        {isCETTransfer ? 'Épargne CET' : 'Pose de congé'}
                      </p>
                    </div>
                    <DialogClose className="shrink-0 w-8 h-8 rounded-xl bg-white/15 hover:bg-white/25 flex items-center justify-center text-white/80 hover:text-white transition-all">
                      <X className="w-4 h-4" />
                    </DialogClose>
                  </div>
                  <div
                    className="mt-4 h-[3px] rounded-full"
                    style={{
                      background:
                        'linear-gradient(90deg, #0055A4 33%, #ffffff 33%, #ffffff 66%, #EF4135 66%)',
                    }}
                  />
                </div>

                {/* Body */}
                <div className="px-6 py-5 bg-white space-y-4">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={badgeColor}>
                      {badgeLabel}
                    </Badge>
                    <span className="text-base font-semibold text-slate-800">
                      {formatAmount(detailTarget.type, detailTarget.amount)}
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {isRange ? (
                      <>
                        <div className="flex items-start gap-2 text-sm">
                          <Calendar className="w-4 h-4 shrink-0 text-blue-600 mt-0.5" />
                          <div className="flex-1">
                            <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">
                              Du
                            </p>
                            <p className="text-slate-800 font-medium capitalize">
                              {formatLongDate(detailTarget.date)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2 text-sm">
                          <Calendar className="w-4 h-4 shrink-0 text-blue-600 mt-0.5" />
                          <div className="flex-1">
                            <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">
                              Au
                            </p>
                            <p className="text-slate-800 font-medium capitalize">
                              {formatLongDate(detailTarget.dateEnd!)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-500 pl-6">
                          {nbDays} jour{nbDays > 1 ? 's' : ''} calendaire{nbDays > 1 ? 's' : ''}
                        </div>
                      </>
                    ) : (
                      <div className="flex items-start gap-2 text-sm">
                        <Calendar className="w-4 h-4 shrink-0 text-blue-600 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">
                            Date
                          </p>
                          <p className="text-slate-800 font-medium capitalize">
                            {formatLongDate(detailTarget.date)}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {detailTarget.description && (
                    <div className="pt-2 border-t border-slate-100">
                      <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-1">
                        Description
                      </p>
                      <p className="text-sm text-slate-700">{detailTarget.description}</p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 pt-2">
                    {onEdit && !isCETTransfer && (
                      <Button
                        variant="outline"
                        onClick={() => {
                          onEdit(detailTarget);
                          setDetailTarget(null);
                        }}
                        className="flex-1 border-blue-200 text-blue-700 hover:bg-blue-50"
                      >
                        <Pencil className="w-4 h-4 mr-2" />
                        Modifier
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      onClick={() => setDeleteTarget(detailTarget)}
                      className="flex-1 border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Supprimer
                    </Button>
                  </div>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmation suppression */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm glass border-slate-200">
          <DialogHeader>
            <DialogTitle>
              {deleteTarget?.action === 'transfer_cet' ? 'Annuler cette épargne CET ?' : 'Supprimer ce congé ?'}
            </DialogTitle>
            <DialogDescription>
              {deleteTarget?.action === 'transfer_cet'
                ? 'Les jours seront restitués à votre solde CA et retirés du CET.'
                : 'Cette action annulera la pose et restaurera vos compteurs.'}
              {deleteTarget && (
                <>
                  <br />
                  <strong className="text-slate-700">
                    {deleteTarget.action === 'transfer_cet' ? 'CET Épargne' : TYPE_LABELS[deleteTarget.type].label}
                  </strong> : {formatAmount(deleteTarget.type, deleteTarget.amount)}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Annuler
            </Button>
            <Button onClick={handleDelete} className="bg-rose-600 hover:bg-rose-700">
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
