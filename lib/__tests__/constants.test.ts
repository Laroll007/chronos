// Tests pour lib/constants.ts - Valeurs APORTT
import { describe, it, expect } from 'vitest';
import {
  // Durées
  HEURES_PAR_JOUR,
  // CA
  CA_TOTAL_ANNUEL,
  CA_MAX_VERS_CET,
  CA_REQUIS_POUR_HP,
  CA_HP_BONUS,
  CA_PAR_CYCLE,
  // CF
  CF_TOTAL_ANNUEL,
  CF_PAR_SEMESTRE,
  // RTC
  RTC_BRUT_ANNUEL,
  JOURNEE_SOLIDARITE,
  RTC_NET_ANNUEL,
  RTC_TOTAL_ANNUEL,
  RTC_JOURS_ANNUELS,
  RTC_COUT_PAR_JOUR_CET,
  RTC_VALEUR_REELLE_JOUR,
  RTC_GAIN_PAR_JOUR,
  RTC_MAX_JOURS_CET,
  RTC_RESERVES_CET,
  RTC_GAIN_ANNUEL_TOTAL,
  RTC_LIBRES,
  CYCLES_EXCLUS_ABONDEMENT_HS,
  // RPS
  RPS_PAR_DIMANCHE,
  RPS_DIMANCHES_ANNUELS_ALTERNE,
  RPS_ANNUEL_ESTIME,
  COEFFICIENTS_RPS,
  // HS
  HS_MAX_STOCKABLES,
  HS_MAX_VERS_CET,
  // CET
  CET_PLAFOND,
  CET_APPORT_ANNUEL_MAX,
  // Dates
  DEADLINE_FIN_ANNEE,
  DEADLINE_S1,
  DEADLINE_S2,
  CA_HP_PERIODE_1_DEBUT,
  CA_HP_PERIODE_1_FIN,
  CA_HP_PERIODE_2_DEBUT,
  CA_HP_PERIODE_2_FIN,
  // Labels et couleurs
  COUNTER_LABELS,
  COUNTER_COLORS,
  JOURS_SEMAINE,
  // App
  APP_VERSION,
  STORAGE_KEY,
} from '../constants';

