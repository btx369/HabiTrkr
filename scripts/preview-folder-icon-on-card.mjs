/**
 * Renders what a folder glyph on a note card would look like, before any of it is wired
 * into the component, so the look can be approved from a picture.
 *
 * The glyph is cloned from the one the folder card already draws (lucide `FolderOpen` at
 * 14px) and given the same colour class the card already uses for its pin and lock, which
 * is exactly what the real implementation would render. Nothing here changes the app.
 *
 * Usage: node scripts/preview-folder-icon-on-card.mjs
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
    await this.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...base, buttons: 0 });
    await sleep(80);
    await this.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...base, buttons: 1 });
    await sleep(50);
    await this.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...base, buttons: 0 });
  }
  async clickText(selector, text) {
    const box = await this.eval(`(() => {
      const el = Array.from(document.querySelectorAll(${JSON.stringify(selector)}))
        .find((e) => (e.textContent || '').trim() === ${JSON.stringify(text)});
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    })()`);
    if (!box) return false;
    await this.clickAt(box.x, box.y);
    return true;
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
const FILED = 'filed-note-id';
const FREE = 'free-note-id';

// Both pinned, so the pin glyph is on screen next to the new folder glyph — the comparison
// the request is about. One is in a folder, the other is not.
const NOTES = [
  { id: FILED, name: 'Filed note', type: 'text', description: 'lives in a folder', tags: [],
    color: '#FFFFFF', pinned: true, locked: false, createdAt: NOW, modifiedAt: NOW },
  { id: FREE, name: 'Loose note', type: 'text', description: 'in no folder at all', tags: [],
    color: '#FFFFFF', pinned: true, locked: false, createdAt: NOW, modifiedAt: NOW },
];
const FOLDERS = [
  { id: 'folder-1', name: 'Blue folder', description: 'one note inside', color: FOLDER_BLUE,
    createdAt: NOW, noteIds: [FILED] },
];

/**
 * Clones the folder card's own glyph into a note card's icon row.
 *
 * The markup is captured while the Folders tab is open and kept on `window`, because Radix
 * unmounts a tab's content as soon as another tab is selected — the source glyph is gone by
 * the time the notes list is measured.
 */
const CAPTURE_GLYPH = `(() => {
  const source = document.querySelector('svg.lucide-folder-open');
  if (!source) return false;
  window.__folderGlyph = source.outerHTML;
  return true;
})()`;

const ADD_GLYPH = (noteId) => `(() => {
  const card = document.querySelector('[data-note-id="${noteId}"]');
  if (!window.__folderGlyph) return { ok: false, glyph: false };
  if (!card) return { ok: false, card: false };
  const row = card.querySelector('.flex.items-center.gap-1') || card.querySelector('.flex.items-center.gap-2');
  if (!row) return { ok: false, row: false };
  const holder = document.createElement('div');
  holder.innerHTML = window.__folderGlyph;
  const glyph = holder.firstElementChild;
  // Exactly what a lucide FolderOpen at 14px with the card's icon colour renders: lucide
  // keeps its own two classes and only the colour comes from the card's pin.
  const pin = card.querySelector('svg.lucide-pin');
  const colour = pin ? pin.getAttribute('class').split(/\\s+/).filter((c) => !c.startsWith('lucide')).join(' ') : '';
  glyph.setAttribute('class', ('lucide lucide-folder-open ' + colour).trim());
  row.prepend(glyph);
  const r = glyph.getBoundingClientRect();
  return { ok: true, size: { w: Math.round(r.width), h: Math.round(r.height) },
    className: glyph.getAttribute('class') };
})()`;

const port = 9222 + Math.floor(Math.random() * 400);
const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'folderglyph-'));
const outDir = path.join(process.cwd(), 'preview');
fs.mkdirSync(outDir, { recursive: true });
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
  '--no-first-run', '--disable-extensions', '--window-size=1440,900', '--force-device-scale-factor=1',
  `--remote-debugging-port=${port}`, `--user-data-dir=${profileDir}`, 'about:blank'], { stdio: 'ignore' });

const crop = async (cdp, file, selector) => {
  const box = await cdp.eval(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: Math.max(0, r.left - 10), y: Math.max(0, r.top - 10), width: r.width + 20, height: r.height + 20 };
  })()`);
  if (!box) return false;
  const shot = await cdp.send('Page.captureScreenshot', { format: 'png', clip: { ...box, scale: 2 } });
  fs.writeFileSync(path.join(outDir, file), Buffer.from(shot.data, 'base64'));
  return true;
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

  console.log('=== inside the folder ===');
  await cdp.clickText('[role="tab"]', 'Folders');
  await sleep(1200);
  const trigger = await cdp.eval(`(() => {
    const h4 = Array.from(document.querySelectorAll('h4')).find((h) => /Blue folder/.test(h.textContent || ''));
    if (!h4) return null;
    const r = (h4.closest('[data-state]') || h4).getBoundingClientRect();
    return { x: r.left + 60, y: r.top + r.height / 2 };
  })()`);
  await cdp.clickAt(trigger.x, trigger.y);
  await sleep(1200);
  const captured = await cdp.eval(CAPTURE_GLYPH);
  console.log(`  captured the folder card's own glyph: ${captured}`);
  const nested = JSON.parse(await cdp.eval(`JSON.stringify(${ADD_GLYPH(FILED)})`));
  console.log(`  glyph on the card inside the folder: ${JSON.stringify(nested)}`);
  await sleep(300);
  console.log(`  preview/folder-icon-inside-folder.png: ${await crop(cdp, 'folder-icon-inside-folder.png', '[data-note-id="' + FILED + '"]')}`);

  console.log('\n=== on the notes list, filed note above a loose one ===');
  await cdp.clickText('[role="tab"]', 'Notes');
  await sleep(1200);
  const listed = JSON.parse(await cdp.eval(`JSON.stringify(${ADD_GLYPH(FILED)})`));
  console.log(`  glyph on the filed note's card: ${JSON.stringify(listed)}`);
  await sleep(300);
  const box = await cdp.eval(`(() => {
    const a = document.querySelector('[data-note-id="${FILED}"]').getBoundingClientRect();
    const b = document.querySelector('[data-note-id="${FREE}"]').getBoundingClientRect();
    const left = Math.min(a.left, b.left), top = Math.min(a.top, b.top);
    return { x: Math.max(0, left - 10), y: Math.max(0, top - 10),
      width: Math.max(a.width, b.width) + 20, height: Math.max(a.bottom, b.bottom) - top + 20 };
  })()`);
  const shot = await cdp.send('Page.captureScreenshot', { format: 'png', clip: { ...box, scale: 2 } });
  fs.writeFileSync(path.join(outDir, 'folder-icon-on-list.png'), Buffer.from(shot.data, 'base64'));
  console.log('  preview/folder-icon-on-list.png (filed note first, loose note second)');
} finally {
  chrome.kill();
  await sleep(200);
  try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch { /* windows lock */ }
}
