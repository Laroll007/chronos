#!/usr/bin/env node
// Optimise public/logo.png (855 KB) via sharp.
// Utilisation : node scripts/optimize-logo.mjs
// Produit : logo.png (~60-100 KB) + logo.webp + logo.avif

import sharp from 'sharp';
import { readFileSync, writeFileSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const src = resolve(root, 'public/logo.png');
const srcSize = statSync(src).size;

console.log(`Source : ${src} (${(srcSize / 1024).toFixed(1)} KB)`);

const buffer = readFileSync(src);
const meta = await sharp(buffer).metadata();
console.log(`  dims : ${meta.width}×${meta.height}, format : ${meta.format}`);

// Le logo est affiché max ~88-200px. On le réduit à 512px (retina-safe pour header 88px à 4x).
const targetWidth = Math.min(512, meta.width ?? 512);

// PNG optimisé (palette + compression)
const png = await sharp(buffer)
  .resize({ width: targetWidth, withoutEnlargement: true })
  .png({ compressionLevel: 9, palette: true, quality: 90 })
  .toBuffer();
writeFileSync(src, png);
console.log(`✓ logo.png : ${(png.length / 1024).toFixed(1)} KB (–${(((srcSize - png.length) / srcSize) * 100).toFixed(0)}%)`);

// WebP & AVIF
const webp = await sharp(buffer)
  .resize({ width: targetWidth, withoutEnlargement: true })
  .webp({ quality: 85 })
  .toBuffer();
writeFileSync(resolve(root, 'public/logo.webp'), webp);
console.log(`✓ logo.webp : ${(webp.length / 1024).toFixed(1)} KB`);

const avif = await sharp(buffer)
  .resize({ width: targetWidth, withoutEnlargement: true })
  .avif({ quality: 60 })
  .toBuffer();
writeFileSync(resolve(root, 'public/logo.avif'), avif);
console.log(`✓ logo.avif : ${(avif.length / 1024).toFixed(1)} KB`);
