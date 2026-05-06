import { mkdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import sharp from 'sharp';
import toIcoPackage from 'to-ico';

const toIco = toIcoPackage.default ?? toIcoPackage;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const inputLogo = path.join(rootDir, 'snaplex-logo.png');
const brandingDir = path.join(rootDir, 'branding');
const sourceDir = path.join(brandingDir, 'source');
const exportDir = path.join(brandingDir, 'exports');
const fullSource = path.join(sourceDir, 'snaplex-mascot-full-1024.png');
const markSource = path.join(sourceDir, 'snaplex-mascot-mark-1024.png');

const fullSizes = [16, 32, 48, 64, 128, 256, 512, 1024];
const markSizes = [24, 32, 48, 64, 128, 256];
const faviconSizes = [16, 32, 48];

async function ensureDirs() {
  await Promise.all([
    mkdir(sourceDir, { recursive: true }),
    mkdir(path.join(exportDir, 'full'), { recursive: true }),
    mkdir(path.join(exportDir, 'mark'), { recursive: true }),
    mkdir(path.join(exportDir, 'favicon'), { recursive: true }),
  ]);
}

async function assertInputExists() {
  try {
    await stat(inputLogo);
  } catch {
    throw new Error(`Missing source logo: ${path.relative(rootDir, inputLogo)}`);
  }
}

function isCardFill(data, width, x, y) {
  const offset = ((y * width) + x) * 4;
  const r = data[offset];
  const g = data[offset + 1];
  const b = data[offset + 2];
  const spread = Math.max(r, g, b) - Math.min(r, g, b);

  return r >= 245 && g >= 238 && b >= 225 && spread <= 32;
}

function findHorizontalFillEdge(data, width, y, startX, step) {
  let x = startX;

  while (x >= 0 && x < width && isCardFill(data, width, x, y)) {
    x += step;
  }

  return x - step;
}

function findVerticalFillEdge(data, width, height, x, startY, step) {
  let y = startY;

  while (y >= 0 && y < height && isCardFill(data, width, x, y)) {
    y += step;
  }

  return y - step;
}

function roundedRectMask(size, radius) {
  return Buffer.from(`
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <rect x="0" y="0" width="${size}" height="${size}" rx="${radius}" ry="${radius}" fill="white"/>
</svg>`);
}

async function generateFullSource() {
  const normalized = await sharp(inputLogo)
    .resize(1024, 1024, { fit: 'fill' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { data, info } = normalized;
  const left = findHorizontalFillEdge(data, info.width, 512, 200, -1);
  const right = findHorizontalFillEdge(data, info.width, 512, 824, 1);
  const top = findVerticalFillEdge(data, info.width, info.height, 512, 200, -1);
  const bottom = findVerticalFillEdge(data, info.width, info.height, 512, 840, 1);

  await sharp(data, {
    raw: {
      width: info.width,
      height: info.height,
      channels: 4,
    },
  })
    .extract({
      left,
      top,
      width: right - left + 1,
      height: bottom - top + 1,
    })
    .resize(1024, 1024, { fit: 'fill' })
    .composite([{
      input: roundedRectMask(1024, 170),
      blend: 'dest-in',
    }])
    .png({ compressionLevel: 9 })
    .toFile(fullSource);
}

function isFloodErasable(data, offset) {
  const r = data[offset];
  const g = data[offset + 1];
  const b = data[offset + 2];
  const a = data[offset + 3];

  if (a === 0) {
    return true;
  }

  const closeToMascotCream =
    Math.abs(r - 245) <= 12 &&
    Math.abs(g - 243) <= 12 &&
    Math.abs(b - 232) <= 12;

  if (closeToMascotCream) {
    return true;
  }

  const maxChannel = Math.max(r, g, b);
  const minChannel = Math.min(r, g, b);
  const channelSpread = maxChannel - minChannel;
  const warmNeutral = r >= g - 4 && g >= b - 18;

  // The source has a cream card plus a soft warm shadow. Treat only light,
  // low-saturation, border-connected pixels as removable background.
  return warmNeutral && (
    (r >= 205 && g >= 198 && b >= 180 && channelSpread <= 48) ||
    (r >= 165 && g >= 155 && b >= 135 && channelSpread <= 58)
  );
}

function buildBackgroundMask(data, width, height) {
  const pixels = width * height;
  const visited = new Uint8Array(pixels);
  const backgroundMask = new Uint8Array(pixels);
  const queue = new Uint32Array(pixels);

  const enqueue = (x, y, tail) => {
    if (x < 0 || x >= width || y < 0 || y >= height) {
      return tail;
    }

    const index = y * width + x;
    if (visited[index] || !isFloodErasable(data, index * 4)) {
      return tail;
    }

    visited[index] = 1;
    queue[tail] = index;
    return tail + 1;
  };

  for (let start = 0; start < pixels; start += 1) {
    if (visited[start] || !isFloodErasable(data, start * 4)) {
      continue;
    }

    let head = 0;
    let tail = 0;
    let touchesEdge = false;

    visited[start] = 1;
    queue[tail] = start;
    tail += 1;

    while (head < tail) {
      const index = queue[head];
      head += 1;

      const x = index % width;
      const y = Math.floor(index / width);

      if (x === 0 || x === width - 1 || y === 0 || y === height - 1) {
        touchesEdge = true;
      }

      tail = enqueue(x + 1, y, tail);
      tail = enqueue(x - 1, y, tail);
      tail = enqueue(x, y + 1, tail);
      tail = enqueue(x, y - 1, tail);
    }

    // Keep small enclosed cream details such as eye whites, but remove the
    // large card/background regions and any region connected to the canvas edge.
    if (touchesEdge || tail > 3000) {
      for (let i = 0; i < tail; i += 1) {
        backgroundMask[queue[i]] = 1;
      }
    }
  }

  return backgroundMask;
}

async function generateMarkSource() {
  const { data, info } = await sharp(fullSource)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const backgroundMask = buildBackgroundMask(data, info.width, info.height);

  for (let index = 0; index < backgroundMask.length; index += 1) {
    if (backgroundMask[index]) {
      data[(index * 4) + 3] = 0;
    }
  }

  const { data: trimmedData, info: trimmedInfo } = await sharp(data, {
    raw: {
      width: info.width,
      height: info.height,
      channels: 4,
    },
  })
    .png()
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 0 })
    .resize(900, 900, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const width = trimmedInfo.width;
  const height = trimmedInfo.height;
  const horizontalPadding = 1024 - width;
  const verticalPadding = 1024 - height;

  await sharp(trimmedData, {
    raw: {
      width,
      height,
      channels: 4,
    },
  })
    .extend({
      top: Math.floor(verticalPadding / 2),
      bottom: Math.ceil(verticalPadding / 2),
      left: Math.floor(horizontalPadding / 2),
      right: Math.ceil(horizontalPadding / 2),
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png({ compressionLevel: 9 })
    .toFile(markSource);
}

async function exportPngSet(source, destination, sizes) {
  await Promise.all(sizes.map((size) => sharp(source)
    .resize(size, size, { fit: 'contain' })
    .png({ compressionLevel: 9 })
    .toFile(path.join(destination, `${size}.png`))));
}

async function generateFavicon() {
  const faviconDir = path.join(exportDir, 'favicon');
  const favicon32 = path.join(faviconDir, 'favicon-32.png');
  const appleTouchIcon = path.join(faviconDir, 'apple-touch-icon-180.png');

  await Promise.all([
    sharp(fullSource)
      .resize(32, 32, { fit: 'contain' })
      .png({ compressionLevel: 9 })
      .toFile(favicon32),
    sharp(fullSource)
      .resize(180, 180, { fit: 'contain' })
      .png({ compressionLevel: 9 })
      .toFile(appleTouchIcon),
  ]);

  const icoBuffers = await Promise.all(faviconSizes.map((size) => sharp(fullSource)
    .resize(size, size, { fit: 'contain' })
    .png()
    .toBuffer()));

  await writeFile(path.join(faviconDir, 'favicon.ico'), await toIco(icoBuffers));
}

async function verifyOutputs() {
  const expectedFiles = [
    fullSource,
    markSource,
    ...fullSizes.map((size) => path.join(exportDir, 'full', `${size}.png`)),
    ...markSizes.map((size) => path.join(exportDir, 'mark', `${size}.png`)),
    path.join(exportDir, 'favicon', 'favicon.ico'),
    path.join(exportDir, 'favicon', 'favicon-32.png'),
    path.join(exportDir, 'favicon', 'apple-touch-icon-180.png'),
  ];

  const missingOrEmpty = [];

  for (const file of expectedFiles) {
    const fileStat = await stat(file).catch(() => null);
    if (!fileStat || fileStat.size === 0) {
      missingOrEmpty.push(path.relative(rootDir, file));
    }
  }

  if (missingOrEmpty.length > 0) {
    throw new Error(`Missing or empty branding assets:\n${missingOrEmpty.join('\n')}`);
  }

  const markMetadata = await sharp(markSource).metadata();
  if (!markMetadata.hasAlpha) {
    throw new Error('Mark source must have an alpha channel.');
  }
}

async function main() {
  await assertInputExists();
  await ensureDirs();

  await generateFullSource();
  await generateMarkSource();
  await exportPngSet(fullSource, path.join(exportDir, 'full'), fullSizes);
  await exportPngSet(markSource, path.join(exportDir, 'mark'), markSizes);
  await generateFavicon();
  await verifyOutputs();

  const manifest = {
    source: [
      path.relative(rootDir, fullSource),
      path.relative(rootDir, markSource),
    ],
    exports: {
      full: fullSizes.map((size) => `branding/exports/full/${size}.png`),
      mark: markSizes.map((size) => `branding/exports/mark/${size}.png`),
      favicon: [
        'branding/exports/favicon/favicon.ico',
        'branding/exports/favicon/favicon-32.png',
        'branding/exports/favicon/apple-touch-icon-180.png',
      ],
    },
  };

  console.log(JSON.stringify(manifest, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
