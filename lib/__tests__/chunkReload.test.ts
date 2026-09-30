import { describe, it, expect, beforeEach, vi } from 'vitest';
import { isChunkLoadError, reloadForNewVersion } from '../chunkReload';

describe('Code de l’ancienne version introuvable après un déploiement', () => {
  it('reconnaît les erreurs de chargement de module (Next/Turbopack, Safari, Firefox)', () => {
    const e = new Error('Failed to load chunk /_next/static/chunks/0c3r8i71zyw82.js');
    e.name = 'ChunkLoadError';
    expect(isChunkLoadError(e)).toBe(true);
    expect(isChunkLoadError(new TypeError('Importing a module script failed.'))).toBe(true);
    expect(isChunkLoadError(new TypeError('Failed to fetch dynamically imported module: x.js'))).toBe(true);
    expect(isChunkLoadError(new TypeError("Cannot read properties of undefined (reading 'ca')"))).toBe(false);
    expect(isChunkLoadError(null)).toBe(false);
  });

  describe('rechargement', () => {
    let store: Map<string, string>;
    beforeEach(() => {
      store = new Map();
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation((k) => store.get(k) ?? null);
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation((k, v) => void store.set(k, String(v)));
    });

    it('recharge une fois, puis pas de boucle si le fichier manque vraiment', () => {
      const reload = vi.fn();
      expect(reloadForNewVersion(1_000_000, reload)).toBe(true);
      expect(reloadForNewVersion(1_010_000, reload)).toBe(false); // 10 s plus tard
      expect(reload).toHaveBeenCalledTimes(1);
      expect(reloadForNewVersion(1_100_000, reload)).toBe(true); // > 1 min : nouveau déploiement possible
      expect(reload).toHaveBeenCalledTimes(2);
    });
  });
});
