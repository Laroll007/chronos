import { describe, it, expect } from 'vitest';
import {
  getWeekType,
  isWorkingDay,
  isSundayWorked,
  countWorkingDays,
  getCAParCycle,
  calculerRTCNet,
  isInCAHPPeriod,
  checkCAHPCondition,
  getCANeededForHP,
  getCurrentSemester,
  getCFRemainingForSemester,
  getRTCLibres,
  isRTCReservesEntames,
  calculateRTCLoss,
  getCETMargeDisponible,
  getCETApportMaxAnnee,
  formatMinutes,
  parseTimeToMinutes,
  getDaysUntil,
  calculateUrgencyPercent,
  getUrgencyColor,
} from '../calculations';
import {
  RTC_RESERVES_CET,
  JOURNEE_SOLIDARITE,
  CF_PAR_SEMESTRE,
  CET_PLAFOND,
  CET_APPORT_ANNUEL_MAX,
  CA_REQUIS_POUR_HP,
  CA_HP_BONUS,
} from '../constants';
import { CycleConfig } from '../types';

// Configuration de cycle de test
const mockCycleConfig: CycleConfig = {
  type: 'alterne',
  pattern: '2/2/3/2/2/3',
  heuresParJour: 728, // 12h08
  dateDebutCycle: '2026-01-05', // Lundi = début semaine B
  semaineActuelle: 'B',
  semaineA: {
    lundi: false,
    mardi: false,
    mercredi: true,
    jeudi: true,
    vendredi: false,
    samedi: false,
    dimanche: false,
  },
  semaineB: {
    lundi: true,
    mardi: true,
    mercredi: false,
    jeudi: false,
    vendredi: true,
    samedi: true,
    dimanche: true,
  },
};

describe('Calculs de cycle', () => {
  describe('getWeekType', () => {
    it('retourne B pour la semaine de début de cycle', () => {
      const date = new Date('2026-01-05'); // Lundi 5 janvier
      expect(getWeekType(date, mockCycleConfig)).toBe('B');
    });

    it('retourne A pour la semaine suivante', () => {
      const date = new Date('2026-01-12'); // Lundi 12 janvier
      expect(getWeekType(date, mockCycleConfig)).toBe('A');
    });

    it('alterne correctement les semaines', () => {
      expect(getWeekType(new Date('2026-01-05'), mockCycleConfig)).toBe('B');
      expect(getWeekType(new Date('2026-01-12'), mockCycleConfig)).toBe('A');
      expect(getWeekType(new Date('2026-01-19'), mockCycleConfig)).toBe('B');
      expect(getWeekType(new Date('2026-01-26'), mockCycleConfig)).toBe('A');
    });
  });

  describe('isWorkingDay', () => {
    it('retourne true pour un jour travaillé en semaine B', () => {
      // Lundi 5 janvier 2026 = semaine B, lundi travaillé
      const date = new Date('2026-01-05');
      expect(isWorkingDay(date, mockCycleConfig)).toBe(true);
    });

    it('retourne false pour un jour de repos en semaine B', () => {
      // Mercredi 7 janvier 2026 = semaine B, mercredi non travaillé
      const date = new Date('2026-01-07');
      expect(isWorkingDay(date, mockCycleConfig)).toBe(false);
    });

    it('retourne true pour un jour travaillé en semaine A', () => {
      // Mercredi 14 janvier 2026 = semaine A, mercredi travaillé
      const date = new Date('2026-01-14');
      expect(isWorkingDay(date, mockCycleConfig)).toBe(true);
    });
  });

  describe('isSundayWorked', () => {
    it('retourne true pour un dimanche travaillé', () => {
      // Dimanche 11 janvier 2026 = semaine B, dimanche travaillé
      const date = new Date('2026-01-11');
      expect(isSundayWorked(date, mockCycleConfig)).toBe(true);
    });

    it('retourne false pour un dimanche non travaillé', () => {
      // Dimanche 18 janvier 2026 = semaine A, dimanche non travaillé
      const date = new Date('2026-01-18');
      expect(isSundayWorked(date, mockCycleConfig)).toBe(false);
    });
  });

  describe('countWorkingDays', () => {
    it('compte correctement les jours travaillés', () => {
      const start = new Date('2026-01-05');
      const end = new Date('2026-01-11');
      // Semaine B : lun, mar, ven, sam, dim = 5 jours
      expect(countWorkingDays(start, end, mockCycleConfig)).toBe(5);
    });

    it('retourne 0 pour une période sans jours travaillés', () => {
      const start = new Date('2026-01-07'); // Mercredi
      const end = new Date('2026-01-08');   // Jeudi
      // Semaine B : mer et jeu non travaillés
      expect(countWorkingDays(start, end, mockCycleConfig)).toBe(0);
    });
  });
});