// ============================================
// HELPER : Conversion minutes -> heures
// ============================================
function minutesToHoursMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h${m.toString().padStart(2, '0')}`;
}

// ============================================
// TESTS DES DURÉES EN MINUTES
// ============================================

describe('Durées en minutes', () => {
  it('HEURES_PAR_JOUR = 12h08 (728 minutes)', () => {
    expect(HEURES_PAR_JOUR).toBe(728);
    expect(minutesToHoursMinutes(HEURES_PAR_JOUR)).toBe('12h08');
  });
});

// ============================================
// TESTS DES CONGÉS ANNUELS (CA)
// ============================================

describe('Congés Annuels (CA)', () => {
  it('CA_TOTAL_ANNUEL = 18 jours', () => {
    expect(CA_TOTAL_ANNUEL).toBe(18);
  });

  it('CA_MAX_VERS_CET = 5 jours', () => {
    expect(CA_MAX_VERS_CET).toBe(5);
  });

  it('CA_REQUIS_POUR_HP = 8 jours', () => {
    expect(CA_REQUIS_POUR_HP).toBe(8);
  });

  it('CA_HP_BONUS = 2 jours', () => {
    expect(CA_HP_BONUS).toBe(2);
  });

  describe('CA_PAR_CYCLE', () => {
    it('cycle 4/2 = 23 CA', () => {
      expect(CA_PAR_CYCLE['4/2']).toBe(23);
    });

    it('cycle 2/2 = 18 CA', () => {
      expect(CA_PAR_CYCLE['2/2']).toBe(18);
    });

    it('cycle 3/3 = 18 CA', () => {
      expect(CA_PAR_CYCLE['3/3']).toBe(18);
    });

    it('cycle 2/2/3/2/2/3 = 18 CA', () => {
      expect(CA_PAR_CYCLE['2/2/3/2/2/3']).toBe(18);
    });

    it('vacation_forte = 18 CA', () => {
      expect(CA_PAR_CYCLE['vacation_forte']).toBe(18);
    });

    it('tous les cycles de 12h08 ont 18 CA', () => {
      const cycles12h08 = ['2/2', '3/3', '2/2/3/2/2/3'];
      cycles12h08.forEach(cycle => {
        expect(CA_PAR_CYCLE[cycle]).toBe(18);
      });
    });
  });
});

// ============================================
// TESTS DES CRÉDITS FÉRIÉS (CF)
// ============================================

describe('Crédits Fériés (CF)', () => {
  it('CF_TOTAL_ANNUEL = 109h12 (6552 minutes)', () => {
    expect(CF_TOTAL_ANNUEL).toBe(6552);
    expect(minutesToHoursMinutes(CF_TOTAL_ANNUEL)).toBe('109h12');
  });

  it('CF_PAR_SEMESTRE = 54h36 (3276 minutes)', () => {
    expect(CF_PAR_SEMESTRE).toBe(3276);
    expect(minutesToHoursMinutes(CF_PAR_SEMESTRE)).toBe('54h36');
  });

  it('CF total = 2 × CF semestre', () => {
    expect(CF_TOTAL_ANNUEL).toBe(CF_PAR_SEMESTRE * 2);
  });
});

// ============================================
// TESTS RTC
// ============================================

describe('RTC - Récupération Temps de Cycle', () => {
  it('RTC_BRUT_ANNUEL = 187h09 (11229 minutes)', () => {
    expect(RTC_BRUT_ANNUEL).toBe(11229);
    expect(minutesToHoursMinutes(RTC_BRUT_ANNUEL)).toBe('187h09');
  });

  it('JOURNEE_SOLIDARITE = 12h08 = HEURES_PAR_JOUR', () => {
    expect(JOURNEE_SOLIDARITE).toBe(HEURES_PAR_JOUR);
    expect(JOURNEE_SOLIDARITE).toBe(728);
  });

  it('RTC_NET_ANNUEL = brut - JS = 175h01 (10501 minutes)', () => {
    expect(RTC_NET_ANNUEL).toBe(RTC_BRUT_ANNUEL - JOURNEE_SOLIDARITE);
    expect(RTC_NET_ANNUEL).toBe(10501);
    expect(minutesToHoursMinutes(RTC_NET_ANNUEL)).toBe('175h01');
  });

  it('RTC_TOTAL_ANNUEL = RTC_NET_ANNUEL (alias)', () => {
    expect(RTC_TOTAL_ANNUEL).toBe(RTC_NET_ANNUEL);
  });

  it('RTC_JOURS_ANNUELS = 15 jours', () => {
    expect(RTC_JOURS_ANNUELS).toBe(15);
  });

  describe('Conversion RTC → CET', () => {
    it('RTC_COUT_PAR_JOUR_CET = 8h21 (501 minutes)', () => {
      expect(RTC_COUT_PAR_JOUR_CET).toBe(501);
      expect(minutesToHoursMinutes(RTC_COUT_PAR_JOUR_CET)).toBe('8h21');
    });

    it('RTC_VALEUR_REELLE_JOUR = 12h08 (728 minutes)', () => {
      expect(RTC_VALEUR_REELLE_JOUR).toBe(HEURES_PAR_JOUR);
      expect(RTC_VALEUR_REELLE_JOUR).toBe(728);
    });

    it('RTC_GAIN_PAR_JOUR = 12h08 - 8h21 = 3h47 (227 minutes)', () => {
      expect(RTC_GAIN_PAR_JOUR).toBe(RTC_VALEUR_REELLE_JOUR - RTC_COUT_PAR_JOUR_CET);
      expect(RTC_GAIN_PAR_JOUR).toBe(227);
      expect(minutesToHoursMinutes(RTC_GAIN_PAR_JOUR)).toBe('3h47');
    });

    it('RTC_MAX_JOURS_CET = 10 jours', () => {
      expect(RTC_MAX_JOURS_CET).toBe(10);
    });

    it('RTC_RESERVES_CET = 10 × 8h21 = 83h30 (5010 minutes)', () => {
      expect(RTC_RESERVES_CET).toBe(RTC_COUT_PAR_JOUR_CET * RTC_MAX_JOURS_CET);
      expect(RTC_RESERVES_CET).toBe(5010);
      expect(minutesToHoursMinutes(RTC_RESERVES_CET)).toBe('83h30');
    });

    it('RTC_GAIN_ANNUEL_TOTAL = 10 × 3h47 = 37h50 (2270 minutes)', () => {
      expect(RTC_GAIN_ANNUEL_TOTAL).toBe(RTC_GAIN_PAR_JOUR * RTC_MAX_JOURS_CET);
      expect(RTC_GAIN_ANNUEL_TOTAL).toBe(2270);
      expect(minutesToHoursMinutes(RTC_GAIN_ANNUEL_TOTAL)).toBe('37h50');
    });

    it('RTC_LIBRES = total - réservés', () => {
      expect(RTC_LIBRES).toBe(RTC_TOTAL_ANNUEL - RTC_RESERVES_CET);
    });
  });

  it('CYCLES_EXCLUS_ABONDEMENT_HS contient les bons cycles', () => {
    expect(CYCLES_EXCLUS_ABONDEMENT_HS).toContain('2/2');
    expect(CYCLES_EXCLUS_ABONDEMENT_HS).toContain('3/3');
    expect(CYCLES_EXCLUS_ABONDEMENT_HS).toContain('2/2/3/2/2/3');
    expect(CYCLES_EXCLUS_ABONDEMENT_HS).toContain('vacation_forte');
    expect(CYCLES_EXCLUS_ABONDEMENT_HS).not.toContain('4/2');
  });
});

// ============================================
// TESTS RPS
// ============================================

describe('RPS - Récupération Dimanche', () => {
  it('RPS_PAR_DIMANCHE = 4h51 (291 minutes)', () => {
    expect(RPS_PAR_DIMANCHE).toBe(291);
    expect(minutesToHoursMinutes(RPS_PAR_DIMANCHE)).toBe('4h51');
  });

  it('RPS = 40% de la journée (12h08 × 0.4)', () => {
    const expected = Math.round(HEURES_PAR_JOUR * 0.4);
    expect(RPS_PAR_DIMANCHE).toBe(expected);
  });

  it('RPS_DIMANCHES_ANNUELS_ALTERNE = 26', () => {
    expect(RPS_DIMANCHES_ANNUELS_ALTERNE).toBe(26);
  });

  it('RPS_ANNUEL_ESTIME = 26 × 4h51 = 126h06 (7566 minutes)', () => {
    expect(RPS_ANNUEL_ESTIME).toBe(RPS_PAR_DIMANCHE * RPS_DIMANCHES_ANNUELS_ALTERNE);
    expect(RPS_ANNUEL_ESTIME).toBe(7566);
    expect(minutesToHoursMinutes(RPS_ANNUEL_ESTIME)).toBe('126h06');
  });

  describe('COEFFICIENTS_RPS', () => {
    it('nuit = 0.1', () => {
      expect(COEFFICIENTS_RPS.nuit).toBe(0.1);
    });

    it('dimanche = 0.4', () => {
      expect(COEFFICIENTS_RPS.dimanche).toBe(0.4);
    });

    it('decalee_rc = 0.25', () => {
      expect(COEFFICIENTS_RPS.decalee_rc).toBe(0.25);
    });

    it('decalee_rl_jf = 0.60', () => {
      expect(COEFFICIENTS_RPS.decalee_rl_jf).toBe(0.60);
    });

    it('repos_manque = 0.15', () => {
      expect(COEFFICIENTS_RPS.repos_manque).toBe(0.15);
    });
  });
});

// ============================================
// TESTS HS ET CET
// ============================================

describe('Heures Supplémentaires (HS)', () => {
  it('HS_MAX_STOCKABLES = 160h (9600 minutes)', () => {
    expect(HS_MAX_STOCKABLES).toBe(9600);
  });

  it('HS_MAX_VERS_CET = 5 jours', () => {
    expect(HS_MAX_VERS_CET).toBe(5);
  });
});

describe('CET - Compte Épargne Temps', () => {
  it('CET_PLAFOND = 60 jours', () => {
    expect(CET_PLAFOND).toBe(60);
  });

  it('CET_APPORT_ANNUEL_MAX = 15 jours', () => {
    expect(CET_APPORT_ANNUEL_MAX).toBe(15);
  });

  it('apport annuel max = 10 RTC + 5 CA = 15', () => {
    expect(CET_APPORT_ANNUEL_MAX).toBe(RTC_MAX_JOURS_CET + CA_MAX_VERS_CET);
  });
});

// ============================================
// TESTS DATES IMPORTANTES
// ============================================

describe('Dates importantes', () => {
  it('DEADLINE_FIN_ANNEE = 12-31', () => {
    expect(DEADLINE_FIN_ANNEE).toBe('12-31');
  });

  it('DEADLINE_S1 = 06-30', () => {
    expect(DEADLINE_S1).toBe('06-30');
  });

  it('DEADLINE_S2 = 12-31', () => {
    expect(DEADLINE_S2).toBe('12-31');
  });

  describe('Périodes CA HP', () => {
    it('période 1 = 01-01 au 04-30', () => {
      expect(CA_HP_PERIODE_1_DEBUT).toBe('01-01');
      expect(CA_HP_PERIODE_1_FIN).toBe('04-30');
    });

    it('période 2 = 11-01 au 12-31', () => {
      expect(CA_HP_PERIODE_2_DEBUT).toBe('11-01');
      expect(CA_HP_PERIODE_2_FIN).toBe('12-31');
    });
  });
});

// ============================================
// TESTS LABELS ET COULEURS
// ============================================

describe('COUNTER_LABELS', () => {
  const expectedCounters = ['ca', 'caHP', 'cf', 'rtc', 'rtcReserves', 'rtcLibres', 'rtt', 'rps', 'hs', 'cet'];

  it('contient tous les compteurs', () => {
    expectedCounters.forEach(counter => {
      expect(COUNTER_LABELS[counter]).toBeDefined();
    });
  });

  it('chaque compteur a name, description, unit', () => {
    Object.values(COUNTER_LABELS).forEach(label => {
      expect(label).toHaveProperty('name');
      expect(label).toHaveProperty('description');
      expect(label).toHaveProperty('unit');
      expect(typeof label.name).toBe('string');
      expect(typeof label.description).toBe('string');
      expect(typeof label.unit).toBe('string');
    });
  });

  it('unités correctes (jours ou heures)', () => {
    expect(COUNTER_LABELS.ca.unit).toBe('jours');
    expect(COUNTER_LABELS.cf.unit).toBe('heures');
    expect(COUNTER_LABELS.rtc.unit).toBe('heures');
    expect(COUNTER_LABELS.cet.unit).toBe('jours');
  });
});

describe('COUNTER_COLORS', () => {
  const expectedCounters = ['ca', 'caHP', 'cf', 'rtc', 'rtcReserves', 'rtt', 'rps', 'hs', 'cet'];

  it('contient tous les compteurs principaux', () => {
    expectedCounters.forEach(counter => {
      expect(COUNTER_COLORS[counter]).toBeDefined();
    });
  });

  it('chaque compteur a gradient, bg, text', () => {
    Object.values(COUNTER_COLORS).forEach(color => {
      expect(color).toHaveProperty('gradient');
      expect(color).toHaveProperty('bg');
      expect(color).toHaveProperty('text');
    });
  });

  it('les couleurs utilisent les bonnes classes Tailwind', () => {
    Object.values(COUNTER_COLORS).forEach(color => {
      expect(color.gradient).toMatch(/^from-/);
      expect(color.bg).toMatch(/^bg-/);
      expect(color.text).toMatch(/^text-/);
    });
  });
});

// ============================================
// TESTS JOURS DE LA SEMAINE
// ============================================

describe('JOURS_SEMAINE', () => {
  it('contient 7 jours', () => {
    expect(JOURS_SEMAINE).toHaveLength(7);
  });

  it('commence par lundi (convention française)', () => {
    expect(JOURS_SEMAINE[0].key).toBe('lundi');
  });

  it('termine par dimanche', () => {
    expect(JOURS_SEMAINE[6].key).toBe('dimanche');
  });

  it('chaque jour a key, label, short', () => {
    JOURS_SEMAINE.forEach(jour => {
      expect(jour).toHaveProperty('key');
      expect(jour).toHaveProperty('label');
      expect(jour).toHaveProperty('short');
    });
  });

  it('les clés correspondent aux jours en minuscules', () => {
    const expectedKeys = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
    JOURS_SEMAINE.forEach((jour, index) => {
      expect(jour.key).toBe(expectedKeys[index]);
    });
  });

  it('les abréviations font 3 caractères', () => {
    JOURS_SEMAINE.forEach(jour => {
      expect(jour.short).toHaveLength(3);
    });
  });
});

// ============================================
// TESTS APP
// ============================================

describe('Constantes App', () => {
  it('APP_VERSION est une version semver', () => {
    expect(APP_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('STORAGE_KEY est défini', () => {
    expect(STORAGE_KEY).toBe('chronos_data');
  });
});

// ============================================
// TESTS DE COHÉRENCE ENTRE CONSTANTES
// ============================================

describe('Cohérence entre constantes', () => {
  it('RTC libres + réservés = RTC total', () => {
    expect(RTC_LIBRES + RTC_RESERVES_CET).toBe(RTC_TOTAL_ANNUEL);
  });

  it('RTC net = brut - journée solidarité', () => {
    expect(RTC_NET_ANNUEL).toBe(RTC_BRUT_ANNUEL - JOURNEE_SOLIDARITE);
  });

  it('gain CET = (valeur réelle - coût) × max jours', () => {
    expect(RTC_GAIN_ANNUEL_TOTAL).toBe(
      (RTC_VALEUR_REELLE_JOUR - RTC_COUT_PAR_JOUR_CET) * RTC_MAX_JOURS_CET
    );
  });

  it('CF total = 2 × CF semestre', () => {
    expect(CF_TOTAL_ANNUEL).toBe(2 * CF_PAR_SEMESTRE);
  });
});
