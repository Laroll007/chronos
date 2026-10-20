// Sondage « Préparons 2027 » : profil anonyme, dotations proposées, règles
// d'affichage, et effet de la réponse sur la bascule du 1er janvier 2027.

import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  dotationsPrevues,
  libelleProfil,
  optionsBascule,
  profilSondage,
  questionArtt,
  sondageAProposer,
} from '../sondage2027';
import { PROFIL_RE, besoinPourProfil, resumer, validerReponse, SONDAGE_SEUIL, type ReponseStockee } from '../server/sondage-store';
import { compteursNouvelleAnnee, migrateUserData, DEFAULT_COUNTERS, SCHEMA_VERSION } from '../storage';
import { compteursAnneeSuivante } from '../previsionnel';
import type { Counters, CycleConfig, ReponseSondage, UserData } from '../types';

afterEach(() => vi.useRealTimers());

const h = (a: number, b = 0) => a * 60 + b;
const S = { lundi: true, mardi: true, mercredi: true, jeudi: true, vendredi: true, samedi: false, dimanche: false };
const cycle = (pattern: CycleConfig['pattern'], duree: number, debut?: number, extra: Partial<CycleConfig> = {}): CycleConfig => ({
  type: 'alterne', pattern, heuresParJour: duree, ...(debut !== undefined && { heureDebut: debut }),
  dateDebutCycle: '2026-01-05', semaineActuelle: 'A', semaineA: S, semaineB: S, ...extra,
});
const HEBDO: CycleConfig = {
  type: 'hebdo', heuresParJour: h(8), dateDebutCycle: '2026-01-05', semaineActuelle: 'A', semaineA: S, semaineB: S,
  heuresSemaine: { lundi: h(8), mardi: h(8), mercredi: h(8), jeudi: h(8), vendredi: h(7, 25), samedi: 0, dimanche: 0 },
};
const NUIT_12H08 = cycle('2/2/3/2/2/3', h(12, 8), h(19));
const C = (o: Partial<Counters> = {}): Counters => ({ ...DEFAULT_COUNTERS, hasCF: true, hasRTC: true, ...o }) as Counters;
const rep = (o: Partial<ReponseSondage>): ReponseSondage => ({ reponse: 'confirme', date: '2026-11-05', ...o });

describe('Profil anonyme', () => {
  it('cycle, durée et type d’horaires ; jamais de date', () => {
    expect(profilSondage(NUIT_12H08)).toBe('alterne|2/2/3/2/2/3|12h08|nuit');
    expect(profilSondage(cycle('3/3', h(11, 8), h(7)))).toBe('alterne|3/3|11h08|jour');
    expect(profilSondage(cycle('2/2/3/2/2/3', h(12, 8)))).toBe('alterne|2/2/3/2/2/3|12h08|inconnu');
    expect(profilSondage(cycle('2/2/3/2/2/3', h(11, 8), h(10, 30), {
      horairesRotation: { jeux: [{ nom: 'S', heureDebut: h(10, 30), duree: h(11, 8) }, { nom: 'M', heureDebut: h(6), duree: h(11, 8) }], sequence: [0, 1], periodeJours: 14, dateReference: '2026-01-05' },
    }))).toBe('alterne|2/2/3/2/2/3|11h08|rotation');
    expect(profilSondage(HEBDO)).toBe('hebdo|-|8h00|-');
  });

  it('accepté par le serveur', () => {
    for (const cfg of [NUIT_12H08, HEBDO, cycle('4/2', h(8, 10), h(6)), cycle('vacation_forte', h(10))]) {
      expect(profilSondage(cfg)).toMatch(PROFIL_RE);
    }
  });

  it('libellé lisible', () => {
    expect(libelleProfil(NUIT_12H08)).toBe('2/2/3 · nuit · 12h08');
    expect(libelleProfil(HEBDO)).toBe('Hebdomadaire · 8h00');
  });
});

