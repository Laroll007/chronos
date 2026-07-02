import { describe, it, expect } from 'vitest';
import { simulatePose } from '../calculations';
import { Counters } from '../types';

// ─── Compteurs de base avec tous les champs activés ───────────────────────────

const BASE_COUNTERS: Counters = {
  // Compteurs courants
  ca: 18,
  caConsommes: 0,
  caPosesHorsPeriode: 0,
  caHP: 2,
  cf: 6552,
  cfConsoS1: 0,
  cfConsoS2: 0,
  rtc: 10501,
  rtcReservesCET: 5010,
  hasRTT: false,
  rtt: undefined,
  rps: 2000,
  rpsAnneePrec: 0,
  hs: 1000,
  cet: 10,
  objectifCET: 15,
  journeeSolidariteAppliquee: false,
  // Nouveaux compteurs
  hasARTT: true,
  artt: 12,
  caAnterieur: 3,
  caHPAnterieur: 2,
  hasCET2008: true,
  cet2008: 8,
  hasCongesBonifies: true,
  congesBonifies: 31,
  congesBonifiesDateOuverture: '2025-01-01',
  hsHistorique: 7200, // 120h
};

// Date hors periode HP (juin) pour eviter les effets de bord CA HP
const DATE_JUIN = new Date('2026-06-15');
// Date en periode HP (fevrier) pour les tests CA anterieurs
const DATE_FEVRIER = new Date('2026-02-10');

// ─── Helper : simule l'annulation exactement comme deleteHistoryEntry ─────────

function applyCancel(
  counters: Counters,
  type: string,
  amount: number
): Counters {
  const c = { ...counters };
  switch (type) {
    case 'caHPAnterieur':
      c.caHPAnterieur += amount;
      break;
    case 'caAnterieur':
      c.caAnterieur += amount;
      break;
    case 'artt':
      c.artt = (c.artt ?? 0) + amount;
      break;
    case 'rtt':
      c.rtt = (c.rtt ?? 0) + amount;
      break;
    case 'cet2008':
      c.cet2008 = (c.cet2008 ?? 0) + amount;
      break;
    case 'congesBonifies':
      c.congesBonifies = (c.congesBonifies ?? 0) + amount;
      break;
    case 'hsHistorique':
      c.hsHistorique += amount;
      break;
  }
  return c;
}

// ─────────────────────────────────────────────────────────────────────────────
// CA HP ANTERIEUR
// ─────────────────────────────────────────────────────────────────────────────

