// Simulation du 1er janvier 2027 pour chaque profil de cycle vu dans les
// statistiques anonymes (semaine du 13 au 19 octobre 2026) : l'app est ouverte
// le 1er janvier au matin, la bascule passe par migrateUserData comme en vrai.
// Les dotations attendues viennent de la grille officielle, pas du code.

import { describe, it, expect, afterEach, vi } from 'vitest';
import { migrateUserData, DEFAULT_COUNTERS, SCHEMA_VERSION } from '../storage';
import type { Counters, CycleConfig, UserData } from '../types';

afterEach(() => vi.useRealTimers());

const h = (a: number, b = 0) => a * 60 + b;
const S = { lundi: true, mardi: true, mercredi: true, jeudi: true, vendredi: true, samedi: false, dimanche: false };
const RTC_12H08 = h(188, 9);
const RTC_11H08 = h(53, 27);
const RTC_4_2 = h(41, 45);
const CF = h(109, 12);

type Profil = { nom: string; cfg: CycleConfig; ca: number; rtc?: number; hebdo?: boolean };

const cycle = (pattern: CycleConfig['pattern'], duree: number, debut: number, extra: Partial<CycleConfig> = {}): CycleConfig => ({
  type: 'alterne', pattern, heuresParJour: duree, heureDebut: debut,
  dateDebutCycle: '2026-01-05', semaineActuelle: 'A', semaineA: S, semaineB: S, ...extra,
});
const ROTATION = {
  horairesRotation: {
    jeux: [{ nom: 'Soirée', heureDebut: h(10, 30), duree: h(11, 8) }, { nom: 'Matinée', heureDebut: h(6, 30), duree: h(11, 8) }],
    sequence: [0, 0, 1], periodeJours: 14, dateReference: '2026-01-05',
  },
};
const hebdo = (jour: number, vendredi: number): CycleConfig => ({
  type: 'hebdo', heuresParJour: jour, dateDebutCycle: '2026-01-05', semaineActuelle: 'A', semaineA: S, semaineB: S,
  heuresSemaine: { lundi: jour, mardi: jour, mercredi: jour, jeudi: jour, vendredi, samedi: 0, dimanche: 0 },
});

