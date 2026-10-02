/**
 * Checks that opening one folder leaves the others alone.
 *
 * Each folder's open state is its own, but a CSS grid stretches its cells to the tallest
 * item in each row by default. Opening one folder therefore made every neighbour beside it
 * just as tall, and they read as if they had all opened together. On a phone the grid is a
 * single column, so nothing shares a row and the problem never showed there — which is why
 * it was reported as a tablet and desktop bug.
 *
 * The fix is `items-start` on the folder grids. This asserts the rendered result: one
 * folder open, the rest closed *and* at their natural height.
 *
 * Usage: node scripts/verify-folder-expansion.mjs
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const BASE = process.env.BASE_URL ?? 'http://localhost:8080';
const CHROME = ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find((p) => fs.existsSync(p));
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
const NOTES = [0, 1, 2, 3].map((i) => ({
  id: `n${i}`, type: 'text', name: `Note ${i}`, description: `body ${i}`,
  tags: [], items: [], color: 'default', locked: false, createdAt: NOW, modifiedAt: NOW,
}));
// Four folders, so a two-column grid puts two of them in the same row as the opened one.
const FOLDERS = [0, 1, 2, 3].map((i) => ({
  id: `f${i}`, name: `Folder ${i}`, description: `desc ${i}`, color: 'default',
  createdAt: NOW, noteIds: [`n${i}`],
}));

const port = 9222 + Math.floor(Math.random() * 400);
const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'folderexp-'));
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
    localStorage.setItem('folders', ${JSON.stringify(JSON.stringify(FOLDERS))});
    localStorage.setItem('habitrkr.theme', 'light');
    return true;
  })()`);
  await cdp.send('Page.navigate', { url: BASE + '/notes' });
  await sleep(3200);

  // Radix tabs ignore a scripted `.click()`; they need a real press.
  const mouseClick = async (x, y) => {
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, buttons: 0 });
    await sleep(120);
    await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 });
    await sleep(70);
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1 });
    await sleep(900);
  };
  const boxOf = async (expr) => JSON.parse(await cdp.eval(`(() => {
    const el = ${expr};
    if (!el) return 'null';
    const r = el.getBoundingClientRect();
    return JSON.stringify({ x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) });
  })()`));

  const tab = await boxOf(`Array.from(document.querySelectorAll('button,[role="tab"]')).find(b => (b.textContent || '').trim() === 'Folders')`);
  check('the Folders tab was found', tab !== null, true);
  await mouseClick(tab.x, tab.y);

  /** The folder grid: the one whose cells contain a collapsible. */
  const measure = () => cdp.eval(`JSON.stringify((() => {
    const g = Array.from(document.querySelectorAll('div.grid'))
      .find(el => el.querySelector('[data-state="open"],[data-state="closed"]'));
    if (!g) return { align: 'NO FOLDER GRID', cells: [] };
    return {
      align: getComputedStyle(g).alignItems,
      cols: getComputedStyle(g).gridTemplateColumns.split(' ').length,
      cells: Array.from(g.children).map(c => {
        const collapsible = c.querySelector('[data-state="open"],[data-state="closed"]');
        return {
          own: collapsible ? collapsible.getAttribute('data-state') : '?',
          h: Math.round(c.getBoundingClientRect().height),
          name: (c.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 8),
        };
      }),
    };
  })())`).then(JSON.parse);

  const before = await measure();
  console.log(`\nfolder grid: ${before.cols} column(s), ${before.cells.length} folder(s), align="${before.align}"`);
  for (const c of before.cells) console.log(`  ${c.name.padEnd(9)} ${c.own.padEnd(7)} h=${c.h}`);
  check('the grid does not stretch its cells', before.align, 'flex-start');
  check('more than one folder shares a row', before.cols > 1 && before.cells.length > before.cols, true);
  check('every folder starts closed', before.cells.every((c) => c.own === 'closed'), true);

  console.log('\n=== opening the first folder ===');
  const header = await boxOf(`(() => {
    const title = Array.from(document.querySelectorAll('*')).find(el =>
      el.children.length === 0 && /^Folder 0$/.test((el.textContent || '').trim()));
    return title ? title.closest('[data-state]') || title : null;
  })()`);
  check('the first folder header was found', header !== null, true);
  // The trigger is the whole header row, so aim near its left edge where the title sits.
  await mouseClick(header.x, header.y);

  const after = await measure();
  console.log('\n=== after the click ===');
  for (const c of after.cells) console.log(`  ${c.name.padEnd(9)} ${c.own.padEnd(7)} h=${c.h}`);

  const open = after.cells.filter((c) => c.own === 'open');
  const closed = after.cells.filter((c) => c.own === 'closed');
  check('exactly one folder is open', open.length, 1);
  check('and it is the one that was clicked', open[0].name, 'Folder 0');
  check('the other folders are still closed', closed.length, after.cells.length - 1);

  // The real assertion: a closed neighbour must stay at its natural height rather than
  // growing to match the open one, which is what made it look open.
  const openHeight = open[0].h;
  const naturalClosed = Math.min(...before.cells.map((c) => c.h));
  console.log(`\n  open height: ${openHeight}   natural closed height: ${naturalClosed}`);
  for (const c of closed) {
    console.log(`  closed "${c.name}" is ${c.h}px (${c.h - naturalClosed}px above natural)`);
  }
  check('every closed folder keeps its natural height',
    closed.every((c) => c.h === naturalClosed), true);
  check('the open one is genuinely taller, so the check has teeth',
    openHeight > naturalClosed, true);
} finally {
  chrome.kill();
  await sleep(200);
  try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch { /* windows lock */ }
}

console.log(failures === 0 ? '\nALL FOLDER-EXPANSION CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
