/**
 * Crédit automatique des RPS (4h51 par dimanche travaillé).
 *
 * Deux garde-fous structurent ces tests :
 *  - le crédit est INCRÉMENTAL. L'ancienne `updateRPS` recalculait depuis le
 *    1er janvier et écrasait le solde : elle rendait des RPS déjà consommés et
 *    effaçait le stock déclaré par un agent inscrit en cours d'année.
 *  - seul le travail RÉEL compte : un dimanche couvert par un congé ou un arrêt
 *    maladie ne crédite rien, même s'il figure au planning.
 */
import { describe, it, expect } from 'vitest';
import { computeRPSCredit, isSundayActuallyWorked, toISODay } from '@/lib/rps';
import { DEFAULT_COUNTERS, DEFAULT_CYCLE_CONFIG } from '@/lib/storage';
import { RPS_PAR_DIMANCHE } from '@/lib/constants';
import { isWorkingDay } from '@/lib/calculations';
import type { Counters, HistoryEntry } from '@/lib/types';

const cfg = DEFAULT_CYCLE_CONFIG;
const C = (o: Partial<Counters> = {}): Counters => ({ ...DEFAULT_COUNTERS, ...o });

/** Dimanches travaillés du cycle sur une période, sans tenir compte des congés. */
function dimanchesDuCycle(from: Date, to: Date): Date[] {
  const out: Date[] = [];
  const cur = new Date(from);
  while (cur <= to) {
    if (cur.getDay() === 0 && isWorkingDay(cur, cfg)) out.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

const pose = (date: Date, type: HistoryEntry['type'] = 'ca'): HistoryEntry => ({
  id: `e-${date.getTime()}`,
  date: date.toISOString(),
  action: 'pose',
  type,
  amount: 1,
  countersSnapshot: {},
});

describe('Crédit RPS', () => {
  it('crédite 4h51 par dimanche travaillé depuis le repère', () => {
    const debut = new Date(2026, 8, 1);
    const fin = new Date(2026, 8, 30);
    const attendus = dimanchesDuCycle(new Date(2026, 8, 2), fin); // strictement après le repère

    const credit = computeRPSCredit(
      C({ rpsDernierCredit: toISODay(debut) }),
      cfg,
      [],
      fin
    );

    expect(credit.sundays).toBe(attendus.length);
    expect(credit.minutes).toBe(attendus.length * RPS_PAR_DIMANCHE);
    expect(credit.marker).toBe(toISODay(fin));
  });

  it('ne crédite rien au premier passage — il pose seulement le repère', () => {
    // Sans repère, créditer rétroactivement inventerait des dimanches déjà
    // comptés dans le solde saisi par l'agent.
    const aujourdhui = new Date(2026, 8, 30);
    const credit = computeRPSCredit(C({ rps: 4000 }), cfg, [], aujourdhui);

    expect(credit.minutes).toBe(0);
    expect(credit.sundays).toBe(0);
    expect(credit.marker).toBe(toISODay(aujourdhui));
  });

  it('ne recompte jamais deux fois (appels successifs)', () => {
    const debut = new Date(2026, 8, 1);
    const fin = new Date(2026, 8, 30);

    const premier = computeRPSCredit(C({ rpsDernierCredit: toISODay(debut) }), cfg, [], fin);
    expect(premier.minutes).toBeGreaterThan(0);

    // Deuxième appel le même jour, avec le repère avancé : plus rien à créditer.
    const second = computeRPSCredit(C({ rpsDernierCredit: premier.marker }), cfg, [], fin);
    expect(second.minutes).toBe(0);
  });

  it('ne crédite pas un dimanche couvert par un congé', () => {
    const debut = new Date(2026, 8, 1);
    const fin = new Date(2026, 8, 30);
    const dimanches = dimanchesDuCycle(new Date(2026, 8, 2), fin);
    expect(dimanches.length).toBeGreaterThan(0);

    const sansConge = computeRPSCredit(C({ rpsDernierCredit: toISODay(debut) }), cfg, [], fin);
    const avecConge = computeRPSCredit(
      C({ rpsDernierCredit: toISODay(debut) }),
      cfg,
      [pose(dimanches[0])],
      fin
    );

    expect(avecConge.sundays).toBe(sansConge.sundays - 1);
  });

  it('ne crédite pas un dimanche couvert par un arrêt maladie', () => {
    const debut = new Date(2026, 8, 1);
    const fin = new Date(2026, 8, 30);
    const dimanches = dimanchesDuCycle(new Date(2026, 8, 2), fin);

    const cmo: HistoryEntry = {
      id: 'cmo-1',
      date: dimanches[0].toISOString(),
      action: 'cmo',
      type: 'cmo',
      amount: 1,
      countersSnapshot: {},
    };

    const sans = computeRPSCredit(C({ rpsDernierCredit: toISODay(debut) }), cfg, [], fin);
    const avec = computeRPSCredit(C({ rpsDernierCredit: toISODay(debut) }), cfg, [cmo], fin);
    expect(avec.sundays).toBe(sans.sundays - 1);
  });

  it('crédite quand même un dimanche avec une simple pose à l’heure', () => {
    // Départ anticipé : la journée reste travaillée.
    const debut = new Date(2026, 8, 1);
    const fin = new Date(2026, 8, 30);
    const dimanches = dimanchesDuCycle(new Date(2026, 8, 2), fin);

    const partielle: HistoryEntry = {
      ...pose(dimanches[0], 'cf'),
      amount: 120,
      partialDay: true,
    };

    const sans = computeRPSCredit(C({ rpsDernierCredit: toISODay(debut) }), cfg, [], fin);
    const avec = computeRPSCredit(C({ rpsDernierCredit: toISODay(debut) }), cfg, [partielle], fin);
    expect(avec.sundays).toBe(sans.sundays);
  });

  it('ignore les dimanches de repos du cycle', () => {
    const repos = new Date(2026, 8, 6);
    const estRepos = !isWorkingDay(repos, cfg);
    if (estRepos) {
      expect(isSundayActuallyWorked(repos, cfg, [])).toBe(false);
    }
    // Un jour qui n'est pas un dimanche ne compte jamais.
    expect(isSundayActuallyWorked(new Date(2026, 8, 7), cfg, [])).toBe(false);
  });

  it('ne recule pas le repère si l’horloge est en retard', () => {
    // Sauvegarde importée depuis un appareil en avance, ou horloge décalée.
    const futur = toISODay(new Date(2026, 9, 15));
    const credit = computeRPSCredit(
      C({ rpsDernierCredit: futur }),
      cfg,
      [],
      new Date(2026, 8, 30)
    );
    expect(credit.minutes).toBe(0);
    expect(credit.marker).toBe(futur);
  });

  it('n’écrase jamais le solde : le crédit est un ajout', () => {
    const debut = new Date(2026, 8, 1);
    const fin = new Date(2026, 8, 30);
    const stockDeclare = 4000;

    const credit = computeRPSCredit(
      C({ rps: stockDeclare, rpsDernierCredit: toISODay(debut) }),
      cfg,
      [],
      fin
    );
    // Le solde final se construit par addition — l'ancienne implémentation
    // remplaçait la valeur par un recalcul depuis le 1er janvier.
    expect(stockDeclare + credit.minutes).toBeGreaterThan(stockDeclare);
  });
});
