// Stockage serveur des statistiques anonymes.
//
// Journal en ajout seul : un lot validé = une ligne JSON dans `stats-YYYY-MM.jsonl`.
// `appendFile` en O_APPEND reste sûr avec plusieurs processus pm2 (cluster),
// là où un fichier JSON réécrit à chaque requête perdrait des écritures.
// Aucune IP, aucun horodatage précis : seulement le jour local de l'appareil.
//
// Emplacement : $STATS_DIR, sinon /var/lib/chronos-stats en production — HORS de
// /var/www/chronos, que `deploy.sh` synchronise avec `rsync --delete`.

import { appendFile, mkdir, readdir, readFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import {
  ERROR_KEY_MAX,
  PROFILE_KEY_RE,
  STATS_EVENTS,
  isStatsEvent,
  isStatsPlatform,
  isoWeekOfDayKey,
  type StatsDayBucket,
  type StatsEvent,
  type StatsPayload,
  type StatsPlatform,
} from '../stats-events';

/** Durée de conservation (recommandation CNIL pour la mesure d'audience). */
export const RETENTION_MONTHS = 25;

const MAX_DAYS_PER_BATCH = 15;
const MAX_COUNT = 500;
const MAX_ERRORS_PER_DAY = 20;
const MAX_PROFILE_KEYS = 8;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const VERSION_RE = /^\d{1,3}\.\d{1,3}\.\d{1,3}$/;

export function statsDir(): string {
  if (process.env.STATS_DIR) return process.env.STATS_DIR;
  return process.env.NODE_ENV === 'production'
    ? '/var/lib/chronos-stats'
    : path.join(process.cwd(), '.stats-data');
}

// ─── Validation ───────────────────────────────────────────────────────────────

function count(n: unknown): number | null {
  return typeof n === 'number' && Number.isInteger(n) && n >= 0 && n <= MAX_COUNT ? n : null;
}

/**
 * Valide et normalise un lot reçu. Tout champ inconnu est ignoré ; un lot
 * structurellement faux est rejeté (null).
 * `today` = jour UTC du serveur : les jours acceptés vont de J-15 à J+1
 * (fuseaux d'outre-mer en avance sur l'UTC).
 */
export function validatePayload(raw: unknown, today: string): StatsPayload | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const p = raw as Record<string, unknown>;
  if (p.v !== 1 || !isStatsPlatform(p.platform)) return null;
  if (typeof p.version !== 'string' || !VERSION_RE.test(p.version)) return null;
  if (typeof p.days !== 'object' || p.days === null) return null;

  const entries = Object.entries(p.days as Record<string, unknown>);
  if (entries.length === 0 || entries.length > MAX_DAYS_PER_BATCH) return null;

  const minDay = shiftDay(today, -MAX_DAYS_PER_BATCH);
  const maxDay = shiftDay(today, 1);
  const days: Record<string, StatsDayBucket> = {};

  for (const [day, value] of entries) {
    if (!DAY_RE.test(day) || day < minDay || day > maxDay) return null;
    if (typeof value !== 'object' || value === null) return null;
    const b = value as Record<string, unknown>;

    const opens = count(b.opens);
    if (opens === null) return null;

    const events: Partial<Record<StatsEvent, number>> = {};
    if (typeof b.events === 'object' && b.events !== null) {
      for (const [name, n] of Object.entries(b.events)) {
        const c = count(n);
        if (isStatsEvent(name) && c) events[name] = c;
      }
    }

    const errors: Record<string, number> = {};
    if (typeof b.errors === 'object' && b.errors !== null) {
      for (const [key, n] of Object.entries(b.errors).slice(0, MAX_ERRORS_PER_DAY)) {
        const c = count(n);
        if (c && key.length <= ERROR_KEY_MAX) errors[key] = c;
      }
    }

    const bucket: StatsDayBucket = { opens, events, errors };

    if (typeof b.active === 'object' && b.active !== null) {
      const a = b.active as Record<string, unknown>;
      const profile = Array.isArray(a.profile)
        ? a.profile
            .filter((k): k is string => typeof k === 'string' && PROFILE_KEY_RE.test(k))
            .slice(0, MAX_PROFILE_KEYS)
        : [];
      bucket.active = {
        firstOfWeek: a.firstOfWeek === true,
        firstOfMonth: a.firstOfMonth === true,
        isNew: a.isNew === true,
        profile,
      };
    }

    days[day] = bucket;
  }

  return { v: 1, platform: p.platform, version: p.version, days };
}

