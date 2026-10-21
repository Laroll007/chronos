// Fidélité des statistiques : lots renvoyés comptés une fois, pages hors app
// sans ouverture, migration Android sans doublon, corrections de l'historique.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { StatsPayload } from '../stats-events';
import { appendBatch, summarize, validatePayload } from '../server/stats-store';
import { empaqueterTransfert, lireDonneesTransfert } from '../transfert';
import { DEFAULT_COUNTERS, DEFAULT_CYCLE_CONFIG } from '../storage';

async function freshAnalytics() {
  vi.resetModules();
  return import('../analytics');
}
const envoyes = (f: ReturnType<typeof vi.fn>) => f.mock.calls.map(([, init]) => JSON.parse((init as RequestInit).body as string) as StatsPayload);

describe('Côté téléphone', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let store: Map<string, string>;
  beforeEach(() => {
    store = new Map();
    vi.mocked(localStorage.getItem).mockImplementation((k) => store.get(k) ?? null);
    vi.mocked(localStorage.setItem).mockImplementation((k, v) => void store.set(k, String(v)));
    vi.mocked(localStorage.removeItem).mockImplementation((k) => void store.delete(k));
    fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock);
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 17, 10, 0));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('lot en échec réseau : renvoyé à l’identique, avec le même numéro', async () => {
    const a = await freshAnalytics();
    a.startStats();
    a.track('leave_pose');
    fetchMock.mockRejectedValueOnce(new Error('réseau coupé'));
    await a.flushStats();
    await a.flushStats();
    const [premier, second] = envoyes(fetchMock);
    expect(premier!.lot).toMatch(/^[a-z0-9]{6,32}$/);
    expect(second).toEqual(premier);
    await a.flushStats();
    expect(fetchMock).toHaveBeenCalledTimes(2); // plus rien à renvoyer
  });

  it('chaque lot a son propre numéro (aucun identifiant d’appareil)', async () => {
    const a = await freshAnalytics();
    a.startStats();
    await a.flushStats();
    a.track('leave_pose');
    await a.flushStats();
    const [l1, l2] = envoyes(fetchMock);
    expect(l1!.lot).not.toBe(l2!.lot);
  });

  it('pages hors app (transfert, téléchargement…) : événements seulement, pas d’ouverture', async () => {
    const a = await freshAnalytics();
    a.startStats({ ouverture: false });
    a.track('transfert_page_vide');
    await a.flushStats();
    const [lot] = envoyes(fetchMock);
    expect(lot!.days['2026-10-17']).toMatchObject({ opens: 0, events: { transfert_page_vide: 1 } });
    expect(lot!.days['2026-10-17']!.active).toBeUndefined();
    // Passage ensuite sur le planning : l'ouverture est comptée une fois
    a.startStats({ ouverture: true });
    a.startStats({ ouverture: true });
    await a.flushStats();
    expect(envoyes(fetchMock)[1]!.days['2026-10-17']).toMatchObject({ opens: 1 });
  });

  it('migration : marqueur pas encore envoyé → ni nouveau, ni 2e actif de la semaine', async () => {
    const a = await freshAnalytics();
    a.startStats();
    a.fusionnerMigration({ known: true, lastActiveWeek: '2026-W42', lastActiveMonth: '2026-10' });
    await a.flushStats();
    expect(envoyes(fetchMock)[0]!.days['2026-10-17']!.active).toMatchObject({ isNew: false, firstOfWeek: false, firstOfMonth: false });
  });

  it('migration : marqueur déjà envoyé → corrections envoyées une seule fois', async () => {
    const a = await freshAnalytics();
    a.startStats();
    await a.flushStats(); // nouvel appareil déjà compté
    a.fusionnerMigration({ known: true, lastActiveWeek: '2026-W42', lastActiveMonth: '2026-10' });
    a.fusionnerMigration({ known: true, lastActiveWeek: '2026-W42', lastActiveMonth: '2026-10' });
    await a.flushStats();
    expect(envoyes(fetchMock)[1]!.days['2026-10-17']!.events).toEqual({
      migration_nouveau_annule: 1, migration_semaine_annulee: 1, migration_mois_annule: 1,
    });
  });

  it('transfert : l’état des stats du navigateur accompagne les données', () => {
    const brut = JSON.stringify({
      cycleConfig: DEFAULT_CYCLE_CONFIG, counters: DEFAULT_COUNTERS, history: [],
      lastUpdated: '2026-10-10T08:00:00.000Z', lastResetYear: 2026, isOnboarded: true,
    });
    const r = lireDonneesTransfert(empaqueterTransfert(brut, { known: true, lastActiveWeek: '2026-W42' }));
    expect(r?.statsNavigateur).toEqual({ known: true, lastActiveWeek: '2026-W42' });
    expect(r?.data.isOnboarded).toBe(true);
    expect(lireDonneesTransfert(brut)?.statsNavigateur).toBeUndefined(); // ancien format accepté
  });
});

