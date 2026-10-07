/**
 * Checks the Move to folder dialog: where the list scrolls, where the create button sits, and
 * whether a reader can tell there are more folders than the ones on screen.
 *
 * The three reports, measured on notes, events and habits alike:
 *   1. nothing hinted that the folder list continued below the edge;
 *   2. the "Create new folder" button was the last thing in that list, so it went below the
 *      fold as soon as there were more folders than fitted;
 *   3. the list scrolled in two places — its own 400px box inside the dialog's own region.
 *
 * So the check opens the dialog on a seeded set of ten folders and measures: how many scroll
 * regions the dialog has, whether the last folder is below the fold, whether a scrollbar is
 * painted at all (scrollbars are hidden globally in this app, so this one is deliberate), and
 * whether the create button stays exactly where it is while the list moves.
 *
 * Usage: node scripts/verify-move-to-folder-dialog.mjs
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
      setTimeout(() => { if (this.pending.has(id)) { this.pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); } }, 25000);
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
    await sleep(70);
    await this.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...base, buttons: 1 });
    await sleep(50);
    await this.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...base, buttons: 0 });
    await sleep(500);
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
  /** A real wheel over a point, which is what a reader does to reach the rest of the list. */
  async wheel(x, y, deltaY) {
    await this.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: Math.round(x), y: Math.round(y), deltaX: 0, deltaY });
    await sleep(600);
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

const NOW = new Date().toISOString();
const FUTURE = new Date(Date.now() + 14 * 86400000).toISOString();
const FOLDER_COUNT = 10;

const folders = (prefix, idKey) => Array.from({ length: FOLDER_COUNT }, (_, index) => ({
  id: `${prefix}-${index}`,
  name: `${prefix} folder ${String(index + 1).padStart(2, '0')}`,
  description: index % 2 === 0 ? 'a description line' : '',
  color: '#FFFFFF',
  createdAt: NOW,
  pinned: false,
  archived: false,
  [idKey]: [],
}));

const SEED = {
  notes: [{ id: 'n1', name: 'The note', type: 'text', description: 'text', tags: [], color: '#FFFFFF', pinned: false, locked: false, createdAt: NOW, modifiedAt: NOW }],
  folders: folders('note', 'noteIds'),
  events: [{ id: 'e1', name: 'The event', description: '', color: '#FFFFFF', createdAt: NOW, isRecurrent: false, startDate: FUTURE, isAllDay: true, pinned: false }],
  eventFolders: folders('event', 'eventIds'),
  habits: [{ id: 'h1', name: 'The habit', color: '#FFFFFF', createdAt: NOW, completedDates: [], activeDays: [true, true, true, true, true, true, true], pinned: false }],
  habitFolders: folders('habit', 'habitIds'),
};

/** Everything the dialog can tell us about how it scrolls and where its pieces are. */
const DIALOG_READING = `(() => {
  const dialog = document.querySelector('[role="dialog"]');
  if (!dialog) return { open: false };
  const box = dialog.getBoundingClientRect();
  const scrollables = Array.from(dialog.querySelectorAll('*')).filter((el) => {
    const cs = getComputedStyle(el);
    const scrolls = cs.overflowY === 'auto' || cs.overflowY === 'scroll';
    return scrolls && el.scrollHeight > el.clientHeight + 1;
  });
  const region = scrollables[0] || null;
  const button = Array.from(dialog.querySelectorAll('button'))
    .find((b) => /create/i.test(b.textContent || '')) || null;
  const cards = Array.from(dialog.querySelectorAll('h4'));
  const lastCard = cards[cards.length - 1] || null;
  const visible = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return r.top >= box.top - 1 && r.bottom <= box.bottom + 1 && r.height > 0;
  };
  const regionRect = region ? region.getBoundingClientRect() : null;
  return {
    open: true,
    dialog: { top: Math.round(box.top), bottom: Math.round(box.bottom), height: Math.round(box.height) },
    scrollRegions: scrollables.length,
    region: region ? {
      top: Math.round(regionRect.top), bottom: Math.round(regionRect.bottom),
      gutter: region.offsetWidth - region.clientWidth,
      scrollTop: Math.round(region.scrollTop),
      scrollHeight: region.scrollHeight, clientHeight: region.clientHeight,
      scrollbarWidth: getComputedStyle(region).scrollbarWidth,
      x: Math.round(regionRect.right - 3), y: Math.round(regionRect.top + 20),
      centreY: Math.round(regionRect.top + regionRect.height / 2),
      centreX: Math.round(regionRect.left + regionRect.width / 2),
    } : null,
    button: button ? {
      text: (button.textContent || '').trim(),
      top: Math.round(button.getBoundingClientRect().top),
      bottom: Math.round(button.getBoundingClientRect().bottom),
      onScreen: visible(button),
    } : null,
    folderCards: cards.length,
    lastName: lastCard ? (lastCard.textContent || '').trim() : null,
    lastCardOnScreen: visible(lastCard),
  };
})()`;

