// Changement de cycle en cours d'année (mutation) : historique des cycles,
// droits au prorata, RPS recrédités, annulation.

import { describe, it, expect } from 'vitest';
import type { Counters, CycleConfig, CycleSimple, UserData } from '../types';
import { cycleDuJour } from '../cycleDuJour';
import { isWorkingDay, getRTCAnnuel } from '../calculations';
import { baremeRPSDepuisHoraires, getRPSPourJour } from '../rps';
import { horairesDuJour } from '../horaires';
import {
  annulerChangement, apercuChangement, appliquerChangement, changementAnnulable, droitsAnnee, droitsProrata, erreurDates,
} from '../changementCycle';
import { DEFAULT_COUNTERS } from '../storage';
import { validateUserData } from '../validation';
import { RTC_DOTATION } from '../constants';

const h = (hh: number, mm = 0) => hh * 60 + mm;
const SEMAINE = { lundi: true, mardi: true, mercredi: true, jeudi: true, vendredi: true, samedi: false, dimanche: false };
const d = (s: string) => {
  const [a, m, j] = s.split('-').map(Number);
  return new Date(a, m - 1, j);
};

// Ancien cycle : 2/2/3 en 12h08 de jour (lundi→vendredi travaillés dans ce jeu d'essai)
const ANCIEN: CycleConfig = {
  type: 'alterne', pattern: '2/2/3/2/2/3', heuresParJour: h(12, 8), heureDebut: h(7),
  dateDebutCycle: '2026-01-05', semaineActuelle: 'A', semaineA: SEMAINE, semaineB: SEMAINE,
  rpsParJour: baremeRPSDepuisHoraires(h(7), h(12, 8)),
};
// Nouveau cycle : 4/2 de nuit (19h), première série travaillée le 1er juillet
const NOUVEAU: CycleSimple = {
  type: 'alterne', pattern: '4/2', heuresParJour: h(12, 8), heureDebut: h(19),
  dateDebutCycle: '2026-07-01', semaineActuelle: 'A', semaineA: SEMAINE,
  rpsParJour: baremeRPSDepuisHoraires(h(19), h(12, 8)),
};
const C = (o: Partial<Counters> = {}): Counters => ({ ...DEFAULT_COUNTERS, ca: 10, rtc: h(100), rps: h(20), ...o });
const AUJ = new Date(2026, 6, 10); // 10 juillet 2026
const MUTATION = { dernierJour: '2026-06-30', premierJour: '2026-07-01', nouveau: NOUVEAU };

describe('Cycle en vigueur selon la date', () => {
  const apres = apercuChangement(ANCIEN, C(), [], { ...MUTATION, dernierJour: '2026-06-28' }, AUJ).config;

  it('ancien cycle jusqu’au dernier jour, aucun entre les deux, nouveau ensuite', () => {
    expect(cycleDuJour(d('2026-06-26'), apres)?.pattern).toBe('2/2/3/2/2/3');
    expect(cycleDuJour(d('2026-06-28'), apres)?.pattern).toBe('2/2/3/2/2/3');
    expect(cycleDuJour(d('2026-06-29'), apres)).toBeNull(); // jour de mutation
    expect(cycleDuJour(d('2026-07-01'), apres)?.pattern).toBe('4/2');
  });

  it('planning : jours de l’ancien cycle avant, rien pendant la mutation, rotation 4/2 ensuite', () => {
    expect(isWorkingDay(d('2026-06-26'), apres)).toBe(true); // vendredi, ancien cycle
    expect(isWorkingDay(d('2026-06-29'), apres)).toBe(false); // lundi, entre deux cycles
    expect(isWorkingDay(d('2026-07-01'), apres)).toBe(true); // 1er jour de la série
    expect(isWorkingDay(d('2026-07-04'), apres)).toBe(true); // 4e jour
    expect(isWorkingDay(d('2026-07-05'), apres)).toBe(false); // repos
  });

  it('horaires et barème RPS de chaque cycle', () => {
    expect(horairesDuJour(d('2026-06-26'), apres).heureDebut).toBe(h(7));
    expect(horairesDuJour(d('2026-07-01'), apres).heureDebut).toBe(h(19));
    expect(getRPSPourJour(d('2026-06-26'), apres)).toBe(0); // jour, en semaine
    expect(getRPSPourJour(d('2026-07-01'), apres)).toBe(54); // nuit, en semaine
    expect(getRPSPourJour(d('2026-06-29'), apres)).toBe(0); // entre deux cycles
  });
});

