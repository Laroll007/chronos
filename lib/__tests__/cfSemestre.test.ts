/**
 * Répartition des CF entre les deux semestres.
 *
 * Régression protégée : `simulatePose` déduisait le semestre de la seule date de
 * DÉBUT, donc une pose du 28 juin au 3 juillet imputait ses 36h24 en bloc au S1.
 * Le crédit CF étant semestriel (~54h36 de chaque côté), cela faussait le suivi
 * des deux semestres à la fois. Même défaut que pour la période CA HP au 30 avril.
 */
import { describe, it, expect } from 'vitest';
import {
  simulatePose,
  getCFS1Share,
  splitWorkingMinutesBySemester,
  countWorkingMinutes,
  getCurrentSemester,
} from '@/lib/calculations';
import { DEFAULT_COUNTERS, DEFAULT_CYCLE_CONFIG } from '@/lib/storage';
import type { Counters } from '@/lib/types';

const cfg = DEFAULT_CYCLE_CONFIG;
const C = (o: Partial<Counters> = {}): Counters => ({ ...DEFAULT_COUNTERS, ...o });

describe('CF — plages à cheval sur le 30 juin', () => {
  it('répartit une pose du 28 juin au 3 juillet entre S1 et S2', () => {
    const start = new Date(2026, 5, 28);
    const end = new Date(2026, 6, 3);

    const total = countWorkingMinutes(start, end, cfg);
    const { s1, s2 } = splitWorkingMinutesBySemester(start, end, cfg);

    expect(s1).toBeGreaterThan(0);
    expect(s2).toBeGreaterThan(0);
    expect(s1 + s2).toBe(total);

    const part = getCFS1Share(total, start, end, cfg);
    const r = simulatePose(C({ cf: 6552 }), 'cf', total, start, { cfS1Minutes: part });

    expect(r.newCounters.cfConsoS1).toBe(s1); // et non `total`
    expect(r.newCounters.cfConsoS2).toBe(s2);
    expect(r.newCounters.cfConsoS1 + r.newCounters.cfConsoS2).toBe(total);
  });

  it('impute tout au S1 pour une plage entièrement avant le 30 juin', () => {
    const start = new Date(2026, 5, 1);
    const end = new Date(2026, 5, 10);
    const total = countWorkingMinutes(start, end, cfg);

    const part = getCFS1Share(total, start, end, cfg);
    expect(part).toBe(total);

    const r = simulatePose(C({ cf: 6552 }), 'cf', total, start, { cfS1Minutes: part });
    expect(r.newCounters.cfConsoS2).toBe(0);
  });

  it('impute tout au S2 pour une plage entièrement après le 1er juillet', () => {
    const start = new Date(2026, 6, 1);
    const end = new Date(2026, 6, 10);
    const total = countWorkingMinutes(start, end, cfg);

    const part = getCFS1Share(total, start, end, cfg);
    expect(part).toBe(0);

    const r = simulatePose(C({ cf: 6552 }), 'cf', total, start, { cfS1Minutes: part });
    expect(r.newCounters.cfConsoS1).toBe(0);
    expect(r.newCounters.cfConsoS2).toBe(total);
  });

  it('ne perd aucune minute, quelle que soit la plage', () => {
    // L'invariant qui compte : la somme des deux semestres égale toujours le posé.
    const plages: [Date, Date][] = [
      [new Date(2026, 5, 28), new Date(2026, 6, 3)],
      [new Date(2026, 5, 29), new Date(2026, 6, 1)],
      [new Date(2026, 5, 30), new Date(2026, 5, 30)],
      [new Date(2026, 6, 1), new Date(2026, 6, 1)],
      [new Date(2026, 4, 15), new Date(2026, 7, 15)],
    ];
    for (const [start, end] of plages) {
      const total = countWorkingMinutes(start, end, cfg);
      if (total === 0) continue;
      const part = getCFS1Share(total, start, end, cfg);
      // Solde volontairement large : on teste la répartition, pas la validation
      // de solde (une pose refusée laisse les compteurs inchangés).
      const r = simulatePose(C({ cf: total }), 'cf', total, start, { cfS1Minutes: part });
      expect(r.isValid).toBe(true);
      expect(r.newCounters.cfConsoS1 + r.newCounters.cfConsoS2).toBe(total);
    }
  });

  it('sans indication, retombe sur le semestre de la date (pose d’un jour)', () => {
    const juin = simulatePose(C({ cf: 6552 }), 'cf', 728, new Date(2026, 5, 10));
    expect(juin.newCounters.cfConsoS1).toBe(728);
    expect(juin.newCounters.cfConsoS2).toBe(0);

    const juillet = simulatePose(C({ cf: 6552 }), 'cf', 728, new Date(2026, 6, 10));
    expect(juillet.newCounters.cfConsoS1).toBe(0);
    expect(juillet.newCounters.cfConsoS2).toBe(728);
  });

  it('gère une plage sans aucun jour travaillé', () => {
    // Repli attendu : le semestre de la date de début.
    const start = new Date(2026, 5, 20);
    const part = getCFS1Share(300, start, start, cfg);
    expect(part).toBe(getCurrentSemester(start) === 1 ? 300 : 0);
  });
});
