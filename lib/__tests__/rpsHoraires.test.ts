import { describe, it, expect } from 'vitest';
import { baremeRPSDepuisHoraires, minutesDeNuit, rpsPourVacation, typeDeVacation } from '../rps';
import { RPS_PAR_DIMANCHE } from '../constants';

const h = (hh: number, mm = 0) => hh * 60 + mm;
const LUNDI = 1, VENDREDI = 5, SAMEDI = 6, DIMANCHE = 0;

describe('RPS d’après les horaires — relevés GesTT réels', () => {
  it('19h00–06h08 : 54 min en semaine, 2h45 le samedi, 2h36 le dimanche', () => {
    const d = h(11, 8);
    expect(rpsPourVacation(LUNDI, h(19), d)).toBe(54);
    expect(rpsPourVacation(SAMEDI, h(19), d)).toBe(h(2, 45));
    expect(rpsPourVacation(DIMANCHE, h(19), d)).toBe(h(2, 36));
  });

  it('19h30–07h38 : 54 min en semaine, 3h21 le samedi, 2h24 le dimanche (6h39 ven.+sam.+dim.)', () => {
    const d = h(12, 8);
    const ven = rpsPourVacation(VENDREDI, h(19, 30), d);
    const sam = rpsPourVacation(SAMEDI, h(19, 30), d);
    const dim = rpsPourVacation(DIMANCHE, h(19, 30), d);
    expect([ven, sam, dim]).toEqual([54, h(3, 21), h(2, 24)]);
    expect(ven + sam + dim).toBe(h(6, 39));
  });
});

describe('RPS d’après les horaires — autres vacations', () => {
  it('jour 07h00–19h08 : rien en semaine, 4h51 le dimanche (valeur historique)', () => {
    expect(rpsPourVacation(LUNDI, h(7), h(12, 8))).toBe(0);
    expect(rpsPourVacation(DIMANCHE, h(7), h(12, 8))).toBe(RPS_PAR_DIMANCHE);
  });

  it('mixte 16h00–03h08 : 6h08 de nuit → 37 min en semaine', () => {
    expect(minutesDeNuit(h(16), h(11, 8))).toBe(h(6, 8));
    expect(rpsPourVacation(LUNDI, h(16), h(11, 8))).toBe(37);
  });

  it('le vendredi soir, les heures d’après minuit (samedi) restent au taux de nuit', () => {
    expect(rpsPourVacation(VENDREDI, h(19, 30), h(12, 8))).toBe(rpsPourVacation(LUNDI, h(19, 30), h(12, 8)));
  });

  it('barème par jour de début de vacation', () => {
    const b = baremeRPSDepuisHoraires(h(19, 30), h(12, 8));
    expect(b).toEqual({
      lundi: 54, mardi: 54, mercredi: 54, jeudi: 54, vendredi: 54,
      samedi: h(3, 21), dimanche: h(2, 24),
    });
  });

  it('type de vacation', () => {
    expect(typeDeVacation(h(7), h(12, 8))).toBe('jour');
    expect(typeDeVacation(h(16), h(11, 8))).toBe('mixte');
    expect(typeDeVacation(h(15), h(11, 8))).toBe('mixte');
    expect(typeDeVacation(h(19, 30), h(12, 8))).toBe('nuit');
  });
});
