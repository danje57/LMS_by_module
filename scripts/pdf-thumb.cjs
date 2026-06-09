'use strict';

// Polyfill process.getBuiltinModule (Node 21+) pour Node 18
if (!process.getBuiltinModule) {
  process.getBuiltinModule = (id) => {
    try { return require(id); } catch { return null; }
  };
}

// Patch fs.promises.readFile pour que pdfjs puisse lire les URLs file://
const fs = require('fs');
const _origReadFile = fs.promises.readFile.bind(fs.promises);
fs.promises.readFile = (p, ...args) => {
  if (typeof p === 'string' && p.startsWith('file://')) p = new URL(p);
  return _origReadFile(p, ...args);
};

const { createCanvas, Path2D, DOMMatrix, ImageData } = require('@napi-rs/canvas');
const { readFileSync, writeFileSync, mkdirSync } = require('fs');
const path = require('path');

global.Path2D    = Path2D;
global.DOMMatrix = DOMMatrix;
global.ImageData = ImageData;

async function main() {
  const [pdfPath, outputPath] = process.argv.slice(2);
  if (!pdfPath || !outputPath) throw new Error('Usage: pdf-thumb.cjs <pdfPath> <outputPath>');

  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');

  const fontsDir = path.join(__dirname, '..', 'node_modules', 'pdfjs-dist', 'standard_fonts');
  const standardFontDataUrl = 'file://' + fontsDir + '/';
  const data = new Uint8Array(readFileSync(pdfPath));
  const doc  = await getDocument({
    data,
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: false,
    standardFontDataUrl,
  }).promise;
  const page = await doc.getPage(1);

  const viewport = page.getViewport({ scale: 1 });
  const scale    = 300 / viewport.width;
  const scaled   = page.getViewport({ scale });

  const canvas = createCanvas(Math.round(scaled.width), Math.round(scaled.height));
  const ctx    = canvas.getContext('2d');
  await page.render({ canvasContext: ctx, viewport: scaled }).promise;

  const buffer = canvas.toBuffer('image/jpeg', { quality: 85 });
  mkdirSync(path.dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, buffer);
}

main()
  .then(() => process.exit(0))
  .catch((err) => { process.stderr.write(err.message + '\n'); process.exit(1); });
