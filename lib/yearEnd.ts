// Bilan de fin d'année : ce qui sera réellement perdu au 31/12 si rien n'est fait.
//
// Le point clé : le CET n'accepte que 15 jours par an (et 60 au total). Les sources
// se disputent donc ces places. Si 10 jours partent en RTC, il ne reste que 5 places :
// inutile de « garder 5 CA pour le CET », ils ne rentreront pas — il faut les poser.
// À l'inverse, les CA que l'agent a explicitement sécurisés (`caReservesCET`) ne
// doivent jamais apparaître comme « à solder ».

import { Counters, CycleConfig, CounterType } from './types';
import {
  CET_PLAFOND,
  CET_APPORT_ANNUEL_MAX,
  CA_MAX_VERS_CET,
  HS_MAX_VERS_CET,
  RTC_MAX_JOURS_CET,
  RTC_COUT_PAR_JOUR_CET,
  RTC_RESERVES_CET,
  HEURES_PAR_JOUR,
  CF_PAR_SEMESTRE,
} from './constants';
import { formatMinutes, getCurrentSemester } from './calculations';

/** Le bilan s'active à partir de ce mois (0 = janvier). Septembre. */
export const BILAN_MOIS_DEBUT = 8;

export interface YearEndItem {
  type: CounterType;
  label: string;
  /** Solde restant, dans l'unité du compteur. */
  solde: number;
  unite: 'jours' | 'heures';
  /** Jours qui partiront au CET depuis ce compteur (0 si non éligible). */
  versCET: number;
  /** Reste à poser avant le 31/12, dans l'unité du compteur. */
  aSolder: number;
  /** Équivalent en journées de travail à poser (pour le total). */
  joursASolder: number;
  /** Pourquoi ce compteur est concerné. */
  raison: string;
}

export interface YearEndBalance {
  /** true à partir du 1er septembre. */
  actif: boolean;
  joursRestants: number;
  /** Places encore disponibles au CET cette année. */
  capaciteCET: number;
  apportCET: { rtc: number; caHP: number; ca: number; hs: number; total: number };
  /** Compteurs ayant encore quelque chose à solder, du plus urgent au moins. */
  items: YearEndItem[];
  /** Total de journées de travail à couvrir avant le 31/12. */
  joursASolder: number;
}

/** Nombre de jours calendaires jusqu'au 31 décembre. */
function joursJusquAu31Decembre(date: Date): number {
  const fin = new Date(date.getFullYear(), 11, 31);
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.max(0, Math.round((fin.getTime() - d.getTime()) / 86_400_000));
}

/**
 * Répartit les places disponibles au CET entre les sources éligibles.
 *
 * Ordre : d'abord les CA que l'agent a explicitement sécurisés (son intention
 * prime), puis l'ordre avantageux par défaut — RTC (gain 3h47/jour), CA HP,
 * CA restants, HS.
 */
function repartirCET(counters: Counters) {
  const capacite = Math.max(0, Math.min(CET_PLAFOND - counters.cet, CET_APPORT_ANNUEL_MAX));
  const apport = { rtc: 0, caHP: 0, ca: 0, hs: 0, total: 0 };
  let reste = capacite;

  // 1. Intention explicite de l'agent : les CA sécurisés passent en premier.
  const reserve = Math.max(0, counters.caReservesCET ?? 0);
  apport.ca = Math.min(reserve, CA_MAX_VERS_CET, counters.ca, reste);
  reste -= apport.ca;

  // 2. RTC — la conversion la plus avantageuse (8h21 payés pour 12h08 de valeur).
  if (reste > 0) {
    apport.rtc = Math.min(RTC_MAX_JOURS_CET, Math.floor(counters.rtc / RTC_COUT_PAR_JOUR_CET), reste);
    reste -= apport.rtc;
  }

  // 3. CA HP (bonus déjà acquis, non reportable autrement).
  if (reste > 0) {
    apport.caHP = Math.min(counters.caHP, reste);
    reste -= apport.caHP;
  }

  // 4. CA restants, dans la limite des 5 jours annuels tous CA confondus.
  if (reste > 0) {
    const encoreCA = Math.max(0, CA_MAX_VERS_CET - apport.ca);
    const supplement = Math.min(encoreCA, counters.ca - apport.ca, reste);
    apport.ca += supplement;
    reste -= supplement;
  }

  // 5. HS.
  if (reste > 0) {
    apport.hs = Math.min(HS_MAX_VERS_CET, Math.floor(counters.hs / HEURES_PAR_JOUR), reste);
    reste -= apport.hs;
  }

  apport.total = apport.rtc + apport.caHP + apport.ca + apport.hs;
  return { capacite, apport };
}

