import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir } from 'node:fs/promises';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'docs/release-assets/promo');

const assets = {
  logo: path.join(root, 'branding/exports/full/512.png'),
  home: path.join(root, 'public/screenshots/home.png'),
  library: path.join(root, 'public/screenshots/library.png'),
};

const colors = {
  cream: '#fffdf5',
  ink: '#243329',
  muted: '#53635a',
  mascot: '#4a6f50',
  mascotSoft: '#e9efe7',
  sunny: '#ffd166',
  coral: '#ef476f',
  softblue: '#118ab2',
  stroke: '#d8dfd1',
};

const escapeXml = (value) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const textLines = (lines, x, y, size, weight = 700, fill = colors.ink, gap = Math.round(size * 1.25)) =>
  lines
    .map((line, index) => (
      `<text x="${x}" y="${y + index * gap}" font-family="Inter, Arial, sans-serif" font-size="${size}" font-weight="${weight}" letter-spacing="0" fill="${fill}">${escapeXml(line)}</text>`
    ))
    .join('');

const svg = (width, height, body) => Buffer.from(`
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${width}" height="${height}" fill="${colors.cream}"/>
  ${body}
</svg>
`);

const png = (input, width, height) => sharp(input).resize(width, height, { fit: 'cover' }).png().toBuffer();
const logo = (size) => sharp(assets.logo).resize(size, size, { fit: 'contain' }).png().toBuffer();

async function renderSmall() {
  const width = 440;
  const height = 280;
  const base = svg(width, height, `
    <rect x="22" y="22" width="396" height="236" rx="18" fill="#ffffff" stroke="${colors.stroke}" stroke-width="2"/>
    <rect x="294" y="36" width="96" height="26" rx="13" fill="${colors.mascotSoft}" stroke="#c6d7bf"/>
    ${textLines(['Local-first'], 312, 54, 12, 800, colors.mascot)}
    ${textLines(['Snaplex'], 92, 74, 28, 850)}
    ${textLines(['Capture visual', 'references locally.'], 36, 126, 30, 850, colors.ink, 36)}
    ${textLines(['Images, video frames, and screenshots', 'land in your desktop library.'], 38, 218, 13, 650, colors.muted, 18)}
    <rect x="296" y="92" width="104" height="120" rx="12" fill="${colors.mascotSoft}" stroke="#c6d7bf"/>
    <rect x="316" y="124" width="62" height="12" rx="6" fill="${colors.mascot}" opacity="0.84"/>
    <rect x="316" y="148" width="46" height="12" rx="6" fill="${colors.sunny}"/>
    <rect x="316" y="172" width="70" height="12" rx="6" fill="${colors.softblue}" opacity="0.82"/>
  `);

  await sharp(base)
    .composite([{ input: await logo(50), left: 34, top: 36 }])
    .png()
    .toFile(path.join(outDir, 'small-promo-440x280.png'));
}

async function renderLarge() {
  const width = 920;
  const height = 680;
  const base = svg(width, height, `
    <rect x="48" y="48" width="824" height="584" rx="28" fill="#ffffff" stroke="${colors.stroke}" stroke-width="2"/>
    <rect x="602" y="82" width="200" height="42" rx="21" fill="${colors.mascotSoft}" stroke="#c6d7bf"/>
    ${textLines(['Local. Private. Fast.'], 631, 109, 17, 800, colors.mascot)}
    ${textLines(['Snaplex'], 188, 134, 44, 850)}
    ${textLines(['Save web images,', 'video frames, and', 'screenshots into your', 'local visual library.'], 80, 224, 42, 850, colors.ink, 50)}
    ${textLines(['A browser companion for Snaplex Desktop.', 'No cloud upload. No account.'], 82, 470, 19, 700, colors.muted, 29)}
    <rect x="554" y="170" width="282" height="216" rx="18" fill="${colors.mascotSoft}" stroke="#c6d7bf" stroke-width="2"/>
    <rect x="496" y="348" width="320" height="218" rx="18" fill="#f8faf5" stroke="${colors.stroke}" stroke-width="2"/>
  `);

  await sharp(base)
    .composite([
      { input: await logo(86), left: 82, top: 77 },
      { input: await png(assets.home, 250, 137), left: 570, top: 194 },
      { input: await png(assets.library, 288, 191), left: 512, top: 372 },
    ])
    .png()
    .toFile(path.join(outDir, 'large-promo-920x680.png'));
}

async function renderMarquee() {
  const width = 1400;
  const height = 560;
  const base = svg(width, height, `
    <rect x="48" y="48" width="1304" height="464" rx="30" fill="#ffffff" stroke="${colors.stroke}" stroke-width="2"/>
    <rect x="76" y="74" width="252" height="42" rx="21" fill="${colors.mascotSoft}" stroke="#c6d7bf"/>
    ${textLines(['Snaplex browser companion'], 108, 102, 18, 800, colors.mascot)}
    ${textLines(['Capture the web', 'into Snaplex.'], 208, 212, 54, 850, colors.ink, 64)}
    ${textLines(['Right-click images, save video frames, or drag a region screenshot.', 'Everything stays on your computer.'], 88, 386, 22, 700, colors.muted, 34)}
    <rect x="724" y="84" width="404" height="286" rx="22" fill="${colors.mascotSoft}" stroke="#c6d7bf" stroke-width="2"/>
    <rect x="960" y="214" width="330" height="250" rx="22" fill="#f8faf5" stroke="${colors.stroke}" stroke-width="2"/>
    <rect x="592" y="402" width="158" height="48" rx="24" fill="${colors.mascot}"/>
    ${textLines(['100% local'], 621, 433, 20, 850, '#ffffff')}
  `);

  await sharp(base)
    .composite([
      { input: await logo(96), left: 84, top: 130 },
      { input: await png(assets.home, 368, 202), left: 742, top: 114 },
      { input: await png(assets.library, 300, 199), left: 976, top: 240 },
    ])
    .png()
    .toFile(path.join(outDir, 'marquee-promo-1400x560.png'));
}

await mkdir(outDir, { recursive: true });
await renderSmall();
await renderLarge();
await renderMarquee();

console.log(`Generated release promo assets in ${path.relative(root, outDir)}`);
