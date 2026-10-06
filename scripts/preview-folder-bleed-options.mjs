/**
 * Renders the same coloured folder three ways, so the fix for "the folder's colour shows
 * through the notes inside it" can be chosen from pictures instead of from prose.
 *
 * Nothing here changes the app: each variant is applied as inline styles in the live page,
 * captured, then cleared again. Every variant paints exactly what the real code would.
 *
 * Usage: node scripts/preview-folder-bleed-options.mjs
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
  async clickAt(x, y) {
    const base = { x: Math.round(x), y: Math.round(y), button: 'left', clickCount: 1 };
    await this.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...base });
    await this.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...base });
    await sleep(40);
    await this.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...base });
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

const NOW = new Date().toISOString();
const FOLDER_BLUE = '#BFDBFE';
const NOTE_YELLOW = '#FEF3C7';
const PLAIN = 'plain-note-id';
const COLOURED = 'coloured-note-id';

const NOTES = [
  { id: PLAIN, name: 'Plain note', type: 'text', description: 'no colour of its own',
    tags: [], color: '#FFFFFF', pinned: false, locked: false, createdAt: NOW, modifiedAt: NOW },
  { id: COLOURED, name: 'Coloured note', type: 'text', description: 'paints its own colour',
    tags: [], color: NOTE_YELLOW, pinned: false, locked: false, createdAt: NOW, modifiedAt: NOW },
];
const FOLDERS = [
  { id: 'folder-1', name: 'Blue folder', description: 'a folder with a colour',
    color: FOLDER_BLUE, createdAt: NOW, noteIds: [PLAIN, COLOURED] },
];

/**
 * Applies a variant with inline styles, remembering every element it touched.
 *
 * The original inline value is saved and put back on cleanup. Removing the property
 * outright would delete the colour React itself wrote as an inline style, and React does
 * not re-render to restore it — which silently uncoloured the folder card and made three
 * of the first previews show something the app never renders.
 */
const APPLY = (variant) => `(() => {
  (window.__touched ?? []).forEach(({ el, prop, value, priority }) => {
    if (value === '') el.style.removeProperty(prop);
    else el.style.setProperty(prop, value, priority);
  });
  window.__touched = [];
  const set = (el, prop, value) => {
    window.__touched.push({ el, prop, value: el.style.getPropertyValue(prop), priority: el.style.getPropertyPriority(prop) });
    el.style.setProperty(prop, value);
  };
  const h4 = Array.from(document.querySelectorAll('h4')).find((h) => /Blue folder/.test(h.textContent || ''));
  if (!h4) return 'folder card not found';
  const root = h4.closest('div[class*="rounded-"]');       // the Card that carries the colour
  const header = root.firstElementChild.firstElementChild;  // Collapsible > CardContent
  const nested = ['${PLAIN}', '${COLOURED}'].map((id) => document.querySelector('[data-note-id="' + id + '"]'));

  if ('${variant}' === 'now') return 'unchanged';

  if ('${variant}' === 'a') {
    // A: the folder's colour stays on its header; the notes inside sit on the page
    // background, which is exactly what they sit on in the main list.
    set(root, 'background-color', 'hsl(var(--background))');
    set(header, 'background-color', '${FOLDER_BLUE}');
    set(header, 'border-radius', '20px 20px 0 0');
  }

  if ('${variant}' === 'b') {
    // B: notes inside a folder become opaque, so nothing behind them shows through.
    nested.forEach((el, i) => {
      if (!el) return;
      set(el, 'background-color', i === 0 ? 'hsl(var(--card))' : '${NOTE_YELLOW}');
      set(el, 'backdrop-filter', 'none');
    });
  }

  if ('${variant}' === 'c') {
    // C: every coloured surface opaque, and the notes inside opaque too.
    set(root, 'background-color', '${FOLDER_BLUE}');
    nested.forEach((el, i) => {
      if (!el) return;
      set(el, 'background-color', i === 0 ? 'hsl(var(--card))' : '${NOTE_YELLOW}');
      set(el, 'backdrop-filter', 'none');
    });
  }
  return 'ok';
})()`;

