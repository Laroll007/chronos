import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { isoWeekKey, isoWeekOfDayKey, sanitizeErrorKey, type StatsPayload } from '../stats-events';
import { appendBatch, purgeOld, summarize, validatePayload } from '../server/stats-store';

const TODAY = '2026-09-24';

function payload(overrides: Partial<StatsPayload> = {}): StatsPayload {
  return {
    v: 1,
    platform: 'android',
    version: '1.10.0',
    days: {
      [TODAY]: {
        opens: 3,
        events: { leave_pose: 2, view_year: 1 },
        errors: {},
        active: { firstOfWeek: true, firstOfMonth: true, isNew: false, profile: ['type:alterne', 'pattern:2/2'] },
      },
    },
    ...overrides,
  };
}

describe('sanitizeErrorKey', () => {
  it('retire chiffres, chaînes et URL', () => {
    const key = sanitizeErrorKey(
      'window',
      'TypeError',
      `Cannot read "12h08" of undefined at https://mychronos.fr/_next/app.js line 1234`,
    );
    expect(key).toBe('window|TypeError: Cannot read <str> of undefined at <url> line #');
  });

  it('borne la longueur', () => {
    expect(sanitizeErrorKey('x', 'E', 'a'.repeat(500)).length).toBe(120);
  });
});

describe('semaine ISO', () => {
  it('suit la norme ISO 8601 aux changements d’année', () => {
    expect(isoWeekKey(new Date(2026, 0, 1))).toBe('2026-W01'); // jeudi
    expect(isoWeekKey(new Date(2027, 0, 1))).toBe('2026-W53'); // vendredi
    expect(isoWeekOfDayKey('2026-09-24')).toBe('2026-W39');
  });
});

describe('validatePayload', () => {
  it('accepte un lot valide', () => {
    expect(validatePayload(payload(), TODAY)).toEqual(payload());
  });

  it('écarte les événements hors catalogue et les profils mal formés', () => {
    const raw = payload();
    const day = raw.days[TODAY]!;
    (day.events as Record<string, number>).inconnu = 4;
    day.active!.profile.push('email:jean@police.fr', 'type:hebdo');
    const out = validatePayload(raw, TODAY)!;
    expect(out.days[TODAY]!.events).toEqual({ leave_pose: 2, view_year: 1 });
    expect(out.days[TODAY]!.active!.profile).toEqual(['type:alterne', 'pattern:2/2', 'type:hebdo']);
  });

  it('rejette plateforme, version, jour ou compteur invalides', () => {
    expect(validatePayload({ ...payload(), platform: 'windows' }, TODAY)).toBeNull();
    expect(validatePayload({ ...payload(), version: '<script>' }, TODAY)).toBeNull();
    expect(validatePayload(payload({ days: { '2025-01-01': payload().days[TODAY]! } }), TODAY)).toBeNull();
    expect(validatePayload(payload({ days: { [TODAY]: { ...payload().days[TODAY]!, opens: -1 } } }), TODAY)).toBeNull();
    expect(validatePayload('nope', TODAY)).toBeNull();
  });

  it('accepte le lendemain (outre-mer en avance sur l’UTC)', () => {
    expect(validatePayload(payload({ days: { '2026-09-25': payload().days[TODAY]! } }), TODAY)).not.toBeNull();
  });
});

describe('stockage et agrégation', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'chronos-stats-'));
    process.env.STATS_DIR = dir;
  });

  afterEach(async () => {
    delete process.env.STATS_DIR;
    await rm(dir, { recursive: true, force: true });
  });

  it('compte actifs, nouveaux, ouvertures, fonctionnalités et plateformes', async () => {
    await appendBatch(payload(), TODAY);
    await appendBatch(
      payload({
        platform: 'ios',
        days: {
          [TODAY]: {
            opens: 1,
            events: { leave_pose: 1 },
            errors: { 'react|TypeError: x': 2 },
            active: { firstOfWeek: false, firstOfMonth: true, isNew: true, profile: ['type:hebdo'] },
          },
        },
      }),
      TODAY,
    );
    // Envoi suivant du même appareil dans la journée : pas de marqueur « actif ».
    await appendBatch(payload({ days: { [TODAY]: { opens: 1, events: { view_year: 1 }, errors: {} } } }), TODAY);

    const s = await summarize('2026-09-20', TODAY);
    const today = s.jours.find((j) => j.day === TODAY)!;

    expect(s.jours).toHaveLength(5);
    expect(today.actifs).toBe(2);
    expect(today.nouveaux).toBe(1);
    expect(today.ouvertures).toBe(5);
    expect(today.actifsParPlateforme).toEqual({ ios: 1, android: 1, pwa: 0, web: 0 });
    expect(s.semaines).toEqual([{ semaine: '2026-W39', actifs: 1 }]);
    expect(s.mois).toEqual([{ mois: '2026-09', actifs: 2 }]);
    expect(s.totaux.ouverturesParActif).toBe(2.5);

    const byEvent = Object.fromEntries(s.fonctionnalites.map((f) => [f.event, f]));
    expect(byEvent.leave_pose!.total).toBe(3);
    expect(byEvent.view_year!.total).toBe(2);
    // Les fonctionnalités jamais utilisées apparaissent à 0 (les « moins utilisées »).
    expect(byEvent.tool_retraite!.total).toBe(0);
    expect(s.fonctionnalites[0]!.event).toBe('leave_pose');

    expect(s.erreurs).toEqual([{ key: 'react|TypeError: x', total: 2, dernierJour: TODAY }]);
    expect(s.profils).toEqual({ 'type:alterne': 1, 'pattern:2/2': 1, 'type:hebdo': 1 });
  });

  it('n’écrit ni IP ni horodatage', async () => {
    await appendBatch(payload(), TODAY);
    const content = await readFile(path.join(dir, 'stats-2026-09.jsonl'), 'utf8');
    expect(JSON.parse(content.trim())).toEqual(payload());
  });

  it('ignore une ligne tronquée', async () => {
    await appendBatch(payload(), TODAY);
    const { appendFile } = await import('node:fs/promises');
    await appendFile(path.join(dir, 'stats-2026-09.jsonl'), '{"v":1,"platf');
    const s = await summarize(TODAY, TODAY);
    expect(s.jours[0]!.actifs).toBe(1);
  });

  it('purge au-delà de 25 mois', async () => {
    await appendBatch(payload(), '2024-01-15');
    await appendBatch(payload(), '2024-09-15');
    await purgeOld(TODAY);
    const { readdir } = await import('node:fs/promises');
    expect(await readdir(dir)).toEqual(['stats-2024-09.jsonl']);
  });
});
