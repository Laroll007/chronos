// Script pour générer les icônes PWA à partir du SVG
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
const inputSvg = path.join(__dirname, '../public/icons/icon.svg');
const outputDir = path.join(__dirname, '../public/icons');

async function generateIcons() {
  // Vérifier que le dossier de sortie existe
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log('Génération des icônes PWA...\n');

  for (const size of sizes) {
    const outputPath = path.join(outputDir, `icon-${size}x${size}.png`);

    try {
      await sharp(inputSvg)
        .resize(size, size)
        .png()
        .toFile(outputPath);

      console.log(`✓ icon-${size}x${size}.png`);
    } catch (error) {
      console.error(`✗ icon-${size}x${size}.png - ${error.message}`);
    }
  }

  console.log('\nIcônes générées avec succès !');
}

generateIcons().catch(console.error);
