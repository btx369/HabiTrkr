/**
 * Checks the folder glyph on a card: a note, event or habit that lives in a folder says so
 * on its card, on every list it appears in, and one that lives nowhere does not.
 *
 * The glyph has to be found in the card's own icon row — the folder card in the Folders tab
 * and the "Move to folder" menu item draw the same icon, so a document-wide search for
 * `svg.lucide-folder-open` would report a pass with nothing on any card.
 *
 * Each entity is seeded twice: one inside a folder, one free, both pinned, so the glyph is
 * measured next to the pin it is meant to match and its absence is measured on an otherwise
 * identical card.
 *
 * The last section archives the filed item through the app's own menu and confirmation, then
 * looks for the glyph in the Archived tab. Archiving takes the item out of the folder's ids
 * and records the folder in `originalFolderId`, so this is the case where the glyph used to
 * vanish — and it is exercised through the real action rather than by seeding the end state.
 *
 * Usage: node scripts/verify-folder-glyph.mjs
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
  async clickExpr(expr) {
    const box = await this.eval(`(() => {
      const el = ${expr};
      if (!el) return null;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return null;
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    })()`);
    if (!box) return false;
    await this.clickAt(box.x, box.y);
    return true;
  }
  async clickText(selector, text) {
    return this.clickExpr(`Array.from(document.querySelectorAll(${JSON.stringify(selector)}))
      .find((e) => (e.textContent || '').trim() === ${JSON.stringify(text)})`);
  }
  async go(url) {
    await this.send('Page.navigate', { url });
    await sleep(2200);
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
};

/** Reads the folder glyph inside a card, and the pin it should match. */
const GLYPH_IN_CARD = (id) => `(() => {
  const card = document.querySelector('[data-note-id="${id}"], [data-event-id="${id}"], [data-habit-id="${id}"]');
  if (!card) return { card: false };
  const glyph = card.querySelector('svg.lucide-folder-open');
  const pin = card.querySelector('svg.lucide-pin');
  const colourOf = (svg) => svg ? svg.getAttribute('class').split(/\\s+/).filter((c) => !c.startsWith('lucide')).join(' ') : null;
  if (!glyph) return { card: true, glyph: false, pin: Boolean(pin) };
  const r = glyph.getBoundingClientRect();
  return { card: true, glyph: true, size: { w: Math.round(r.width), h: Math.round(r.height) },
    colour: colourOf(glyph), pinColour: colourOf(pin), visible: r.width > 0 && r.height > 0 };
})()`;

const NOW = new Date().toISOString();
const FOLDER_BLUE = '#BFDBFE';

const NOTES = [
  { id: 'filed-note', name: 'Filed note', type: 'text', description: 'lives in a folder', tags: [],
    color: '#FFFFFF', pinned: true, locked: false, createdAt: NOW, modifiedAt: NOW },
  { id: 'loose-note', name: 'Loose note', type: 'text', description: 'in no folder', tags: [],
    color: '#FFFFFF', pinned: true, locked: false, createdAt: NOW, modifiedAt: NOW },
  // Filed and NOT pinned: the glyph must not depend on the pin being there.
  { id: 'unpinned-filed-note', name: 'Quiet filed note', type: 'text', description: 'filed, not pinned',
    tags: [], color: '#FFFFFF', pinned: false, locked: false, createdAt: NOW, modifiedAt: NOW },
];
const NOTE_FOLDERS = [
  { id: 'note-folder', name: 'Blue folder', description: '', color: FOLDER_BLUE, createdAt: NOW,
    noteIds: ['filed-note', 'unpinned-filed-note'] },
];

const EVENTS = [
  { id: 'filed-event', name: 'Filed event', description: '', color: '#FFFFFF', createdAt: NOW,
    isRecurrent: false, startDate: NOW, isAllDay: true, pinned: true },
  { id: 'loose-event', name: 'Loose event', description: '', color: '#FFFFFF', createdAt: NOW,
    isRecurrent: false, startDate: NOW, isAllDay: true, pinned: true },
];
const EVENT_FOLDERS = [
  { id: 'event-folder', name: 'Blue event folder', description: '', color: FOLDER_BLUE, pinned: false,
    archived: false, createdAt: NOW, eventIds: ['filed-event'] },
];