const port = 9222 + Math.floor(Math.random() * 400);
const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'movetofolder-'));
const outDir = path.join(process.cwd(), 'preview');
fs.mkdirSync(outDir, { recursive: true });
/*
 * No `--hide-scrollbars` here, unlike the other checks. That flag hides scrollbars at the
 * browser level, so with it this measurement would be about the flag rather than about the app
 * — and a visible scrollbar is the whole point of this dialog's list.
 */
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox',
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
    const seed = ${JSON.stringify(SEED)};
    for (const key of Object.keys(seed)) localStorage.setItem(key, JSON.stringify(seed[key]));
    localStorage.setItem('habitrkr.language', 'en');
    localStorage.setItem('habitrkr.theme', 'light');
    return true;
  })()`);

  const runPage = async (route, label, cardAttribute) => {
    console.log(`\n########## ${label} (${route}) ##########`);
    await cdp.send('Page.navigate', { url: BASE + route });
    await sleep(2600);

    const menuOpened = await cdp.clickExpr(`document.querySelector('[${cardAttribute}] button[aria-haspopup="menu"]')`);
    check('the item menu opened', menuOpened, true);
    await sleep(500);
    const moveClicked = await cdp.clickExpr(
      `Array.from(document.querySelectorAll('[role="menuitem"]')).find((m) => (m.textContent || '').trim() === 'Move to Folder')`);
    check('the Move to folder item was clicked', moveClicked, true);
    await sleep(1000);

    const before = JSON.parse(await cdp.eval(`JSON.stringify(${DIALOG_READING})`));
    check('the dialog opened', before.open, true);
    if (!before.open) return;
    console.log(`  folders listed: ${before.folderCards}, dialog ${before.dialog.height}px tall`);
    console.log(`  scroll regions: ${before.scrollRegions}, gutter ${before.region?.gutter}px, scrollbar-width: ${before.region?.scrollbarWidth}`);
    console.log(`  create button: "${before.button?.text}" at y=${before.button?.top}, on screen: ${before.button?.onScreen}`);
    console.log(`  last folder "${before.lastName}" on screen: ${before.lastCardOnScreen}`);

    check('all ten folders are listed', before.folderCards, FOLDER_COUNT);
    check('the dialog has exactly one scrolling region', before.scrollRegions, 1);
    check('the last folder is below the fold, so there is more to see', before.lastCardOnScreen, false);
    check('the create button is on screen without scrolling', before.button?.onScreen, true);
    check('a scrollbar is laid out for the list', before.region.gutter > 0, true);

    // The thumb has to be painted, not just laid out: a transparent one would leave the hint
    // invisible, which is the whole point of the change.
    const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
    await cdp.eval(`window.__shot = ${JSON.stringify(shot.data)}`);
    const thumb = await cdp.eval(`(async () => {
      const img = new Image();
      img.src = 'data:image/png;base64,' + window.__shot;
      await img.decode();
      const scale = img.width / window.innerWidth;
      const canvas = document.createElement('canvas');
      canvas.width = img.width; canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const at = (x, y) => {
        const d = ctx.getImageData(Math.round(x * scale), Math.round(y * scale), 1, 1).data;
        return [d[0], d[1], d[2]];
      };
      const gutterX = ${before.region.x};
      const samples = [${before.region.top + 8}, ${before.region.top + 30}, ${before.region.centreY}].map((y) => at(gutterX, y));
      const background = at(gutterX - 12, ${before.region.centreY});
      return { samples, background };
    })()`);
    console.log(`  pixels in the gutter: ${JSON.stringify(thumb.samples)}, dialog background ${JSON.stringify(thumb.background)}`);
    check('something is painted in the scrollbar gutter',
      thumb.samples.some((s) => Math.abs(s[0] - thumb.background[0]) + Math.abs(s[1] - thumb.background[1]) + Math.abs(s[2] - thumb.background[2]) > 8), true);

    // Scroll the list with a real wheel and see what moves.
    await cdp.wheel(before.region.centreX, before.region.centreY, 600);
    const after = JSON.parse(await cdp.eval(`JSON.stringify(${DIALOG_READING})`));
    console.log(`  after scrolling: scrollTop ${after.region.scrollTop}, button at y=${after.button.top}, on screen: ${after.button.onScreen}`);
    check('the list scrolled', after.region.scrollTop > 0, true);
    check('the create button did not move', after.button.top, before.button.top);
    check('and it is still on screen at the bottom of the list', after.button.onScreen, true);

    const shot2 = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(outDir, `move-to-folder-${label}.png`), Buffer.from(shot2.data, 'base64'));
    console.log(`  screenshot: preview/move-to-folder-${label}.png`);

    await cdp.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await sleep(700);
  };

  await runPage('/notes', 'notes', 'data-note-id');
  await runPage('/events', 'events', 'data-event-id');
  await runPage('/', 'habits', 'data-habit-id');

  /*
   * The bar has to be visible on the dark theme too, and Chrome paints its own scrollbar
   * whenever `scrollbar-width` is set — so this is the reading that would catch a bar left in
   * the light system grey.
   */
  console.log('\n########## notes, dark theme ##########');
  await cdp.eval(`localStorage.setItem('habitrkr.theme', 'dark')`);
  await cdp.send('Page.navigate', { url: BASE + '/notes' });
  await sleep(2600);
  await cdp.clickExpr(`document.querySelector('[data-note-id] button[aria-haspopup="menu"]')`);
  await sleep(500);
  await cdp.clickExpr(
    `Array.from(document.querySelectorAll('[role="menuitem"]')).find((m) => (m.textContent || '').trim() === 'Move to Folder')`);
  await sleep(1000);
  const dark = JSON.parse(await cdp.eval(`JSON.stringify(${DIALOG_READING})`));
  check('the dialog opened in the dark theme', dark.open, true);
  if (dark.open) {
    const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
    await cdp.eval(`window.__shot = ${JSON.stringify(shot.data)}`);
    const pixels = await cdp.eval(`(async () => {
      const img = new Image();
      img.src = 'data:image/png;base64,' + window.__shot;
      await img.decode();
      const scale = img.width / window.innerWidth;
      const canvas = document.createElement('canvas');
      canvas.width = img.width; canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const at = (x, y) => {
        const d = ctx.getImageData(Math.round(x * scale), Math.round(y * scale), 1, 1).data;
        return [d[0], d[1], d[2]];
      };
      return {
        thumb: at(${dark.region.x}, ${dark.region.top + 30}),
        background: at(${dark.region.x - 12}, ${dark.region.centreY}),
      };
    })()`);
    console.log(`  thumb ${JSON.stringify(pixels.thumb)} against dialog background ${JSON.stringify(pixels.background)}`);
    const distance = Math.abs(pixels.thumb[0] - pixels.background[0]) + Math.abs(pixels.thumb[1] - pixels.background[1]) + Math.abs(pixels.thumb[2] - pixels.background[2]);
    check('the scrollbar is visible against the dark dialog', distance > 20, true);
    fs.writeFileSync(path.join(outDir, 'move-to-folder-notes-dark.png'), Buffer.from(shot.data, 'base64'));
    console.log('  screenshot: preview/move-to-folder-notes-dark.png');
  }
} finally {
  chrome.kill();
  await sleep(200);
  try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch { /* windows lock */ }
}

console.log(failures === 0 ? '\nALL MOVE-TO-FOLDER CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
