// Lieu d'affectation : crédit férié (guide APORTT : 109h12, « sauf Moselle,
// Bas-Rhin, Haut-Rhin : 123h12 ; départements d'outre-mer : 116h12 ») et jours
// fériés locaux (Alsace-Moselle, abolition de l'esclavage dans les DOM).

import { describe, it, expect, afterEach, vi } from 'vitest';
import { cfAnnuel, cfParSemestre, estZone, feriesLocaux } from '../zones';
import { estFerie, joursFeries } from '../feries';
import { clearCalculationCaches, isWorkingDay } from '../calculations';
import { compteursNouvelleAnnee, DEFAULT_COUNTERS } from '../storage';
import { appliquerChangement, quotaCycle } from '../changementCycle';
import { dotationsPrevues } from '../sondage2027';
import { calculerDepartRetraite } from '../retraite';
import { validateUserData } from '../validation';
import type { Counters, CycleConfig } from '../types';

afterEach(() => { vi.useRealTimers(); clearCalculationCaches(); });

const h = (a: number, b = 0) => a * 60 + b;
const S = { lundi: true, mardi: true, mercredi: true, jeudi: true, vendredi: true, samedi: false, dimanche: false };
const cycle = (zone?: CycleConfig['zone']): CycleConfig => ({
  type: 'alterne', pattern: '2/2/3/2/2/3', heuresParJour: h(12, 8), heureDebut: h(7),
  dateDebutCycle: '2026-01-05', semaineActuelle: 'A', semaineA: S, semaineB: S, ...(zone && { zone }),
});
const hebdo = (zone?: CycleConfig['zone']): CycleConfig => ({
  type: 'hebdo', heuresParJour: h(8), dateDebutCycle: '2026-01-05', semaineActuelle: 'A', semaineA: S, semaineB: S,
  heuresSemaine: { lundi: h(8), mardi: h(8), mercredi: h(8), jeudi: h(8), vendredi: h(7, 25), samedi: 0, dimanche: 0 },
  ...(zone && { zone }),
});
const C = (o: Partial<Counters> = {}) => ({ ...DEFAULT_COUNTERS, hasCF: true, hasRTC: true, ...o }) as Counters;

describe('Crédit férié selon le lieu d’affectation', () => {
  it('109h12 en métropole, 123h12 en Alsace-Moselle, 116h12 dans les 5 DOM', () => {
    expect(cfAnnuel(undefined)).toBe(h(109, 12));
    expect(cfAnnuel('metropole')).toBe(h(109, 12));
    expect(cfAnnuel('alsace_moselle')).toBe(h(123, 12));
    for (const z of ['guadeloupe', 'guyane', 'martinique', 'mayotte', 'reunion'] as const) expect(cfAnnuel(z)).toBe(h(116, 12));
    expect(cfAnnuel('autre_om')).toBe(h(109, 12)); // non précisé par le guide
    expect(cfParSemestre('reunion')).toBe(h(58, 6));
    expect(cfParSemestre(undefined)).toBe(h(54, 36));
  });

  it('crédité au 1er janvier selon la zone', () => {
    const fin = C({ cf: h(3) });
    expect(compteursNouvelleAnnee(fin, cycle()).cf).toBe(h(109, 12));
    expect(compteursNouvelleAnnee(fin, cycle('reunion')).cf).toBe(h(116, 12));
    expect(compteursNouvelleAnnee(fin, cycle('alsace_moselle')).cf).toBe(h(123, 12));
  });

  it('proposé dans le sondage 2027, compté dans le simulateur retraite et les droits d’un changement de cycle', () => {
    expect(dotationsPrevues(cycle('martinique'), C()).find((d) => d.compteur === 'cf')?.valeur).toBe(h(116, 12));
    expect(quotaCycle(cycle('guyane'), C(), 'cf')).toBe(h(116, 12));
    const r = calculerDepartRetraite(new Date(2027, 11, 31), C({ ca: 0, cf: 0, rtc: 0, rps: 0, hs: 0, cet: 0 }), cycle('reunion'), [], {}, new Date(2026, 9, 22));
    expect(r.dotationsFutures[0]!.minutes).toBe(h(116, 12) + h(188, 9));
  });
});

describe('Jours fériés locaux', () => {
  it('Alsace-Moselle : Vendredi saint et 26 décembre', () => {
    // Pâques 2027 : 28 mars → Vendredi saint 26 mars
    expect(feriesLocaux('alsace_moselle', 2027, new Date(2027, 2, 28))).toEqual(['2027-03-26', '2027-12-26']);
    expect(joursFeries(2027, 'alsace_moselle').size).toBe(13);
    expect(joursFeries(2027).size).toBe(11);
  });

  it('DOM : abolition de l’esclavage', () => {
    expect(estFerie(new Date(2027, 11, 20), 'reunion')).toBe(true);
    expect(estFerie(new Date(2027, 11, 20))).toBe(false);
    expect(estFerie(new Date(2027, 4, 22), 'martinique')).toBe(true);
    expect(estFerie(new Date(2027, 4, 27), 'guadeloupe')).toBe(true);
    expect(estFerie(new Date(2027, 5, 10), 'guyane')).toBe(true);
    expect(estFerie(new Date(2027, 3, 27), 'mayotte')).toBe(true);
    expect(joursFeries(2027, 'autre_om').size).toBe(11);
  });

  it('régime hebdomadaire : le férié local n’est pas travaillé', () => {
    const lundi20dec = new Date(2027, 11, 20);
    expect(isWorkingDay(lundi20dec, hebdo('reunion'))).toBe(false);
    expect(isWorkingDay(lundi20dec, hebdo())).toBe(true);
  });
});

describe('Le lieu d’affectation est conservé', () => {
  it('par un changement de cycle en cours d’année', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 22, 10));
    const r = appliquerChangement(cycle('reunion'), C({ ca: 10, cf: h(60) }), [], {
      dernierJour: '2026-10-31', premierJour: '2026-11-01', nouveau: { ...cycle(), pattern: '3/3' },
    });
    expect('config' in r && r.config.zone).toBe('reunion');
  });

  it('dans une sauvegarde (zone valide acceptée, inconnue refusée)', () => {
    const data = { cycleConfig: cycle('guadeloupe'), counters: C(), history: [], lastUpdated: '', isOnboarded: true };
    expect(validateUserData(data).success).toBe(true);
    expect(validateUserData({ ...data, cycleConfig: { ...cycle(), zone: 'atlantide' } }).success).toBe(false);
    expect(estZone('reunion')).toBe(true);
  });
});