describe('Calculs CA APORTT', () => {
  describe('getCAParCycle', () => {
    it('retourne 23 CA pour cycle 4/2', () => {
      expect(getCAParCycle('4/2')).toBe(23);
    });

    it('retourne 18 CA pour cycle 2/2/3/2/2/3', () => {
      expect(getCAParCycle('2/2/3/2/2/3')).toBe(18);
    });

    it('retourne 18 CA pour cycle 2/2', () => {
      expect(getCAParCycle('2/2')).toBe(18);
    });

    it('retourne 18 CA pour cycle 3/3', () => {
      expect(getCAParCycle('3/3')).toBe(18);
    });

    it('retourne 18 CA pour vacation_forte', () => {
      expect(getCAParCycle('vacation_forte')).toBe(18);
    });

    it('retourne 18 CA par défaut si pattern undefined', () => {
      expect(getCAParCycle(undefined)).toBe(18);
    });
  });
});

describe('Calculs RTC et Journée Solidarité', () => {
  describe('calculerRTCNet', () => {
    it('déduit la journée de solidarité du RTC brut', () => {
      const rtcBrut = 11229; // 187h09
      const result = calculerRTCNet(rtcBrut, '2/2/3/2/2/3', true);

      expect(result.rtcNet).toBe(rtcBrut - JOURNEE_SOLIDARITE);
      expect(result.deductionJS).toBe(JOURNEE_SOLIDARITE);
    });

    it('ne déduit rien si JS pas appliquée', () => {
      const rtcBrut = 11229;
      const result = calculerRTCNet(rtcBrut, '2/2/3/2/2/3', false);

      expect(result.rtcNet).toBe(rtcBrut);
      expect(result.deductionJS).toBe(0);
    });

    it('identifie les cycles exclus de compensation HS', () => {
      expect(calculerRTCNet(11229, '2/2/3/2/2/3', true).estExcluCompensationHS).toBe(true);
      expect(calculerRTCNet(11229, '2/2', true).estExcluCompensationHS).toBe(true);
      expect(calculerRTCNet(11229, '3/3', true).estExcluCompensationHS).toBe(true);
      expect(calculerRTCNet(11229, 'vacation_forte', true).estExcluCompensationHS).toBe(true);
    });

    it('ne retourne jamais un RTC négatif', () => {
      const result = calculerRTCNet(100, '2/2/3/2/2/3', true);
      expect(result.rtcNet).toBe(0);
    });
  });
});