const SAMPLE = `(async () => {
  const img = new Image();
  img.src = 'data:image/png;base64,' + window.__shot;
  await img.decode();
  const scale = img.width / window.innerWidth;
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  c.getContext('2d').drawImage(img, 0, 0);
  const ctx = c.getContext('2d');
  const out = {};
  for (const [name, id] of [['plain', '${PLAIN}'], ['coloured', '${COLOURED}']]) {
    const el = document.querySelector('[data-note-id="' + id + '"]');
    if (!el) { out[name] = null; continue; }
    const r = el.getBoundingClientRect();
    const x = Math.round((r.left + r.width / 2) * scale);
    const y = Math.round((r.bottom - 4) * scale);
    const d = ctx.getImageData(x, y, 1, 1).data;
    out[name] = 'rgb(' + [d[0], d[1], d[2]].join(', ') + ')';
  }
  return out;
})()`;

const port = 9222 + Math.floor(Math.random() * 400);
const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bleed-'));
const outDir = path.join(process.cwd(), 'preview');
fs.mkdirSync(outDir, { recursive: true });
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
  '--no-first-run', '--disable-extensions', '--window-size=1440,900', '--force-device-scale-factor=1',
  `--remote-debugging-port=${port}`, `--user-data-dir=${profileDir}`, 'about:blank'], { stdio: 'ignore' });

const crop = async (cdp, file, scale = 2) => {
  const box = await cdp.eval(`(() => {
    const h4 = Array.from(document.querySelectorAll('h4')).find((h) => /Blue folder/.test(h.textContent || ''));
    const root = h4.closest('div[class*="rounded-"]');
    const r = root.getBoundingClientRect();
    return { x: r.left - 12, y: r.top - 12, width: r.width + 24, height: r.height + 24 };
  })()`);
  const shot = await cdp.send('Page.captureScreenshot', { format: 'png', clip: { ...box, scale } });
  fs.writeFileSync(path.join(outDir, file), Buffer.from(shot.data, 'base64'));
  return shot.data;
};

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

  // Reference: the two notes on the main list, where nothing is behind them.
  const mainShot = await cdp.send('Page.captureScreenshot', { format: 'png' });
  await cdp.eval(`window.__shot = ${JSON.stringify(mainShot.data)}`);
  const mainPixels = await cdp.eval(SAMPLE);
  fs.writeFileSync(path.join(outDir, 'folder-bleed-main-list.png'), Buffer.from(mainShot.data, 'base64'));
  console.log(`main list (no folder behind the notes): ${JSON.stringify(mainPixels)}`);

  // Open the Folders tab and expand the folder, with real clicks.
  const tab = await cdp.eval(`(() => {
    const t = Array.from(document.querySelectorAll('[role="tab"]')).find((b) => (b.textContent || '').trim() === 'Folders');
    const r = t.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  })()`);
  await cdp.clickAt(tab.x, tab.y);
  await sleep(1200);
  const trigger = await cdp.eval(`(() => {
    const h4 = Array.from(document.querySelectorAll('h4')).find((h) => /Blue folder/.test(h.textContent || ''));
    const r = (h4.closest('[data-state]') || h4).getBoundingClientRect();
    return { x: r.left + 60, y: r.top + r.height / 2 };
  })()`);
  await cdp.clickAt(trigger.x, trigger.y);
  await sleep(1200);

  const VARIANTS = [
    ['now', 'now', 'today: the folder paints its colour behind everything inside it'],
    ['a', 'a-header-only', 'A: colour on the folder header only, notes sit on the page background'],
    ['b', 'b-opaque-children', 'B: the folder keeps its colour, the notes inside it become opaque'],
    ['c', 'c-all-opaque', 'C: folder and the notes inside it all opaque'],
  ];

  for (const [variant, file, description] of VARIANTS) {
    const applied = await cdp.eval(APPLY(variant));
    if (applied !== 'ok' && applied !== 'unchanged') throw new Error(`${variant}: ${applied}`);
    await sleep(400);
    await crop(cdp, `folder-bleed-${file}.png`);
    const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
    await cdp.eval(`window.__shot = ${JSON.stringify(shot.data)}`);
    const pixels = await cdp.eval(SAMPLE);
    console.log(`\n${description}`);
    console.log(`  preview/folder-bleed-${file}.png`);
    console.log(`  plain note ${pixels.plain}   coloured note ${pixels.coloured}`);
  }
} finally {
  chrome.kill();
  await sleep(200);
  try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch { /* windows lock */ }
}
