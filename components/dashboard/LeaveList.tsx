'use client';

import { TYPE_LABELS } from '@/lib/typesConges';
import { useMemo, useState } from 'react';
import { HistoryEntry, CounterType, PersonalEvent } from '@/lib/types';
import { EVENT_CATEGORIES, EVENT_COLORS, eventColor, eventsInRange, formatEventWhen } from '@/lib/events';
import { MOTIFS_ABSENCE, estMotifAbsence } from '@/lib/absences';
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
import { Calendar, Trash2, ListChecks, Pencil, ChevronRight, X, CalendarPlus } from 'lucide-react';

interface LeaveListProps {
  history: HistoryEntry[];
  onDelete: (entryId: string) => void;
  /** Modifier une période : tous ses congés (un ou plusieurs compteurs). */
  onEdit?: (entries: HistoryEntry[]) => void;
  // Quand renseignée (clic sur un jour déjà posé du calendrier), ouvre la modale
  // détail du congé couvrant cette date. `onFocusHandled` est appelé après traitement.
  focusDate?: Date | null;
  onFocusHandled?: () => void;
  // Événements perso : un RDV le soir d'un jour de congé doit rester visible,
  // modifiable, et pouvoir être ajouté depuis le détail du congé (toucher un
  // jour posé n'ouvre que ce détail).
  events?: PersonalEvent[];
  onAddEvent?: (date: Date) => void;
  onOpenEvent?: (event: PersonalEvent) => void;
  /** Marque (ou démarque) une période comme congé du plan prévisionnel. */
  onTogglePrevisionnel?: (ids: string[], valeur: boolean) => void;
}

type Filtre = 'tous' | 'previsionnels' | 'anneeSuivante';

/** Badges d'une période : plan prévisionnel, décompte différé, congé antérieur. */
function badgesPeriode(items: HistoryEntry[]): { cle: string; texte: string; classe: string }[] {
  const poses = items.filter((it) => it.action === 'pose');
  const out: { cle: string; texte: string; classe: string }[] = [];
  if (poses.length && poses.every((it) => it.previsionnel)) {
    out.push({ cle: 'prev', texte: '🔒 Prévi.', classe: 'bg-emerald-800 text-white border-emerald-800' });
  }
  const differe = poses.find((it) => it.decompte === 'differe' && !it.decompteApplique);
  if (differe?.anneeDecompte) {
    out.push({ cle: 'annee', texte: String(differe.anneeDecompte), classe: 'bg-indigo-100 text-indigo-800 border-indigo-200' });
  }
  if (poses.some((it) => it.decompte === 'anterieur')) {
    out.push({ cle: 'ant', texte: 'Antérieur · non décompté', classe: 'bg-slate-100 text-slate-600 border-slate-200' });
  }
  return out;
}


interface LeaveGroup {
  key: string;
  items: HistoryEntry[];
  start: string;
  end: string;
}

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

function formatRange(startISO: string, endISO: string): string {
  if (startISO === endISO) {
    return formatShortDate(startISO);
  }
  const start = new Date(startISO);
  const end = new Date(endISO);
  const sameMonth =
    start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  if (sameMonth) {
    const startDay = start.toLocaleDateString('fr-FR', { day: 'numeric' });
    const endPart = end.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    return `du ${startDay} au ${endPart}`;
  }
  return `du ${formatShortDate(startISO)} au ${formatShortDate(endISO)}`;
}

function formatAmount(type: CounterType, amount: number): string {
  if (type === 'ca' || type === 'caHP' || type === 'cet' || type === 'rtt' || type === 'artt' || type === 'cmo' || type === 'astreinte' || type === 'absence') {
    return `${amount}j`;
  }
  return formatMinutes(amount);
}

function countDays(startISO: string, endISO: string): number {
  if (startISO === endISO) return 1;
  const start = new Date(startISO);
  const end = new Date(endISO);
  const diff = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  return Math.max(1, diff);
}

