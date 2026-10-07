/**
 * Walks the "move this into a new folder" flow on notes, events and habits:
 *
 *   the item's menu → Move to Folder → Create New Folder → name it → Create
 *
 * and checks that the item ends up inside the folder it just created.
 *
 * The report: on habits the folder was created and the habit stayed out of it, while notes and
 * events behaved. The two pages that worked seed the new folder with the item being moved —
 * `addFolder(folderData, ids)` and `addEventFolder(folderData, id)` — and the habits handler
 * took no such argument at all, so the folder was created empty.
 *
 * The check reads the folder's own contents from storage AND expands the folder on screen, so
 * a folder that merely claims the id without rendering the habit would not pass.
 *
 * Usage: node scripts/verify-create-folder-from-move.mjs
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
  /** Types into whatever has focus. `insertText` rather than key events: those double letters. */
  async type(text) {
    await this.send('Input.insertText', { text });
    await sleep(300);
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

const SEED = {
  notes: [{ id: 'n1', name: 'The note', type: 'text', description: 'text', tags: [], color: '#FFFFFF', pinned: false, locked: false, createdAt: NOW, modifiedAt: NOW }],
  folders: [],
  events: [{ id: 'e1', name: 'The event', description: '', color: '#FFFFFF', createdAt: NOW, isRecurrent: false, startDate: FUTURE, isAllDay: true, pinned: false }],
  eventFolders: [],
  habits: [{ id: 'h1', name: 'The habit', color: '#FFFFFF', createdAt: NOW, completedDates: [], activeDays: [true, true, true, true, true, true, true], pinned: false }],
  habitFolders: [],
};

const port = 9222 + Math.floor(Math.random() * 400);
const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'createfolder-'));
const outDir = path.join(process.cwd(), 'preview');
fs.mkdirSync(outDir, { recursive: true });
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
  '--no-first-run', '--disable-extensions', '--window-size=1440,900', '--force-device-scale-factor=1',
  `--remote-debugging-port=${port}`, `--user-data-dir=${profileDir}`, 'about:blank'], { stdio: 'ignore' });

const folderName = (label) => `${label} box`;

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

  /** The whole flow, for one page. */
  const runFlow = async ({ route, label, cardAttribute, itemName, folderKey, itemIdKey, itemId }) => {
    console.log(`\n########## ${label} (${route}) ##########`);
    await cdp.send('Page.navigate', { url: BASE + route });
    await sleep(2600);

    const menuOpened = await cdp.clickExpr(`document.querySelector('[${cardAttribute}] button[aria-haspopup="menu"]')`);
    check('the item menu opened', menuOpened, true);
    await sleep(500);
    const moveClicked = await cdp.clickExpr(
      `Array.from(document.querySelectorAll('[role="menuitem"]')).find((m) => (m.textContent || '').trim() === 'Move to Folder')`);
    check('the Move to Folder item was clicked', moveClicked, true);
    await sleep(900);

    const createFromDialog = await cdp.clickExpr(
      `Array.from(document.querySelectorAll('[role="dialog"] button')).find((b) => /create/i.test(b.textContent || ''))`);
    check('the Create New Folder button in the dialog was clicked', createFromDialog, true);
    await sleep(900);

    // The folder creator is a dialog of its own; its title field takes the name.
    const titleFocused = await cdp.clickExpr(`(() => {
      const dialog = document.querySelector('[role="dialog"]');
      if (!dialog) return null;
      return dialog.querySelector('input[type="text"], input:not([type])');
    })()`);
    check('the folder creator opened with a title field', titleFocused, true);
    await cdp.type(folderName(label));
    await sleep(400);
    const saved = await cdp.clickExpr(
      `Array.from(document.querySelectorAll('[role="dialog"] button')).find((b) => (b.textContent || '').trim() === 'Create Folder')`);
    check('the folder was created', saved, true);
    await sleep(1400);

    const folders = JSON.parse(await cdp.eval(`localStorage.getItem(${JSON.stringify(folderKey)}) || '[]'`));
    console.log(`  folders now: ${JSON.stringify(folders.map((f) => ({ name: f.name, ids: f[itemIdKey] })))}`);
    check('exactly one folder was created', folders.length, 1);
    check('the folder took the name that was typed', folders[0]?.name, folderName(label));
    check('the item that was being moved is inside the new folder', folders[0]?.[itemIdKey], [itemId]);

    // And on screen: open the folder and look for the item's card inside it.
    const onFolders = await cdp.clickExpr(
      `Array.from(document.querySelectorAll('[role="tab"]')).find((b) => (b.textContent || '').trim() === 'Folders')`);
    check('the Folders tab was clicked', onFolders, true);
    await sleep(1100);
    const trigger = await cdp.eval(`(() => {
      const h4 = Array.from(document.querySelectorAll('h4')).find((h) => (h.textContent || '').includes(${JSON.stringify(folderName(label))}));
      if (!h4) return null;
      const r = (h4.closest('[data-state]') || h4).getBoundingClientRect();
      return { x: r.left + 60, y: r.top + r.height / 2 };
    })()`);
    check('the new folder is listed', Boolean(trigger), true);
    if (trigger) {
      await cdp.clickAt(trigger.x, trigger.y);
      await sleep(1100);
      const insideFolder = await cdp.eval(`(() => {
        const h4 = Array.from(document.querySelectorAll('h4')).find((h) => (h.textContent || '').includes(${JSON.stringify(folderName(label))}));
        const card = h4 ? h4.closest('div[class*="rounded-[20px]"]') : null;
        return card ? Array.from(card.querySelectorAll('[${cardAttribute}]')).map((el) => el.getAttribute('${cardAttribute}')) : [];
      })()`);
      console.log(`  cards inside the folder: ${JSON.stringify(insideFolder)}`);
      check('the item renders inside the folder', insideFolder, [itemId]);
      check('and its name is on screen inside it',
        await cdp.eval(`document.body.innerText.includes(${JSON.stringify(itemName)})`), true);
    }

    const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(outDir, `create-folder-from-move-${label}.png`), Buffer.from(shot.data, 'base64'));
    console.log(`  screenshot: preview/create-folder-from-move-${label}.png`);
  };

  await runFlow({ route: '/notes', label: 'notes', cardAttribute: 'data-note-id', itemName: 'The note', folderKey: 'folders', itemIdKey: 'noteIds', itemId: 'n1' });
  await runFlow({ route: '/events', label: 'events', cardAttribute: 'data-event-id', itemName: 'The event', folderKey: 'eventFolders', itemIdKey: 'eventIds', itemId: 'e1' });
  await runFlow({ route: '/', label: 'habits', cardAttribute: 'data-habit-id', itemName: 'The habit', folderKey: 'habitFolders', itemIdKey: 'habitIds', itemId: 'h1' });
} finally {
  chrome.kill();
  await sleep(200);
  try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch { /* windows lock */ }
}

console.log(failures === 0 ? '\nALL CREATE-FOLDER-FROM-MOVE CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