/**
 * Calcule ce qu'il reste à solder avant le 31/12, une fois déduit ce qui partira
 * réellement au CET.
 */
export function calculateYearEndBalance(
  counters: Counters,
  cycleConfig: CycleConfig,
  currentDate: Date = new Date()
): YearEndBalance {
  const { capacite, apport } = repartirCET(counters);
  const jourMin = cycleConfig.heuresParJour || HEURES_PAR_JOUR;
  const items: YearEndItem[] = [];

  const pushJours = (type: CounterType, label: string, solde: number, versCET: number, raison: string) => {
    const aSolder = Math.max(0, solde - versCET);
    if (aSolder > 0) {
      items.push({ type, label, solde, unite: 'jours', versCET, aSolder, joursASolder: aSolder, raison });
    }
  };
  const pushHeures = (type: CounterType, label: string, solde: number, versCETMinutes: number, raison: string) => {
    const aSolder = Math.max(0, solde - versCETMinutes);
    if (aSolder > 0) {
      items.push({
        type, label, solde, unite: 'heures', versCET: Math.round(versCETMinutes / jourMin),
        aSolder, joursASolder: Math.round((aSolder / jourMin) * 10) / 10, raison,
      });
    }
  };

  // ── CA : perdus au 31/12, sauf ceux qui partiront au CET ────────────────────
  pushJours(
    'ca', 'Congés annuels', counters.ca, apport.ca,
    apport.ca > 0
      ? `${apport.ca}j partiront au CET, le reste est perdu au 31/12`
      : `Aucune place au CET cette année (${capacite} dispo, déjà prises) — tout est à poser`
  );

  // ── CA HP : bonus non reportable ────────────────────────────────────────────
  pushJours('caHP', 'CA hors période', counters.caHP, apport.caHP, 'Bonus perdu au 31/12 s\'il n\'est ni posé ni épargné');

  // ── RTC : les jours au-delà de ce qui part au CET sont perdus ───────────────
  if (counters.hasRTC !== false) {
    pushHeures(
      'rtc', 'RTC', counters.rtc, apport.rtc * RTC_COUT_PAR_JOUR_CET,
      apport.rtc > 0
        ? `${apport.rtc}j convertis au CET (${formatMinutes(apport.rtc * RTC_COUT_PAR_JOUR_CET)}), le reste est perdu`
        : `Perdus au 31/12 — la réserve de ${formatMinutes(RTC_RESERVES_CET)} ne sert que si le CET a de la place`
    );
  }

  // ── CF : crédit du semestre en cours, perdu au 31/12 ────────────────────────
  if (counters.hasCF !== false && getCurrentSemester(currentDate) === 2) {
    const resteS2 = Math.max(0, Math.min(counters.cf, CF_PAR_SEMESTRE - counters.cfConsoS2));
    if (resteS2 > 0) {
      pushHeures('cf', 'Crédits fériés', resteS2, 0, 'Non reportables — à consommer avant le 31/12');
    }
  }

  // ── ARTT / RTT : perdus au 31/12 ────────────────────────────────────────────
  if (counters.hasARTT && (counters.artt ?? 0) > 0) {
    pushJours('artt', 'ARTT', counters.artt ?? 0, 0, 'Perdus au 31/12 s\'ils ne sont pas posés');
  }
  if (counters.hasRTT && (counters.rtt ?? 0) > 0) {
    pushJours('rtt', 'RTT', counters.rtt ?? 0, 0, 'Perdus au 31/12 s\'ils ne sont pas posés');
  }

  // ── HS : seulement le surplus au-delà du plafond stockable ──────────────────
  // Les HS se conservent ; on ne les signale donc pas comme « perdues ».

  const joursASolder = Math.round(items.reduce((s, i) => s + i.joursASolder, 0) * 10) / 10;

  return {
    actif: currentDate.getMonth() >= BILAN_MOIS_DEBUT,
    joursRestants: joursJusquAu31Decembre(currentDate),
    capaciteCET: capacite,
    apportCET: apport,
    items: items.sort((a, b) => b.joursASolder - a.joursASolder),
    joursASolder,
  };
}

/** Résumé court, pour un bandeau ou une notification. */
export function formatYearEndSummary(bilan: YearEndBalance): string {
  if (bilan.items.length === 0) return 'Rien à solder — tous vos compteurs non reportables sont à jour.';
  const detail = bilan.items
    .slice(0, 3)
    .map((i) => (i.unite === 'jours' ? `${i.aSolder}j ${i.label}` : `${formatMinutes(i.aSolder)} ${i.label}`))
    .join(' · ');
  const suite = bilan.items.length > 3 ? ` (+${bilan.items.length - 3})` : '';
  return `${detail}${suite}`;
}