function buildGroups(entries: HistoryEntry[]): LeaveGroup[] {
  const map = new Map<string, HistoryEntry[]>();
  for (const entry of entries) {
    const key = entry.groupId ?? `single-${entry.id}`;
    const list = map.get(key) ?? [];
    list.push(entry);
    map.set(key, list);
  }
  const groups: LeaveGroup[] = [];
  for (const [key, items] of map) {
    const sorted = [...items].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );
    const start = sorted[0].date;
    let end = sorted[0].dateEnd ?? sorted[0].date;
    for (const it of sorted) {
      const candidate = it.dateEnd ?? it.date;
      if (new Date(candidate).getTime() > new Date(end).getTime()) {
        end = candidate;
      }
    }
    groups.push({ key, items: sorted, start, end });
  }
  // Tri décroissant (plus récent en premier)
  groups.sort((a, b) => new Date(b.start).getTime() - new Date(a.start).getTime());
  return groups;
}

export function LeaveList({ history, onDelete, onEdit, focusDate, onFocusHandled, events, onAddEvent, onOpenEvent, onTogglePrevisionnel }: LeaveListProps) {
  const [deleteTarget, setDeleteTarget] = useState<LeaveGroup | null>(null);
  const [detailTarget, setDetailTarget] = useState<LeaveGroup | null>(null);
  const [filtre, setFiltre] = useState<Filtre>('tous');

  const groups = useMemo(() => {
    const filtered = history.filter(
      (entry) =>
        entry.action === 'pose' ||
        entry.action === 'transfer_cet' ||
        entry.action === 'cmo' ||
        entry.action === 'astreinte' ||
        entry.action === 'absence',
    );
    return buildGroups(filtered);
  }, [history]);

  // Filtres « Prévisionnels » et « année suivante » : affichés seulement s'il y
  // a de quoi filtrer (pas de boutons inutiles pour la majorité).
  const estPrevi = (g: LeaveGroup) => g.items.some((it) => it.action === 'pose') && g.items.filter((it) => it.action === 'pose').every((it) => it.previsionnel);
  const estDiffere = (g: LeaveGroup) => g.items.some((it) => it.decompte === 'differe' && !it.decompteApplique);
  const nbPrevi = groups.filter(estPrevi).length;
  const nbDifferes = groups.filter(estDiffere).length;
  const anneeSuivante = new Date().getFullYear() + 1;
  const filtreActif: Filtre =
    (filtre === 'previsionnels' && nbPrevi === 0) || (filtre === 'anneeSuivante' && nbDifferes === 0) ? 'tous' : filtre;
  const groupesAffiches =
    filtreActif === 'previsionnels' ? groups.filter(estPrevi) : filtreActif === 'anneeSuivante' ? groups.filter(estDiffere) : groups;

  // Ouverture du détail depuis le calendrier : groupe dont un item (congé / CMO /
  // astreinte) couvre la date cliquée. Dérivé (pas d'effet) pour éviter un setState
  // en cascade — l'ouverture est purement calculée à partir de focusDate.
  const focusGroup = useMemo(() => {
    if (!focusDate) return null;
    const t = new Date(focusDate).setHours(0, 0, 0, 0);
    return (
      groups.find((g) =>
        g.items.some((it) => {
          if (it.action !== 'pose' && it.action !== 'cmo' && it.action !== 'astreinte' && it.action !== 'absence') return false;
          const s = new Date(it.date).setHours(0, 0, 0, 0);
          const e = new Date(it.dateEnd ?? it.date).setHours(0, 0, 0, 0);
          return t >= s && t <= e;
        }),
      ) ?? null
    );
  }, [focusDate, groups]);

  // Détail effectivement affiché : clic direct sur la liste, ou clic calendrier.
  // Relu dans les groupes à jour : un changement (statut prévisionnel…) s'y voit aussitôt.
  const activeDetail = (detailTarget && groups.find((g) => g.key === detailTarget.key)) ?? detailTarget ?? focusGroup;

  const closeDetail = () => {
    setDetailTarget(null);
    onFocusHandled?.();
  };

  const handleDelete = () => {
    if (deleteTarget) {
      for (const item of deleteTarget.items) {
        onDelete(item.id);
      }
      setDeleteTarget(null);
      setDetailTarget(null);
      onFocusHandled?.();
    }
  };

  if (groups.length === 0) {
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
              {groups.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {(nbPrevi > 0 || nbDifferes > 0) && (
            <div className="flex flex-wrap gap-1.5 px-4 pb-2" role="radiogroup" aria-label="Filtrer les congés">
              {([
                ['tous', `Tous (${groups.length})`, true],
                ['previsionnels', `🔒 Prévisionnels (${nbPrevi})`, nbPrevi > 0],
                ['anneeSuivante', `${anneeSuivante} (${nbDifferes})`, nbDifferes > 0],
              ] as [Filtre, string, boolean][]).filter(([, , visible]) => visible).map(([cle, texte]) => (
                <button
                  key={cle}
                  type="button"
                  role="radio"
                  aria-checked={filtreActif === cle}
                  onClick={() => setFiltre(cle)}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                    filtreActif === cle ? 'border-emerald-800 bg-emerald-800 text-white' : 'border-slate-300 bg-white text-slate-700'
                  }`}
                >
                  {texte}
                </button>
              ))}
            </div>
          )}
          <div className="max-h-[320px] overflow-y-auto">
            <div className="px-4 pb-4 space-y-2">
              {groupesAffiches.map((group) => {
                const types = group.items.map((it) =>
                  it.action === 'transfer_cet' ? 'cet' : (it.type as CounterType),
                );
                const uniqueTypes = Array.from(new Set(types));
                const rangeText = formatRange(group.start, group.end);

                return (
                  <button
                    key={group.key}
                    type="button"
                    onClick={() => setDetailTarget(group)}
                    className="w-full flex items-center gap-3 p-3 rounded-lg bg-white/50 border border-slate-200 hover:bg-white/80 hover:border-blue-300 active:bg-white transition-colors text-left"
                  >
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {uniqueTypes.slice(0, 3).map((t) => {
                          const isCET = t === 'cet' && group.items.some((it) => it.action === 'transfer_cet');
                          const label = isCET ? 'CET ↑' : TYPE_LABELS[t].label;
                          const color = isCET
                            ? 'bg-blue-100 text-blue-700 border-blue-200'
                            : TYPE_LABELS[t].color;
                          return (
                            <Badge
                              key={t}
                              variant="outline"
                              className={`shrink-0 ${color}`}
                            >
                              {label}
                            </Badge>
                          );
                        })}
                        {uniqueTypes.length > 3 && (
                          <span className="text-xs text-slate-500">
                            +{uniqueTypes.length - 3}
                          </span>
                        )}
                        {badgesPeriode(group.items).map((b) => (
                          <Badge key={b.cle} variant="outline" className={`shrink-0 ${b.classe}`}>
                            {b.texte}
                          </Badge>
                        ))}
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

      {/* Modal détail */}
      <Dialog
        open={!!activeDetail}
        onOpenChange={(open) => !open && closeDetail()}
      >
        <DialogContent
          className="w-[92vw] max-w-sm p-0 overflow-y-auto overscroll-contain border-0 shadow-2xl rounded-2xl"
          showCloseButton={false}
        >
          {activeDetail && (() => {
            const isRange = activeDetail.start !== activeDetail.end;
            const nbDays = countDays(activeDetail.start, activeDetail.end);
            const multiItem = activeDetail.items.length > 1;
            // Une période posée sur plusieurs compteurs (ex. CA + CET) se modifie
            // comme une période sur un seul : toutes ses poses sont reprises.
            const editableItems = activeDetail.items.every((it) => it.action === 'pose')
              ? activeDetail.items
              : null;
            const isCMO =
              activeDetail.items.length === 1 && activeDetail.items[0].action === 'cmo';
            const isAstreinte =
              activeDetail.items.length === 1 && activeDetail.items[0].action === 'astreinte';
            const absence =
              activeDetail.items.length === 1 && activeDetail.items[0].action === 'absence'
                ? activeDetail.items[0]
                : null;
            const motifAbsence = absence && estMotifAbsence(absence.motif) ? MOTIFS_ABSENCE[absence.motif] : null;

            return (
              <>
                <div
                  className="px-6 pt-6 pb-5 text-white"
                  style={{ background: 'linear-gradient(135deg, #0a1628 0%, #0d2347 50%, #0055A4 100%)' }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <DialogTitle className="text-lg font-bold leading-tight text-white">
                        {multiItem ? 'Période de congés' : isCMO ? 'Détail de l\'arrêt' : isAstreinte ? 'Détail de l\'astreinte' : absence ? 'Détail de l\'absence' : 'Détail du congé'}
                      </DialogTitle>
                      <p className="text-blue-200 text-xs mt-1">
                        {multiItem
                          ? `${activeDetail.items.length} types · ${nbDays} jour${nbDays > 1 ? 's' : ''}`
                          : activeDetail.items[0].action === 'transfer_cet'
                            ? 'Épargne CET'
                            : isCMO
                              ? 'Arrêt maladie (CMO)'
                              : isAstreinte
                                ? 'Astreinte / permanence'
                                : absence
                                  ? motifAbsence?.label ?? 'Absence sans compteur'
                                  : 'Pose de congé'}
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

                <div className="px-6 py-5 bg-white space-y-4">
                  {/* Période globale */}
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
                              {formatLongDate(activeDetail.start)}
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
                              {formatLongDate(activeDetail.end)}
                            </p>
                          </div>
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
                            {formatLongDate(activeDetail.start)}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Détail des items du groupe */}
                  <div className="pt-2 border-t border-slate-100">
                    <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-2">
                      {multiItem ? 'Composition' : 'Type'}
                    </p>
                    <div className="space-y-1.5">
                      {activeDetail.items.map((item) => {
                        const isCETTransfer = item.action === 'transfer_cet';
                        const typeInfo = TYPE_LABELS[item.type];
                        const badgeLabel = isCETTransfer
                          ? 'CET ↑ Épargne'
                          : item.action === 'absence' && estMotifAbsence(item.motif)
                            ? MOTIFS_ABSENCE[item.motif].court
                            : typeInfo.label;
                        const badgeColor = isCETTransfer
                          ? 'bg-blue-100 text-blue-700 border-blue-200'
                          : typeInfo.color;
                        const itemRange =
                          item.dateEnd && item.dateEnd !== item.date
                            ? `${formatShortDate(item.date)} → ${formatShortDate(item.dateEnd)}`
                            : formatShortDate(item.date);
                        return (
                          <div
                            key={item.id}
                            className="flex items-center justify-between gap-2 py-1.5 px-2 rounded-lg bg-slate-50"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <Badge variant="outline" className={`shrink-0 ${badgeColor}`}>
                                {badgeLabel}
                              </Badge>
                              <span className="text-xs text-slate-500 truncate">
                                {itemRange}
                              </span>
                            </div>
                            <span className="text-sm font-medium text-slate-800 shrink-0">
                              {formatAmount(item.type, item.amount)}
                              {item.partialDay && (
                                <span className="ml-1 text-xs font-normal text-teal-600">à l&apos;heure</span>
                              )}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {motifAbsence && (
                    <p className="text-xs text-slate-600 bg-cyan-50 border border-cyan-100 rounded-lg p-3">
                      <span className="font-medium">Code GesTT {motifAbsence.code}.</span> {motifAbsence.aide}{' '}Aucun compteur n&apos;est débité.
                    </p>
                  )}

                  {/* Événements perso de ces jours-là */}
                  {onAddEvent && onOpenEvent && (() => {
                    const evts = eventsInRange(new Date(activeDetail.start), new Date(activeDetail.end), events);
                    return (
                      <div className="pt-2 border-t border-slate-100">
                        <p className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-2">Événements</p>
                        {evts.length > 0 && (
                          <ul className="space-y-1.5 mb-2">
                            {evts.map((ev) => (
                              <li key={ev.id}>
                                <button
                                  type="button"
                                  onClick={() => { closeDetail(); onOpenEvent(ev); }}
                                  className={`w-full flex items-center gap-2 p-2 rounded-lg bg-white border border-slate-200 border-l-4 ${EVENT_COLORS[eventColor(ev)].border} text-left hover:bg-slate-50`}
                                >
                                  <span aria-hidden="true">{EVENT_CATEGORIES[ev.category].emoji}</span>
                                  <span className="flex-1 min-w-0">
                                    <span className="block text-sm font-medium text-slate-800 truncate">{ev.title}</span>
                                    <span className="block text-xs text-slate-500 truncate">{formatEventWhen(ev)}</span>
                                  </span>
                                  <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            const jour = focusDate ?? new Date(activeDetail.start);
                            closeDetail();
                            onAddEvent(jour);
                          }}
                          className="inline-flex items-center gap-1.5 text-sm font-medium text-pink-700 hover:text-pink-800"
                        >
                          <CalendarPlus className="w-4 h-4" />
                          Ajouter un événement (RDV, formation…)
                        </button>
                      </div>
                    );
                  })()}

                  {/* Plan prévisionnel : marquer ou démarquer la période */}
                  {onTogglePrevisionnel && activeDetail.items.every((it) => it.action === 'pose') && (() => {
                    const actif = activeDetail.items.every((it) => it.previsionnel);
                    return (
                      <button
                        type="button"
                        aria-pressed={actif}
                        onClick={() => onTogglePrevisionnel(activeDetail.items.map((it) => it.id), !actif)}
                        className={`w-full flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left ${
                          actif ? 'border-emerald-700 bg-emerald-50' : 'border-slate-200 bg-white'
                        }`}
                      >
                        <span>
                          <span className="block text-sm font-semibold text-slate-800">🔒 Congé prévisionnel</span>
                          <span className="block text-xs text-slate-500">
                            {actif ? 'Déposé au plan prévisionnel du service' : 'Toucher pour l’indiquer comme déposé au plan prévisionnel'}
                          </span>
                        </span>
                        <span className={`shrink-0 h-6 w-11 rounded-full p-0.5 transition-colors ${actif ? 'bg-emerald-700' : 'bg-slate-300'}`} aria-hidden="true">
                          <span className={`block h-5 w-5 rounded-full bg-white shadow transition-transform ${actif ? 'translate-x-5' : ''}`} />
                        </span>
                      </button>
                    );
                  })()}
                  {badgesPeriode(activeDetail.items).some((b) => b.cle !== 'prev') && (
                    <p className="text-xs text-slate-600">
                      {activeDetail.items.some((it) => it.decompte === 'anterieur')
                        ? 'Congé antérieur : enregistré sans toucher à vos compteurs.'
                        : `Prévisionnel de l’année prochaine : déduit de vos droits ${activeDetail.items.find((it) => it.anneeDecompte)?.anneeDecompte ?? ''} au 1er janvier.`}
                    </p>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 pt-2">
                    {onEdit && editableItems && (
                      <Button
                        variant="outline"
                        onClick={() => {
                          onEdit(editableItems);
                          closeDetail();
                        }}
                        className="flex-1 border-blue-200 text-blue-700 hover:bg-blue-50"
                      >
                        <Pencil className="w-4 h-4 mr-2" />
                        Modifier
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      onClick={() => setDeleteTarget(activeDetail)}
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

      {/* Confirmation suppression */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm overflow-y-auto overscroll-contain glass border-slate-200">
          <DialogHeader>
            <DialogTitle>
              {deleteTarget && deleteTarget.items.length > 1
                ? 'Supprimer cette période ?'
                : deleteTarget?.items[0]?.action === 'transfer_cet'
                  ? 'Annuler cette épargne CET ?'
                  : deleteTarget?.items[0]?.action === 'cmo'
                    ? 'Supprimer cet arrêt maladie ?'
                    : deleteTarget?.items[0]?.action === 'astreinte'
                      ? 'Supprimer cette astreinte ?'
                      : deleteTarget?.items[0]?.action === 'absence'
                        ? 'Supprimer cette absence ?'
                        : 'Supprimer ce congé ?'}
            </DialogTitle>
            <DialogDescription>
              {deleteTarget && deleteTarget.items.length > 1
                ? `Les ${deleteTarget.items.length} entrées de cette période seront supprimées et vos compteurs restaurés.`
                : deleteTarget?.items[0]?.action === 'transfer_cet'
                  ? 'Les jours seront restitués à votre solde CA et retirés du CET.'
                  : deleteTarget?.items[0]?.action === 'cmo'
                    ? 'Le marquage de l\'arrêt maladie sera retiré du calendrier (aucun compteur impacté).'
                    : deleteTarget?.items[0]?.action === 'astreinte'
                      ? 'Le marquage de l\'astreinte sera retiré du calendrier (aucun compteur impacté).'
                      : deleteTarget?.items[0]?.action === 'absence'
                        ? 'Le marquage de l\'absence sera retiré du calendrier (aucun compteur impacté).'
                        : 'Cette action annulera la pose et restaurera vos compteurs.'}
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