describe('Calculs CA HP', () => {
  describe('isInCAHPPeriod', () => {
    it('retourne true pour janvier-avril', () => {
      expect(isInCAHPPeriod(new Date('2026-01-15'))).toBe(true);
      expect(isInCAHPPeriod(new Date('2026-02-15'))).toBe(true);
      expect(isInCAHPPeriod(new Date('2026-03-15'))).toBe(true);
      expect(isInCAHPPeriod(new Date('2026-04-15'))).toBe(true);
    });

    it('retourne true pour novembre-décembre', () => {
      expect(isInCAHPPeriod(new Date('2026-11-15'))).toBe(true);
      expect(isInCAHPPeriod(new Date('2026-12-15'))).toBe(true);
    });

    it('retourne false pour mai-octobre (période estivale)', () => {
      expect(isInCAHPPeriod(new Date('2026-05-15'))).toBe(false);
      expect(isInCAHPPeriod(new Date('2026-06-15'))).toBe(false);
      expect(isInCAHPPeriod(new Date('2026-07-15'))).toBe(false);
      expect(isInCAHPPeriod(new Date('2026-08-15'))).toBe(false);
      expect(isInCAHPPeriod(new Date('2026-09-15'))).toBe(false);
      expect(isInCAHPPeriod(new Date('2026-10-15'))).toBe(false);
    });
  });

  describe('checkCAHPCondition', () => {
    it('retourne 2 si 8+ CA posés hors période', () => {
      expect(checkCAHPCondition(8)).toBe(CA_HP_BONUS);
      expect(checkCAHPCondition(10)).toBe(CA_HP_BONUS);
    });

    it('retourne 0 si moins de 8 CA posés hors période', () => {
      expect(checkCAHPCondition(7)).toBe(0);
      expect(checkCAHPCondition(0)).toBe(0);
    });
  });

  describe('getCANeededForHP', () => {
    it('retourne le nombre de CA manquants', () => {
      expect(getCANeededForHP(0)).toBe(CA_REQUIS_POUR_HP);
      expect(getCANeededForHP(5)).toBe(3);
      expect(getCANeededForHP(7)).toBe(1);
    });

    it('retourne 0 si condition déjà atteinte', () => {
      expect(getCANeededForHP(8)).toBe(0);
      expect(getCANeededForHP(10)).toBe(0);
    });
  });
});

describe('Calculs CF par semestre', () => {
  describe('getCurrentSemester', () => {
    it('retourne 1 pour janvier-juin', () => {
      expect(getCurrentSemester(new Date('2026-01-15'))).toBe(1);
      expect(getCurrentSemester(new Date('2026-06-15'))).toBe(1);
    });

    it('retourne 2 pour juillet-décembre', () => {
      expect(getCurrentSemester(new Date('2026-07-15'))).toBe(2);
      expect(getCurrentSemester(new Date('2026-12-15'))).toBe(2);
    });
  });

  describe('getCFRemainingForSemester', () => {
    it('retourne CF restants pour S1', () => {
      expect(getCFRemainingForSemester(1, 1000, 0)).toBe(CF_PAR_SEMESTRE - 1000);
    });

    it('retourne CF restants pour S2', () => {
      expect(getCFRemainingForSemester(2, 0, 2000)).toBe(CF_PAR_SEMESTRE - 2000);
    });

    it('ne retourne jamais un nombre négatif', () => {
      expect(getCFRemainingForSemester(1, 10000, 0)).toBe(0);
    });
  });
});

describe('Calculs RTC', () => {
  describe('getRTCLibres', () => {
    it('retourne les RTC au-delà de la réserve CET', () => {
      const rtcTotal = RTC_RESERVES_CET + 1000;
      expect(getRTCLibres(rtcTotal)).toBe(1000);
    });

    it('retourne 0 si RTC sous la réserve', () => {
      expect(getRTCLibres(RTC_RESERVES_CET - 100)).toBe(0);
    });

    it('retourne 0 si RTC égal à la réserve', () => {
      expect(getRTCLibres(RTC_RESERVES_CET)).toBe(0);
    });
  });

  describe('isRTCReservesEntames', () => {
    it('retourne true si RTC sous la réserve', () => {
      expect(isRTCReservesEntames(RTC_RESERVES_CET - 100)).toBe(true);
    });

    it('retourne false si RTC au-dessus ou égal à la réserve', () => {
      expect(isRTCReservesEntames(RTC_RESERVES_CET)).toBe(false);
      expect(isRTCReservesEntames(RTC_RESERVES_CET + 100)).toBe(false);
    });
  });

  describe('calculateRTCLoss', () => {
    it('retourne 0 si réserves non entamées', () => {
      expect(calculateRTCLoss(RTC_RESERVES_CET)).toBe(0);
      expect(calculateRTCLoss(RTC_RESERVES_CET + 1000)).toBe(0);
    });

    it('calcule la perte si réserves entamées', () => {
      // Si on a perdu 501 min (1 jour CET), on perd le gain de 227 min
      const loss = calculateRTCLoss(RTC_RESERVES_CET - 501);
      expect(loss).toBeGreaterThan(0);
    });
  });
});