describe('Droits de l’année au prorata', () => {
  it('CA et RTC au prorata des jours passés dans chaque cycle (arrondi APORTT)', () => {
    const a = apercuChangement(ANCIEN, C(), [], MUTATION, AUJ);
    const ca = a.lignes.find((l) => l.compteur === 'ca')!;
    // 18 × 181/365 + 23 × 184/365 = 20,52 → 20,5
    expect(ca).toMatchObject({ avant: 18, apres: 20.5, solde: 10 });
    const rtc = a.lignes.find((l) => l.compteur === 'rtc')!;
    expect(rtc.avant).toBe(getRTCAnnuel(ANCIEN));
    expect(rtc.apres).toBe(Math.round((RTC_DOTATION.cycle12h08 * 181 + RTC_DOTATION.cycle4_2 * 184) / 365));
    // CF identique quel que soit le cycle : inchangé
    expect(a.lignes.find((l) => l.compteur === 'cf')).toMatchObject({ avant: h(109, 12), apres: h(109, 12) });
  });

  it('les jours entre deux cycles comptent avec le nouveau', () => {
    const avecMutation = apercuChangement(ANCIEN, C(), [], { ...MUTATION, dernierJour: '2026-06-20' }, AUJ).config;
    const sans = droitsProrata(apercuChangement(ANCIEN, C(), [], { ...MUTATION, dernierJour: '2026-06-20', premierJour: '2026-06-21' }, AUJ).config, C(), 2026);
    expect(droitsProrata(avecMutation, C(), 2026)).toEqual(sans);
  });

  it('changement l’an dernier, saisi cette année : droits complets du nouveau cycle', () => {
    const a = apercuChangement(ANCIEN, C(), [], { ...MUTATION, dernierJour: '2025-11-30', premierJour: '2025-12-01' }, AUJ);
    expect(a.lignes.find((l) => l.compteur === 'ca')).toMatchObject({ avant: 18, apres: 23 });
  });

  it('montants corrigés par l’agent (GesTT fait foi)', () => {
    const a = apercuChangement(ANCIEN, C(), [], { ...MUTATION, droitsCorriges: { ca: 21 } }, AUJ);
    expect(a.lignes.find((l) => l.compteur === 'ca')?.apres).toBe(21);
  });
});

