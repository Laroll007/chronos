// Lecture des exports CSV des stores importés dans /stats.

import { describe, it, expect } from 'vitest';
import { fusionnerExport, jourDepuis, lireExportStore } from '../server/stores-store';

// Extrait réel de l'export Play Console (audience installée + acquisitions).
const PLAY = `Date,"Audience ayant installé l'application (Tous les utilisateurs, Utilisateurs uniques, Par intervalle, Quotidiennes) : Tous les pays/régions","Audience ayant installé l'application (Tous les utilisateurs, Utilisateurs uniques, Par intervalle, Quotidiennes) : France","Acquisition d'utilisateurs (Tous les utilisateurs, Tous les événements, Par intervalle, Quotidiennes) : Tous les pays/régions","Acquisition d'utilisateurs (Tous les utilisateurs, Tous les événements, Par intervalle, Quotidiennes) : France",Notes
6 juin 2026,8,8,10,10,
1 sept. 2026,34,33,21,21,
4 oct. 2026,559,553,447,439,
14 oct. 2026,997,992,23,23,Déploiement de la version : Début du déploiement de la version 5 (2.0.1) (40%).
15 oct. 2026,1 008,1 003,14,14,
19 oct. 2026,1 054,1 046,-,-,
`;

describe('Exports des stores', () => {
  it('dates françaises, ISO ou jj/mm/aaaa', () => {
    expect(jourDepuis('6 juin 2026')).toBe('2026-06-06');
    expect(jourDepuis('1 sept. 2026')).toBe('2026-09-01');
    expect(jourDepuis('14 août 2026')).toBe('2026-08-14');
    expect(jourDepuis('2026-10-04')).toBe('2026-10-04');
    expect(jourDepuis('04/10/2026')).toBe('2026-10-04');
    expect(jourDepuis('Notes')).toBeNull();
  });

  it('Play Console : colonnes « tous pays », milliers avec espace, « - » ignoré', () => {
    const e = lireExportStore(PLAY)!;
    expect(e.plateforme).toBe('android');
    expect(e.jours['2026-10-04']).toEqual({ installes: 559, acquisitions: 447 });
    expect(e.jours['2026-10-15']).toEqual({ installes: 1008, acquisitions: 14 });
    expect(e.jours['2026-10-19']).toEqual({ installes: 1054 });
    expect(Object.keys(e.jours)).toHaveLength(6);
  });

  it('App Store Connect : unités d’app par jour (séparateur virgule ou point-virgule)', () => {
    const e = lireExportStore('Date;Unités d’app\n2026-09-24;3\n2026-10-04;431\n')!;
    expect(e).toEqual({ plateforme: 'ios', jours: { '2026-09-24': { telechargements: 3 }, '2026-10-04': { telechargements: 431 } } });
  });

  it('format inconnu : refusé', () => {
    expect(lireExportStore('a,b\n1,2\n')).toBeNull();
    expect(lireExportStore('')).toBeNull();
  });

  it('un nouvel import complète et remplace jour par jour', () => {
    const d1 = fusionnerExport({ android: {}, ios: {} }, lireExportStore(PLAY)!, '2026-10-21');
    const d2 = fusionnerExport(d1, { plateforme: 'android', jours: { '2026-10-19': { acquisitions: 9 } } }, '2026-10-22');
    expect(d2.android['2026-10-19']).toEqual({ installes: 1054, acquisitions: 9 });
    expect(d2.android['2026-06-06']).toEqual({ installes: 8, acquisitions: 10 });
    expect(d2.majLe).toBe('2026-10-22');
  });
});
