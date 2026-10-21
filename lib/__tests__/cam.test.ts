// CA reportés (CAM) et congé maternité — guide APORTT : « congés annuels […]
// reportés sur l'année suivante dans la limite de 4 semaines par an, à prendre
// dans un délai de 15 mois […] (soit avant le 31.03 de l'année N+2) (seuls les
// CA sont reportables en CAM ; les HP non pris sont perdus) (code GesTT : CAM) ».
// Cas remonté : collègue en congé maternité en 2025, 8 CA de 2025 gardés en 2026.

import { describe, it, expect, afterEach, vi } from 'vitest';
import { simulatePose } from '../calculations';
import { canAfford, generateAllCombinations, getRawBalance } from '../optimization';
import { calculerDepartRetraite } from '../retraite';
import { generateRecommendations } from '../recommendations';
import { absenceOuvrantCAM, migrateUserData, DEFAULT_COUNTERS, DEFAULT_CYCLE_CONFIG, SCHEMA_VERSION } from '../storage';
import { validateUserData } from '../validation';
import { MOTIFS_ABSENCE, ORDRE_MOTIFS } from '../absences';
import type { Counters, HistoryEntry, UserData } from '../types';

afterEach(() => vi.useRealTimers());

const C = (o: Partial<Counters> = {}): Counters => ({ ...DEFAULT_COUNTERS, hasCF: true, hasRTC: true, ...o }) as Counters;
const CAM = C({ ca: 10, caReporte: 8, caReporteLimite: '2027-03-31' });
const absence = (motif: string, date: string, dateEnd?: string): HistoryEntry => ({
  id: motif + date, date: new Date(date).toISOString(), ...(dateEnd && { dateEnd: new Date(dateEnd).toISOString() }),
  action: 'absence', type: 'absence', amount: 0, motif, countersSnapshot: {},
});

describe('Compteur CA reportés (CAM)', () => {
  it('se pose en jours et refuse au-delà du solde', () => {
    const r = simulatePose(CAM, 'caReporte', 3, new Date(2026, 10, 3));
    expect(r.isValid).toBe(true);
    expect(r.newCounters.caReporte).toBe(5);
    expect(simulatePose(CAM, 'caReporte', 9, new Date(2026, 10, 3)).isValid).toBe(false);
    expect(getRawBalance(CAM, 'caReporte')).toBe(8);
    expect(canAfford([{ type: 'caReporte', amount: 8 }], CAM).ok).toBe(true);
  });

  it('proposé en premier à l’approche de sa date limite', () => {
    const combis = generateAllCombinations(2, CAM, new Date(2027, 0, 10), 2 * 728);
    expect(combis[0]!.items.map((i) => i.type)).toContain('caReporte');
  });

  it('compté dans le simulateur de départ', () => {
    const r = calculerDepartRetraite(new Date(2026, 11, 31), CAM, DEFAULT_CYCLE_CONFIG, [], {}, new Date(2026, 9, 21));
    expect(r.detail.find((d) => d.type === 'caReporte')?.quantite).toBe(8);
  });

  it('rappel quand la date limite approche, alerte quand elle est passée', () => {
    const proche = generateRecommendations(CAM, DEFAULT_CYCLE_CONFIG, new Date(2027, 1, 15));
    expect(proche.some((r) => r.counterType === 'caReporte' && r.action.includes('avant le 31 mars 2027'))).toBe(true);
    const loin = generateRecommendations(CAM, DEFAULT_CYCLE_CONFIG, new Date(2026, 5, 1));
    expect(loin.some((r) => r.counterType === 'caReporte')).toBe(false);
    const passe = generateRecommendations(CAM, DEFAULT_CYCLE_CONFIG, new Date(2027, 3, 2));
    expect(passe.some((r) => r.counterType === 'caReporte' && r.action.includes('expirés'))).toBe(true);
  });

  it('sauvegarde : solde et date limite acceptés à l’import', () => {
    const data = { cycleConfig: DEFAULT_CYCLE_CONFIG, counters: CAM, history: [], lastUpdated: '', isOnboarded: true };
    expect(validateUserData(data).success).toBe(true);
    expect(validateUserData({ ...data, counters: { ...CAM, caReporteLimite: '31/03/2027' } }).success).toBe(false);
  });
});

describe('Congé maternité, pathologique, paternité', () => {
  it('motifs d’absence sans compteur, avec leur code GesTT', () => {
    expect(MOTIFS_ABSENCE.maternite.code).toBe('MAT');
    expect(MOTIFS_ABSENCE.pathologique.code).toBe('PAT');
    expect(MOTIFS_ABSENCE.paternite.code).toBe('CPA');
    expect(MOTIFS_ABSENCE.maternite.aide).toMatch(/16 semaines/);
    expect(ORDRE_MOTIFS).toEqual(expect.arrayContaining(['maternite', 'pathologique', 'paternite']));
  });

  it('ouvrent le report en CAM, comme un arrêt maladie', () => {
    expect(absenceOuvrantCAM([absence('maternite', '2026-03-01', '2026-06-20')], 2026)).toBe(true);
    expect(absenceOuvrantCAM([absence('maternite', '2025-11-01', '2026-02-20')], 2026)).toBe(true); // à cheval
    expect(absenceOuvrantCAM([absence('asa_mariage', '2026-03-01')], 2026)).toBe(false);
    expect(absenceOuvrantCAM([absence('maternite', '2025-03-01', '2025-06-20')], 2026)).toBe(false);
    const cmo: HistoryEntry = { id: 'c', date: new Date('2026-09-01').toISOString(), action: 'cmo', type: 'cmo', amount: 0, countersSnapshot: {} };
    expect(absenceOuvrantCAM([cmo], 2026)).toBe(true);
  });
});

describe('1er janvier après un congé maternité', () => {
  function ouvrir(history: HistoryEntry[], counters: Partial<Counters> = {}): UserData {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2027, 0, 1, 8));
    return migrateUserData(structuredClone({
      cycleConfig: DEFAULT_CYCLE_CONFIG, counters: C({ ca: 8, caHP: 1, ...counters }), history, isOnboarded: true,
      lastUpdated: '2026-12-31T20:00:00.000Z', lastResetYear: 2026, schemaVersion: SCHEMA_VERSION,
    } as UserData));
  }

  it('propose de reporter les CA restants en CAM ; les CA antérieurs restent en attendant la réponse', () => {
    const d = ouvrir([absence('maternite', '2026-03-01', '2026-06-20')]);
    expect(d.reportCAM).toEqual({ annee: 2026, jours: 8 });
    expect(d.counters.caAnterieur).toBe(8);
  });

  it('report plafonné à 4 semaines (20 jours)', () => {
    expect(ouvrir([absence('maternite', '2026-03-01', '2026-06-20')], { ca: 25 }).reportCAM).toEqual({ annee: 2026, jours: 20 });
  });

  it('rien à proposer sans absence de ce type, ni sans CA restants', () => {
    expect(ouvrir([]).reportCAM).toBeUndefined();
    expect(ouvrir([absence('maternite', '2026-03-01', '2026-06-20')], { ca: 0 }).reportCAM).toBeUndefined();
  });

  it('les CAM déjà acquis traversent la bascule avec leur date limite', () => {
    const d = ouvrir([], { caReporte: 5, caReporteLimite: '2027-03-31' });
    expect(d.counters).toMatchObject({ caReporte: 5, caReporteLimite: '2027-03-31' });
  });
});