function shiftDay(day: string, delta: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

// ─── Écriture ─────────────────────────────────────────────────────────────────

export async function appendBatch(payload: StatsPayload, today: string): Promise<void> {
  const dir = statsDir();
  await mkdir(dir, { recursive: true });
  // Classé par mois de RÉCEPTION : les lectures parcourent quelques fichiers
  // voisins, un jour envoyé en retard reste trouvable.
  const file = path.join(dir, `stats-${today.slice(0, 7)}.jsonl`);
  await appendFile(file, JSON.stringify(payload) + '\n', 'utf8');
}

/** Supprime les fichiers au-delà de la durée de conservation. */
export async function purgeOld(today: string): Promise<void> {
  const dir = statsDir();
  const [y, m] = today.split('-').map(Number);
  const limit = new Date(Date.UTC(y!, m! - 1 - RETENTION_MONTHS, 1)).toISOString().slice(0, 7);
  let files: string[];
  try {
    files = await readdir(dir);
  } catch {
    return;
  }
  await Promise.all(
    files
      .filter((f) => /^stats-\d{4}-\d{2}\.jsonl$/.test(f) && f.slice(6, 13) < limit)
      .map((f) => unlink(path.join(dir, f)).catch(() => undefined)),
  );
}

// ─── Lecture / agrégation ─────────────────────────────────────────────────────

type PlatformCounts = Record<StatsPlatform, number>;

const zeroPlatforms = (): PlatformCounts => ({ ios: 0, android: 0, pwa: 0, web: 0 });

export interface DaySummary {
  day: string;
  actifs: number;
  nouveaux: number;
  ouvertures: number;
  actifsParPlateforme: PlatformCounts;
}

export interface StatsSummary {
  from: string;
  to: string;
  jours: DaySummary[];
  /** Actifs uniques par semaine ISO / par mois (comptés au 1er passage). */
  semaines: { semaine: string; actifs: number }[];
  mois: { mois: string; actifs: number }[];
  totaux: {
    actifsJourMoyen: number;
    nouveaux: number;
    ouvertures: number;
    ouverturesParActif: number;
  };
  plateformes: PlatformCounts;
  versions: Record<string, number>;
  /** Chaque fonctionnalité du catalogue, même jamais utilisée (0). */
  fonctionnalites: {
    event: StatsEvent;
    label: string;
    group: string;
    total: number;
    /** Nombre de jours-appareil distincts ayant utilisé la fonctionnalité. */
    joursUtilisateurs: number;
  }[];
  erreurs: { key: string; total: number; dernierJour: string }[];
  profils: Record<string, number>;
}

async function readBatches(fromDay: string): Promise<StatsPayload[]> {
  const dir = statsDir();
  let files: string[];
  try {
    files = await readdir(dir);
  } catch {
    return [];
  }
  // Un jour peut arriver jusqu'à 15 j plus tard : on lit aussi le mois précédent.
  const fromMonth = shiftDay(fromDay, -31).slice(0, 7);
  const wanted = files
    .filter((f) => /^stats-\d{4}-\d{2}\.jsonl$/.test(f) && f.slice(6, 13) >= fromMonth)
    .sort();

  const out: StatsPayload[] = [];
  for (const f of wanted) {
    const content = await readFile(path.join(dir, f), 'utf8');
    for (const line of content.split('\n')) {
      if (!line) continue;
      try {
        out.push(JSON.parse(line) as StatsPayload);
      } catch {
        /* ligne tronquée (arrêt pendant une écriture) : ignorée */
      }
    }
  }
  return out;
}

export async function summarize(fromDay: string, toDay: string): Promise<StatsSummary> {
  const batches = await readBatches(fromDay);

  const jours = new Map<string, DaySummary>();
  for (let d = fromDay; d <= toDay; d = shiftDay(d, 1)) {
    jours.set(d, { day: d, actifs: 0, nouveaux: 0, ouvertures: 0, actifsParPlateforme: zeroPlatforms() });
  }

  const semaines = new Map<string, number>();
  const mois = new Map<string, number>();
  const plateformes = zeroPlatforms();
  const versions: Record<string, number> = {};
  const featTotals = new Map<StatsEvent, { total: number; jours: number }>();
  const erreurs = new Map<string, { total: number; dernierJour: string }>();
  const profils: Record<string, number> = {};

  for (const batch of batches) {
    for (const [day, b] of Object.entries(batch.days)) {
      const js = jours.get(day);
      if (!js) continue;

      js.ouvertures += b.opens;

      if (b.active) {
        js.actifs += 1;
        js.actifsParPlateforme[batch.platform] += 1;
        plateformes[batch.platform] += 1;
        versions[batch.version] = (versions[batch.version] ?? 0) + 1;
        if (b.active.isNew) js.nouveaux += 1;
        if (b.active.firstOfWeek) {
          const w = isoWeekOfDayKey(day);
          semaines.set(w, (semaines.get(w) ?? 0) + 1);
        }
        if (b.active.firstOfMonth) {
          const m = day.slice(0, 7);
          mois.set(m, (mois.get(m) ?? 0) + 1);
        }
        for (const k of b.active.profile) profils[k] = (profils[k] ?? 0) + 1;
      }

      for (const [name, n] of Object.entries(b.events)) {
        const e = name as StatsEvent;
        const cur = featTotals.get(e) ?? { total: 0, jours: 0 };
        cur.total += n ?? 0;
        cur.jours += 1;
        featTotals.set(e, cur);
      }

      for (const [key, n] of Object.entries(b.errors)) {
        const cur = erreurs.get(key) ?? { total: 0, dernierJour: day };
        cur.total += n;
        if (day > cur.dernierJour) cur.dernierJour = day;
        erreurs.set(key, cur);
      }
    }
  }

  const joursArr = [...jours.values()];
  const totalActifs = joursArr.reduce((s, j) => s + j.actifs, 0);
  const totalOuvertures = joursArr.reduce((s, j) => s + j.ouvertures, 0);

  const fonctionnalites = (Object.keys(STATS_EVENTS) as StatsEvent[])
    .map((event) => ({
      event,
      label: STATS_EVENTS[event].label,
      group: STATS_EVENTS[event].group,
      total: featTotals.get(event)?.total ?? 0,
      joursUtilisateurs: featTotals.get(event)?.jours ?? 0,
    }))
    .sort((a, b) => b.total - a.total);

  const round1 = (n: number) => Math.round(n * 10) / 10;

  return {
    from: fromDay,
    to: toDay,
    jours: joursArr,
    semaines: [...semaines.entries()].sort().map(([semaine, actifs]) => ({ semaine, actifs })),
    mois: [...mois.entries()].sort().map(([m, actifs]) => ({ mois: m, actifs })),
    totaux: {
      actifsJourMoyen: round1(totalActifs / Math.max(1, joursArr.length)),
      nouveaux: joursArr.reduce((s, j) => s + j.nouveaux, 0),
      ouvertures: totalOuvertures,
      ouverturesParActif: round1(totalOuvertures / Math.max(1, totalActifs)),
    },
    plateformes,
    versions,
    fonctionnalites,
    erreurs: [...erreurs.entries()]
      .map(([key, v]) => ({ key, ...v }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 50),
    profils,
  };
}
