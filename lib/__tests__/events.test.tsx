import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { STORAGE_KEY } from '../constants';
import { DEFAULT_COUNTERS, DEFAULT_CYCLE_CONFIG } from '../storage';
import { eventsInRange, eventsOnDate, formatEventWhen, sanitizeEvents, toDayKey } from '../events';
import { legendFlagsForDays } from '@/components/dashboard/CalendarLegend';
import type { HistoryEntry, PersonalEvent, UserData } from '../types';

const track = vi.fn();
vi.mock('../analytics', () => ({ track: (e: string) => track(e), trackError: vi.fn() }));

import { useCounters } from '@/hooks/useCounters';

const rdv: PersonalEvent = { id: 'a', date: '2026-10-02', title: 'RDV médecin', category: 'rdv', time: '14:30' };
const stage: PersonalEvent = { id: 'b', date: '2026-10-05', dateEnd: '2026-10-07', title: 'Stage tir', category: 'formation' };

describe('événements : dates et filtres', () => {
  it('un événement sur plusieurs jours couvre chaque jour de la période', () => {
    expect(eventsOnDate(new Date(2026, 9, 4), [stage])).toEqual([]);
    expect(eventsOnDate(new Date(2026, 9, 5), [stage])).toEqual([stage]);
    expect(eventsOnDate(new Date(2026, 9, 7), [stage])).toEqual([stage]);
    expect(eventsOnDate(new Date(2026, 9, 8), [stage])).toEqual([]);
  });

  it('eventsInRange retient ce qui chevauche la sélection', () => {
    expect(eventsInRange(new Date(2026, 9, 6), new Date(2026, 9, 10), [rdv, stage])).toEqual([stage]);
    expect(eventsInRange(new Date(2026, 9, 1), new Date(2026, 9, 5), [stage, rdv])).toEqual([rdv, stage]);
  });

  it('jour local, quel que soit le fuseau (pas de toISOString)', () => {
    expect(toDayKey(new Date(2026, 0, 1, 0, 30))).toBe('2026-01-01');
    expect(toDayKey(new Date(2026, 11, 31, 23, 59))).toBe('2026-12-31');
  });

  it('formatEventWhen affiche la plage et l’heure', () => {
    expect(formatEventWhen(rdv)).toMatch(/2 oct\..*14h30$/);
    expect(formatEventWhen(stage)).toMatch(/5 oct\..*→.*7 oct\./);
  });

  it('sanitizeEvents écarte les entrées corrompues et normalise le reste', () => {
    const out = sanitizeEvents([
      rdv,
      { id: 'x', date: '2026-02-31', title: 'date impossible', category: 'rdv' },
      { id: 'y', date: '2026-10-01', title: '   ', category: 'rdv' },
      { id: 'z', date: '2026-10-01', title: 'Catégorie inconnue', category: 'plongée', time: '25:00', dateEnd: '2026-09-01' },
      'n’importe quoi',
    ]);
    expect(out).toEqual([rdv, { id: 'z', date: '2026-10-01', title: 'Catégorie inconnue', category: 'autre' }]);
    expect(sanitizeEvents(undefined)).toEqual([]);
  });
});

describe('légende du calendrier', () => {
  const days = [
    { date: new Date(2026, 9, 1), isWorking: true },
    { date: new Date(2026, 9, 2), isWorking: false },
  ];

  it('ne montre que ce qui est affiché sur la période', () => {
    expect(legendFlagsForDays(days, [], [], false)).toEqual({
      travail: true, conge: false, cmo: false, astreinte: false, heures: false, evenement: false, stage: false, horaires: false, selection: false,
    });
  });

  it('ajoute Congé, CMO, Événement et Sélection quand ils sont présents', () => {
    const history = [
      { id: '1', date: new Date(2026, 9, 1).toISOString(), action: 'pose', type: 'ca', amount: 1, countersSnapshot: {} },
      { id: '2', date: new Date(2026, 9, 2).toISOString(), action: 'cmo', type: 'cmo', amount: 0, countersSnapshot: {} },
    ] as HistoryEntry[];
    const flags = legendFlagsForDays(days, history, [rdv], true);
    expect(flags).toMatchObject({ conge: true, cmo: true, evenement: true, selection: true, astreinte: false, heures: false });
  });
});

describe('useCounters : événements', () => {
  let store: Map<string, string>;

  beforeEach(() => {
    store = new Map();
    vi.mocked(localStorage.getItem).mockImplementation((k) => store.get(k) ?? null);
    vi.mocked(localStorage.setItem).mockImplementation((k, v) => void store.set(k, String(v)));
    vi.mocked(localStorage.removeItem).mockImplementation((k) => void store.delete(k));
    track.mockClear();
    const data: UserData = {
      cycleConfig: DEFAULT_CYCLE_CONFIG,
      counters: DEFAULT_COUNTERS,
      history: [],
      lastUpdated: new Date().toISOString(),
      lastResetYear: new Date().getFullYear(),
      isOnboarded: true,
    };
    store.set(STORAGE_KEY, JSON.stringify(data));
  });

  const stored = () => JSON.parse(store.get(STORAGE_KEY)!) as UserData;

  it('ajoute, modifie et supprime un événement sans toucher aux compteurs', async () => {
    const { result } = renderHook(() => useCounters());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const before = stored().counters;

    act(() => { result.current.addEvent({ date: '2026-10-02', title: 'RDV', category: 'rdv' }); });
    const id = stored().events![0]!.id;
    expect(result.current.events).toHaveLength(1);

    act(() => { result.current.updateEvent({ id, date: '2026-10-03', title: 'RDV décalé', category: 'rdv' }); });
    expect(stored().events).toEqual([{ id, date: '2026-10-03', title: 'RDV décalé', category: 'rdv' }]);

    act(() => { result.current.deleteEvent(id); });
    expect(stored().events).toEqual([]);
    expect(stored().counters).toEqual(before);
    expect(stored().history).toEqual([]);
    expect(track.mock.calls.map((c) => c[0])).toEqual(['event_add', 'event_edit', 'event_delete']);
  });

  it('un événement corrompu dans le stockage est ignoré au chargement', async () => {
    store.set(STORAGE_KEY, JSON.stringify({ ...stored(), events: [rdv, { id: 'bad' }] }));
    const { result } = renderHook(() => useCounters());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.events).toEqual([rdv]);
  });
});

describe('couleur des événements', () => {
  it('couleur du type par défaut, couleur choisie conservée, couleur inconnue ignorée', async () => {
    const { eventColor } = await import('../events');
    expect(eventColor({ category: 'formation' })).toBe('orange');
    expect(eventColor({ category: 'formation', color: 'slate' })).toBe('slate');
    const [ok, inconnue] = sanitizeEvents([
      { ...rdv, color: 'cyan' },
      { ...rdv, id: 'z', color: 'arc-en-ciel' },
    ]);
    expect(ok!.color).toBe('cyan');
    expect(inconnue!.color).toBeUndefined();
  });
});