describe('Enregistrement et annulation', () => {
  it('soldes ajustés de l’écart, RPS recrédités depuis le changement, puis annulation à l’identique', () => {
    const counters = C({ rpsDernierCredit: '2026-07-10' });
    const r = appliquerChangement(ANCIEN, counters, [], MUTATION, AUJ);
    if ('erreur' in r) throw new Error(r.erreur);

    expect(r.counters.ca).toBe(12.5); // 10 + (20,5 − 18)
    expect(r.counters.rtc).toBe(counters.rtc + (droitsAnnee(r.config, counters, 'rtc', 2026) - getRTCAnnuel(ANCIEN)));
    // 1er→10 juillet : l'ancien cycle (jour, semaine) ne créditait rien ; le
    // nouveau (nuit) crédite chaque jour travaillé : 1-4 et 7-10 juillet.
    const attendus = ['2026-07-01', '2026-07-02', '2026-07-03', '2026-07-04', '2026-07-07', '2026-07-08', '2026-07-09', '2026-07-10']
      .reduce((s, j) => s + getRPSPourJour(d(j), r.config), 0);
    expect(r.counters.rps).toBe(counters.rps + attendus);
    expect(r.config.droitsAnnee).toMatchObject({ annee: 2026, ca: 20.5 });
    expect(droitsAnnee(r.config, r.counters, 'ca', 2027)).toBe(23); // l'an prochain : quota du nouveau cycle

    expect(changementAnnulable(r.config, AUJ)).toBe(true);
    const annule = annulerChangement(r.config, r.counters)!;
    expect(annule.counters).toMatchObject({ ca: 10, rtc: counters.rtc, rps: counters.rps });
    expect(annule.config.pattern).toBe('2/2/3/2/2/3');
    expect(annule.config.cyclesAnterieurs).toBeUndefined();
    expect(annule.config.appliqueDepuis).toBeUndefined();
  });

  it('passage en hebdomadaire : RTC et CF au prorata de la période en cycle, ARTT au prorata de l’hebdo', () => {
    const HEBDO: CycleSimple = { ...NOUVEAU, type: 'hebdo', pattern: undefined };
    const a = apercuChangement(ANCIEN, C({ hasARTT: true, artt: 0 }), [], { ...MUTATION, nouveau: HEBDO }, AUJ);
    const ligne = (k: string) => a.lignes.find((l) => l.compteur === k)!;
    expect(ligne('rtc').apres).toBe(Math.round((RTC_DOTATION.cycle12h08 * 181) / 365));
    expect(ligne('cf').apres).toBe(Math.round((h(109, 12) * 181) / 365));
    expect(ligne('artt')).toMatchObject({ avant: 0, apres: 10 }); // 20 × 184/365 = 10,08 → 10
    expect(ligne('ca').apres).toBe(21.5); // 18 × 181/365 + 25 × 184/365 = 21,53
  });

  it('cycliste ayant coché ARTT par erreur : ses ARTT ne bougent pas', () => {
    const a = apercuChangement(ANCIEN, C({ hasARTT: true, artt: 20 }), [], MUTATION, AUJ);
    expect(a.lignes.find((l) => l.compteur === 'artt')).toBeUndefined();
  });

  it('jamais de solde négatif (droits déjà consommés au-delà du prorata)', () => {
    const r = appliquerChangement({ ...ANCIEN, type: 'hebdo' }, C({ ca: 2 }), [], { ...MUTATION, nouveau: NOUVEAU }, AUJ);
    if ('erreur' in r) throw new Error(r.erreur);
    // hebdo 25 CA → prorata 25×181/365 + 23×184/365 ≈ 23,99 → 24 : écart −1
    expect(r.counters.ca).toBe(1);
  });

  it('deux changements dans l’année : chaque période garde son cycle', () => {
    const r1 = appliquerChangement(ANCIEN, C(), [], { ...MUTATION, dernierJour: '2026-03-31', premierJour: '2026-04-01' }, AUJ);
    if ('erreur' in r1) throw new Error(r1.erreur);
    const r2 = appliquerChangement(r1.config, r1.counters, [], { dernierJour: '2026-06-30', premierJour: '2026-07-01', nouveau: { ...NOUVEAU, pattern: '2/2', dateDebutCycle: '2026-07-01' } }, AUJ);
    if ('erreur' in r2) throw new Error(r2.erreur);
    expect(cycleDuJour(d('2026-03-15'), r2.config)?.pattern).toBe('2/2/3/2/2/3');
    expect(cycleDuJour(d('2026-05-15'), r2.config)?.pattern).toBe('4/2');
    expect(cycleDuJour(d('2026-07-15'), r2.config)?.pattern).toBe('2/2');
    // L'annulation ne défait que le dernier
    expect(annulerChangement(r2.config, r2.counters)!.config.pattern).toBe('4/2');
  });
});

describe('Contrôles', () => {
  it('dates incohérentes refusées', () => {
    expect(erreurDates(ANCIEN, '2026-07-01', '2026-07-01')).toMatch(/doit suivre/);
    expect(erreurDates(ANCIEN, '', '2026-07-01')).toMatch(/deux dates/);
    expect(erreurDates(ANCIEN, '2026-01-01', '2026-06-01')).toMatch(/trois mois/);
    expect(erreurDates({ ...ANCIEN, appliqueDepuis: '2026-05-01' }, '2026-04-01', '2026-04-02')).toMatch(/précédent changement/);
    expect(erreurDates(ANCIEN, '2026-06-30', '2026-07-01')).toBeNull();
  });

  it('données enregistrées valides (sauvegarde, rechargement)', () => {
    const r = appliquerChangement(ANCIEN, C(), [], MUTATION, AUJ);
    if ('erreur' in r) throw new Error(r.erreur);
    const data = { cycleConfig: r.config, counters: r.counters, history: [], lastUpdated: '', lastResetYear: 2026, isOnboarded: true } as unknown as UserData;
    expect(validateUserData(data).success).toBe(true);
    const corrompu = { ...data, cycleConfig: { ...r.config, cyclesAnterieurs: [{ fin: 'hier', config: {} }] } };
    expect(validateUserData(corrompu).success).toBe(false);
  });
});
