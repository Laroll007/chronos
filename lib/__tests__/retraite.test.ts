/**
 * Simulateur de départ à la retraite.
 *
 * Règles APORTT en jeu :
 *  - CET : « les 15 premiers jours » doivent être pris en congés avant la
 *    radiation, le reste est indemnisé — d'où un plancher et un choix.
 *  - Année incomplète : la dotation de l'année de radiation est proratisée
 *    (« au prorata de la durée accomplie »).
 *  - Années intermédiaires : les congés payés valant période d'activité, la
 *    dotation reste pleine et peut être posée par anticipation.
 */
import { describe, it, expect } from 'vitest';
import {
  calculerDepartRetraite,
  getProrataAnnee,
  arrondirDotation,
  COMPTEURS_RETRAITE,
  INDEMNISATION_CET,
} from '@/lib/retraite';
import { DEFAULT_COUNTERS, DEFAULT_CYCLE_CONFIG } from '@/lib/storage';
import { CET_SEUIL_OPTION } from '@/lib/constants';
import { isWorkingDay } from '@/lib/calculations';
import type { Counters } from '@/lib/types';

const cfg = DEFAULT_CYCLE_CONFIG;
const C = (o: Partial<Counters> = {}): Counters => ({ ...DEFAULT_COUNTERS, ...o });
const AUJOURDHUI = new Date(2026, 8, 12);
const RADIATION = new Date(2028, 5, 30);

/** Profil type : compteurs pleins et CET au plafond. */
const PROFIL = C({
  ca: 18, caHP: 2, cf: 6552, hasCF: true, rtc: 11229, hasRTC: true,
  rps: 12000, hs: 4000, cet: 60,
});

describe('Prorata de l’année de radiation', () => {
  it('vaut ~50 % pour une radiation au 30 juin', () => {
    const p = getProrataAnnee(new Date(2028, 5, 30));
    expect(p).toBeGreaterThan(0.48);
    expect(p).toBeLessThan(0.52);
  });

  it('vaut ~100 % au 31 décembre et ~0 % au 1er janvier', () => {
    expect(getProrataAnnee(new Date(2028, 11, 31))).toBe(1);
    expect(getProrataAnnee(new Date(2028, 0, 1))).toBeLessThan(0.01);
  });
});

describe('Arrondi APORTT des dotations', () => {
  // « au nombre entier inférieur si la décimale n'atteint pas 0,25 ; au demi-jour
  //   si entre 0,25 et 0,74 ; à l'entier supérieur si ≥ 0,75 »
  it('suit la règle des trois seuils', () => {
    expect(arrondirDotation(9.1)).toBe(9);
    expect(arrondirDotation(9.25)).toBe(9.5);
    expect(arrondirDotation(9.5)).toBe(9.5);
    expect(arrondirDotation(9.74)).toBe(9.5);
    expect(arrondirDotation(9.75)).toBe(10);
    expect(arrondirDotation(9)).toBe(9);
  });
});