describe('Côté serveur', () => {
  let dir: string;
  const JOUR = '2026-10-15';
  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'chronos-stats-'));
    process.env.STATS_DIR = dir;
  });
  afterEach(async () => {
    delete process.env.STATS_DIR;
    await rm(dir, { recursive: true, force: true });
  });
  const nouveau = (platform: StatsPayload['platform'], events = {}, lot?: string): StatsPayload => ({
    v: 1, platform, version: '1.18.1', ...(lot && { lot }),
    days: { [JOUR]: { opens: 1, events, errors: {}, active: { firstOfWeek: true, firstOfMonth: true, isNew: true, profile: [] } } },
  });

  it('installations d’avant les statistiques (Play Console, App Store Connect) comptées dans les nouveaux', async () => {
    const s = await summarize('2026-04-01', '2026-09-23');
    expect(s.totaux.nouveaux).toBe(108 + 211);
    expect(s.jours.find((j) => j.day === '2026-06-06')).toMatchObject({ nouveaux: 10, nouveauxParPlateforme: expect.objectContaining({ android: 10, ios: 0 }), actifs: 0 });
    expect(s.jours.find((j) => j.day === '2026-09-01')).toMatchObject({ nouveaux: 21 + 49, nouveauxParPlateforme: expect.objectContaining({ android: 21, ios: 49 }) });
    // À partir du 24/09, seules nos statistiques comptent
    expect((await summarize('2026-09-24', '2026-09-24')).totaux.nouveaux).toBe(0);
  });

  it('le numéro de lot est conservé à la réception', () => {
    expect(validatePayload(nouveau('ios', {}, 'abc123xyz'), JOUR)?.lot).toBe('abc123xyz');
    expect(validatePayload(nouveau('ios', {}, 'pas un lot !'), JOUR)?.lot).toBeUndefined();
  });

  it('un lot reçu deux fois n’est compté qu’une fois ; deux appareils identiques sans lot, deux fois', async () => {
    await appendBatch(nouveau('ios', {}, 'lot0000001'), JOUR);
    await appendBatch(nouveau('ios', {}, 'lot0000001'), JOUR);
    await appendBatch(nouveau('ios'), JOUR);
    await appendBatch(nouveau('ios'), JOUR);
    const j = (await summarize(JOUR, JOUR)).jours[0]!;
    expect(j).toMatchObject({ actifs: 3, nouveaux: 3, ouvertures: 3 });
  });

  it('historique : la page /transfert n’est pas un utilisateur web', async () => {
    await appendBatch(nouveau('web', { transfert_page_vide: 1 }), JOUR);
    await appendBatch(nouveau('web', { leave_pose: 1 }), JOUR);
    const s = await summarize(JOUR, JOUR);
    expect(s.jours[0]).toMatchObject({ actifs: 1, nouveaux: 1, ouvertures: 1 });
    expect(s.fonctionnalites.find((f) => f.event === 'transfert_page_vide')?.total).toBe(1); // l'événement reste compté
  });

  it('historique : chaque récupération Android retire un faux nouvel appareil et un doublon semaine / mois', async () => {
    await appendBatch(nouveau('android'), JOUR); // appareil natif neuf…
    await appendBatch(nouveau('android', { transfert_recu: 1, transfert_importe: 1 }), JOUR); // …qui récupère ses données
    await appendBatch(nouveau('android'), JOUR); // vrai nouvel agent
    const s = await summarize(JOUR, JOUR);
    expect(s.jours[0]).toMatchObject({ actifs: 3, nouveaux: 2 });
    expect(s.jours[0]!.nouveauxParPlateforme.android).toBe(2);
    expect(s.semaines[0]!.actifs).toBe(2);
    expect(s.mois[0]!.actifs).toBe(2);
  });

  it('corrections envoyées par l’app (lots numérotés)', async () => {
    await appendBatch(nouveau('android', {}, 'lotaaaaaa1'), JOUR);
    await appendBatch({ ...nouveau('android', { migration_nouveau_annule: 1, migration_semaine_annulee: 1 }, 'lotaaaaaa2'), days: { [JOUR]: { opens: 0, events: { migration_nouveau_annule: 1, migration_semaine_annulee: 1 }, errors: {} } } }, JOUR);
    const s = await summarize(JOUR, JOUR);
    expect(s.jours[0]).toMatchObject({ nouveaux: 0 });
    expect(s.semaines[0]!.actifs).toBe(0);
    expect(s.mois[0]!.actifs).toBe(1);
  });
});
