import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const corePath = '/opt/homebrew/lib/node_modules/@bubblewrap/cli/node_modules/@bubblewrap/core/dist/index.js';
const { TwaManifest, TwaGenerator, ConsoleLog, Config, AndroidSdkTools, JdkHelper } = require(corePath);

const cliPath = '/opt/homebrew/lib/node_modules/@bubblewrap/cli/dist/lib/cmds/shared.js';
const { generateManifestChecksumFile } = require(cliPath);

const targetDir = __dirname;

async function main() {
  const log = new ConsoleLog('generate');

  // Load config
  const config = new Config(
    '/Library/Java/JavaVirtualMachines/temurin-25.jdk/Contents/Home',
    '/Users/amreen/Library/Android/sdk'
  );

  // Load the twa-manifest.json
  const twaManifest = await TwaManifest.fromFile(path.join(targetDir, 'twa-manifest.json'));

  // Override signing key
  twaManifest.signingKey = {
    path: path.join(targetDir, 'android.keystore'),
    alias: 'chronos',
  };

  log.info('Generating TWA project...');
  const twaGenerator = new TwaGenerator();
  await twaGenerator.createTwaProject(targetDir, twaManifest);

  log.info('Generating checksum...');
  await generateManifestChecksumFile(path.join(targetDir, 'twa-manifest.json'), targetDir);

  log.info('Project generated successfully!');
}

main().catch(err => {
  console.error('ERROR:', err.message);
  console.error(err.stack);
  process.exit(1);
});
