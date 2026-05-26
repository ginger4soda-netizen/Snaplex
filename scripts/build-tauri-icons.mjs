import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';
import toIcoPackage from 'to-ico';

const toIco = toIcoPackage.default ?? toIcoPackage;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const source = path.join(rootDir, 'branding', 'source', 'snaplex-mascot-full-1024.png');
const iconsDir = path.join(rootDir, 'src-tauri', 'app', 'icons');

// Apple's macOS Big Sur+ app icon template: the visible rounded body should
// occupy 824x824 inside a 1024x1024 canvas (~100px transparent padding on every
// side). The source asset draws the squircle edge-to-edge, so we scale it down
// and re-center it before exporting the platform icons. The same padding works
// well for Linux/Windows fallbacks too.
const CANVAS = 1024;
const BODY = 824;

async function paddedBuffer(size) {
  const inner = Math.round((BODY / CANVAS) * size);
  const padding = size - inner;
  const padLeft = Math.floor(padding / 2);
  const padRight = padding - padLeft;

  const innerBuffer = await sharp(source)
    .resize(inner, inner, { fit: 'fill' })
    .png()
    .toBuffer();

  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: innerBuffer, left: padLeft, top: padLeft }])
    .png({ compressionLevel: 9 })
    .toBuffer()
    .then((buf) => ({ buf, padLeft, padRight }));
}

async function writePadded(size, outPath) {
  const { buf } = await paddedBuffer(size);
  await writeFile(outPath, buf);
}

async function buildIco() {
  // .ico for Windows: include common sizes.
  const sizes = [16, 32, 48, 64, 128, 256];
  const buffers = await Promise.all(sizes.map(async (s) => (await paddedBuffer(s)).buf));
  await writeFile(path.join(iconsDir, 'icon.ico'), await toIco(buffers));
}

async function buildIcns() {
  // macOS .icns expects a .iconset directory with specific filenames, then
  // iconutil converts it. Each declared size includes a @2x variant when
  // applicable so Retina displays pick the higher-resolution asset.
  const variants = [
    { name: 'icon_16x16.png', size: 16 },
    { name: 'icon_16x16@2x.png', size: 32 },
    { name: 'icon_32x32.png', size: 32 },
    { name: 'icon_32x32@2x.png', size: 64 },
    { name: 'icon_128x128.png', size: 128 },
    { name: 'icon_128x128@2x.png', size: 256 },
    { name: 'icon_256x256.png', size: 256 },
    { name: 'icon_256x256@2x.png', size: 512 },
    { name: 'icon_512x512.png', size: 512 },
    { name: 'icon_512x512@2x.png', size: 1024 },
  ];

  const stagingParent = await mkdtemp(path.join(tmpdir(), 'snaplex-icons-'));
  const iconset = path.join(stagingParent, 'icon.iconset');
  await sharp({
    create: { width: 1, height: 1, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  }).png().toFile(path.join(stagingParent, '.keep')).catch(() => {});
  // mkdir via writeFile fallback (mkdtemp gives us parent dir already)
  const { mkdir } = await import('node:fs/promises');
  await mkdir(iconset, { recursive: true });

  await Promise.all(variants.map(async ({ name, size }) => {
    const { buf } = await paddedBuffer(size);
    await writeFile(path.join(iconset, name), buf);
  }));

  const result = spawnSync('iconutil', ['-c', 'icns', '-o', path.join(iconsDir, 'icon.icns'), iconset], {
    stdio: 'inherit',
  });

  await rm(stagingParent, { recursive: true, force: true });

  if (result.status !== 0) {
    throw new Error('iconutil failed to produce icon.icns');
  }
}

async function main() {
  // PNGs referenced by tauri.conf.json (used as fallbacks and Linux icons).
  await writePadded(32, path.join(iconsDir, '32x32.png'));
  await writePadded(64, path.join(iconsDir, '64x64.png'));
  await writePadded(128, path.join(iconsDir, '128x128.png'));
  await writePadded(256, path.join(iconsDir, '128x128@2x.png'));
  await writePadded(512, path.join(iconsDir, 'icon.png'));

  await buildIco();
  await buildIcns();

  console.log('Generated padded Tauri app icons in', path.relative(rootDir, iconsDir));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
