/**
 * Aller-retour de sauvegarde : Réglages → « Exporter » puis « Importer ».
 *
 * Régression protégée : les dates d'historique sont écrites par `poseConge` via
 * `Date.toISOString()` (« 2026-03-10T00:00:00.000Z »). Le validateur n'acceptait
 * que « YYYY-MM-DD », donc tout export contenant au moins un congé était refusé
 * à l'import — c'est-à-dire exactement le cas d'usage annoncé dans les Réglages
 * (« réimporter sur un nouvel appareil »).
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  exportData,
  importData,
  loadUserData,
  saveUserData,
  DEFAULT_COUNTERS,
  DEFAULT_CYCLE_CONFIG,
} from '@/lib/storage';
import { validateExportData, validateUserData } from '@/lib/validation';
import type { HistoryEntry, UserData } from '@/lib/types';

// vitest.setup.ts remplace localStorage par des vi.fn() renvoyant null ; on
// installe un vrai stockage en mémoire pour rejouer le parcours de bout en bout.
const store = new Map<string, string>();
Object.defineProperty(window, 'localStorage', {
  configurable: true,
  value: {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() {
      return store.size;
    },
  },
});

/** Entrée d'historique telle que `poseConge` / `poseCMO` l'écrivent réellement. */
function poseEntry(over: Partial<HistoryEntry> = {}): HistoryEntry {
  return {
    id: '1753900000-abc123',
    date: new Date(2026, 2, 10).toISOString(),
    dateEnd: new Date(2026, 2, 14).toISOString(),
    action: 'pose',
    type: 'ca',
    amount: 3,
    countersSnapshot: { ca: 15 },
    ...over,
  };
}

function userDataWith(history: HistoryEntry[]): UserData {
  return {
    cycleConfig: { ...DEFAULT_CYCLE_CONFIG },
    counters: { ...DEFAULT_COUNTERS },
    history,
    lastUpdated: new Date().toISOString(),
    lastResetYear: new Date().getFullYear(),
    isOnboarded: true,
  };
}

beforeEach(() => store.clear());

describe('Sauvegarde — aller-retour export/import', () => {
  it('réimporte un export contenant un congé posé', () => {
    saveUserData(userDataWith([poseEntry()]));

    const exported = exportData();
    expect(exported).not.toBeNull();
    expect(exported!.history).toHaveLength(1);

    const result = importData(JSON.stringify(exported), false);
    expect(result.error).toBeUndefined();
    expect(result.success).toBe(true);

    const reloaded = loadUserData();
    expect(reloaded!.history).toHaveLength(1);
    expect(reloaded!.history[0].date).toBe(exported!.history[0].date);
  });

  it('réimporte un export riche (plage, CMO, astreinte, pose à l’heure, épargne CET)', () => {
    const history: HistoryEntry[] = [
      poseEntry({ id: 'a', type: 'ca', amount: 3 }),
      poseEntry({ id: 'b', type: 'cf', amount: 728, dateEnd: undefined }),
      poseEntry({ id: 'c', type: 'rtc', amount: 1456, groupId: 'grp-1' }),
      poseEntry({ id: 'd', type: 'cf', amount: 180, dateEnd: undefined, partialDay: true }),
      poseEntry({ id: 'e', action: 'cmo', type: 'cmo', amount: 2, countersSnapshot: {} }),
      poseEntry({ id: 'f', action: 'astreinte', type: 'astreinte', amount: 1, countersSnapshot: {} }),
      poseEntry({ id: 'g', action: 'transfer_cet', type: 'cet', amount: 5, dateEnd: undefined }),
    ];
    saveUserData(userDataWith(history));

    const result = importData(JSON.stringify(exportData()), false);
    expect(result.error).toBeUndefined();
    expect(result.success).toBe(true);
    expect(loadUserData()!.history).toHaveLength(history.length);
  });

  it('accepte encore les anciennes sauvegardes en date seule (YYYY-MM-DD)', () => {
    const legacy = poseEntry({ date: '2026-03-10', dateEnd: '2026-03-14' });
    expect(validateExportData({
      version: '1.0.0',
      exportDate: '2026-03-10T00:00:00.000Z',
      cycleConfig: DEFAULT_CYCLE_CONFIG,
      counters: DEFAULT_COUNTERS,
      history: [legacy],
    }).success).toBe(true);
  });

  it('charge des données dont l’historique est horodaté sans repli legacy', () => {
    // Avant le correctif, validateUserData échouait et seul le repli
    // `legacyValidateUserData` (4 clés vérifiées) sauvait le chargement :
    // la validation stricte était de fait désactivée pour tout le monde.
    expect(validateUserData(userDataWith([poseEntry()])).success).toBe(true);
  });

  it('refuse toujours une date d’historique réellement invalide', () => {
    for (const bad of ['10/03/2026', '2026-13-01T00:00:00.000Z', 'demain', '', '2026-03-10T']) {
      const result = validateExportData({
        version: '1.0.0',
        exportDate: '2026-03-10T00:00:00.000Z',
        cycleConfig: DEFAULT_CYCLE_CONFIG,
        counters: DEFAULT_COUNTERS,
        history: [poseEntry({ date: bad, dateEnd: undefined })],
      });
      expect(result.success, `« ${bad} » devrait être refusée`).toBe(false);
    }
  });

  it('refuse une dateEnd invalide', () => {
    expect(validateExportData({
      version: '1.0.0',
      exportDate: '2026-03-10T00:00:00.000Z',
      cycleConfig: DEFAULT_CYCLE_CONFIG,
      counters: DEFAULT_COUNTERS,
      history: [poseEntry({ dateEnd: 'pas-une-date' })],
    }).success).toBe(false);
  });

  it('l’import en fusion conserve l’historique existant', () => {
    saveUserData(userDataWith([poseEntry({ id: 'existant' })]));
    const exported = exportData()!;
    const result = importData(
      JSON.stringify({ ...exported, history: [poseEntry({ id: 'importe' })] }),
      true
    );
    expect(result.success).toBe(true);
    expect(loadUserData()!.history.map((h) => h.id)).toEqual(['existant', 'importe']);
  });
});
