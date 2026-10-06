/**
 * Measures what a note card actually looks like when it sits inside a coloured folder,
 * against the very same note rendered on the main list.
 *
 * The complaint: a note inside a coloured folder looks as if the folder's colour shows
 * through it. It does. Both readings below agree that a plain note inside a blue folder
 * paints rgb(244, 249, 255) where the same note on the main list paints rgb(254, 254, 254).
 *
 * That is the accepted behaviour, not a defect: the alternatives were rendered and put to
 * a decision, and the answer was to leave the folder painting its colour behind the notes
 * (see scripts/preview-folder-bleed-options.mjs for the pictures). What this script does
 * now is record the numbers and fail if the app drifts away from them in either direction,
 * so the question is asked again rather than silently answered by a refactor.
 *
 * Two independent readings are taken:
 *   - the computed backgroundColor of the card element, walked up its ancestors and
 *     composited, which is what the CSS says the result should be;
 *   - the pixels the browser actually painted, sampled from a screenshot, which is what
 *     the reader sees.
 *
 * Usage: node scripts/verify-nested-note-card.mjs
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const BASE = process.env.BASE_URL ?? 'http://localhost:8080';
const CHROME = ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'].find((p) => fs.existsSync(p));
if (!CHROME) { console.error('No Chrome/Edge binary found.'); process.exit(1); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class Cdp {
  constructor(ws) {
    this.ws = ws; this.nextId = 1; this.pending = new Map();
    ws.addEventListener('message', (e) => {
      const m = JSON.parse(e.data);
      if (m.id && this.pending.has(m.id)) {
        const { resolve, reject } = this.pending.get(m.id);
        this.pending.delete(m.id);
        m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result);
      }
    });
  }
  send(method, params = {}) {
    const id = this.nextId++;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      setTimeout(() => { if (this.pending.has(id)) { this.pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); } }, 30000);
    });
  }
  async eval(expression) {
    const r = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? 'eval failed');
    return r.result.value;
  }
  /** A real click. Radix triggers ignore a synthetic `.click()`, which is what made an
   *  earlier version of this script measure the main list while believing it was in the
   *  Folders tab and report a pass it had not earned. */
  async clickAt(x, y) {
    const base = { x: Math.round(x), y: Math.round(y), button: 'left', clickCount: 1 };
    await this.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...base });
    await this.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...base });
    await sleep(40);
    await this.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...base });
  }
  async clickSelector(selector) {
    const rect = await this.eval(`(() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
    })()`);
    if (!rect) throw new Error(`not found: ${selector}`);
    await this.clickAt(rect.x, rect.y);
    return rect;
  }
}

async function getWsUrl(port, attempts = 40) {
  for (let i = 0; i < attempts; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      const page = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
      if (page) return page.webSocketDebuggerUrl;
    } catch { /* not up yet */ }
    await sleep(250);
  }
  throw new Error('Could not reach Chrome DevTools endpoint');
}