// Profils réels (nombre d'utilisateurs actifs sur la semaine), regroupés.
const PROFILS: Profil[] = [
  // 2/2/3 en 12h08 : jour (418), nuit (307), mixte (20), sans horaires (12)
  { nom: '2/2/3 12h08 jour', cfg: cycle('2/2/3/2/2/3', h(12, 8), h(7)), ca: 18, rtc: RTC_12H08 },
  { nom: '2/2/3 12h08 nuit', cfg: cycle('2/2/3/2/2/3', h(12, 8), h(19)), ca: 18, rtc: RTC_12H08 },
  { nom: '2/2/3 12h08 sans horaires', cfg: { ...cycle('2/2/3/2/2/3', h(12, 8), 0), heureDebut: undefined }, ca: 18, rtc: RTC_12H08 },
  // 2/2/3 en 11h08 : mixte = horaires en rotation (214), jour (111), nuit (17)
  { nom: '2/2/3 11h08 rotation soirée/matinée', cfg: cycle('2/2/3/2/2/3', h(11, 8), h(10, 30), ROTATION), ca: 18, rtc: RTC_11H08 },
  { nom: '2/2/3 11h08 jour', cfg: cycle('2/2/3/2/2/3', h(11, 8), h(7)), ca: 18, rtc: RTC_11H08 },
  { nom: '2/2/3 11h08 nuit', cfg: cycle('2/2/3/2/2/3', h(11, 8), h(19)), ca: 18, rtc: RTC_11H08 },
  // 3/3 : 12h08 nuit (130), 11h08 nuit (28), 11h08 mixte (12), 12h08 jour (7)
  { nom: '3/3 12h08 nuit', cfg: cycle('3/3', h(12, 8), h(19)), ca: 18, rtc: RTC_12H08 },
  { nom: '3/3 12h08 jour', cfg: cycle('3/3', h(12, 8), h(7)), ca: 18, rtc: RTC_12H08 },
  { nom: '3/3 11h08 nuit', cfg: cycle('3/3', h(11, 8), h(19)), ca: 18, rtc: RTC_11H08 },
  // 4/2 en 8h10 (29) ; 2/2 nuit 12h08 (1)
  { nom: '4/2 8h10', cfg: cycle('4/2', h(8, 10), h(6)), ca: 23, rtc: RTC_4_2 },
  { nom: '2/2 12h08 nuit', cfg: cycle('2/2', h(12, 8), h(19)), ca: 18, rtc: RTC_12H08 },
  // Durées hors grille déclarées : au-dessus de 11h38 → colonne 12h08, sinon 11h08
  { nom: '2/2/3 12h00 nuit', cfg: cycle('2/2/3/2/2/3', h(12), h(19)), ca: 18, rtc: RTC_12H08 },
  { nom: '2/2/3 12h38 jour', cfg: cycle('2/2/3/2/2/3', h(12, 38), h(6, 30)), ca: 18, rtc: RTC_12H08 },
  { nom: '2/2/3 11h38 jour', cfg: cycle('2/2/3/2/2/3', h(11, 38), h(7)), ca: 18, rtc: RTC_11H08 },
  { nom: '2/2/3 10h45 jour', cfg: cycle('2/2/3/2/2/3', h(10, 45), h(7)), ca: 18, rtc: RTC_11H08 },
  // Hebdomadaire : 8h00 (42), 7h53 (7)
  { nom: 'hebdo 8h00', cfg: hebdo(h(8), h(7, 25)), ca: 25, hebdo: true },
  { nom: 'hebdo 7h53', cfg: hebdo(h(7, 53), h(7, 53)), ca: 25, hebdo: true },
];

// Soldes de fin 2026 quelconques.
function finAnnee(hebdoProfil: boolean, extra: Partial<Counters> = {}): Counters {
  return {
    ...DEFAULT_COUNTERS,
    ca: 4, caHP: 1, caPosesHorsPeriode: 6, caConsommes: 14, cf: h(3), cfConsoS1: h(54), cfConsoS2: h(52),
    rtc: h(20), rps: h(45, 12), hs: h(30), cet: 22, caAnterieur: 2, caHPAnterieur: 1,
    hasCF: !hebdoProfil, hasRTC: !hebdoProfil, hasARTT: hebdoProfil, hasRTT: hebdoProfil,
    artt: hebdoProfil ? 3 : 0, rtt: hebdoProfil ? 2 : undefined,
    rpsDernierCredit: '2026-12-31',
    ...extra,
  } as Counters;
}

function ouvrirLe1erJanvier(cfg: CycleConfig, counters: Counters, history: UserData['history'] = []): UserData {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2027, 0, 1, 8));
  const data: UserData = {
    cycleConfig: cfg, counters, history, isOnboarded: true,
    lastUpdated: '2026-12-31T20:00:00.000Z', lastResetYear: 2026, schemaVersion: SCHEMA_VERSION,
  };
  return migrateUserData(structuredClone(data));
}

