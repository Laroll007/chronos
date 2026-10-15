// Bascule du 1er janvier : chaque cycle reçoit les dotations de la grille
// officielle selon son rythme et la durée de ses vacations. Les horaires (jour,
// nuit, rotation soirée/matinée) ne changent pas les dotations, seulement les
// RPS (crédités au fil des vacations, pas au 1er janvier).

import { describe, it, expect } from 'vitest';
import { compteursNouvelleAnnee, DEFAULT_COUNTERS } from '../storage';
import type { Counters, CycleConfig } from '../types';

const h = (a: number, b = 0) => a * 60 + b;
const S = { lundi: true, mardi: true, mercredi: true, jeudi: true, vendredi: true, samedi: false, dimanche: false };
const base = { dateDebutCycle: '2026-01-05', semaineActuelle: 'A' as const, semaineA: S, semaineB: S };
const cycle = (pattern: CycleConfig['pattern'], duree: number, heureDebut = h(7), extra: Partial<CycleConfig> = {}): CycleConfig =>
  ({ ...base, type: 'alterne', pattern, heuresParJour: duree, heureDebut, ...extra });
const ROTATION = {
  horairesRotation: {
    jeux: [{ nom: 'Soirée', heureDebut: h(10, 30), duree: h(12, 8) }, { nom: 'Matinée', heureDebut: h(6, 30), duree: h(12, 8) }],
    sequence: [0, 0, 1], periodeJours: 14, dateReference: '2026-01-05',
  },
};

const R188 = h(188, 9);
const R53 = h(53, 27);
const R41 = h(41, 45);
const CF = h(109, 12);

// Soldes de fin d'année quelconques : la bascule les remplace par les dotations.
const finAnnee = (flags: Partial<Counters>): Counters =>
  ({ ...DEFAULT_COUNTERS, ...flags, ca: 3, caHP: 1, cf: 100, rtc: 100, artt: 2, rtt: 1, rps: 500, hs: 600, cet: 12 }) as Counters;
const CYCLE = { hasCF: true, hasRTC: true, hasARTT: false, hasRTT: false };

const CAS: [string, CycleConfig, { ca: number; rtc: number }][] = [
  ['2/2/3/2/2/3 en 12h08 (jour)', cycle('2/2/3/2/2/3', h(12, 8)), { ca: 18, rtc: R188 }],
  ['2/2/3/2/2/3 en 12h08 (nuit)', cycle('2/2/3/2/2/3', h(12, 8), h(19)), { ca: 18, rtc: R188 }],
  ['2/2/3/2/2/3 en 11h08', cycle('2/2/3/2/2/3', h(11, 8)), { ca: 18, rtc: R53 }],
  ['2/2/3/2/2/3 horaires en rotation (soirée/matinée)', cycle('2/2/3/2/2/3', h(12, 8), h(10, 30), ROTATION), { ca: 18, rtc: R188 }],
  ['3/3 en 12h08 (jour)', cycle('3/3', h(12, 8)), { ca: 18, rtc: R188 }],
  ['3/3 en 12h08 (nuit)', cycle('3/3', h(12, 8), h(19, 30)), { ca: 18, rtc: R188 }],
  ['3/3 en 11h08', cycle('3/3', h(11, 8), h(19)), { ca: 18, rtc: R53 }],
  ['2/2 en 12h08', cycle('2/2', h(12, 8)), { ca: 18, rtc: R188 }],
  ['2/2 en 11h08', cycle('2/2', h(11, 8)), { ca: 18, rtc: R53 }],
  ['4/2 en 12h08', cycle('4/2', h(12, 8)), { ca: 23, rtc: R41 }],
  ['4/2 en 11h08', cycle('4/2', h(11, 8)), { ca: 23, rtc: R41 }],
  ['4/2 compressé (8h10)', cycle('4/2', h(8, 10), h(6)), { ca: 23, rtc: R41 }],
];

describe('Bascule du 1er janvier : dotations par cycle', () => {
  it.each(CAS)('%s', (_nom, cfg, attendu) => {
    const n = compteursNouvelleAnnee(finAnnee(CYCLE), cfg);
    expect(n).toMatchObject({ ca: attendu.ca, cf: CF, rtc: attendu.rtc });
    // Reports et compteurs conservés
    expect(n).toMatchObject({ caAnterieur: 3, caHPAnterieur: 1, caHP: 0, caConsommes: 0, rps: 500, hs: 600, cet: 12 });
  });

  it('régime hebdomadaire : 25 CA, ARTT et RTT, ni CF ni RTC', () => {
    const hebdo: CycleConfig = {
      ...base, type: 'hebdo', heuresParJour: h(8),
      heuresSemaine: { lundi: h(8), mardi: h(8), mercredi: h(8), jeudi: h(8), vendredi: h(7, 25), samedi: 0, dimanche: 0 },
    };
    const n = compteursNouvelleAnnee(finAnnee({ hasCF: false, hasRTC: false, hasARTT: true, hasRTT: true }), hebdo);
    expect(n).toMatchObject({ ca: 25, artt: 20, rtt: 16, cf: 100, rtc: 100 }); // CF / RTC non crédités
  });

  it('seuil de la grille : jusqu’à 11h38 colonne 11h08, au-delà colonne 12h08', () => {
    expect(compteursNouvelleAnnee(finAnnee(CYCLE), cycle('2/2/3/2/2/3', h(11, 38))).rtc).toBe(R53);
    expect(compteursNouvelleAnnee(finAnnee(CYCLE), cycle('2/2/3/2/2/3', h(11, 39))).rtc).toBe(R188);
  });
});
