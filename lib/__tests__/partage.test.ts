// « Partager mon planning » : photo du planning, masquage du type d'absence,
// horaires, et planning transporté dans le lien (rien côté serveur).

import { describe, it, expect } from 'vitest';
import { joursDuMois, lienPartage, lirePartage, periodePartage, photoPlanning } from '../partage';
import { contenuPartageNatif } from '../partageEnvoi';
import type { CycleConfig, HistoryEntry } from '../types';

const h = (a: number, b = 0) => a * 60 + b;
const S = { lundi: true, mardi: true, mercredi: true, jeudi: true, vendredi: true, samedi: false, dimanche: false };
// Lundi→vendredi travaillés, 07h00–19h08
const CFG: CycleConfig = {
  type: 'alterne', pattern: '2/2/3/2/2/3', heuresParJour: h(12, 8), heureDebut: h(7),
  dateDebutCycle: '2026-09-28', semaineActuelle: 'A', semaineA: S, semaineB: S,
};
const jour = (j: number) => new Date(2026, 10, j, 8).toISOString();
const HISTORY: HistoryEntry[] = [
  { id: 'ca', date: jour(10), dateEnd: jour(11), action: 'pose', type: 'ca', amount: 2, countersSnapshot: {} },
  { id: 'rtc', date: jour(12), action: 'pose', type: 'rtc', amount: h(4), partialDay: true, countersSnapshot: {} },
  { id: 'cmo', date: jour(13), action: 'cmo', type: 'cmo', amount: 1, countersSnapshot: {} },
  { id: 'ast', date: jour(14), action: 'astreinte', type: 'astreinte', amount: 0, countersSnapshot: {} }, // samedi
];
const NOV = new Date(2026, 10, 5);
const opts = { mois: 1 as const, masquerTypes: true, horaires: true };

describe('Photo du planning', () => {
  it('nature de chaque jour : travail, repos, congé, congé en heures, absent, astreinte', () => {
    const p = photoPlanning(CFG, HISTORY, NOV, opts, new Date(2026, 9, 22));
    const jours = joursDuMois(p, 0);
    const n = (j: number) => jours[j - 1]!;
    expect(p.du).toBe('2026-11');
    expect(jours).toHaveLength(30);
    expect(n(9).nature).toBe('T');
    expect(n(8).nature).toBe('R'); // dimanche
    expect(n(10)).toMatchObject({ nature: 'C', etiquette: 'Congé' });
    expect(n(12)).toMatchObject({ nature: 'P', etiquette: 'Congé (heures)' });
    expect(n(13)).toMatchObject({ nature: 'A', etiquette: 'Absent' });
    expect(n(14)).toMatchObject({ nature: 'T', etiquette: 'Astreinte' });
    expect(n(9).horaires).toBe('07:00–19:08');
    expect(n(8).horaires).toBeUndefined();
  });

  it('types visibles si l’agent ne les masque pas ; horaires seulement si demandés', () => {
    const p = photoPlanning(CFG, HISTORY, NOV, { ...opts, masquerTypes: false, horaires: false });
    const jours = joursDuMois(p, 0);
    expect(jours[9]!.etiquette).toBe('CA');
    expect(jours[11]!.etiquette).toBe('RTC 4h');
    expect(jours[12]!.etiquette).toBe('CMO');
    expect(jours[8]!.horaires).toBeUndefined();
  });

  it('aucun compteur dans la photo', () => {
    const p = photoPlanning(CFG, HISTORY, NOV, opts);
    expect(Object.keys(p).sort()).toEqual(['du', 'h', 'j', 'l', 'le', 'mois', 'v']);
  });

  it('période : un ou plusieurs mois', () => {
    expect(periodePartage(photoPlanning(CFG, [], NOV, opts))).toBe('novembre 2026');
    expect(periodePartage(photoPlanning(CFG, [], NOV, { ...opts, mois: 3 }))).toBe('novembre 2026 → janvier 2027');
    const p6 = photoPlanning(CFG, [], NOV, { ...opts, mois: 6 });
    expect(p6.j).toHaveLength(30 + 31 + 31 + 28 + 31 + 30);
    expect(joursDuMois(p6, 2)[0]!.date.getMonth()).toBe(0); // janvier 2027
  });
});

describe('Lien de partage', () => {
  it('le planning voyage dans le « # » et se relit à l’identique', async () => {
    const p = photoPlanning(CFG, HISTORY, NOV, { ...opts, titre: 'Planning de Marc' });
    const lien = await lienPartage(p);
    expect(lien).toMatch(/^https:\/\/mychronos\.fr\/planning#p=/);
    expect(await lirePartage(new URL(lien).hash)).toEqual(p);
  });

  it('6 mois avec horaires : lien assez court pour un messager', async () => {
    const lien = await lienPartage(photoPlanning(CFG, HISTORY, NOV, { ...opts, mois: 6 }));
    expect(lien.length).toBeLessThan(6000);
  });

  it('lien abîmé : illisible, sans plantage', async () => {
    expect(await lirePartage('#p=g1.nimportequoi')).toBeNull();
    expect(await lirePartage('')).toBeNull();
  });
});

describe('Partage natif d’un lien', () => {
  const c = { title: 'Planning', text: 'Planning de Marc (My Chronos)', url: 'https://mychronos.fr/planning#p=g1.abc' };
  it('iPhone : le lien part dans le texte (sinon WhatsApp le bloque)', () => {
    expect(contenuPartageNatif('ios', c)).toEqual({ title: 'Planning', text: 'Planning de Marc (My Chronos)\nhttps://mychronos.fr/planning#p=g1.abc' });
  });
  it('Android : inchangé', () => {
    expect(contenuPartageNatif('android', c)).toEqual(c);
  });
});