describe('Calcul du départ', () => {
  it('trouve un dernier jour travaillé antérieur à la radiation', () => {
    const r = calculerDepartRetraite(RADIATION, PROFIL, cfg, [], {}, AUJOURDHUI);
    expect(r.dernierJourTravaille).not.toBeNull();
    expect(r.dernierJourTravaille!.getTime()).toBeLessThan(RADIATION.getTime());
    expect(r.joursCouverts).toBeGreaterThan(0);
  });

  it('le dernier jour travaillé est bien un jour travaillé du cycle', () => {
    const r = calculerDepartRetraite(RADIATION, PROFIL, cfg, [], {}, AUJOURDHUI);
    expect(isWorkingDay(r.dernierJourTravaille!, cfg)).toBe(true);
  });

  it('l’absence commence juste après le dernier jour travaillé', () => {
    const r = calculerDepartRetraite(RADIATION, PROFIL, cfg, [], {}, AUJOURDHUI);
    expect(r.premierJourConge!.getTime()).toBeGreaterThan(r.dernierJourTravaille!.getTime());
    // Aucun jour travaillé non couvert entre les deux.
    const entre = new Date(r.dernierJourTravaille!);
    entre.setDate(entre.getDate() + 1);
    while (entre < r.premierJourConge!) {
      expect(isWorkingDay(entre, cfg)).toBe(false);
      entre.setDate(entre.getDate() + 1);
    }
  });

  it('poser plus de CET fait partir plus tôt', () => {
    const dates = [CET_SEUIL_OPTION, 30, 60].map(
      (cet) => calculerDepartRetraite(RADIATION, PROFIL, cfg, [], { cetPoseEnConges: cet }, AUJOURDHUI)
    );
    expect(dates[1].dernierJourTravaille!.getTime()).toBeLessThan(dates[0].dernierJourTravaille!.getTime());
    expect(dates[2].dernierJourTravaille!.getTime()).toBeLessThan(dates[1].dernierJourTravaille!.getTime());
    expect(dates[2].joursCouverts).toBeGreaterThan(dates[0].joursCouverts);
  });

  it('ne descend jamais sous le plancher des 15 jours de CET', () => {
    const r = calculerDepartRetraite(RADIATION, PROFIL, cfg, [], { cetPoseEnConges: 0 }, AUJOURDHUI);
    const cetConsomme = r.detail.find((d) => d.type === 'cet')?.quantite ?? 0;
    expect(cetConsomme).toBe(CET_SEUIL_OPTION);
    expect(r.cetIndemnise).toBe(60 - CET_SEUIL_OPTION);
  });

  it('chiffre l’indemnisation selon la catégorie', () => {
    for (const cat of ['A', 'B', 'C'] as const) {
      const r = calculerDepartRetraite(
        RADIATION, PROFIL, cfg, [], { cetPoseEnConges: CET_SEUIL_OPTION, categorie: cat }, AUJOURDHUI
      );
      expect(r.indemnisationEuros).toBe(r.cetIndemnise * INDEMNISATION_CET[cat]);
    }
  });
});

describe('Dotations par anticipation', () => {
  it('crédite les années intermédiaires en plein et l’année de radiation au prorata', () => {
    const r = calculerDepartRetraite(RADIATION, PROFIL, cfg, [], {}, AUJOURDHUI);
    const annees = r.dotationsFutures.map((d) => d.annee);
    expect(annees).toEqual([2027, 2028]);

    const pleine = r.dotationsFutures.find((d) => d.annee === 2027)!;
    const partielle = r.dotationsFutures.find((d) => d.annee === 2028)!;
    expect(pleine.prorata).toBe(1);
    expect(partielle.prorata).toBeLessThan(0.55);
    expect(partielle.jours).toBeLessThan(pleine.jours);
  });

  it('une radiation plus lointaine donne plus de dotations, donc un départ plus tôt', () => {
    const proche = calculerDepartRetraite(new Date(2027, 5, 30), PROFIL, cfg, [], {}, AUJOURDHUI);
    const lointaine = calculerDepartRetraite(new Date(2029, 5, 30), PROFIL, cfg, [], {}, AUJOURDHUI);
    expect(lointaine.dotationsFutures.length).toBeGreaterThan(proche.dotationsFutures.length);
    expect(lointaine.joursCouverts).toBeGreaterThan(proche.joursCouverts);
  });

  it('aucune dotation future si la radiation est dans l’année courante', () => {
    const r = calculerDepartRetraite(new Date(2026, 11, 31), PROFIL, cfg, [], {}, AUJOURDHUI);
    expect(r.dotationsFutures).toHaveLength(0);
  });
});

describe('Compteurs exclus', () => {
  it('exclure un compteur réduit la couverture', () => {
    const avec = calculerDepartRetraite(RADIATION, PROFIL, cfg, [], {}, AUJOURDHUI);
    const sans = calculerDepartRetraite(RADIATION, PROFIL, cfg, [], { exclus: ['hs'] }, AUJOURDHUI);
    expect(sans.joursCouverts).toBeLessThan(avec.joursCouverts);
    expect(sans.detail.some((d) => d.type === 'hs')).toBe(false);
  });

  it('exclure le CET l’indemnise intégralement', () => {
    const r = calculerDepartRetraite(RADIATION, PROFIL, cfg, [], { exclus: ['cet'] }, AUJOURDHUI);
    expect(r.cetIndemnise).toBe(60);
    expect(r.detail.some((d) => d.type === 'cet')).toBe(false);
  });

  it('tout exclure ne couvre aucun jour', () => {
    const r = calculerDepartRetraite(
      RADIATION, PROFIL, cfg, [], { exclus: [...COMPTEURS_RETRAITE] }, AUJOURDHUI
    );
    expect(r.joursCouverts).toBe(0);
    expect(r.dernierJourTravaille).toBeNull();
  });
});

