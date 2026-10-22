// « Partager mon planning » : photo du planning sur 1, 3 ou 6 mois, envoyée
// en image ou en lien (mychronos.fr/planning#p=…). Le planning voyage DANS le
// lien (partie après #, jamais transmise au serveur) : rien n'est stocké.
// Jamais de compteurs ; par défaut, le type d'absence est masqué (« Congé »,
// « Absent » au lieu de CA, RTC, CMO…).

import type { CycleConfig, HistoryEntry } from './types';
import {
  getPartialMinutesOnDate,
  hasAbsenceOnDate,
  hasAstreinteOnDate,
  hasCMOOnDate,
  hasPostedLeaveOnDate,
  isWorkingDay,
} from './calculations';
import { horairesDuJour } from './horaires';
import { etiquetteDuJour } from './typesConges';
import { decoderTransfert, encoderTransfert } from './transfert';

/** Nature d'un jour : T travail, R repos, C congé, P congé partiel (quelques heures), A absent. */
export type NatureJourPartage = 'T' | 'R' | 'C' | 'P' | 'A';

export interface PlanningPartage {
  v: 1;
  titre?: string;
  /** Premier mois ('YYYY-MM'). */
  du: string;
  /** Nombre de mois (1, 3 ou 6). */
  mois: number;
  /** Date du partage (ISO). */
  le: string;
  /** Nature de chaque jour, un caractère par jour depuis le 1er du premier mois. */
  j: string;
  /** Étiquettes des jours (indice → « CA », « RTC 4h », « Congé »…). */
  l?: Record<number, string>;
  /** Horaires des jours travaillés (indice → « 07:00–19:08 »), si demandés. */
  h?: Record<number, string>;
}

export interface OptionsPartage {
  mois: 1 | 3 | 6;
  titre?: string;
  masquerTypes: boolean;
  horaires: boolean;
}

export const ORIGINE_PARTAGE = 'https://mychronos.fr';

const hhmm = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const cleMois = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

/** Photo du planning à partir du 1er du mois de `debut`. */
export function photoPlanning(
  cfg: CycleConfig,
  history: HistoryEntry[],
  debut: Date,
  options: OptionsPartage,
  maintenant: Date = new Date()
): PlanningPartage {
  const premier = new Date(debut.getFullYear(), debut.getMonth(), 1);
  const fin = new Date(premier.getFullYear(), premier.getMonth() + options.mois, 0);
  let j = '';
  const l: Record<number, string> = {};
  const h: Record<number, string> = {};
  let i = 0;
  for (const d = new Date(premier); d <= fin; d.setDate(d.getDate() + 1), i++) {
    const travaille = isWorkingDay(d, cfg);
    let nature: NatureJourPartage;
    if (hasCMOOnDate(d, history) || hasAbsenceOnDate(d, history)) nature = 'A';
    else if (hasPostedLeaveOnDate(d, history)) nature = 'C';
    else if (getPartialMinutesOnDate(d, history) > 0) nature = 'P';
    else if (travaille || hasAstreinteOnDate(d, history)) nature = 'T';
    else nature = 'R';
    j += nature;

    if (nature === 'C' || nature === 'A' || nature === 'P') {
      const etiquette = etiquetteDuJour(d, history)?.texte;
      l[i] = options.masquerTypes
        ? nature === 'A' ? 'Absent' : nature === 'P' ? 'Congé (heures)' : 'Congé'
        : etiquette ?? (nature === 'A' ? 'Absent' : 'Congé');
    } else if (nature === 'T' && !travaille) {
      // Astreinte sur un repos : travaillé ce jour-là
      l[i] = 'Astreinte';
    }
    if (options.horaires && (nature === 'T' || nature === 'P') && travaille) {
      const hj = horairesDuJour(d, cfg);
      if (hj.heureDebut !== undefined) h[i] = `${hhmm(hj.heureDebut)}–${hhmm(hj.heureDebut + hj.duree)}`;
    }
  }
  const titre = options.titre?.trim();
  return {
    v: 1,
    ...(titre && { titre: titre.slice(0, 60) }),
    du: cleMois(premier),
    mois: options.mois,
    le: maintenant.toISOString(),
    j,
    ...(Object.keys(l).length && { l }),
    ...(Object.keys(h).length && { h }),
  };
}

/** Lien à envoyer : le planning compressé dans la partie après « # ». */
export async function lienPartage(p: PlanningPartage, origine: string = ORIGINE_PARTAGE): Promise<string> {
  return `${origine}/planning#p=${await encoderTransfert(JSON.stringify(p))}`;
}

/** Lit le planning depuis le « # » du lien ; null si illisible. */
export async function lirePartage(hash: string): Promise<PlanningPartage | null> {
  const m = /[#&]?p=([^&]+)/.exec(hash);
  if (!m) return null;
  try {
    const p = JSON.parse(await decoderTransfert(decodeURIComponent(m[1]!))) as PlanningPartage;
    if (p?.v !== 1 || typeof p.j !== 'string' || !/^\d{4}-\d{2}$/.test(p.du) || !/^[TRCPA]*$/.test(p.j)) return null;
    return p;
  } catch {
    return null;
  }
}

export interface JourPartage {
  date: Date;
  nature: NatureJourPartage;
  etiquette?: string;
  horaires?: string;
}

/** Jours d'un mois de la photo (0 = premier mois). */
export function joursDuMois(p: PlanningPartage, rang: number): JourPartage[] {
  const [a, m] = p.du.split('-').map(Number);
  const premierDuMois = new Date(a!, m! - 1 + rang, 1);
  const origine = new Date(a!, m! - 1, 1);
  const out: JourPartage[] = [];
  for (const d = new Date(premierDuMois); d.getMonth() === premierDuMois.getMonth(); d.setDate(d.getDate() + 1)) {
    const i = Math.round((d.getTime() - origine.getTime()) / 86_400_000);
    const nature = (p.j[i] ?? 'R') as NatureJourPartage;
    out.push({ date: new Date(d), nature, ...(p.l?.[i] && { etiquette: p.l[i] }), ...(p.h?.[i] && { horaires: p.h[i] }) });
  }
  return out;
}

export const MOIS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

/** « novembre 2026 » ou « novembre 2026 → janvier 2027 ». */
export function periodePartage(p: PlanningPartage): string {
  const [a, m] = p.du.split('-').map(Number);
  const debut = new Date(a!, m! - 1, 1);
  const fin = new Date(a!, m! - 1 + p.mois - 1, 1);
  const lib = (d: Date) => `${MOIS_FR[d.getMonth()]} ${d.getFullYear()}`;
  return p.mois === 1 ? lib(debut) : `${lib(debut)} → ${lib(fin)}`;
}

/** Couleurs communes à l'image et à la page (mêmes teintes que le planning). */
export const COULEURS_PARTAGE: Record<NatureJourPartage, { fond: string; texte: string; nom: string }> = {
  T: { fond: '#e6effc', texte: '#1d4ed8', nom: 'Travail' },
  R: { fond: '#ffffff', texte: '#64748b', nom: 'Repos' },
  C: { fond: '#d1fae5', texte: '#047857', nom: 'Congé' },
  P: { fond: '#ecfdf5', texte: '#047857', nom: 'Congé (heures)' },
  A: { fond: '#f1f5f9', texte: '#475569', nom: 'Absent' },
};