describe('simulatePose - CA HP Anterieur', () => {
  const amount = 1;

  it('pose valide : decremente caHPAnterieur', () => {
    const result = simulatePose(BASE_COUNTERS, 'caHPAnterieur', amount, DATE_FEVRIER);

    expect(result.isValid).toBe(true);
    expect(result.newCounters.caHPAnterieur).toBe(BASE_COUNTERS.caHPAnterieur - amount);
  });

  it('pose invalide si montant > solde disponible', () => {
    const result = simulatePose(BASE_COUNTERS, 'caHPAnterieur', 99, DATE_FEVRIER);

    expect(result.isValid).toBe(false);
    expect(result.errorMessage).toContain('CA HP ant');
  });

  it('ne touche pas aux autres compteurs', () => {
    const result = simulatePose(BASE_COUNTERS, 'caHPAnterieur', amount, DATE_FEVRIER);

    expect(result.newCounters.ca).toBe(BASE_COUNTERS.ca);
    expect(result.newCounters.caHP).toBe(BASE_COUNTERS.caHP);
    expect(result.newCounters.caAnterieur).toBe(BASE_COUNTERS.caAnterieur);
  });

  it('annulation restaure exactement etat initial', () => {
    const afterPose = simulatePose(BASE_COUNTERS, 'caHPAnterieur', amount, DATE_FEVRIER);
    expect(afterPose.isValid).toBe(true);

    const afterCancel = applyCancel(afterPose.newCounters, 'caHPAnterieur', amount);

    expect(afterCancel).toEqual(BASE_COUNTERS);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CA ANTERIEUR
// ─────────────────────────────────────────────────────────────────────────────

describe('simulatePose - CA Anterieur', () => {
  const amount = 2;

  it('pose valide : decremente caAnterieur', () => {
    const result = simulatePose(BASE_COUNTERS, 'caAnterieur', amount, DATE_FEVRIER);

    expect(result.isValid).toBe(true);
    expect(result.newCounters.caAnterieur).toBe(BASE_COUNTERS.caAnterieur - amount);
  });

  it('pose invalide si montant > solde disponible', () => {
    const result = simulatePose(BASE_COUNTERS, 'caAnterieur', 99, DATE_FEVRIER);

    expect(result.isValid).toBe(false);
    expect(result.errorMessage).toContain('CA ant');
  });

  it('ne touche pas au CA courant ni aux autres compteurs jours', () => {
    const result = simulatePose(BASE_COUNTERS, 'caAnterieur', amount, DATE_FEVRIER);

    expect(result.newCounters.ca).toBe(BASE_COUNTERS.ca);
    expect(result.newCounters.caHP).toBe(BASE_COUNTERS.caHP);
    expect(result.newCounters.caHPAnterieur).toBe(BASE_COUNTERS.caHPAnterieur);
  });

  it('annulation restaure exactement etat initial', () => {
    const afterPose = simulatePose(BASE_COUNTERS, 'caAnterieur', amount, DATE_FEVRIER);
    expect(afterPose.isValid).toBe(true);

    const afterCancel = applyCancel(afterPose.newCounters, 'caAnterieur', amount);

    expect(afterCancel).toEqual(BASE_COUNTERS);
  });

  it('solde tombe a zero apres consommation totale', () => {
    const result = simulatePose(BASE_COUNTERS, 'caAnterieur', BASE_COUNTERS.caAnterieur, DATE_FEVRIER);

    expect(result.isValid).toBe(true);
    expect(result.newCounters.caAnterieur).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ARTT
// ─────────────────────────────────────────────────────────────────────────────

describe('simulatePose - ARTT', () => {
  const amount = 3;

  it('pose valide : decremente artt', () => {
    const result = simulatePose(BASE_COUNTERS, 'artt', amount, DATE_JUIN);

    expect(result.isValid).toBe(true);
    expect(result.newCounters.artt).toBe((BASE_COUNTERS.artt ?? 0) - amount);
  });

  it('pose invalide si montant > solde disponible', () => {
    const result = simulatePose(BASE_COUNTERS, 'artt', 99, DATE_JUIN);

    expect(result.isValid).toBe(false);
    expect(result.errorMessage).toContain('ARTT');
  });

  it('pose invalide si hasARTT = false', () => {
    const countersNoARTT = { ...BASE_COUNTERS, hasARTT: false };
    const result = simulatePose(countersNoARTT, 'artt', 1, DATE_JUIN);

    expect(result.isValid).toBe(false);
    expect(result.errorMessage).toContain('ARTT');
  });

  it('pose invalide si artt = undefined', () => {
    const countersUndef = { ...BASE_COUNTERS, artt: undefined };
    const result = simulatePose(countersUndef, 'artt', 1, DATE_JUIN);

    expect(result.isValid).toBe(false);
  });

  it('ne touche pas aux autres compteurs jours', () => {
    const result = simulatePose(BASE_COUNTERS, 'artt', amount, DATE_JUIN);

    expect(result.newCounters.ca).toBe(BASE_COUNTERS.ca);
    expect(result.newCounters.caAnterieur).toBe(BASE_COUNTERS.caAnterieur);
  });

  it('annulation restaure exactement etat initial', () => {
    const afterPose = simulatePose(BASE_COUNTERS, 'artt', amount, DATE_JUIN);
    expect(afterPose.isValid).toBe(true);

    const afterCancel = applyCancel(afterPose.newCounters, 'artt', amount);

    expect(afterCancel).toEqual(BASE_COUNTERS);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// RTT (cycle hebdo — en jours, 16j/an)
// ─────────────────────────────────────────────────────────────────────────────

describe('simulatePose - RTT', () => {
  const amount = 3;
  const RTT_COUNTERS: Counters = { ...BASE_COUNTERS, hasRTT: true, rtt: 16 };

  it('pose valide : decremente rtt (en jours)', () => {
    const result = simulatePose(RTT_COUNTERS, 'rtt', amount, DATE_JUIN);

    expect(result.isValid).toBe(true);
    expect(result.newCounters.rtt).toBe((RTT_COUNTERS.rtt ?? 0) - amount);
  });

  it('pose invalide si montant > solde disponible', () => {
    const result = simulatePose(RTT_COUNTERS, 'rtt', 99, DATE_JUIN);

    expect(result.isValid).toBe(false);
    expect(result.errorMessage).toContain('RTT');
    expect(result.errorMessage).toContain('j de RTT');
  });

  it('pose invalide si hasRTT = false', () => {
    const result = simulatePose(BASE_COUNTERS, 'rtt', 1, DATE_JUIN);

    expect(result.isValid).toBe(false);
    expect(result.errorMessage).toContain('RTT');
  });

  it('pose invalide si rtt = undefined', () => {
    const countersUndef = { ...RTT_COUNTERS, rtt: undefined };
    const result = simulatePose(countersUndef, 'rtt', 1, DATE_JUIN);

    expect(result.isValid).toBe(false);
  });

  it('annulation restaure exactement etat initial', () => {
    const afterPose = simulatePose(RTT_COUNTERS, 'rtt', amount, DATE_JUIN);
    expect(afterPose.isValid).toBe(true);

    const afterCancel = applyCancel(afterPose.newCounters, 'rtt', amount);

    expect(afterCancel).toEqual(RTT_COUNTERS);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CET 2008
// ─────────────────────────────────────────────────────────────────────────────

describe('simulatePose - CET 2008', () => {
  const amount = 2;

  it('pose valide : decremente cet2008', () => {
    const result = simulatePose(BASE_COUNTERS, 'cet2008', amount, DATE_JUIN);

    expect(result.isValid).toBe(true);
    expect(result.newCounters.cet2008).toBe((BASE_COUNTERS.cet2008 ?? 0) - amount);
  });

  it('pose invalide si montant > solde disponible', () => {
    const result = simulatePose(BASE_COUNTERS, 'cet2008', 99, DATE_JUIN);

    expect(result.isValid).toBe(false);
    expect(result.errorMessage).toContain('CET 2008');
  });

  it('pose invalide si hasCET2008 = false', () => {
    const countersNo = { ...BASE_COUNTERS, hasCET2008: false };
    const result = simulatePose(countersNo, 'cet2008', 1, DATE_JUIN);

    expect(result.isValid).toBe(false);
    expect(result.errorMessage).toContain('CET 2008');
  });

  it('ne touche pas au CET courant', () => {
    const result = simulatePose(BASE_COUNTERS, 'cet2008', amount, DATE_JUIN);

    expect(result.newCounters.cet).toBe(BASE_COUNTERS.cet);
  });

  it('annulation restaure exactement etat initial', () => {
    const afterPose = simulatePose(BASE_COUNTERS, 'cet2008', amount, DATE_JUIN);
    expect(afterPose.isValid).toBe(true);

    const afterCancel = applyCancel(afterPose.newCounters, 'cet2008', amount);

    expect(afterCancel).toEqual(BASE_COUNTERS);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CONGES BONIFIES
// ─────────────────────────────────────────────────────────────────────────────

describe('simulatePose - Conges Bonifies', () => {
  const amount = 10;

  it('pose valide : decremente congesBonifies', () => {
    const result = simulatePose(BASE_COUNTERS, 'congesBonifies', amount, DATE_JUIN);

    expect(result.isValid).toBe(true);
    expect(result.newCounters.congesBonifies).toBe((BASE_COUNTERS.congesBonifies ?? 0) - amount);
  });

  it('pose invalide si montant > solde disponible', () => {
    const result = simulatePose(BASE_COUNTERS, 'congesBonifies', 99, DATE_JUIN);

    expect(result.isValid).toBe(false);
    expect(result.errorMessage).toContain('bonifi');
  });

  it('pose invalide si hasCongesBonifies = false', () => {
    const countersNo = { ...BASE_COUNTERS, hasCongesBonifies: false };
    const result = simulatePose(countersNo, 'congesBonifies', 1, DATE_JUIN);

    expect(result.isValid).toBe(false);
  });

  it('ne touche pas aux CA ni au CET', () => {
    const result = simulatePose(BASE_COUNTERS, 'congesBonifies', amount, DATE_JUIN);

    expect(result.newCounters.ca).toBe(BASE_COUNTERS.ca);
    expect(result.newCounters.cet).toBe(BASE_COUNTERS.cet);
  });

  it('annulation restaure exactement etat initial', () => {
    const afterPose = simulatePose(BASE_COUNTERS, 'congesBonifies', amount, DATE_JUIN);
    expect(afterPose.isValid).toBe(true);

    const afterCancel = applyCancel(afterPose.newCounters, 'congesBonifies', amount);

    expect(afterCancel).toEqual(BASE_COUNTERS);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// HS HISTORIQUE
// ─────────────────────────────────────────────────────────────────────────────

describe('simulatePose - HS Historique', () => {
  const amount = 728; // 1 journee (12h08 = 728 min)

  it('pose valide : decremente hsHistorique', () => {
    const result = simulatePose(BASE_COUNTERS, 'hsHistorique', amount, DATE_JUIN);

    expect(result.isValid).toBe(true);
    expect(result.newCounters.hsHistorique).toBe(BASE_COUNTERS.hsHistorique - amount);
  });

  it('pose invalide si montant > solde disponible', () => {
    const result = simulatePose(BASE_COUNTERS, 'hsHistorique', 999999, DATE_JUIN);

    expect(result.isValid).toBe(false);
    expect(result.errorMessage).toContain('HS historiques');
  });

  it('ne touche pas au stock HS courant (compte distinct)', () => {
    const result = simulatePose(BASE_COUNTERS, 'hsHistorique', amount, DATE_JUIN);

    expect(result.newCounters.hs).toBe(BASE_COUNTERS.hs);
  });

  it('accepte une pose a montant = 0', () => {
    const result = simulatePose(BASE_COUNTERS, 'hsHistorique', 0, DATE_JUIN);

    expect(result.isValid).toBe(true);
    expect(result.newCounters.hsHistorique).toBe(BASE_COUNTERS.hsHistorique);
  });

  it('annulation restaure exactement etat initial', () => {
    const afterPose = simulatePose(BASE_COUNTERS, 'hsHistorique', amount, DATE_JUIN);
    expect(afterPose.isValid).toBe(true);

    const afterCancel = applyCancel(afterPose.newCounters, 'hsHistorique', amount);

    expect(afterCancel).toEqual(BASE_COUNTERS);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ISOLATION : les 6 nouveaux compteurs ne s'affectent pas mutuellement
// ─────────────────────────────────────────────────────────────────────────────

describe('Isolation des 6 nouveaux compteurs', () => {
  it('poser caHPAnterieur ne modifie pas les 5 autres nouveaux compteurs', () => {
    const result = simulatePose(BASE_COUNTERS, 'caHPAnterieur', 1, DATE_FEVRIER);

    expect(result.newCounters.caAnterieur).toBe(BASE_COUNTERS.caAnterieur);
    expect(result.newCounters.artt).toBe(BASE_COUNTERS.artt);
    expect(result.newCounters.cet2008).toBe(BASE_COUNTERS.cet2008);
    expect(result.newCounters.congesBonifies).toBe(BASE_COUNTERS.congesBonifies);
    expect(result.newCounters.hsHistorique).toBe(BASE_COUNTERS.hsHistorique);
  });

  it('poser artt ne modifie pas les compteurs courants (ca, cf, rtc, hs, cet)', () => {
    const result = simulatePose(BASE_COUNTERS, 'artt', 2, DATE_JUIN);

    expect(result.newCounters.ca).toBe(BASE_COUNTERS.ca);
    expect(result.newCounters.cf).toBe(BASE_COUNTERS.cf);
    expect(result.newCounters.rtc).toBe(BASE_COUNTERS.rtc);
    expect(result.newCounters.hs).toBe(BASE_COUNTERS.hs);
    expect(result.newCounters.cet).toBe(BASE_COUNTERS.cet);
  });

  it('poser hsHistorique ne modifie pas les 5 autres nouveaux compteurs', () => {
    const result = simulatePose(BASE_COUNTERS, 'hsHistorique', 728, DATE_JUIN);

    expect(result.newCounters.caHPAnterieur).toBe(BASE_COUNTERS.caHPAnterieur);
    expect(result.newCounters.caAnterieur).toBe(BASE_COUNTERS.caAnterieur);
    expect(result.newCounters.artt).toBe(BASE_COUNTERS.artt);
    expect(result.newCounters.cet2008).toBe(BASE_COUNTERS.cet2008);
    expect(result.newCounters.congesBonifies).toBe(BASE_COUNTERS.congesBonifies);
  });
});