const HABITS = [
  { id: 'filed-habit', name: 'Filed habit', color: '#FFFFFF', createdAt: NOW, completedDates: [],
    activeDays: [true, true, true, true, true, true, true], pinned: true },
  { id: 'loose-habit', name: 'Loose habit', color: '#FFFFFF', createdAt: NOW, completedDates: [],
    activeDays: [true, true, true, true, true, true, true], pinned: true },
];
const HABIT_FOLDERS = [
  { id: 'habit-folder', name: 'Blue habit folder', description: '', color: FOLDER_BLUE, pinned: false,
    archived: false, createdAt: NOW, habitIds: ['filed-habit'] },
];

const port = 9222 + Math.floor(Math.random() * 400);
const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'folderglyph-'));
const outDir = path.join(process.cwd(), 'preview');
fs.mkdirSync(outDir, { recursive: true });
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
  '--no-first-run', '--disable-extensions', '--window-size=1440,900', '--force-device-scale-factor=1',
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
    for (const k of ['notes','archivedNotes','folders','archivedFolders','events','archivedEvents',
                     'eventFolders','archivedEventFolders','habits','archivedHabits',
                     'habitFolders','archivedHabitFolders']) localStorage.removeItem(k);
    localStorage.setItem('notes', ${JSON.stringify(JSON.stringify(NOTES))});
    localStorage.setItem('folders', ${JSON.stringify(JSON.stringify(NOTE_FOLDERS))});
    localStorage.setItem('events', ${JSON.stringify(JSON.stringify(EVENTS))});
    localStorage.setItem('eventFolders', ${JSON.stringify(JSON.stringify(EVENT_FOLDERS))});
    localStorage.setItem('habits', ${JSON.stringify(JSON.stringify(HABITS))});
    localStorage.setItem('habitFolders', ${JSON.stringify(JSON.stringify(HABIT_FOLDERS))});
    localStorage.setItem('habitrkr.theme', 'light');
    localStorage.setItem('habitrkr.language', 'en');
    return true;
  })()`);

  /** Opens a page, expands the first folder, and reports the glyph on each card. */
  const runEntity = async (url, tabLabel, filedId, looseId, extraId) => {
    await cdp.go(url);

    console.log(`\n=== ${url} · list ===`);
    const filed = JSON.parse(await cdp.eval(`JSON.stringify(${GLYPH_IN_CARD(filedId)})`));
    const loose = JSON.parse(await cdp.eval(`JSON.stringify(${GLYPH_IN_CARD(looseId)})`));
    console.log(`  filed: ${JSON.stringify(filed)}`);
    console.log(`  loose: ${JSON.stringify(loose)}`);
    check('the card of a filed item carries the folder glyph', filed.glyph, true);
    check('the glyph is the shared 14px icon', filed.size, { w: 14, h: 14 });
    check('the glyph takes the same colour as the pin beside it', filed.colour, filed.pinColour);
    check('the card of an item in no folder has no folder glyph', loose.glyph, false);
    if (extraId) {
      const extra = JSON.parse(await cdp.eval(`JSON.stringify(${GLYPH_IN_CARD(extraId)})`));
      console.log(`  filed but not pinned: ${JSON.stringify(extra)}`);
      check('a filed item shows the glyph even when it is not pinned', extra.glyph, true);
    }

    console.log(`\n=== ${url} · inside the folder ===`);
    const tabbed = await cdp.clickText('[role="tab"]', tabLabel);
    check(`the ${tabLabel} tab was clicked`, tabbed, true);
    await sleep(1100);
    check(`the ${tabLabel} tab is active`, await cdp.eval(
      `(document.querySelector('[role="tab"][data-state="active"]') || {}).textContent?.trim() ?? null`), tabLabel);
    const trigger = await cdp.eval(`(() => {
      const h4 = Array.from(document.querySelectorAll('h4')).find((h) => /^(Blue|Blue event|Blue habit) folder/.test((h.textContent || '').trim()));
      if (!h4) return null;
      const r = (h4.closest('[data-state]') || h4).getBoundingClientRect();
      return { x: r.left + 60, y: r.top + r.height / 2 };
    })()`);
    check('the folder card is in the folder list', Boolean(trigger), true);
    if (!trigger) return;
    await cdp.clickAt(trigger.x, trigger.y);
    await sleep(1200);
    const nested = JSON.parse(await cdp.eval(`JSON.stringify(${GLYPH_IN_CARD(filedId)})`));
    console.log(`  nested card: ${JSON.stringify(nested)}`);
    check('the card inside the folder carries the glyph too', nested.glyph, true);

    const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(outDir, `folder-glyph-${filedId}.png`), Buffer.from(shot.data, 'base64'));
    console.log(`  screenshot: preview/folder-glyph-${filedId}.png`);
  };

  /**
   * Archives the filed item the way a reader would — its own 3-dot menu, then the
   * confirmation — and looks for the glyph in the Archived tab.
   */
  const runArchive = async (url, filedId, cardAttribute, archivedTab) => {
    await cdp.go(url);
    console.log(`\n=== ${url} · archived ===`);

    const menuOpened = await cdp.clickExpr(
      `document.querySelector('[${cardAttribute}="${filedId}"] button[aria-haspopup="menu"]')`);
    check(`the ${filedId} menu opened`, menuOpened, true);
    await sleep(500);
    const archiveClicked = await cdp.clickExpr(
      `Array.from(document.querySelectorAll('[role="menuitem"]')).find((m) => (m.textContent || '').trim() === 'Archive')`);
    check('the Archive item was clicked', archiveClicked, true);
    await sleep(900);
    // Archiving asks first, so the confirmation has to be answered.
    const confirmed = await cdp.clickExpr(
      `Array.from(document.querySelectorAll('[role="alertdialog"] button')).find((b) => (b.textContent || '').trim() === 'Archive')`);
    check('the confirmation was accepted', confirmed, true);
    await sleep(1200);
    check('the item has left the list', await cdp.eval(
      `Boolean(document.querySelector('[${cardAttribute}="${filedId}"]'))`), false);

    const tabbed = await cdp.clickExpr(
      `Array.from(document.querySelectorAll('[role="tab"]')).find((b) => (b.textContent || '').trim() === ${JSON.stringify(archivedTab)})`);
    check(`the ${archivedTab} tab was clicked`, tabbed, true);
    await sleep(1100);
    check(`the ${archivedTab} tab is active`, await cdp.eval(
      `(document.querySelector('[role="tab"][data-state="active"]') || {}).textContent?.trim() ?? null`), archivedTab);

    const reading = JSON.parse(await cdp.eval(`JSON.stringify(${GLYPH_IN_CARD(filedId)})`));
    console.log(`  archived card: ${JSON.stringify(reading)}`);
    check('the archived card is on screen with its folder glyph', reading.glyph, true);

    const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(outDir, `folder-glyph-archived-${filedId}.png`), Buffer.from(shot.data, 'base64'));
    console.log(`  screenshot: preview/folder-glyph-archived-${filedId}.png`);
  };

  await runEntity(BASE + '/notes', 'Folders', 'filed-note', 'loose-note', 'unpinned-filed-note');
  await runEntity(BASE + '/events', 'Folders', 'filed-event', 'loose-event');
  // The habit tracker is the root route: `/habits` matches nothing and renders an empty page.
  await runEntity(BASE + '/', 'Folders', 'filed-habit', 'loose-habit');

  // Each archive is exercised on a freshly seeded state, so the item is still filed.
  await cdp.eval(`(() => {
    for (const k of ['notes','archivedNotes','folders','archivedFolders','events','archivedEvents',
                     'eventFolders','archivedEventFolders','habits','archivedHabits',
                     'habitFolders','archivedHabitFolders']) localStorage.removeItem(k);
    localStorage.setItem('notes', ${JSON.stringify(JSON.stringify(NOTES))});
    localStorage.setItem('folders', ${JSON.stringify(JSON.stringify(NOTE_FOLDERS))});
    localStorage.setItem('events', ${JSON.stringify(JSON.stringify(EVENTS))});
    localStorage.setItem('eventFolders', ${JSON.stringify(JSON.stringify(EVENT_FOLDERS))});
    localStorage.setItem('habits', ${JSON.stringify(JSON.stringify(HABITS))});
    localStorage.setItem('habitFolders', ${JSON.stringify(JSON.stringify(HABIT_FOLDERS))});
    return true;
  })()`);

  await runArchive(BASE + '/notes', 'filed-note', 'data-note-id', 'Archived');
  await runArchive(BASE + '/events', 'filed-event', 'data-event-id', 'Archived');
  await runArchive(BASE + '/', 'filed-habit', 'data-habit-id', 'Archived');
} finally {
  chrome.kill();
  await sleep(200);
  try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch { /* windows lock */ }
}

console.log(failures === 0 ? '\nALL FOLDER-GLYPH CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
