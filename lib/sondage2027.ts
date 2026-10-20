// Sondage « Préparons 2027 » : avant la bascule du 1er janvier 2027, chaque
// agent vérifie les dotations que l'app lui créditera pour SON cycle (CA, RTC,
// CF, ARTT/RTT), les confirme ou les corrige d'après son relevé GesTT.
//
// - Pour l'agent : ses chiffres corrigés sont crédités au 1er janvier 2027 à la
//   place de la grille, et le compteur ARTT en double (agent en cycle) est réglé.
// - Pour l'éditeur : réponses anonymes regroupées par profil (cycle, durée,
//   horaires) ; le serveur cesse de poser la question à un profil dès qu'il a
//   assez de réponses (cf. lib/server/sondage-store.ts).

import type { Counters, CycleConfig, CompteurSondage, ReponseSondage, UserData } from './types';
import { ARTT_QUOTA_ANNUEL, CF_TOTAL_ANNUEL, RTT_QUOTA_HEBDO } from './constants';
import { getCATotalForCycle, getRTCAnnuel } from './calculations';
import { typeDeVacation } from './rps';

/** Année préparée par le sondage. */
export const SONDAGE_ANNEE = 2027;
/** « Plus tard » : reproposé au plus une fois, pas avant 3 jours. */
export const SONDAGE_MAX_REPORTS = 2;
const DELAI_REPORT_JOURS = 3;

/** Compteurs en jours ; les autres sont en minutes. */
export const COMPTEURS_EN_JOURS: ReadonlySet<CompteurSondage> = new Set(['ca', 'artt', 'rtt']);

const hhmm = (m: number) => `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}`;
const jourCle = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * Profil anonyme du cycle, clé de regroupement des réponses :
 * « alterne|2/2/3/2/2/3|12h08|nuit », « hebdo|-|8h00|- ». Jamais de date.
 */
export function profilSondage(cfg: CycleConfig): string {
  const duree = hhmm(cfg.heuresParJour);
  if (cfg.type === 'hebdo') return `hebdo|-|${duree}|-`;
  const horaire = cfg.horairesRotation
    ? 'rotation'
    : cfg.heureDebut === undefined
      ? 'inconnu'
      : typeDeVacation(cfg.heureDebut, cfg.heuresParJour);
  return `alterne|${cfg.pattern ?? '-'}|${duree}|${horaire}`;
}

/** Libellé lisible du profil (« 2/2/3 · nuit · 12h08 »). */
export function libelleProfil(cfg: CycleConfig): string {
  const duree = hhmm(cfg.heuresParJour);
  if (cfg.type === 'hebdo') return `Hebdomadaire · ${duree}`;
  const motif = (cfg.pattern ?? 'Cycle').replace('2/2/3/2/2/3', '2/2/3');
  const p = profilSondage(cfg).split('|')[3];
  const horaire = { jour: 'jour', nuit: 'nuit', mixte: 'horaires mixtes', rotation: 'horaires en rotation', inconnu: '' }[p ?? ''] ?? '';
  return [motif, horaire, duree].filter(Boolean).join(' · ');
}

export interface DotationPrevue {
  compteur: CompteurSondage;
  /** Jours (CA, ARTT, RTT) ou minutes (RTC, CF). */
  valeur: number;
}

/**
 * Ce que l'app créditera au 1er janvier, selon la grille et les compteurs
 * actifs. Les ARTT d'un agent en cycle sont traités à part (question dédiée).
 */
export function dotationsPrevues(cfg: CycleConfig, c: Counters): DotationPrevue[] {
  const d: DotationPrevue[] = [{ compteur: 'ca', valeur: getCATotalForCycle(cfg) }];
  if (cfg.type === 'hebdo') {
    if (c.hasARTT) d.push({ compteur: 'artt', valeur: ARTT_QUOTA_ANNUEL });
    if (c.hasRTT) d.push({ compteur: 'rtt', valeur: RTT_QUOTA_HEBDO });
  } else {
    if (c.hasRTC !== false) d.push({ compteur: 'rtc', valeur: getRTCAnnuel(cfg) });
    if (c.hasCF !== false) d.push({ compteur: 'cf', valeur: CF_TOTAL_ANNUEL });
  }
  return d;
}

/** Agent en cycle avec un compteur ARTT : souvent ses RTC saisis deux fois. */
export function questionArtt(cfg: CycleConfig, c: Counters): boolean {
  return cfg.type !== 'hebdo' && c.hasARTT;
}

/**
 * Le sondage peut-il être proposé à l'ouverture ? (Le serveur dit ensuite si
 * ce profil a encore besoin de réponses.) Jamais après le 31 décembre 2026,
 * ni à un agent qui a répondu, ni plus de deux fois.
 */
export function sondageAProposer(
  data: Pick<UserData, 'isOnboarded' | 'compteursARenseigner' | 'sondage2027'>,
  maintenant: Date = new Date()
): boolean {
  if (maintenant.getFullYear() >= SONDAGE_ANNEE) return false;
  if (!data.isOnboarded || data.compteursARenseigner) return false;
  const s = data.sondage2027;
  if (s?.reponse) return false;
  if (s?.plusTard) {
    if (s.plusTard.fois >= SONDAGE_MAX_REPORTS) return false;
    const limite = new Date(maintenant);
    limite.setDate(limite.getDate() - DELAI_REPORT_JOURS);
    if (s.plusTard.dernier > jourCle(limite)) return false;
  }
  return true;
}

/** Options de la bascule annuelle tirées du sondage (cf. compteursNouvelleAnnee). */
export interface OptionsNouvelleAnnee {
  /** Dotations corrigées par l'agent, à créditer à la place de la grille. */
  perso?: Partial<Record<CompteurSondage, number>>;
  /** Compteur ARTT d'un agent en cycle : le même que ses RTC, distinct, ou inconnu. */
  arttCycle?: ReponseSondage['artt'];
  /** Jours d'ARTT au 1er janvier, si le compteur est distinct. */
  arttJours?: number;
}

/**
 * Ce que la réponse change pour la bascule de `annee` : les chiffres corrigés
 * ne valent que pour 2027 (crédit GesTT du 1er janvier 2026, qui peut changer
 * ensuite) ; la réponse sur le compteur ARTT vaut durablement.
 */
export function optionsBascule(data: Pick<UserData, 'sondage2027'>, annee: number): OptionsNouvelleAnnee {
  const r = data.sondage2027?.reponse;
  if (!r) return {};
  return {
    ...(annee === SONDAGE_ANNEE && r.reponse === 'corrige' && r.appliquer && r.dotations && { perso: r.dotations }),
    ...(r.artt && { arttCycle: r.artt }),
    ...(r.artt === 'distinct' && r.arttJours !== undefined && { arttJours: r.arttJours }),
  };
}

/** Jour local ('YYYY-MM-DD'), pour dater une réponse ou un report. */
export function aujourdhuiCle(d: Date = new Date()): string {
  return jourCle(d);
}