describe('Cohérence du décompte', () => {
  it('les jours couverts par compteur totalisent les jours couverts', () => {
    const r = calculerDepartRetraite(RADIATION, PROFIL, cfg, [], {}, AUJOURDHUI);
    const somme = r.detail.reduce((s, d) => s + d.joursCouverts, 0);
    // Fractionnaire : une journée peut être payée par plusieurs compteurs horaires.
    expect(somme).toBeCloseTo(r.joursCouverts, 6);
  });

  it('cumule les compteurs horaires pour couvrir une journée', () => {
    // Cinq soldes sous la journée de 12h08 : aucun ne la couvre seul, mais leur
    // total dépasse une journée. Exiger un compteur unique gâchait tout.
    const miettes = C({
      ca: 0, caHP: 0, cet: 0,
      cf: 6 * 60, hasCF: true, rtc: 5 * 60, hasRTC: true,
      rps: 4 * 60, hs: 3 * 60, hsHistorique: 2 * 60,
    });
    const r = calculerDepartRetraite(
      new Date(2026, 11, 31), miettes, cfg, [], { exclus: ['rps'] }, new Date(2026, 11, 1)
    );
    // 6+5+3+2 = 16h, soit une journée de 12h08 et un reliquat.
    expect(r.joursCouverts).toBe(1);
    expect(r.detail.length).toBeGreaterThan(1); // plusieurs compteurs mobilisés
    expect(r.reliquatMinutes).toBeLessThan(12 * 60 + 8);
  });

  it('s’arrête quand le reliquat ne couvre plus une journée entière', () => {
    const presqueRien = C({
      ca: 0, caHP: 0, cet: 0,
      cf: 2 * 60, hasCF: true, rtc: 0, hasRTC: false, rps: 0, hs: 60,
    });
    const r = calculerDepartRetraite(
      new Date(2026, 11, 31), presqueRien, cfg, [], { exclus: ['rps'] }, new Date(2026, 11, 1)
    );
    expect(r.joursCouverts).toBe(0);
    expect(r.reliquatMinutes).toBe(3 * 60);
  });

  it('ne consomme jamais plus que le stock disponible', () => {
    const r = calculerDepartRetraite(RADIATION, PROFIL, cfg, [], {}, AUJOURDHUI);
    const caConsomme = r.detail.find((d) => d.type === 'ca')?.quantite ?? 0;
    const caDispo = PROFIL.ca + r.dotationsFutures.reduce((s, d) => s + d.jours, 0);
    expect(caConsomme).toBeLessThanOrEqual(caDispo);

    const cetConsomme = r.detail.find((d) => d.type === 'cet')?.quantite ?? 0;
    expect(cetConsomme).toBeLessThanOrEqual(PROFIL.cet);
  });

  it('l’absence calendaire dépasse le nombre de jours travaillés couverts', () => {
    // Les repos de cycle prolongent l'absence sans rien coûter.
    const r = calculerDepartRetraite(RADIATION, PROFIL, cfg, [], {}, AUJOURDHUI);
    expect(r.dureeCalendaire).toBeGreaterThan(r.joursCouverts);
  });

  it('un agent sans aucun compteur ne peut pas partir en avance', () => {
    const vide = C({
      ca: 0, caHP: 0, cf: 0, hasCF: false, rtc: 0, hasRTC: false,
      rps: 0, hs: 0, cet: 0,
    });
    const r = calculerDepartRetraite(new Date(2026, 11, 31), vide, cfg, [], {}, AUJOURDHUI);
    expect(r.joursCouverts).toBe(0);
  });
});