describe('Dotations proposées', () => {
  it('cycle : CA, RTC et CF de la grille', () => {
    expect(dotationsPrevues(NUIT_12H08, C())).toEqual([
      { compteur: 'ca', valeur: 18 }, { compteur: 'rtc', valeur: h(188, 9) }, { compteur: 'cf', valeur: h(109, 12) },
    ]);
    expect(dotationsPrevues(cycle('4/2', h(8, 10), h(6)), C())[0]).toEqual({ compteur: 'ca', valeur: 23 });
  });

  it('hebdomadaire : CA, ARTT et RTT si actifs, ni RTC ni CF', () => {
    const d = dotationsPrevues(HEBDO, C({ hasCF: false, hasRTC: false, hasARTT: true, hasRTT: true }));
    expect(d).toEqual([{ compteur: 'ca', valeur: 25 }, { compteur: 'artt', valeur: 20 }, { compteur: 'rtt', valeur: 16 }]);
  });

  it('question ARTT seulement pour un agent en cycle qui a un compteur ARTT', () => {
    expect(questionArtt(NUIT_12H08, C({ hasARTT: true }))).toBe(true);
    expect(questionArtt(NUIT_12H08, C())).toBe(false);
    expect(questionArtt(HEBDO, C({ hasARTT: true }))).toBe(false);
  });
});

describe('Quand le proposer', () => {
  const base = { isOnboarded: true };
  const nov = new Date(2026, 10, 10);
  it('une fois, avant 2027, à un agent inscrit avec ses compteurs', () => {
    expect(sondageAProposer(base, nov)).toBe(true);
    expect(sondageAProposer({ ...base, compteursARenseigner: true }, nov)).toBe(false);
    expect(sondageAProposer({ isOnboarded: false }, nov)).toBe(false);
    expect(sondageAProposer(base, new Date(2027, 0, 1))).toBe(false);
    expect(sondageAProposer({ ...base, sondage2027: { reponse: rep({}) } }, nov)).toBe(false);
  });

  it('« Plus tard » : reproposé une seule fois, pas avant 3 jours', () => {
    expect(sondageAProposer({ ...base, sondage2027: { plusTard: { fois: 1, dernier: '2026-11-09' } } }, nov)).toBe(false);
    expect(sondageAProposer({ ...base, sondage2027: { plusTard: { fois: 1, dernier: '2026-11-07' } } }, nov)).toBe(true);
    expect(sondageAProposer({ ...base, sondage2027: { plusTard: { fois: 2, dernier: '2026-10-01' } } }, nov)).toBe(false);
  });
});

describe('Effet de la réponse au 1er janvier', () => {
  const fin2026 = C({ ca: 3, rtc: h(10), hasARTT: true, artt: 4 });

  it('chiffres corrigés et « utiliser pour moi » : crédités en 2027 seulement', () => {
    const data = { sondage2027: { reponse: rep({ reponse: 'corrige', dotations: { rtc: h(165, 54) }, appliquer: true }) } };
    expect(compteursNouvelleAnnee(fin2026, NUIT_12H08, optionsBascule(data, 2027)).rtc).toBe(h(165, 54));
    expect(compteursNouvelleAnnee(fin2026, NUIT_12H08, optionsBascule(data, 2028)).rtc).toBe(h(188, 9));
    // Sans « utiliser pour moi » : la grille
    const sans = { sondage2027: { reponse: rep({ reponse: 'corrige', dotations: { rtc: h(165, 54) }, appliquer: false }) } };
    expect(compteursNouvelleAnnee(fin2026, NUIT_12H08, optionsBascule(sans, 2027)).rtc).toBe(h(188, 9));
  });

  it('ARTT d’un agent en cycle : retiré si « le même », crédité si « distinct », pas recrédité sinon', () => {
    const meme = compteursNouvelleAnnee(fin2026, NUIT_12H08, optionsBascule({ sondage2027: { reponse: rep({ artt: 'meme' }) } }, 2027));
    expect(meme).toMatchObject({ hasARTT: false, artt: 0, rtc: h(188, 9) });
    const distinct = compteursNouvelleAnnee(fin2026, NUIT_12H08, optionsBascule({ sondage2027: { reponse: rep({ artt: 'distinct', arttJours: 12 }) } }, 2027));
    expect(distinct).toMatchObject({ hasARTT: true, artt: 12 });
    const sansReponse = compteursNouvelleAnnee(fin2026, NUIT_12H08);
    expect(sansReponse).toMatchObject({ hasARTT: true, artt: 0 });
  });

  it('hebdomadaire : ARTT toujours recrédités', () => {
    const c = compteursNouvelleAnnee(C({ hasCF: false, hasRTC: false, hasARTT: true, artt: 2 }), HEBDO);
    expect(c.artt).toBe(20);
  });

  it('bascule réelle au 1er janvier 2027 avec la réponse enregistrée', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2027, 0, 1, 8));
    const data: UserData = {
      cycleConfig: NUIT_12H08, counters: fin2026, history: [], isOnboarded: true,
      lastUpdated: '2026-12-31T20:00:00.000Z', lastResetYear: 2026, schemaVersion: SCHEMA_VERSION,
      sondage2027: { reponse: rep({ reponse: 'corrige', dotations: { rtc: h(165, 54) }, appliquer: true, artt: 'meme' }) },
    };
    const c = migrateUserData(structuredClone(data)).counters;
    expect(c).toMatchObject({ rtc: h(165, 54), ca: 18, hasARTT: false, artt: 0 });
  });

  it('droits 2027 estimés pour les congés posés à l’avance : mêmes règles', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 10));
    const c = compteursAnneeSuivante({
      counters: fin2026, cycleConfig: NUIT_12H08, history: [],
      sondage2027: { reponse: rep({ reponse: 'corrige', dotations: { ca: 17 }, appliquer: true }) },
    });
    expect(c.ca).toBe(17);
  });
});

