/**
 * Generates every app icon from a single source image.
 *
 * This is a build tool, not app code: re-run it after replacing the source image.
 *
 *   node scripts/generate-icons.mjs                       # uses resources/icon-source.jpg
 *   node scripts/generate-icons.mjs path/to/other.jpg
 *
 * It renders with headless Chrome/Edge via a canvas, so there are no image-library
 * dependencies to install. Two variants are produced:
 *
 *   "art"       — the rounded-square artwork as-is, transparent outside the corners.
 *                 Used for browser favicons, PWA icons and the in-app logo.
 *   "fullbleed" — the artwork scaled so its edges reach the canvas edges, with the
 *                 surrounding corners filled by the artwork's own colours. This is what
 *                 Android launcher icons need: they get masked to a circle/squircle,
 *                 and a rounded square inside a circle would otherwise show gaps.
 *
 * Regenerated Android assets are written straight into android/app/src/main/res, so
 * `npx cap sync` is not required afterwards.
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

// ---------------------------------------------------------------------------
// Source geometry and palette, measured from resources/icon-source.jpg.
// ---------------------------------------------------------------------------
const DEFAULT_SOURCE = path.join(root, 'resources', 'icon-source.jpg');

/** Square crop of the icon inside the source image. */
const CROP = { x: 36, y: 219, size: 712 };

/** Average of the artwork's four corners — used for the adaptive-icon background. */
const BACKGROUND_COLOR = '#2a8be3';

/** Splash screen background, matching the app's light theme. */
const SPLASH_BG = '#edeae6';

const sourcePath = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_SOURCE;
if (!fs.existsSync(sourcePath)) {
  console.error(`Source image not found: ${sourcePath}`);
  process.exit(1);
}

const CHROME_CANDIDATES = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
];
const chrome = CHROME_CANDIDATES.find((p) => fs.existsSync(p));
if (!chrome) {
  console.error('No Chrome/Edge binary found. Install one, or add its path to CHROME_CANDIDATES.');
  process.exit(1);
}

const sourceUrl = 'file:///' + sourcePath.replace(/\\/g, '/');

// ---------------------------------------------------------------------------
// Icon targets
// ---------------------------------------------------------------------------
const MIPMAP_DENSITIES = ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi'];
const LAUNCHER_SIZES = { mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192 };
const FOREGROUND_SIZES = { mdpi: 108, hdpi: 162, xhdpi: 216, xxhdpi: 324, xxxhdpi: 432 };

const targets = [];

/** Adds a target; `height` defaults to `size` for square icons. */
const add = (out, size, variant, height) =>
  targets.push({ out, size, height: height ?? size, variant });

// Web: browser tab / bookmarks / home screen / PWA.
add('public/favicon-16x16.png', 16, 'art');
add('public/favicon-32x32.png', 32, 'art');
add('public/favicon-48x48.png', 48, 'art');
add('public/apple-touch-icon.png', 180, 'art');
add('public/icon-192.png', 192, 'art');
add('public/icon-512.png', 512, 'art');
add('public/icon-maskable-512.png', 512, 'maskable');
add('resources/icon.png', 1024, 'art');

// Android launcher icons (legacy, pre-adaptive).
for (const d of MIPMAP_DENSITIES) {
  const s = LAUNCHER_SIZES[d];
  add(`android/app/src/main/res/mipmap-${d}/ic_launcher.png`, s, 'fullbleed');
  add(`android/app/src/main/res/mipmap-${d}/ic_launcher_round.png`, s, 'fullbleed');
  add(`android/app/src/main/res/mipmap-${d}/ic_launcher_foreground.png`, s, 'fullbleed');
}

// Android adaptive icon foreground. Android scales this layer up by ~1.5, so the art
// must sit inside the centre safe zone (66%) or the mask clips it.
for (const d of MIPMAP_DENSITIES) {
  add(`android/app/src/main/res/mipmap-${d}/ic_launcher_foreground_adaptive.png`, FOREGROUND_SIZES[d], 'adaptive-foreground');
}

// Android splash (drawable-* covers both orientations; one asset per density).
const SPLASH_SIZES = { mdpi: 480, hdpi: 720, xhdpi: 960, xxhdpi: 1440, xxxhdpi: 1920 };
for (const d of MIPMAP_DENSITIES) {
  const s = SPLASH_SIZES[d];
  add(`android/app/src/main/res/drawable-${d}/splash.png`, s, 'splash');
}

