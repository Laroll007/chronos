// Chiffres des stores (Google Play Console, App Store Connect), importés à la
// main dans /stats depuis leurs exports CSV. Ils couvrent la période d'avant
// les statistiques de l'app (24 septembre 2026) et servent de point de
// comparaison ensuite. Fichier `stores.json` à côté des statistiques.

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { statsDir } from './stats-store';

export interface JourAndroid {
  /** Appareils ayant l'app installée ce jour-là (« Audience ayant installé »). */
  installes?: number;
  /** Installations depuis le Play Store ce jour-là (« Acquisition d'utilisateurs »). */
  acquisitions?: number;
}
export interface JourIOS {
  /** Téléchargements (« Unités d'app » / « Téléchargements initiaux »). */
  telechargements?: number;
}
export interface DonneesStores {
  android: Record<string, JourAndroid>;
  ios: Record<string, JourIOS>;
  /** Jour du dernier import ('YYYY-MM-DD'). */
  majLe?: string;
}
export type ExportStore =
  | { plateforme: 'android'; jours: Record<string, JourAndroid> }
  | { plateforme: 'ios'; jours: Record<string, JourIOS> };

const MOIS: Record<string, number> = {
  'janv.': 1, 'févr.': 2, mars: 3, 'avr.': 4, mai: 5, juin: 6, 'juil.': 7, 'août': 8, 'sept.': 9, 'oct.': 10, 'nov.': 11, 'déc.': 12,
  janvier: 1, février: 2, avril: 4, juillet: 7, septembre: 9, octobre: 10, novembre: 11, décembre: 12,
};

/** Découpe une ligne CSV (guillemets, virgules ou points-virgules). */
function cellules(ligne: string, sep: string): string[] {
  const out: string[] = [];
  let cur = '';
  let entre = false;
  for (let i = 0; i < ligne.length; i++) {
    const c = ligne[i]!;
    if (c === '"') {
      if (entre && ligne[i + 1] === '"') { cur += '"'; i++; } else entre = !entre;
    } else if (c === sep && !entre) {
      out.push(cur);
      cur = '';
    } else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

/** « 24 avr. 2026 », « 2026-04-24 », « 24/04/2026 » → '2026-04-24'. */
export function jourDepuis(texte: string): string | null {
  const t = texte.trim().toLowerCase();
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t);
  if (m) return `${m[3]}-${m[2]!.padStart(2, '0')}-${m[1]!.padStart(2, '0')}`;
  m = /^(\d{1,2}) (\S+) (\d{4})$/.exec(t);
  if (m && MOIS[m[2]!]) return `${m[3]}-${String(MOIS[m[2]!]).padStart(2, '0')}-${m[1]!.padStart(2, '0')}`;
  return null;
}

/** « 1 008 » (espaces fines comprises) → 1008 ; « - » ou vide → undefined. */
function nombre(texte: string | undefined): number | undefined {
  if (texte === undefined) return undefined;
  const s = texte.replace(/[\s  ]/g, '');
  if (s === '' || s === '-') return undefined;
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : undefined;
}

/**
 * Lit un export CSV de la Play Console (audience installée, acquisitions) ou
 * d'App Store Connect (unités d'app, téléchargements). Seules les colonnes
 * « tous pays » sont retenues. null si le format n'est pas reconnu.
 */
export function lireExportStore(csv: string): ExportStore | null {
  const lignes = csv.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim() !== '');
  if (lignes.length < 2) return null;
  const sep = (lignes[0]!.match(/;/g)?.length ?? 0) > (lignes[0]!.match(/,/g)?.length ?? 0) ? ';' : ',';
  const tete = cellules(lignes[0]!, sep).map((h) => h.toLowerCase());
  const tousPays = (h: string) => !h.includes(':') || h.includes('tous les pays');
  const col = (motif: RegExp) => tete.findIndex((h) => motif.test(h) && tousPays(h));

  const iInstalles = col(/audience ayant install/);
  const iAcquisitions = col(/acquisition d.utilisateurs|nouveaux utilisateurs|installations sur l.appareil/);
  const iIOS = col(/unités d.app|unites d.app|téléchargements|telechargements|app units|first-time downloads|total downloads/);

  const lignesDonnees = lignes.slice(1).map((l) => cellules(l, sep));
  if (iInstalles >= 0 || iAcquisitions >= 0) {
    const jours: Record<string, JourAndroid> = {};
    for (const c of lignesDonnees) {
      const jour = jourDepuis(c[0] ?? '');
      if (!jour) continue;
      const j: JourAndroid = {};
      const inst = iInstalles >= 0 ? nombre(c[iInstalles]) : undefined;
      const acq = iAcquisitions >= 0 ? nombre(c[iAcquisitions]) : undefined;
      if (inst !== undefined) j.installes = inst;
      if (acq !== undefined) j.acquisitions = acq;
      if (Object.keys(j).length) jours[jour] = j;
    }
    return Object.keys(jours).length ? { plateforme: 'android', jours } : null;
  }
  if (iIOS >= 0) {
    const jours: Record<string, JourIOS> = {};
    for (const c of lignesDonnees) {
      const jour = jourDepuis(c[0] ?? '');
      const n = nombre(c[iIOS]);
      if (jour && n !== undefined) jours[jour] = { telechargements: n };
    }
    return Object.keys(jours).length ? { plateforme: 'ios', jours } : null;
  }
  return null;
}

const fichier = () => path.join(statsDir(), 'stores.json');

export async function lireStores(): Promise<DonneesStores> {
  try {
    const d = JSON.parse(await readFile(fichier(), 'utf8')) as DonneesStores;
    return { android: d.android ?? {}, ios: d.ios ?? {}, ...(d.majLe && { majLe: d.majLe }) };
  } catch {
    return { android: {}, ios: {} };
  }
}

/** Fusionne un export dans les données : les valeurs importées remplacent les anciennes jour par jour. */
export function fusionnerExport(d: DonneesStores, e: ExportStore, aujourdhui: string): DonneesStores {
  const out: DonneesStores = { android: { ...d.android }, ios: { ...d.ios }, majLe: aujourdhui };
  if (e.plateforme === 'android') {
    for (const [jour, j] of Object.entries(e.jours)) out.android[jour] = { ...out.android[jour], ...j };
  } else {
    for (const [jour, j] of Object.entries(e.jours)) out.ios[jour] = { ...out.ios[jour], ...j };
  }
  return out;
}

export async function ecrireStores(d: DonneesStores): Promise<void> {
  await mkdir(statsDir(), { recursive: true });
  const tmp = `${fichier()}.tmp`;
  await writeFile(tmp, JSON.stringify(d), { encoding: 'utf8', mode: 0o640 });
  await rename(tmp, fichier());
}