describe('Serveur : validation, besoin par profil, résumé', () => {
  const ok = { profil: 'alterne|2/2/3/2/2/3|12h08|nuit', plateforme: 'ios', version: '1.21.0' };

  it('accepte une réponse complète, ignore les champs inconnus', () => {
    const r = validerReponse({ ...ok, reponse: 'corrige', dotations: { rtc: h(165, 54), ca: 17.5 }, motif: 'arrivee', artt: 'distinct', arttJours: 12, nom: 'X' }, '2026-11-05');
    expect(r).toEqual({ jour: '2026-11-05', ...ok, reponse: 'corrige', dotations: { rtc: h(165, 54), ca: 17.5 }, motif: 'arrivee', artt: 'distinct', arttJours: 12 });
  });

  it('refuse les données invalides', () => {
    expect(validerReponse({ ...ok, profil: 'n’importe quoi' , reponse: 'confirme' }, 'j')).toBeNull();
    expect(validerReponse({ ...ok, reponse: 'corrige' }, 'j')).toBeNull(); // corrige sans chiffres
    expect(validerReponse({ ...ok, reponse: 'corrige', dotations: { ca: 17.3 } }, 'j')).toBeNull(); // pas une demi-journée
    expect(validerReponse({ ...ok, reponse: 'corrige', dotations: { rtc: -5 } }, 'j')).toBeNull();
    expect(validerReponse({ ...ok, reponse: 'confirme', motif: 'texte libre' }, 'j')).toBeNull();
    expect(validerReponse({ ...ok, plateforme: 'pc', reponse: 'confirme' }, 'j')).toBeNull();
  });

  it(`un profil n’est plus interrogé après ${SONDAGE_SEUIL} réponses utiles (« je ne sais pas » ne compte pas)`, () => {
    const r = (reponse: ReponseStockee['reponse'], profil = ok.profil): ReponseStockee => ({ jour: 'j', plateforme: 'ios', version: '1.21.0', profil, reponse });
    const liste = [r('confirme'), r('confirme'), r('corrige'), r('nsp'), r('nsp'), r('confirme')];
    expect(besoinPourProfil(liste, ok.profil)).toBe(true);
    liste.push(r('confirme'));
    expect(besoinPourProfil(liste, ok.profil)).toBe(false);
    expect(besoinPourProfil(liste, 'alterne|3/3|12h08|nuit')).toBe(true);
  });

  it('résumé par profil : confirmations, valeurs corrigées les plus fréquentes, ARTT', () => {
    const base = { jour: 'j', plateforme: 'ios' as const, version: '1.21.0', profil: ok.profil };
    const s = resumer([
      { ...base, reponse: 'confirme' },
      { ...base, reponse: 'corrige', dotations: { rtc: h(165, 54) }, motif: 'maladie' },
      { ...base, reponse: 'corrige', dotations: { rtc: h(165, 54) }, artt: 'meme' },
    ], false);
    expect(s.profils[0]).toMatchObject({
      total: 3, confirme: 1, corrige: 2, corrections: { rtc: [[h(165, 54), 2]] }, motifs: { maladie: 1 }, artt: { meme: 1, distinct: 0, nsp: 0 }, ouvert: true,
    });
  });
});
