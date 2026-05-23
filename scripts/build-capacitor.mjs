// Build statique pour Capacitor (iOS/Android).
// Met de côté les routes web-only (api, robots, sitemap) pendant le build, puis les restaure.

import { execSync } from 'node:child_process';
import { renameSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const APP = join(ROOT, 'app');

// Fichiers web-only à mettre de côté pendant le build statique.
// Déplacés HORS du dossier `app/` (sinon Next.js les détecte malgré le rename).
const SHELF = join(ROOT, '.capacitor-shelf');
const TARGETS = [
  'robots.ts',
  'sitemap.ts',
  'api', // dossier complet (health + feedback)
];

const moves = [];

function shelve(name) {
  const src = join(APP, name);
  const dst = join(SHELF, name);
  if (existsSync(src)) {
    if (!existsSync(SHELF)) {
      execSync(`mkdir -p "${SHELF}"`);
    }
    renameSync(src, dst);
    moves.push([dst, src]);
    console.log(`[capacitor] shelved ${name}`);
  }
}

function restore() {
  for (const [from, to] of moves) {
    if (existsSync(from)) {
      renameSync(from, to);
      console.log(`[capacitor] restored ${to.replace(`${APP}/`, '')}`);
    }
  }
}

process.on('exit', restore);
process.on('SIGINT', () => { restore(); process.exit(130); });
process.on('SIGTERM', () => { restore(); process.exit(143); });

try {
  // Nettoie .next + out
  rmSync(join(ROOT, '.next'), { recursive: true, force: true });
  rmSync(join(ROOT, 'out'), { recursive: true, force: true });

  // Met de côté les routes web-only
  TARGETS.forEach(shelve);

  // Build statique
  execSync('next build', {
    stdio: 'inherit',
    env: { ...process.env, BUILD_TARGET: 'capacitor' },
  });

  console.log('[capacitor] build OK');
} catch (err) {
  console.error('[capacitor] build failed:', err.message);
  process.exitCode = 1;
} finally {
  restore();
}
