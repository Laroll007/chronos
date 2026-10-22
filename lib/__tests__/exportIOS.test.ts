// Export de la sauvegarde sur iPhone : la WebView ignore les téléchargements,
// l'app annonçait « Sauvegarde enregistrée » sans créer de fichier (signalé par
// un collègue). Désormais : fichier écrit dans le cache, puis partage iOS.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { STORAGE_KEY } from '../constants';
import { DEFAULT_COUNTERS, DEFAULT_CYCLE_CONFIG } from '../storage';

const writeFile = vi.fn(async () => ({ uri: 'file:///cache/x.json' }));
const getUri = vi.fn(async () => ({ uri: 'file:///cache/chronos-backup.json' }));
const share = vi.fn(async () => ({}));
vi.mock('../api', async (orig) => ({ ...(await orig<typeof import('../api')>()), plateformeNative: () => 'ios' }));
vi.mock('@capacitor/filesystem', () => ({
  Filesystem: { writeFile, getUri },
  Directory: { Cache: 'CACHE' },
  Encoding: { UTF8: 'utf8' },
}));
vi.mock('@capacitor/share', () => ({ Share: { share } }));
const { downloadExport } = await import('../storage');

beforeEach(() => {
  const store = new Map<string, string>([[STORAGE_KEY, JSON.stringify({
    cycleConfig: DEFAULT_CYCLE_CONFIG, counters: DEFAULT_COUNTERS, history: [], lastUpdated: '2026-10-22T08:00:00.000Z', isOnboarded: true,
  })]]);
  vi.mocked(localStorage.getItem).mockImplementation((k) => store.get(k) ?? null);
  vi.mocked(localStorage.setItem).mockImplementation((k, v) => void store.set(k, String(v)));
  writeFile.mockClear();
  share.mockClear();
});

describe('Export de la sauvegarde sur iPhone', () => {
  it('écrit le fichier puis ouvre la fenêtre de partage d’iOS', async () => {
    expect(await downloadExport()).toBe('ok');
    expect(writeFile).toHaveBeenCalledWith(expect.objectContaining({ path: expect.stringMatching(/^chronos-backup-\d{4}-\d{2}-\d{2}\.json$/), directory: 'CACHE' }));
    expect(share).toHaveBeenCalledWith(expect.objectContaining({ url: 'file:///cache/chronos-backup.json' }));
  });

  it('fenêtre de partage fermée sans destination : « annulé », pas de faux « enregistré »', async () => {
    share.mockRejectedValueOnce(new Error('Share canceled'));
    expect(await downloadExport()).toBe('annule');
  });
});
