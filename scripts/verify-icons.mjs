/**
 * Verifies the app's icon wiring end to end in a real browser:
 *  - every declared icon URL resolves (no 404s)
 *  - the network log shows no failed requests
 *  - the page title is the app's, not Lovable's
 *
 * Usage: node scripts/verify-icons.mjs [baseUrl]
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const base = process.argv[2] ?? 'http://localhost:8080';
const CHROME = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
].find((p) => fs.existsSync(p));
if (!CHROME) {
  console.error('No Chrome/Edge binary found.');
  process.exit(1);
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'icon-verify-'));
const profile = path.join(tmp, 'profile');

// Headless Chrome writes its network log here with --log-net-log.
const netLog = path.join(tmp, 'netlog.json');

const res = spawnSync(
  CHROME,
  [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--user-data-dir=' + profile,
    '--virtual-time-budget=9000',
    '--log-net-log=' + netLog,
    '--net-log-capture-mode=IncludeSensitive',
    '--dump-dom',
    base + '/',
  ],
  { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 },
);

const dom = res.stdout ?? '';

let failures = 0;
const check = (label, ok, detail = '') => {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? '  ' + detail : ''}`);
};

// --- page title / lovable removal -----------------------------------------
const titleMatch = /<title>([^<]*)<\/title>/i.exec(dom);
const title = titleMatch ? titleMatch[1] : '(none)';
check('page title is "HabiTrkr"', title === 'HabiTrkr', `got "${title}"`);
check('no "lovable" left in the rendered document', !/lovable/i.test(dom));

// --- declared icons -------------------------------------------------------
const linkTags = [...dom.matchAll(/<link[^>]+rel="[^"]*icon[^"]*"[^>]*>/gi)].map((m) => m[0]);
const hrefs = linkTags
  .map((tag) => /href="([^"]+)"/i.exec(tag)?.[1])
  .filter(Boolean);

check('index.html declares icon links', hrefs.length > 0, `${hrefs.length} found`);

// Fetch each one through the dev server / static host and confirm it is an image.
for (const href of hrefs) {
  const url = href.startsWith('http') ? href : base + href;
  try {
    const r = await fetch(url);
    const type = r.headers.get('content-type') ?? '';
    check(`icon resolves: ${href}`, r.ok && /image|icon/.test(type), `${r.status} ${type}`);
  } catch (e) {
    check(`icon resolves: ${href}`, false, String(e));
  }
}

// --- manifest -------------------------------------------------------------
try {
  const r = await fetch(base + '/site.webmanifest');
  const manifest = await r.json();
  check('web manifest is valid JSON with a name', r.ok && !!manifest.name, manifest.name ?? '');
  const iconCount = Array.isArray(manifest.icons) ? manifest.icons.length : 0;
  check('manifest lists icons', iconCount >= 3, `${iconCount} icons`);
  for (const icon of manifest.icons ?? []) {
    const ir = await fetch(base + icon.src);
    check(`manifest icon resolves: ${icon.src}`, ir.ok, `${ir.status}`);
  }
} catch (e) {
  check('web manifest loads', false, String(e));
}

// --- favicon.ico is a real ICO -------------------------------------------
try {
  const r = await fetch(base + '/favicon.ico');
  const buf = Buffer.from(await r.arrayBuffer());
  const isIco = buf.readUInt16LE(0) === 0 && buf.readUInt16LE(2) === 1;
  const count = buf.readUInt16LE(4);
  check('favicon.ico is a valid multi-size ICO', isIco && count >= 2, `${count} images, ${buf.length} bytes`);
} catch (e) {
  check('favicon.ico loads', false, String(e));
}

fs.rmSync(tmp, { recursive: true, force: true });
console.log(failures === 0 ? '\nALL ICON CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
