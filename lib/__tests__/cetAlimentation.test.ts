/**
 * Conditions d'alimentation du CET (guide APORTT « Gestion du temps de travail »).
 *
 * Deux règles que l'app ignorait :
 *  - « L'alimentation du CET s'effectue entre le 1er et le 31 janvier pour les
 *    congés de l'année précédente. »
 *  - Épargner des CA suppose d'avoir pris « au moins 20 jours de congés annuels
 *    (CA, HP, CAA, HPA et CAM compris) ou 4/5e de leur dotation pour les
 *    cycliques ». Les deux formulations coïncident : 4/5 de 25 j valent 20.
 */
import { describe, it, expect } from 'vitest';
import {
  canEpargnerCA,
  countCAPosesAnnee,
  getSeuilCAPourEpargne,
  isPeriodeAlimentationCET,
} from '@/lib/cet';
import { DEFAULT_CYCLE_CONFIG, DEFAULT_COUNTERS } from '@/lib/storage';
import { calculateOptimalCETStrategy } from '@/lib/cet';
import { calculateYearEndBalance } from '@/lib/yearEnd';
import { DEFAULT_HEBDO_SCHEDULE, DEFAULT_HEBDO_HEURES } from '@/lib/types';
import type { CycleConfig, HistoryEntry, Counters } from '@/lib/types';

const CYCLIQUE = DEFAULT_CYCLE_CONFIG; // 18 CA
const HEBDO: CycleConfig = {
  type: 'hebdo',
  heuresParJour: 8 * 60,
  dateDebutCycle: '2026-01-05',
  semaineActuelle: 'A',
  semaineA: DEFAULT_HEBDO_SCHEDULE,
  semaineB: DEFAULT_HEBDO_SCHEDULE,
  heuresSemaine: DEFAULT_HEBDO_HEURES,
}; // 25 CA

const JANVIER = new Date(2027, 0, 15);
const SEPTEMBRE = new Date(2027, 8, 15);

/** `n` jours de congés posés en 2026, du type demandé. */
function poses(n: number, type: HistoryEntry['type'] = 'ca'): HistoryEntry[] {
  return [
    {
      id: 'e1',
      date: new Date(2026, 5, 10).toISOString(),
      action: 'pose',
      type,
      amount: n,
      countersSnapshot: {},
    },
  ];
}

describe('Fenêtre d’alimentation', () => {
  it('n’est ouverte qu’en janvier', () => {
    expect(isPeriodeAlimentationCET(new Date(2027, 0, 1))).toBe(true);
    expect(isPeriodeAlimentationCET(new Date(2027, 0, 31))).toBe(true);
    for (const mois of [1, 4, 8, 11]) {
      expect(isPeriodeAlimentationCET(new Date(2027, mois, 15)), `mois ${mois}`).toBe(false);
    }
  });

  it('bloque l’épargne hors janvier, même seuil atteint', () => {
    const v = canEpargnerCA(CYCLIQUE, poses(18), SEPTEMBRE);
    expect(v.ok).toBe(false);
    expect(v.fenetreOuverte).toBe(false);
    expect(v.raison).toContain('1er et le 31 janvier');
  });
});

describe('Seuil de congés pris', () => {
  it('vaut 4/5 de la dotation, arrondi au jour supérieur', () => {
    expect(getSeuilCAPourEpargne(CYCLIQUE)).toBe(15); // 4/5 × 18 = 14,4
    expect(getSeuilCAPourEpargne(HEBDO)).toBe(20); // 4/5 × 25 = 20, la valeur du texte
  });

  it('bloque l’épargne sous le seuil', () => {
    const v = canEpargnerCA(CYCLIQUE, poses(10), JANVIER);
    expect(v.ok).toBe(false);
    expect(v.poses).toBe(10);
    expect(v.seuil).toBe(15);
    expect(v.raison).toContain('15 jours');
  });

  it('autorise l’épargne au seuil exact', () => {
    expect(canEpargnerCA(CYCLIQUE, poses(15), JANVIER).ok).toBe(true);
  });

  it('compte les CA HP et les reports, pas seulement les CA ordinaires', () => {
    // « CA, HP, CAA, HPA et CAM compris »
    const history = [
      ...poses(12, 'ca'),
      ...poses(2, 'caHP').map((e) => ({ ...e, id: 'e2' })),
      ...poses(1, 'caAnterieur').map((e) => ({ ...e, id: 'e3' })),
    ];
    expect(countCAPosesAnnee(history, 2026)).toBe(15);
    expect(canEpargnerCA(CYCLIQUE, history, JANVIER).ok).toBe(true);
  });

  it('ignore les autres compteurs et les poses à l’heure', () => {
    const history = [
      ...poses(20, 'cf'), // pas un congé annuel
      ...poses(15, 'ca').map((e) => ({ ...e, id: 'e2', partialDay: true })), // fraction de journée
    ];
    expect(countCAPosesAnnee(history, 2026)).toBe(0);
  });

  it('mesure sur l’année PRÉCÉDENTE, celle au titre de laquelle on épargne', () => {
    // Congés posés en 2027 : sans effet sur l'épargne de janvier 2027, qui porte
    // sur les congés de 2026.
    const history: HistoryEntry[] = [
      {
        id: 'x',
        date: new Date(2027, 0, 5).toISOString(),
        action: 'pose',
        type: 'ca',
        amount: 18,
        countersSnapshot: {},
      },
    ];
    const v = canEpargnerCA(CYCLIQUE, history, JANVIER);
    expect(v.poses).toBe(0);
    expect(v.ok).toBe(false);
  });
});

describe('Répartition de l’apport CET — source unique', () => {
  // Régression : la répartition existait en deux exemplaires — Projection du
  // Profil et bilan de fin d'année — et seul le second respectait les CA
  // sécurisés. Les deux écrans annonçaient des chiffres différents pour les
  // mêmes données.
  const C = (o: Partial<Counters> = {}): Counters => ({ ...DEFAULT_COUNTERS, ...o });

  it('le Profil et le bilan annoncent la même répartition', () => {
    for (const profil of [
      { ca: 18, caReservesCET: 5, rtc: 11229, caHP: 2, hs: 3000 },
      { ca: 18, rtc: 11229, caHP: 2 },
      { ca: 18, caReservesCET: 5, rtc: 0, hasRTC: false, caHP: 2, hs: 3000 },
      { ca: 0, rtc: 0, hasRTC: false, caHP: 0, hs: 0 },
      { ca: 18, cet: 58, rtc: 11229 },
    ]) {
      const c = C(profil);
      const proj = calculateOptimalCETStrategy(c).apportCET;
      const bil = calculateYearEndBalance(c, CYCLIQUE, new Date(2026, 8, 15)).apportCET;
      expect(proj, JSON.stringify(profil)).toEqual({
        rtc: bil.rtc, caHP: bil.caHP, ca: bil.ca, hs: bil.hs,
      });
    }
  });

  it('les CA sécurisés passent avant les RTC dans les deux écrans', () => {
    const c = C({ ca: 18, caReservesCET: 5, rtc: 11229, caHP: 2 });
    expect(calculateOptimalCETStrategy(c).apportCET.ca).toBe(5);
    expect(calculateYearEndBalance(c, CYCLIQUE, new Date(2026, 8, 15)).apportCET.ca).toBe(5);
  });
});
