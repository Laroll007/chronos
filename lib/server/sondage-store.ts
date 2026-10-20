// Réponses anonymes au sondage « Préparons 2027 » (cf. lib/sondage2027.ts).
//
// Journal en ajout seul `sondage-2027.jsonl`, à côté des statistiques (hors de
// /var/www/chronos, que deploy.sh synchronise avec --delete). Une ligne = un
// profil de cycle + des dotations annuelles : ni identifiant, ni IP, ni date
// précise (le jour seulement), ni texte libre.
//
// Le serveur cesse de poser la question à un profil dès qu'il a SEUIL réponses
// exploitables (« c'est bien ça » ou « je corrige ») : inutile de solliciter
// tout le monde une fois un cycle et ses horaires couverts.

import { appendFile, mkdir, readFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { statsDir } from './stats-store';

export const SONDAGE_SEUIL = 5;
const FICHIER = 'sondage-2027.jsonl';
/** « alterne|2/2/3/2/2/3|12h08|nuit », « hebdo|-|8h00|- » */
export const PROFIL_RE = /^(alterne|hebdo)\|[0-9/a-z_-]{1,20}\|\d{1,2}h\d{2}\|(jour|nuit|mixte|rotation|inconnu|-)$/;
const COMPTEURS = ['ca', 'rtc', 'cf', 'artt', 'rtt'] as const;
type Compteur = (typeof COMPTEURS)[number];
const EN_JOURS: ReadonlySet<Compteur> = new Set(['ca', 'artt', 'rtt']);
const MOTIFS = ['arrivee', 'temps_partiel', 'maladie', 'autre'] as const;
const VERSION_RE = /^\d{1,3}\.\d{1,3}\.\d{1,3}$/;

export interface ReponseStockee {
  jour: string;
  profil: string;
  plateforme: 'ios' | 'android' | 'web';
  version: string;
  reponse: 'confirme' | 'corrige' | 'nsp';
  dotations?: Partial<Record<Compteur, number>>;
  motif?: (typeof MOTIFS)[number];
  artt?: 'meme' | 'distinct' | 'nsp';
  arttJours?: number;
}

const estObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Valide une réponse reçue ; tout champ inconnu est ignoré. */
export function validerReponse(raw: unknown, jour: string): ReponseStockee | null {
  if (!estObj(raw)) return null;
  const { profil, plateforme, version, reponse, dotations, motif, artt, arttJours } = raw;
  if (typeof profil !== 'string' || !PROFIL_RE.test(profil)) return null;
  if (plateforme !== 'ios' && plateforme !== 'android' && plateforme !== 'web') return null;
  if (typeof version !== 'string' || !VERSION_RE.test(version)) return null;
  if (reponse !== 'confirme' && reponse !== 'corrige' && reponse !== 'nsp') return null;
  const r: ReponseStockee = { jour, profil, plateforme, version, reponse };

  if (reponse === 'corrige') {
    if (!estObj(dotations)) return null;
    const d: Partial<Record<Compteur, number>> = {};
    for (const k of COMPTEURS) {
      const v = dotations[k];
      if (v === undefined) continue;
      // Jours : 0 à 60 (demi-journées) ; minutes : 0 à 600 h.
      const max = EN_JOURS.has(k) ? 60 : 600 * 60;
      if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > max || (EN_JOURS.has(k) ? v * 2 : v) % 1 !== 0) return null;
      d[k] = v;
    }
    if (Object.keys(d).length === 0) return null;
    r.dotations = d;
  }
  if (motif !== undefined) {
    if (!MOTIFS.includes(motif as (typeof MOTIFS)[number])) return null;
    r.motif = motif as (typeof MOTIFS)[number];
  }
  if (artt !== undefined) {
    if (artt !== 'meme' && artt !== 'distinct' && artt !== 'nsp') return null;
    r.artt = artt;
    if (artt === 'distinct' && arttJours !== undefined) {
      if (typeof arttJours !== 'number' || arttJours < 0 || arttJours > 60 || (arttJours * 2) % 1 !== 0) return null;
      r.arttJours = arttJours;
    }
  }
  return r;
}