describe('1er janvier 2027 : dotations de chaque cycle utilisé', () => {
  it.each(PROFILS.map((p) => [p.nom, p] as const))('%s', (_nom, p) => {
    const avant = finAnnee(!!p.hebdo);
    const apres = ouvrirLe1erJanvier(p.cfg, avant);
    const c = apres.counters;

    // Dotations de la grille
    expect(c.ca).toBe(p.ca);
    if (p.hebdo) {
      expect(c.artt).toBe(20);
      expect(c.rtt).toBe(16);
    } else {
      expect(c.cf).toBe(CF);
      expect(c.rtc).toBe(p.rtc);
    }

    // Reports et remises à zéro
    expect(c.caAnterieur).toBe(avant.ca); // 4 CA restants → à poser avant le 30 avril
    expect(c.caHPAnterieur).toBe(avant.caHP);
    expect(c).toMatchObject({ caHP: 0, caPosesHorsPeriode: 0, caConsommes: 0, cfConsoS1: 0, cfConsoS2: 0 });
    // Ce qui se conserve
    expect(c).toMatchObject({ rps: avant.rps, hs: avant.hs, cet: avant.cet });
    // Reliquat noté pour le versement au CET de janvier, au titre de 2026
    expect(apres.reliquatCET).toMatchObject({ annee: 2026, rtc: p.hebdo ? 0 : avant.rtc });
    // Une seule bascule, et le message « vérifiez vos nouveaux quotas »
    expect(apres.lastResetYear).toBe(2027);
    expect(apres.basculeAConfirmer).toBe(2027);
  });

  it('rouvrir l’app le même jour ne rebascule pas (pas de double crédit)', () => {
    const p = PROFILS[0]!;
    const une = ouvrirLe1erJanvier(p.cfg, finAnnee(false));
    const deux = migrateUserData(structuredClone({ ...une, counters: { ...une.counters, ca: 10 } }));
    expect(deux.counters.ca).toBe(10);
    expect(deux.counters.caAnterieur).toBe(4);
  });

  it('congés de 2027 posés à l’avance : déduits des nouveaux droits', () => {
    const p = PROFILS[0]!;
    const apres = ouvrirLe1erJanvier(p.cfg, finAnnee(false), [{
      id: 'x', date: new Date(2027, 1, 2).toISOString(), dateEnd: new Date(2027, 1, 3).toISOString(),
      action: 'pose', type: 'ca', amount: 2, countersSnapshot: {}, decompte: 'differe', anneeDecompte: 2027,
    }]);
    expect(apres.counters.ca).toBe(16);
    expect(apres.history[0]).toMatchObject({ decompteApplique: true });
  });

  it('agent qui a changé de cycle en 2026 : dotation pleine du nouveau cycle en 2027', () => {
    const ancien = cycle('2/2/3/2/2/3', h(11, 8), h(7));
    const nouveau = { ...cycle('3/3', h(12, 8), h(19)), appliqueDepuis: '2026-07-01', droitsAnnee: { annee: 2026, ca: 18, rtc: h(120) },
      cyclesAnterieurs: [{ fin: '2026-06-30', config: ancien }] } as CycleConfig;
    const c = ouvrirLe1erJanvier(nouveau, finAnnee(false)).counters;
    expect(c.rtc).toBe(RTC_12H08);
    expect(c.ca).toBe(18);
  });

  it('élève sans CET, élu, congés bonifiés : options conservées', () => {
    const p = PROFILS[0]!;
    const c = ouvrirLe1erJanvier(p.cfg, finAnnee(false, {
      sansCET: true, cmeTrimestre: h(36), hasCongesBonifies: true, congesBonifies: 31,
    } as Partial<Counters>)).counters;
    expect(c).toMatchObject({ sansCET: true, cmeTrimestre: h(36), hasCongesBonifies: true, congesBonifies: 31 });
  });

  it('report de RPS : le solde de fin d’année devient le « report année précédente »', () => {
    const c = ouvrirLe1erJanvier(PROFILS[0]!.cfg, finAnnee(false)).counters;
    expect(c.rpsAnneePrec).toBe(h(45, 12));
  });
});

describe('Agent en cycle ayant gardé un compteur ARTT (≈ 16 % des agents en cycle, octobre 2026)', () => {
  it('constat : il reçoit 20 jours d’ARTT EN PLUS des RTC (les mêmes heures, appelées ARTT dans la grille)', () => {
    const c = ouvrirLe1erJanvier(PROFILS[0]!.cfg, finAnnee(false, { hasARTT: true, artt: 5 })).counters;
    expect(c.rtc).toBe(RTC_12H08);
    expect(c.artt).toBe(20);
  });
});
