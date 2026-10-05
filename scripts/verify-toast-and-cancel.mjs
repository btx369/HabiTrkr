/**
 * Checks two reported defects, both visual and both measured rather than eyeballed:
 *
 *  1. A toast was a fixed width, so a short message sat in a box far wider than its text.
 *  2. The Cancel button on the Archive and Delete confirmations was painted in the
 *     destructive colour, making the safe way out look like the dangerous one.
 *
 * Usage: node scripts/verify-toast-and-cancel.mjs
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
const NOTES = [
  { id: 'n1', type: 'text', name: 'Groceries', description: 'milk', tags: [], items: [], color: 'default', locked: false, createdAt: NOW, modifiedAt: NOW },
];

const port = 9222 + Math.floor(Math.random() * 400);
const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'toastcancel-'));
const outDir = path.join(process.cwd(), 'preview');
fs.mkdirSync(outDir, { recursive: true });
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
  '--no-first-run', '--disable-extensions', '--window-size=1440,900',
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
  await sleep(2500);
  await cdp.eval(`(() => {
    for (const k of ['notes','archivedNotes','folders','archivedFolders']) localStorage.removeItem(k);
    localStorage.setItem('notes', ${JSON.stringify(JSON.stringify(NOTES))});
    localStorage.setItem('habitrkr.theme', 'light');
    localStorage.setItem('habitrkr.language', 'en');
    return true;
  })()`);
  await cdp.send('Page.navigate', { url: BASE + '/notes' });
  await sleep(3200);

  const mouseClick = async (x, y) => {
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, buttons: 0 });
    await sleep(110);
    await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 });
    await sleep(65);
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1 });
    await sleep(800);
  };
  const clickExpr = async (expr) => {
    const box = await cdp.eval(`(() => { const el = ${expr}; if (!el) return 'null';
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return 'null';
      return JSON.stringify({ x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }); })()`);
    if (box === 'null') return false;
    const b = JSON.parse(box);
    await mouseClick(b.x, b.y);
    return true;
  };

  console.log('=== 1. A toast sizes itself to its message ===');
  // Pinning a note fires a short toast: "Note pinned".
  await clickExpr(`Array.from(document.querySelectorAll('[data-note-card] button')).find(b => b.getAttribute('aria-haspopup') === 'menu')`);
  await sleep(500);
  const pinned = await clickExpr(`Array.from(document.querySelectorAll('[role="menuitem"]')).find(m => /pin/i.test(m.textContent || ''))`);
  check('the Pin menu item was clicked', pinned, true);
  await sleep(1200);

  const toast = JSON.parse(await cdp.eval(`JSON.stringify((() => {
    const el = document.querySelector('[data-sonner-toast]');
    if (!el) return { found: false };
    const r = el.getBoundingClientRect();
    // Width of the text inside, so "the box fits the message" is measurable.
    const textEl = el.querySelector('[data-title]') || el.firstElementChild;
    const tr = textEl ? textEl.getBoundingClientRect() : null;
    return { found: true, boxWidth: Math.round(r.width), height: Math.round(r.height),
      textWidth: tr ? Math.round(tr.width) : null,
      text: (el.textContent || '').trim().slice(0, 40) };
  })())`));
  console.log(`  toast: ${JSON.stringify(toast)}`);
  check('a toast appeared', toast.found, true);
  // Sonner's stock width is 356px, which is what made a short message look lost. The box
  // must now be narrower than that, AND the message must still fit on one line: a
  // `fit-content` attempt produced a 65x247 box with the text wrapped one character per
  // line, and a width-only assertion called that a pass.
  console.log(`  box ${toast.boxWidth}px wide, ${toast.height}px tall, for ${toast.textWidth}px of text`);
  check('the toast no longer uses the stock 356px width', toast.boxWidth < 340, true);
  check('and it is still wide enough for its own text', toast.boxWidth >= (toast.textWidth ?? 0), true);
  // A toast holding one short line must not be taller than a couple of lines of text.
  check('the message is not wrapped one character per line', toast.height < 90, true);

  const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(outDir, 'toast-width.png'), Buffer.from(shot.data, 'base64'));
  console.log(`  screenshot: preview/toast-width.png`);

  console.log('\n=== 2. Cancel on a Delete confirmation is not destructive ===');
  await sleep(3500); // let the toast go
  await clickExpr(`Array.from(document.querySelectorAll('[data-note-card] button')).find(b => b.getAttribute('aria-haspopup') === 'menu')`);
  await sleep(500);
  const deleteClicked = await clickExpr(`Array.from(document.querySelectorAll('[role="menuitem"]')).find(m => /delete/i.test(m.textContent || ''))`);
  check('the Delete menu item was clicked', deleteClicked, true);
  await sleep(1200);

  const cancel = JSON.parse(await cdp.eval(`JSON.stringify((() => {
    const dialog = document.querySelector('[role="alertdialog"]');
    if (!dialog) return { found: false };
    const btn = Array.from(dialog.querySelectorAll('button')).find(b => /cancel/i.test(b.textContent || ''));
    if (!btn) return { found: false, noCancel: true };
    const cs = getComputedStyle(btn);
    return { found: true, text: btn.textContent.trim(), color: cs.color, border: cs.borderTopColor,
      bg: cs.backgroundColor };
  })())`));
  console.log(`  Cancel: ${JSON.stringify(cancel)}`);
  check('the confirmation dialog opened with a Cancel button', cancel.found, true);

  // The destructive colour in this palette is a red: a high red channel with low green and
  // blue. Anything near-neutral is the shared secondary styling the request asked for.
  const rgb = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(cancel.color || '');
  if (rgb) {
    const [r, g, b] = [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
    const isRed = r > 120 && g < 80 && b < 80;
    console.log(`  text colour rgb(${r},${g},${b}) -> ${isRed ? 'RED' : 'neutral'}`);
    check('Cancel is not painted in the destructive red', isRed, false);
  } else {
    check('Cancel has a readable colour', Boolean(cancel.color), true);
  }

  const shot2 = await cdp.send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(outDir, 'confirm-cancel.png'), Buffer.from(shot2.data, 'base64'));
  console.log(`  screenshot: preview/confirm-cancel.png`);
} finally {
  chrome.kill();
  await sleep(200);
  try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch { /* windows lock */ }
}

console.log(failures === 0 ? '\nALL TOAST-AND-CANCEL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