describe('Calculs CET', () => {
  describe('getCETMargeDisponible', () => {
    it('retourne la marge jusqu\'au plafond', () => {
      expect(getCETMargeDisponible(0)).toBe(CET_PLAFOND);
      expect(getCETMargeDisponible(30)).toBe(CET_PLAFOND - 30);
    });

    it('retourne 0 si plafond atteint', () => {
      expect(getCETMargeDisponible(CET_PLAFOND)).toBe(0);
      expect(getCETMargeDisponible(CET_PLAFOND + 10)).toBe(0);
    });
  });

  describe('getCETApportMaxAnnee', () => {
    it('retourne le minimum entre marge et apport annuel max', () => {
      expect(getCETApportMaxAnnee(0)).toBe(CET_APPORT_ANNUEL_MAX);
      expect(getCETApportMaxAnnee(50)).toBe(Math.min(CET_PLAFOND - 50, CET_APPORT_ANNUEL_MAX));
    });

    it('retourne 0 si plafond atteint', () => {
      expect(getCETApportMaxAnnee(CET_PLAFOND)).toBe(0);
    });
  });
});

describe('Utilitaires', () => {
  describe('formatMinutes', () => {
    it('formate correctement les heures et minutes', () => {
      expect(formatMinutes(0)).toBe('0h00');
      expect(formatMinutes(60)).toBe('1h00');
      expect(formatMinutes(90)).toBe('1h30');
      expect(formatMinutes(728)).toBe('12h08');
    });
  });

  describe('parseTimeToMinutes', () => {
    it('parse correctement une chaîne horaire', () => {
      expect(parseTimeToMinutes('1h00')).toBe(60);
      expect(parseTimeToMinutes('1h30')).toBe(90);
      expect(parseTimeToMinutes('12h08')).toBe(728);
    });

    it('retourne 0 pour une chaîne invalide', () => {
      expect(parseTimeToMinutes('invalid')).toBe(0);
    });
  });

  describe('getDaysUntil', () => {
    it('calcule les jours jusqu\'à une date future', () => {
      const from = new Date('2026-01-01');
      const target = new Date('2026-01-11');
      expect(getDaysUntil(target, from)).toBe(10);
    });

    it('retourne un nombre négatif pour une date passée', () => {
      const from = new Date('2026-01-11');
      const target = new Date('2026-01-01');
      expect(getDaysUntil(target, from)).toBeLessThan(0);
    });
  });

  describe('calculateUrgencyPercent', () => {
    it('retourne 0 si beaucoup de temps restant', () => {
      expect(calculateUrgencyPercent(100, 100)).toBe(0);
    });

    it('retourne 100 si deadline passée', () => {
      expect(calculateUrgencyPercent(0, 100)).toBe(100);
      expect(calculateUrgencyPercent(-5, 100)).toBe(100);
    });

    it('retourne un pourcentage intermédiaire', () => {
      expect(calculateUrgencyPercent(50, 100)).toBe(50);
      expect(calculateUrgencyPercent(25, 100)).toBe(75);
    });
  });

  describe('getUrgencyColor', () => {
    it('retourne success pour faible urgence', () => {
      expect(getUrgencyColor(0)).toBe('success');
      expect(getUrgencyColor(49)).toBe('success');
    });

    it('retourne warning pour urgence moyenne', () => {
      expect(getUrgencyColor(50)).toBe('warning');
      expect(getUrgencyColor(79)).toBe('warning');
    });

    it('retourne error pour haute urgence', () => {
      expect(getUrgencyColor(80)).toBe('error');
      expect(getUrgencyColor(100)).toBe('error');
    });
  });
});
