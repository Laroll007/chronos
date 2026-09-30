'use client';

import { useState } from 'react';
import { Dialog, DialogClose, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { CalendarPlus, Trash2, X } from 'lucide-react';
import type { EventCategory, PersonalEvent } from '@/lib/types';
import { EVENT_CATEGORIES, EVENT_NOTE_MAX, EVENT_TITLE_MAX } from '@/lib/events';

export interface EventDraft {
  id?: string;
  date: string;
  dateEnd?: string;
  title?: string;
  category?: EventCategory;
  time?: string;
  note?: string;
}

interface EventModalProps {
  /** Événement à modifier (avec `id`) ou pré-remplissage d'un nouvel événement. */
  draft: EventDraft;
  onClose: () => void;
  onSave: (event: Omit<PersonalEvent, 'id'> & { id?: string }) => boolean;
  onDelete?: (id: string) => boolean;
}

const inputClass =
  'w-full h-11 px-3 rounded-xl border border-slate-200 bg-white text-slate-800 text-base focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400';

/**
 * Création / modification d'un événement personnel. Monté à la demande par le
 * parent (clé = événement), l'état initial vient donc toujours du brouillon.
 */
export function EventModal({ draft, onClose, onSave, onDelete }: EventModalProps) {
  const isEdit = Boolean(draft.id);
  const [title, setTitle] = useState(draft.title ?? '');
  const [category, setCategory] = useState<EventCategory>(draft.category ?? 'rdv');
  const [date, setDate] = useState(draft.date);
  const [multiDay, setMultiDay] = useState(Boolean(draft.dateEnd && draft.dateEnd > draft.date));
  const [dateEnd, setDateEnd] = useState(draft.dateEnd ?? draft.date);
  const [time, setTime] = useState(draft.time ?? '');
  const [note, setNote] = useState(draft.note ?? '');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const endInvalid = multiDay && dateEnd < date;
  const canSave = title.trim().length > 0 && Boolean(date) && !endInvalid;

  const handleSave = () => {
    if (!canSave) return;
    const ok = onSave({
      ...(draft.id && { id: draft.id }),
      title: title.trim(),
      category,
      date,
      ...(multiDay && dateEnd > date && { dateEnd }),
      ...(time && { time }),
      ...(note.trim() && { note: note.trim() }),
    });
    if (ok) onClose();
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        className="w-[95vw] max-w-md p-0 rounded-2xl border-0 shadow-2xl overflow-hidden flex flex-col"
        style={{ maxHeight: '90vh' }}
        showCloseButton={false}
      >
        <div className="shrink-0 px-5 pt-5 pb-4 text-white" style={{ background: 'linear-gradient(135deg, #0a1628 0%, #0d2347 55%, #0055A4 100%)' }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
              <CalendarPlus className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-base font-bold leading-tight text-white">
                {isEdit ? "Modifier l'événement" : 'Nouvel événement'}
              </DialogTitle>
              <p className="text-blue-200 text-xs mt-0.5">Sans effet sur vos compteurs</p>
            </div>
            <DialogClose className="shrink-0 w-8 h-8 rounded-xl bg-white/15 hover:bg-white/25 flex items-center justify-center text-white/80 hover:text-white transition-all">
              <X className="w-4 h-4" />
            </DialogClose>
          </div>
          <div className="mt-3 h-[3px] rounded-full" style={{ background: 'linear-gradient(90deg, #0055A4 33%, #ffffff 33%, #ffffff 66%, #EF4135 66%)' }} />
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain p-5 space-y-5">
          <div>
            <label htmlFor="event-title" className="block text-sm font-medium text-slate-700 mb-1.5">Intitulé</label>
            <input
              id="event-title"
              type="text"
              value={title}
              maxLength={EVENT_TITLE_MAX}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex. RDV médecin, stage tir…"
              className={inputClass}
              autoFocus={!isEdit}
            />
          </div>

          <fieldset>
            <legend className="block text-sm font-medium text-slate-700 mb-1.5">Type</legend>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(EVENT_CATEGORIES) as EventCategory[]).map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-pressed={category === c}
                  onClick={() => setCategory(c)}
                  className={`px-3 py-2 rounded-xl border text-sm transition-all ${
                    category === c
                      ? 'border-pink-400 bg-pink-50 text-pink-800 font-medium'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <span aria-hidden="true">{EVENT_CATEGORIES[c].emoji}</span> {EVENT_CATEGORIES[c].label}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="event-date" className="block text-sm font-medium text-slate-700 mb-1.5">
                {multiDay ? 'Du' : 'Date'}
              </label>
              <input id="event-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
            </div>
            {multiDay ? (
              <div>
                <label htmlFor="event-date-end" className="block text-sm font-medium text-slate-700 mb-1.5">Au</label>
                <input
                  id="event-date-end"
                  type="date"
                  value={dateEnd}
                  min={date}
                  onChange={(e) => setDateEnd(e.target.value)}
                  className={`${inputClass} ${endInvalid ? 'border-rose-400' : ''}`}
                />
              </div>
            ) : (
              <div>
                <label htmlFor="event-time" className="block text-sm font-medium text-slate-700 mb-1.5">
                  Heure <span className="font-normal text-slate-400">(facultatif)</span>
                </label>
                <input id="event-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} className={inputClass} />
              </div>
            )}
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={multiDay}
              onChange={(e) => {
                setMultiDay(e.target.checked);
                if (e.target.checked && dateEnd < date) setDateEnd(date);
              }}
              className="h-4 w-4 rounded border-slate-300 accent-pink-600"
            />
            Sur plusieurs jours
          </label>
          {endInvalid && <p className="text-xs text-rose-600 -mt-3">La date de fin doit suivre la date de début.</p>}

          <div>
            <label htmlFor="event-note" className="block text-sm font-medium text-slate-700 mb-1.5">
              Note <span className="font-normal text-slate-400">(facultatif)</span>
            </label>
            <textarea
              id="event-note"
              value={note}
              maxLength={EVENT_NOTE_MAX}
              rows={3}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Lieu, documents à prévoir…"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-800 text-base resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400"
            />
          </div>
        </div>

        <div className="shrink-0 px-5 py-4 border-t border-slate-100 flex items-center gap-2">
          {isEdit && onDelete && (
            confirmDelete ? (
              <button
                type="button"
                onClick={() => { if (onDelete(draft.id!)) onClose(); }}
                className="h-11 px-3 rounded-xl text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700"
              >
                Confirmer
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                aria-label="Supprimer l'événement"
                className="h-11 w-11 rounded-xl flex items-center justify-center text-rose-500 border border-rose-200 hover:bg-rose-50"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )
          )}
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-11 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            className="flex-1 h-11 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #0055A4 0%, #1a7de8 100%)' }}
          >
            Enregistrer
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