// ---------------------------------------------------------------------------
// Render each target with headless Chrome.
// ---------------------------------------------------------------------------
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'icon-gen-'));
let written = 0;

for (const t of targets) {
  const absOut = path.join(root, t.out);
  fs.mkdirSync(path.dirname(absOut), { recursive: true });

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
  /* Transparent page background: without this, --screenshot composites onto white
     and every "transparent" icon comes out fully opaque. */
  html,body{margin:0;padding:0;background:transparent !important}
  canvas{display:block}
</style></head><body>
<canvas id="c" width="${t.size}" height="${t.height}"></canvas>
<script>
const SIZE = ${t.size};
const HEIGHT = ${t.height};
const VARIANT = ${JSON.stringify(t.variant)};
const CROP = ${JSON.stringify(CROP)};
const BG = ${JSON.stringify(BACKGROUND_COLOR)};
const SPLASH_BG = ${JSON.stringify(SPLASH_BG)};

const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');

const img = new Image();
img.onload = () => {
  const draw = (dx, dy, dSize) => {
    ctx.drawImage(img, CROP.x, CROP.y, CROP.size, CROP.size, dx, dy, dSize, dSize);
  };

  /**
   * Clips subsequent drawing to a rounded rectangle. The source artwork is an opaque
   * JPEG with WHITE corners, so scaling it up would leave opaque white blocks where
   * transparency is wanted — the corners must actually be cut out.
   */
  const clipRounded = (x, y, w, h, radius) => {
    const r = Math.min(radius, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    ctx.clip();
  };

  if (VARIANT === 'art') {
    // Rounded-square artwork, with the corners genuinely transparent.
    // iOS-style squircle radius is ~22.4% of the side.
    ctx.save();
    clipRounded(0, 0, SIZE, SIZE, SIZE * 0.224);
    draw(0, 0, SIZE);
    ctx.restore();
  } else if (VARIANT === 'fullbleed') {
    // Fill the canvas with the artwork's own corner colours so the rounded corners
    // do not reveal the canvas behind them, then draw the art edge-to-edge.
    const reach = Math.round(SIZE * 0.14);
    const corners = [
      [0, 0], [SIZE, 0], [0, SIZE], [SIZE, SIZE],
    ];
    const probes = [
      [CROP.x + CROP.size * 0.18, CROP.y + CROP.size * 0.18],
      [CROP.x + CROP.size * 0.82, CROP.y + CROP.size * 0.18],
      [CROP.x + CROP.size * 0.18, CROP.y + CROP.size * 0.82],
      [CROP.x + CROP.size * 0.82, CROP.y + CROP.size * 0.82],
    ];
    // Sample each probe colour through a 1x1 scratch canvas.
    const scratch = document.createElement('canvas');
    scratch.width = 1; scratch.height = 1;
    const sctx = scratch.getContext('2d');
    const colourAt = (sx, sy) => {
      sctx.clearRect(0, 0, 1, 1);
      sctx.drawImage(img, sx, sy, 1, 1, 0, 0, 1, 1);
      const d = sctx.getImageData(0, 0, 1, 1).data;
      return 'rgb(' + d[0] + ',' + d[1] + ',' + d[2] + ')';
    };
    for (let i = 0; i < 4; i++) {
      const [cx, cy] = corners[i];
      const [px, py] = probes[i];
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, reach * 1.6);
      g.addColorStop(0, colourAt(Math.round(px), Math.round(py)));
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(cx - reach * 1.6, cy - reach * 1.6, reach * 3.2, reach * 3.2);
    }
    draw(0, 0, SIZE);
  } else if (VARIANT === 'maskable') {
    // PWA maskable: art scaled into the centre safe zone over the solid background.
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, SIZE, SIZE);
    const inner = Math.round(SIZE * 0.72);
    const offset = Math.round((SIZE - inner) / 2);
    ctx.save();
    clipRounded(offset, offset, inner, inner, inner * 0.224);
    draw(offset, offset, inner);
    ctx.restore();
  } else if (VARIANT === 'adaptive-foreground') {
    // Transparent layer; art sits in the centre ~62% so the mask never clips it.
    const inner = Math.round(SIZE * 0.62);
    const offset = Math.round((SIZE - inner) / 2);
    ctx.save();
    clipRounded(offset, offset, inner, inner, inner * 0.224);
    draw(offset, offset, inner);
    ctx.restore();
  } else if (VARIANT === 'splash') {
    // Android splash: the icon centred on the app background.
    ctx.fillStyle = SPLASH_BG;
    ctx.fillRect(0, 0, SIZE, HEIGHT);
    const inner = Math.round(Math.min(SIZE, HEIGHT) * 0.30);
    const offsetX = Math.round((SIZE - inner) / 2);
    const offsetY = Math.round((HEIGHT - inner) / 2);
    ctx.save();
    clipRounded(offsetX, offsetY, inner, inner, inner * 0.224);
    draw(offsetX, offsetY, inner);
    ctx.restore();
  }

  // Signal completion for --virtual-time-budget.
  document.title = 'ready';
};
img.onerror = () => { document.title = 'error'; };
img.src = ${JSON.stringify(sourceUrl)};
</script></body></html>`;

  const htmlFile = path.join(tmp, `i-${written}.html`);
  fs.writeFileSync(htmlFile, html);

  const res = spawnSync(chrome, [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--hide-scrollbars',
    '--allow-file-access-from-files',
    '--force-device-scale-factor=1',
    // Required for PNG alpha in headless screenshots.
    '--default-background-color=00000000',
    `--window-size=${t.size},${t.height}`,
    '--screenshot=' + absOut,
    '--user-data-dir=' + path.join(tmp, 'profile'),
    '--virtual-time-budget=6000',
    'file:///' + htmlFile.replace(/\\/g, '/'),
  ], { encoding: 'utf8', stdio: ['ignore', 'ignore', 'ignore'] });

  if (!fs.existsSync(absOut)) {
    console.error(`FAILED  ${t.out} (size ${t.size})`);
    console.error(res.stderr?.slice(0, 500) ?? '');
    process.exitCode = 1;
    continue;
  }
  written++;
  console.log(`ok  ${t.out.padEnd(66)} ${t.size}x${t.height}`);
}

// ---------------------------------------------------------------------------
// favicon.ico — assembled by hand (PNG-in-ICO), no dependency needed.
// ---------------------------------------------------------------------------
/** Reads the pixel width from a PNG's IHDR chunk. */
function readPngSize(filePath) {
  const buf = fs.readFileSync(filePath);
  const signature = buf.subarray(0, 8).toString('hex');
  if (signature !== '89504e470d0a1a0a') {
    throw new Error(`${filePath} is not a PNG`);
  }
  // IHDR: 8-byte signature, 4-byte length, 4-byte type, then width (4) and height (4).
  return buf.readUInt32BE(16);
}

function buildIco(pngPaths, outPath) {
  const images = pngPaths.map((p) => ({ png: fs.readFileSync(p), size: readPngSize(p) }));

  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: 1 = icon
  header.writeUInt16LE(images.length, 4);

  const entries = [];
  let offset = 6 + images.length * 16;
  for (const img of images) {
    const e = Buffer.alloc(16);
    e.writeUInt8(img.size >= 256 ? 0 : img.size, 0); // width  (0 means 256)
    e.writeUInt8(img.size >= 256 ? 0 : img.size, 1); // height (0 means 256)
    e.writeUInt8(0, 2); // palette count
    e.writeUInt8(0, 3); // reserved
    e.writeUInt16LE(1, 4);  // colour planes
    e.writeUInt16LE(32, 6); // bits per pixel
    e.writeUInt32LE(img.png.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += img.png.length;
    entries.push(e);
  }

  fs.writeFileSync(outPath, Buffer.concat([header, ...entries, ...images.map((i) => i.png)]));
}

const icoParts = ['public/favicon-16x16.png', 'public/favicon-32x32.png', 'public/favicon-48x48.png']
  .map((p) => path.join(root, p))
  .filter((p) => fs.existsSync(p));

if (icoParts.length > 0) {
  buildIco(icoParts, path.join(root, 'public', 'favicon.ico'));
  console.log(`ok  public/favicon.ico (${icoParts.length} sizes)`);
}

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\n${written}/${targets.length} images generated.`);
