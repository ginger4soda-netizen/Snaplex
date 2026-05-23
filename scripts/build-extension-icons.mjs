import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const source = resolve(root, 'branding/source/snaplex-mascot-mark-1024.png');
const outDir = resolve(root, 'extension/icons');

await mkdir(outDir, { recursive: true });

for (const size of [16, 32, 48, 128]) {
  await sharp(source)
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toFile(resolve(outDir, `${size}.png`));
}

for (const { name, px } of [
  { name: 'popup-logo.png', px: 24 },
  { name: 'popup-logo@2x.png', px: 48 },
  { name: 'popup-logo@3x.png', px: 72 },
]) {
  await sharp(source)
    .resize(px, px, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toFile(resolve(outDir, name));
}

console.log(`Generated extension icons in ${outDir}`);
