import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { STORAGE_KEY } from '../constants';

// Module rechargé à chaque test : `startStats` ne s'exécute qu'une fois par module.
async function freshAnalytics() {
  vi.resetModules();
  return import('../analytics');
}

function sentPayloads(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls.map(([, init]) => JSON.parse((init as RequestInit).body as string));
}

describe('analytics (client)', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // vitest.setup.ts remplace localStorage par des vi.fn() inertes : on les
    // adosse ici à une vraie Map.
    const store = new Map<string, string>();
    vi.mocked(localStorage.getItem).mockImplementation((k) => store.get(k) ?? null);
    vi.mocked(localStorage.setItem).mockImplementation((k, v) => void store.set(k, String(v)));
    vi.mocked(localStorage.removeItem).mockImplementation((k) => void store.delete(k));
    fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock);
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 24, 10, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('envoie un lot sans identifiant, avec marqueur actif le premier jour', async () => {
    const a = await freshAnalytics();
    a.setStatsProfile(() => ['type:alterne']);
    a.startStats();
    a.track('leave_pose');
    a.track('leave_pose');
    await a.flushStats();

    const [p] = sentPayloads(fetchMock);
    expect(fetchMock.mock.calls[0]![0]).toBe('/api/stats');
    expect(p).toEqual({
      v: 1,
      platform: 'web',
      version: expect.any(String),
      days: {
        '2026-09-24': {
          opens: 1,
          events: { leave_pose: 2 },
          errors: {},
          active: { firstOfWeek: true, firstOfMonth: true, isNew: true, profile: ['type:alterne'] },
        },
      },
    });
    // Rien n'est gardé après un envoi réussi
    await a.flushStats();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('un utilisateur existant n’est pas compté comme nouvelle installation', async () => {
    localStorage.setItem(STORAGE_KEY, '{}');
    const a = await freshAnalytics();
    a.startStats();
    await a.flushStats();
    expect(sentPayloads(fetchMock)[0].days['2026-09-24'].active.isNew).toBe(false);
  });

  it('le lendemain : actif du jour, mais pas premier de la semaine', async () => {
    let a = await freshAnalytics();
    a.startStats();
    await a.flushStats();

    vi.setSystemTime(new Date(2026, 8, 25, 9, 0));
    a = await freshAnalytics();
    a.startStats();
    await a.flushStats();

    const second = sentPayloads(fetchMock)[1].days['2026-09-25'];
    expect(second.active).toMatchObject({ firstOfWeek: false, firstOfMonth: false, isNew: false });
  });

  it('remet les compteurs en attente si l’envoi échoue', async () => {
    fetchMock.mockRejectedValueOnce(new Error('offline'));
    const a = await freshAnalytics();
    a.startStats();
    a.track('view_year');
    await a.flushStats();
    await a.flushStats();
    const retry = sentPayloads(fetchMock)[1].days['2026-09-24'];
    expect(retry.events).toEqual({ view_year: 1 });
    expect(retry.active).toBeDefined();
  });

  it('désactivé : ne collecte ni n’envoie rien, et efface l’attente', async () => {
    const a = await freshAnalytics();
    a.startStats();
    a.track('leave_pose');
    a.setStatsEnabled(false);
    a.track('leave_pose');
    await a.flushStats();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(localStorage.getItem('chronos_stats')).toBeNull();
  });

  it('compte les erreurs nettoyées, bornées à 20 types par jour', async () => {
    const a = await freshAnalytics();
    for (let i = 0; i < 25; i++) a.trackError('window', new Error(`boom ${'x'.repeat(i)}`));
    a.trackError('window', new Error('Solde 42 pour "Dupont"'));
    await a.flushStats();
    const errors = sentPayloads(fetchMock)[0].days['2026-09-24'].errors;
    expect(Object.keys(errors)).toHaveLength(20);
    expect(Object.keys(errors).some((k) => k.includes('Dupont') || k.includes('42'))).toBe(false);
  });
});
