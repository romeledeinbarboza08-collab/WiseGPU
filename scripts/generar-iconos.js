// Genera los PNG del favicon a partir de public/favicon.svg (Pixi simplificado).
// Uso: npm run iconos
import sharp from 'sharp';
import { readFile } from 'node:fs/promises';

const svg = await readFile('public/favicon.svg');

// [archivo, tamaño en px, color de fondo o null para dejarlo transparente]
const ICONOS = [
  ['favicon-16.png', 16, null],
  ['favicon-32.png', 32, null],
  // iOS no admite transparencia y redondea las esquinas solo: lo llenamos con el fondo oscuro.
  ['apple-touch-icon.png', 180, '#1B2130'],
  ['icon-192.png', 192, null],
  ['icon-512.png', 512, null],
];

for (const [archivo, tamano, fondo] of ICONOS) {
  // density alta para que el SVG se dibuje nítido antes de achicarlo.
  let imagen = sharp(svg, { density: 600 }).resize(tamano, tamano);
  if (fondo) imagen = imagen.flatten({ background: fondo });
  await imagen.png().toFile(`public/${archivo}`);
  console.log(`public/${archivo} (${tamano}x${tamano})`);
}
