/**
 * Bascule d'année et migrations ponctuelles.
 *
 * Deux régressions protégées :
 *
 * 1. Au 1er janvier, seules les CONSOMMATIONS étaient remises à zéro : aucun
 *    solde n'était recrédité et les CA restants disparaissaient. Un agent
 *    retrouvait « 4 CA » sans savoir d'où ils venaient — et la fiche CA affichait
 *    « Épargnés au CET : 14j » sorti de nulle part.
 *
 * 2. La migration désactivant CF/RTC à solde nul se rejouait à CHAQUE
 *    chargement : un agent ayant légitimement soldé ses RTC en fin d'année
 *    voyait le compteur disparaître définitivement.
 */
import { describe, it, expect } from 'vitest';
import { migrateUserData, DEFAULT_COUNTERS, DEFAULT_CYCLE_CONFIG, SCHEMA_VERSION } from '@/lib/storage';
import {
  CF_TOTAL_ANNUEL,
  RTC_BRUT_ANNUEL,
  RTC_NET_ANNUEL,
  ARTT_QUOTA_ANNUEL,
  RTT_QUOTA_HEBDO,
} from '@/lib/constants';
import { getCATotalForCycle } from '@/lib/calculations';
import type { Counters, UserData } from '@/lib/types';

const ANNEE = new Date().getFullYear();

function donnees(counters: Partial<Counters>, over: Partial<UserData> = {}): UserData {
  return {
    cycleConfig: { ...DEFAULT_CYCLE_CONFIG },
    counters: { ...DEFAULT_COUNTERS, ...counters },
    history: [],
    lastUpdated: new Date().toISOString(),
    isOnboarded: true,
    schemaVersion: SCHEMA_VERSION,
    ...over,
  };
}

/** Rejoue une bascule : dernier reset l'an dernier. */
const finDAnnee = (c: Partial<Counters>) => donnees(c, { lastResetYear: ANNEE - 1 });

describe('Bascule d’année', () => {
  it('reporte le reliquat de CA et de CA HP en « antérieurs »', () => {
    const apres = migrateUserData(finDAnnee({ ca: 4, caHP: 1 })).counters;
    expect(apres.caAnterieur).toBe(4);
    expect(apres.caHPAnterieur).toBe(1);
  });

  it('recrédite les quotas des compteurs activés', () => {
    const apres = migrateUserData(
      finDAnnee({
        ca: 4, cf: 1200, hasCF: true, rtc: 800, hasRTC: true,
        hasARTT: true, artt: 3, hasRTT: true, rtt: 2,
      })
    ).counters;

    expect(apres.ca).toBe(getCATotalForCycle(DEFAULT_CYCLE_CONFIG));
    expect(apres.cf).toBe(CF_TOTAL_ANNUEL);
    expect(apres.artt).toBe(ARTT_QUOTA_ANNUEL);
    expect(apres.rtt).toBe(RTT_QUOTA_HEBDO);
  });

  it('respecte le drapeau journée de solidarité pour les RTC', () => {
    const brut = migrateUserData(finDAnnee({ rtc: 0, hasRTC: true, journeeSolidariteAppliquee: false })).counters;
    expect(brut.rtc).toBe(RTC_BRUT_ANNUEL);

    const net = migrateUserData(finDAnnee({ rtc: 0, hasRTC: true, journeeSolidariteAppliquee: true })).counters;
    expect(net.rtc).toBe(RTC_NET_ANNUEL);
  });

  it('ne recrédite pas un compteur désactivé', () => {
    const apres = migrateUserData(
      finDAnnee({ cf: 0, hasCF: false, rtc: 0, hasRTC: false, hasARTT: false, hasRTT: false })
    ).counters;
    expect(apres.cf).toBe(0);
    expect(apres.rtc).toBe(0);
    expect(apres.artt).toBeUndefined();
  });

  it('ne touche pas aux compteurs qui se conservent', () => {
    const avant = { rps: 5000, hs: 3000, cet: 12, hsHistorique: 800 };
    const apres = migrateUserData(finDAnnee(avant)).counters;
    expect(apres.rps).toBe(5000);
    expect(apres.hs).toBe(3000);
    expect(apres.cet).toBe(12);
    expect(apres.hsHistorique).toBe(800);
  });

  it('remet les consommations à zéro', () => {
    const apres = migrateUserData(
      finDAnnee({ caConsommes: 14, caPosesHorsPeriode: 8, cfConsoS1: 3276, cfConsoS2: 2076 })
    ).counters;
    expect(apres.caConsommes).toBe(0);
    expect(apres.caPosesHorsPeriode).toBe(0);
    expect(apres.cfConsoS1).toBe(0);
    expect(apres.cfConsoS2).toBe(0);
    expect(apres.caHP).toBe(0);
  });

  it('ne se déclenche pas deux fois dans la même année', () => {
    const apresPremiere = migrateUserData(finDAnnee({ ca: 4 }));
    expect(apresPremiere.lastResetYear).toBe(ANNEE);

    // Deuxième chargement : l'agent a consommé 2 CA entre-temps.
    apresPremiere.counters.ca -= 2;
    const apresSeconde = migrateUserData(JSON.parse(JSON.stringify(apresPremiere)));
    expect(apresSeconde.counters.ca).toBe(getCATotalForCycle(DEFAULT_CYCLE_CONFIG) - 2);
  });
});

describe('Migration ponctuelle CF/RTC', () => {
  it('n’est plus rejouée une fois le schéma à jour', () => {
    // Agent ayant légitimement soldé ses RTC : le compteur doit rester actif.
    const apres = migrateUserData(
      donnees({ rtc: 0, hasRTC: true, cf: 0, hasCF: true }, { lastResetYear: ANNEE })
    ).counters;
    expect(apres.hasRTC).toBe(true);
    expect(apres.hasCF).toBe(true);
  });

  it('s’applique une fois aux anciennes données, puis jamais plus', () => {
    const ancien = donnees(
      { rtc: 0, hasRTC: true, cf: 0, hasCF: true, cfConsoS1: 0, cfConsoS2: 0 },
      { lastResetYear: ANNEE }
    );
    delete ancien.schemaVersion; // profil antérieur au numéro de schéma

    const apres = migrateUserData(ancien);
    expect(apres.counters.hasRTC).toBe(false); // corrigé une fois
    expect(apres.schemaVersion).toBe(SCHEMA_VERSION);

    // L'agent réactive son compteur : la migration ne doit plus le désactiver.
    apres.counters.hasRTC = true;
    const rejoue = migrateUserData(JSON.parse(JSON.stringify(apres)));
    expect(rejoue.counters.hasRTC).toBe(true);
  });
});