const fichier = () => path.join(statsDir(), FICHIER);

export async function enregistrerReponse(r: ReponseStockee): Promise<void> {
  await mkdir(statsDir(), { recursive: true });
  await appendFile(fichier(), JSON.stringify(r) + '\n', { encoding: 'utf8', mode: 0o640 });
  cache = null;
}

let cache: { lu: number; reponses: ReponseStockee[] } | null = null;
const CINQ_MINUTES = 5 * 60 * 1000;

/** Conservation : jusqu'au 31 décembre 2027 (politique de confidentialité, 2.D). */
const FIN_CONSERVATION = new Date(2028, 0, 1);

export async function lireReponses(maintenant: Date = new Date()): Promise<ReponseStockee[]> {
  if (maintenant >= FIN_CONSERVATION) {
    await unlink(fichier()).catch(() => {});
    cache = null;
    return [];
  }
  if (cache && Date.now() - cache.lu < CINQ_MINUTES) return cache.reponses;
  let texte = '';
  try {
    texte = await readFile(fichier(), 'utf8');
  } catch {
    /* pas encore de réponse */
  }
  const reponses = texte
    .split('\n')
    .filter(Boolean)
    .flatMap((l) => {
      try {
        return [JSON.parse(l) as ReponseStockee];
      } catch {
        return [];
      }
    });
  cache = { lu: Date.now(), reponses };
  return reponses;
}

/** Sondage fermé : variable d'environnement, ou passé le 31 décembre 2026. */
export function sondageClos(maintenant: Date = new Date()): boolean {
  return process.env.SONDAGE_2027_CLOS === '1' || maintenant.getFullYear() >= 2027;
}

/** Le profil a-t-il encore besoin de réponses ? */
export function besoinPourProfil(reponses: ReponseStockee[], profil: string): boolean {
  const utiles = reponses.filter((r) => r.profil === profil && r.reponse !== 'nsp').length;
  return utiles < SONDAGE_SEUIL;
}

export interface ResumeProfil {
  profil: string;
  total: number;
  confirme: number;
  corrige: number;
  nsp: number;
  /** Valeurs corrigées les plus fréquentes, par compteur : [valeur, nombre]. */
  corrections: Partial<Record<Compteur, [number, number][]>>;
  motifs: Record<string, number>;
  artt: { meme: number; distinct: number; nsp: number };
  /** Encore proposé à ce profil ? */
  ouvert: boolean;
}

export interface ResumeSondage {
  clos: boolean;
  seuil: number;
  total: number;
  profils: ResumeProfil[];
}

export function resumer(reponses: ReponseStockee[], clos: boolean): ResumeSondage {
  const parProfil = new Map<string, ReponseStockee[]>();
  for (const r of reponses) parProfil.set(r.profil, [...(parProfil.get(r.profil) ?? []), r]);
  const profils = [...parProfil.entries()].map(([profil, rs]) => {
    const corrections: ResumeProfil['corrections'] = {};
    for (const k of COMPTEURS) {
      const n = new Map<number, number>();
      for (const r of rs) {
        const v = r.dotations?.[k];
        if (v !== undefined) n.set(v, (n.get(v) ?? 0) + 1);
      }
      if (n.size) corrections[k] = [...n.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
    }
    const motifs: Record<string, number> = {};
    for (const r of rs) if (r.motif) motifs[r.motif] = (motifs[r.motif] ?? 0) + 1;
    return {
      profil,
      total: rs.length,
      confirme: rs.filter((r) => r.reponse === 'confirme').length,
      corrige: rs.filter((r) => r.reponse === 'corrige').length,
      nsp: rs.filter((r) => r.reponse === 'nsp').length,
      corrections,
      motifs,
      artt: {
        meme: rs.filter((r) => r.artt === 'meme').length,
        distinct: rs.filter((r) => r.artt === 'distinct').length,
        nsp: rs.filter((r) => r.artt === 'nsp').length,
      },
      ouvert: !clos && besoinPourProfil(reponses, profil),
    };
  });
  profils.sort((a, b) => b.total - a.total);
  return { clos, seuil: SONDAGE_SEUIL, total: reponses.length, profils };
}
