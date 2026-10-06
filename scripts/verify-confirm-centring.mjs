/**
 * Checks where the text of an Archive/Delete confirmation sits across screen sizes.
 *
 * The report: the confirmation text was centred on a phone and left-aligned on a tablet
 * and a desktop. The cause was in the shared dialog header, which carried
 * `text-center sm:text-left` — Tailwind's `sm:` breakpoint is 640px, so every screen wider
 * than a phone got the left-aligned variant.
 *
 * Centring is measured on the text itself, not on its container: the header is a flex
 * column, so its children always span the full dialog width and a container-based reading
 * would report "centred" no matter how the text is aligned. A Range over the text gives
 * the box the glyphs actually occupy.
 *
 * Usage: node scripts/verify-confirm-centring.mjs
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
  /** Clicks whatever a JS expression returns, using a real mouse event. */
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
  async pressEscape() {
    const key = { key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 };
    await this.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', ...key });
    await this.send('Input.dispatchKeyEvent', { type: 'keyUp', ...key });
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
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}`);
  if (!ok) console.log(`          actual   = ${a}\n          expected = ${e}`);
};

const NOW = new Date().toISOString();
const NOTES = [
  { id: 'n1', type: 'text', name: 'Groceries', description: 'milk', tags: [], items: [],
    color: '#FFFFFF', pinned: false, locked: false, createdAt: NOW, modifiedAt: NOW },
];

/** How far the glyphs sit from the centre of the dialog, in CSS pixels. */
const MEASURE = `(() => {
  const dialog = document.querySelector('[role="alertdialog"]');
  if (!dialog) return { open: false };
  const box = dialog.getBoundingClientRect();
  const centreOf = (el) => {
    if (!el) return null;
    const range = document.createRange();
    range.selectNodeContents(el);
    const r = range.getBoundingClientRect();
    if (!r.width) return null;
    return {
      text: (el.textContent || '').trim().slice(0, 40),
      offset: Math.round((r.left + r.width / 2 - (box.left + box.width / 2)) * 10) / 10,
      width: Math.round(r.width),
    };
  };
  const header = dialog.firstElementChild;
  return {
    open: true,
    dialog: { x: Math.round(box.left), width: Math.round(box.width) },
    textAlign: getComputedStyle(header).textAlign,
    title: centreOf(dialog.querySelector('h2')),
    description: centreOf(dialog.querySelector('p')),
  };
})()`;

const port = 9222 + Math.floor(Math.random() * 400);
const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'centring-'));
const outDir = path.join(process.cwd(), 'preview');
fs.mkdirSync(outDir, { recursive: true });
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
  '--no-first-run', '--disable-extensions', '--window-size=1440,900', '--force-device-scale-factor=1',
  `--remote-debugging-port=${port}`, `--user-data-dir=${profileDir}`, 'about:blank'], { stdio: 'ignore' });

const SCREENS = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'tablet', width: 820, height: 1180 },
  { name: 'desktop', width: 1440, height: 900 },
];

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
    localStorage.setItem('habitrkr.theme', 'light');
    localStorage.setItem('habitrkr.language', 'en');
    return true;
  })()`);
  await cdp.send('Page.navigate', { url: BASE + '/notes' });
  await sleep(2500);

  for (const screen of SCREENS) {
    console.log(`\n=== ${screen.name} (${screen.width}x${screen.height}) ===`);
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: screen.width, height: screen.height, deviceScaleFactor: 1, mobile: false,
    });
    await sleep(900);

    // Scoped to the note card: the first `aria-haspopup="menu"` button on the page is the
    // header's sort menu, and clicking that opened the wrong menu.
    const opened = await cdp.clickExpr(
      `document.querySelector('[data-note-card] button[aria-haspopup="menu"]')`);
    check('the note menu opened', opened, true);
    await sleep(500);
    const deleteClicked = await cdp.clickExpr(
      `Array.from(document.querySelectorAll('[role="menuitem"]')).find((m) => /delete/i.test(m.textContent || ''))`);
    check('the Delete item opened the confirmation', deleteClicked, true);
    if (!deleteClicked) {
      console.log('  menu items on offer: ' + await cdp.eval(
        `JSON.stringify(Array.from(document.querySelectorAll('[role="menuitem"]')).map((m) => (m.textContent || '').trim()))`));
    }
    await sleep(900);

    const reading = JSON.parse(await cdp.eval(`JSON.stringify(${MEASURE})`));
    if (!reading.open) {
      check('the confirmation dialog is on screen', false, true);
      continue;
    }
    console.log(`  dialog ${reading.dialog.width}px wide at x=${reading.dialog.x}, computed text-align: ${reading.textAlign}`);
    console.log(`  title       "${reading.title?.text}" offset from centre ${reading.title?.offset}px`);
    console.log(`  description "${reading.description?.text}" offset from centre ${reading.description?.offset}px`);

    check('the header centres its text', reading.textAlign, 'center');
    check('the title is centred in the dialog', Math.abs(reading.title?.offset ?? 999) <= 2, true);
    check('the description is centred in the dialog', Math.abs(reading.description?.offset ?? 999) <= 2, true);

    const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(outDir, `confirm-centring-${screen.name}.png`), Buffer.from(shot.data, 'base64'));
    console.log(`  screenshot: preview/confirm-centring-${screen.name}.png`);

    await cdp.pressEscape();
    await sleep(700);
    check('the dialog closed again', await cdp.eval(`Boolean(document.querySelector('[role="alertdialog"]'))`), false);
  }
} finally {
  chrome.kill();
  await sleep(200);
  try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch { /* windows lock */ }
}

console.log(failures === 0 ? '\nALL CONFIRMATION-CENTRING CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