let failures = 0;
const check = (label, actual, expected) => {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  const ok = a === e;
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`);
  if (!ok) console.log(`        actual   = ${a}\n        expected = ${e}`);
  return ok;
};

const NOW = new Date().toISOString();
const FOLDER_BLUE = '#BFDBFE';   // "Light Blue", straight from src/constants/colors.ts
const NOTE_YELLOW = '#FEF3C7';   // "Light Yellow", same palette
const PLAIN = 'plain-note-id';
const COLOURED = 'coloured-note-id';

// Two notes inside one coloured folder. Both also appear on the main list, because the
// app lists every note there regardless of folder membership — which is what makes a
// like-for-like comparison of the same note possible.
const NOTES = [
  { id: PLAIN, name: 'Zzz plain note', type: 'text', description: 'no colour of its own',
    tags: [], color: '#FFFFFF', pinned: false, locked: false, createdAt: NOW, modifiedAt: NOW },
  { id: COLOURED, name: 'Zzz coloured note', type: 'text', description: 'paints its own colour',
    tags: [], color: NOTE_YELLOW, pinned: false, locked: false, createdAt: NOW, modifiedAt: NOW },
];
const FOLDERS = [
  { id: 'folder-1', name: 'Zzz blue folder', description: 'a folder with a colour',
    color: FOLDER_BLUE, createdAt: NOW, noteIds: [PLAIN, COLOURED] },
];

/** Reads the card for a note: where it is, the background CSS asks for, and the colour
 *  that background resolves to once every ancestor behind it is composited in. */
const CARD_READING = (id) => `(() => {
  const el = document.querySelector('[data-note-id="${id}"]');
  if (!el) return null;
  const r = el.getBoundingClientRect();
  const parse = (css) => {
    const m = /rgba?\\(([\\d.]+)[,\\s]+([\\d.]+)[,\\s]+([\\d.]+)(?:[,\\s/]+([\\d.]+))?\\)/.exec(css || '');
    if (!m) return null;
    return { rgb: [Number(m[1]), Number(m[2]), Number(m[3])], a: m[4] === undefined ? 1 : Number(m[4]) };
  };
  const own = getComputedStyle(el).backgroundColor;
  // Composite: page background first, then each ancestor's background, then the card's.
  const layers = [];
  for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
    const c = parse(getComputedStyle(n).backgroundColor);
    if (c && c.a > 0) layers.push(c);
  }
  let out = [255, 255, 255];
  for (const layer of layers.reverse()) {
    out = out.map((b, i) => Math.round(layer.rgb[i] * layer.a + b * (1 - layer.a)));
  }
  return {
    rect: { x: r.left, y: r.top, w: r.width, h: r.height },
    own,
    composited: 'rgb(' + out.join(', ') + ')',
    backdrop: getComputedStyle(el).backdropFilter,
    opacity: getComputedStyle(el).opacity,
  };
})()`;

/** Samples the pixels the browser painted. `points` are in CSS pixels of the viewport;
 *  the screenshot is rescaled if it was captured at a different size. */
const SAMPLE = (points) => `(async () => {
  const img = new Image();
  img.src = 'data:image/png;base64,' + window.__shot;
  await img.decode();
  const scale = img.width / window.innerWidth;
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const at = (x, y) => {
    const d = ctx.getImageData(Math.round(x * scale), Math.round(y * scale), 1, 1).data;
    return [d[0], d[1], d[2]];
  };
  const strip = (x, y, n, step) => {
    const seen = new Map();
    for (let i = 0; i < n; i++) {
      const rgb = at(x + i * step, y);
      const k = rgb.join(',');
      seen.set(k, (seen.get(k) || 0) + 1);
    }
    return [...seen.entries()].sort((a, b) => b[1] - a[1])[0][0].split(',').map(Number);
  };
  return { size: { w: img.width, h: img.height }, viewport: { w: window.innerWidth, h: window.innerHeight },
    samples: ${JSON.stringify(points)}.map((p) => strip(p.x, p.y, p.n ?? 24, p.step ?? 4)) };
})()`;

/**
 * A blank strip inside the card: a few pixels above the bottom edge, across the middle of
 * the card, where `px-2 py-2` padding guarantees no text. The rounded corner is 20px, so
 * the strip stays between x+40 and x+w-40.
 */
const blankStrip = (rect) => ({ x: rect.x + 40, y: rect.y + rect.h - 4, n: Math.max(6, Math.floor((rect.w - 80) / 4)), step: 4 });

const fmt = (rgb) => `rgb(${rgb.join(', ')})`;
const maxDelta = (a, b) => Math.max(...a.map((v, i) => Math.abs(v - b[i])));
const parseRgb = (css) => (/(\d+)[,\s]+(\d+)[,\s]+(\d+)/.exec(css || '') || []).slice(1, 4).map(Number);

const port = 9222 + Math.floor(Math.random() * 400);
const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nested-'));
const outDir = path.join(process.cwd(), 'preview');
fs.mkdirSync(outDir, { recursive: true });
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
  '--no-first-run', '--disable-extensions', '--window-size=1440,900',
  '--force-device-scale-factor=1',
  `--remote-debugging-port=${port}`, `--user-data-dir=${profileDir}`, 'about:blank'], { stdio: 'ignore' });

try {
  const ws = new WebSocket(await getWsUrl(port));
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });
  const cdp = new Cdp(ws);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');

  await cdp.send('Page.navigate', { url: BASE + '/' });
  await sleep(2000);
  await cdp.eval(`(() => {
    for (const k of ['notes','archivedNotes','folders','archivedFolders']) localStorage.removeItem(k);
    localStorage.setItem('notes', ${JSON.stringify(JSON.stringify(NOTES))});
    localStorage.setItem('folders', ${JSON.stringify(JSON.stringify(FOLDERS))});
    localStorage.setItem('habitrkr.theme', 'light');
    localStorage.setItem('habitrkr.language', 'en');
    return true;
  })()`);

  await cdp.send('Page.navigate', { url: BASE + '/notes' });
  await sleep(2500);
  // Wait for the main list to actually render.
  for (let i = 0; i < 20; i++) {
    if (await cdp.eval(`Boolean(document.querySelector('[data-note-id="${PLAIN}"]'))`)) break;
    await sleep(300);
  }
  check('the seeded notes render on the main list', await cdp.eval(`document.querySelectorAll('[data-note-id]').length`), 2);

  const readState = async (label) => {
    const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
    await cdp.eval(`window.__shot = ${JSON.stringify(shot.data)}`);
    const plain = await cdp.eval(CARD_READING(PLAIN));
    const coloured = await cdp.eval(CARD_READING(COLOURED));
    const pixels = await cdp.eval(SAMPLE([
      { ...blankStrip(plain.rect), id: PLAIN },
      { ...blankStrip(coloured.rect), id: COLOURED },
    ]));
    console.log(`\n=== ${label} ===`);
    console.log(`  screenshot ${pixels.size.w}x${pixels.size.h}, viewport ${pixels.viewport.w}x${pixels.viewport.h}`);
    const reading = (card, px) => ({
      own: card.own,
      composited: card.composited,
      painted: fmt(px),
    });
    console.log(`  plain note    : ${JSON.stringify(reading(plain, pixels.samples[0]))}`);
    console.log(`  coloured note : ${JSON.stringify(reading(coloured, pixels.samples[1]))}`);
    return { plain, coloured, pixels: pixels.samples, shot: shot.data };
  };

  const outside = await readState('On the main list, outside any folder');

  console.log('\n=== Switching to the Folders tab (real clicks) ===');
  const tabRect = await cdp.eval(`(() => {
    const tab = Array.from(document.querySelectorAll('[role="tab"]')).find((b) => (b.textContent || '').trim() === 'Folders');
    if (!tab) return null;
    const r = tab.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  })()`);
  check('the Folders tab exists', Boolean(tabRect), true);
  await cdp.clickAt(tabRect.x, tabRect.y);
  await sleep(1200);
  // Without this the script can believe it is in the Folders tab while still measuring the
  // main list, which is exactly how the previous version reported a pass it had not earned.
  check('the Folders tab is the active tab', await cdp.eval(
    `(document.querySelector('[role="tab"][data-state="active"]') || {}).textContent?.trim() ?? null`), 'Folders');

  const folderCardBefore = await cdp.eval(
    `Boolean(document.querySelector('[data-note-id="${PLAIN}"]'))`);
  check('no nested note is rendered while the folder is closed', folderCardBefore, false);

  console.log('\n=== Expanding the folder (real click) ===');
  const triggerRect = await cdp.eval(`(() => {
    const title = Array.from(document.querySelectorAll('h4')).find((h) => /Zzz blue folder/.test(h.textContent || ''));
    if (!title) return null;
    const t = title.closest('[data-state]') || title;
    const r = t.getBoundingClientRect();
    return { x: r.left + Math.min(60, r.width / 2), y: r.top + r.height / 2 };
  })()`);
  check('the folder card exists in the Folders tab', Boolean(triggerRect), true);
  await cdp.clickAt(triggerRect.x, triggerRect.y);
  await sleep(1200);
  check('the folder is expanded and its notes are rendered', await cdp.eval(
    `Boolean(document.querySelector('[data-note-id="${PLAIN}"]'))`), true);

  const inside = await readState('Inside the coloured folder');

  console.log('\n=== what the reader sees ===');
  const paintedOutside = outside.pixels;
  const paintedInside = inside.pixels;
  const dPlain = maxDelta(paintedOutside[0], paintedInside[0]);
  const dColoured = maxDelta(paintedOutside[1], paintedInside[1]);
  console.log(`  plain note    : outside ${fmt(paintedOutside[0])}  in folder ${fmt(paintedInside[0])}  max channel delta ${dPlain}`);
  console.log(`  coloured note : outside ${fmt(paintedOutside[1])}  in folder ${fmt(paintedInside[1])}  max channel delta ${dColoured}`);

  console.log('\n=== what the CSS says ===');
  console.log(`  plain note    : outside ${outside.plain.composited}  in folder ${inside.plain.composited}`);
  console.log(`  coloured note : outside ${outside.coloured.composited}  in folder ${inside.coloured.composited}`);

  /*
   * The decision is that the folder keeps painting its colour behind its notes, so a note
   * inside a coloured folder is expected to be tinted by it. A delta of 0 would mean that
   * changed — a nested card went opaque, or the folder stopped painting its colour — and
   * that is a rendering decision, not something a verification script gets to make.
   */
  console.log('\n=== verdict ===');
  console.log('  decided behaviour: the folder\'s colour is visible through the notes inside it');
  check('a plain note inside a coloured folder is tinted by it', dPlain >= 4, true);
  check('a note with its own colour is tinted by the folder too', dColoured >= 4, true);
  // The tint must stay a tint: a note inside a folder is never the folder's own colour.
  const folderColour = parseRgb(inside.plain.composited);
  console.log(`  the note reads ${inside.plain.composited} inside a folder of ${FOLDER_BLUE}`);
  check('the note is still lighter than the folder behind it', folderColour[0] > 0xbf, true);

  const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(outDir, 'nested-note-card.png'), Buffer.from(shot.data, 'base64'));
  console.log(`\n  screenshot of the open folder: preview/nested-note-card.png (theme: light)`);

  console.log(failures === 0 ? '\nALL NESTED-CARD CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
  process.exitCode = failures === 0 ? 0 : 1;
} finally {
  chrome.kill();
  await sleep(200);
  try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch { /* windows lock */ }
}
