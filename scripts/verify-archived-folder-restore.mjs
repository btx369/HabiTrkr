/**
 * Checks that an item inside an archived folder can be restored from there.
 *
 * The report: the restore button on a note or an event inside an archived folder did nothing.
 * The nested cards have always drawn it — the folder marks them as archived, and an archived
 * card shows restore and delete instead of the menu — but the folder card was never given a
 * handler for the item, only for the folder itself. The habits page passed its equivalent, so
 * it was the one that worked.
 *
 * The archived state is produced by the app, not seeded: a folder is archived through its own
 * menu and confirmation, then the item is restored from inside it. Seeding the end state would
 * have skipped the two code paths that matter.
 *
 * Usage: node scripts/verify-archived-folder-restore.mjs
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
  async clickText(selector, text) {
    return this.clickExpr(`Array.from(document.querySelectorAll(${JSON.stringify(selector)}))
      .find((el) => (el.textContent || '').trim() === ${JSON.stringify(text)})`);
  }
  async go(url, wait = 2600) { await this.send('Page.navigate', { url }); await sleep(wait); }
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
  notes: [{ id: 'n1', name: 'Note in folder', type: 'text', description: 'text', tags: [], color: '#FFFFFF', pinned: false, locked: false, createdAt: NOW, modifiedAt: NOW }],
  folders: [{ id: 'nf1', name: 'Note box', description: '', color: '#FFFFFF', createdAt: NOW, noteIds: ['n1'] }],
  events: [{ id: 'e1', name: 'Event in folder', description: '', color: '#FFFFFF', createdAt: NOW, isRecurrent: false, startDate: FUTURE, isAllDay: true, pinned: false }],
  eventFolders: [{ id: 'ef1', name: 'Event box', description: '', color: '#FFFFFF', pinned: false, archived: false, createdAt: NOW, eventIds: ['e1'] }],
  habits: [{ id: 'h1', name: 'Habit in folder', color: '#FFFFFF', createdAt: NOW, completedDates: [], activeDays: [true, true, true, true, true, true, true], pinned: false }],
  habitFolders: [{ id: 'hf1', name: 'Habit box', description: '', color: '#FFFFFF', pinned: false, archived: false, createdAt: NOW, habitIds: ['h1'] }],
};

const port = 9222 + Math.floor(Math.random() * 400);
const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'archrestore-'));
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

  /**
   * Archives the one folder on the page, through its own menu and confirmation.
   *
   * The menu is found inside the folder's own card: the first `aria-haspopup="menu"` button on
   * the page belongs to the header's view settings, which opens a different menu.
   */
  const archiveFolder = async (url, folderName) => {
    await cdp.go(url);
    // The folder cards live on the Folders tab, not on the first tab of the page.
    const onFolders = await cdp.clickText('[role="tab"]', 'Folders');
    check('the Folders tab was clicked', onFolders, true);
    await sleep(1000);
    check('the Folders tab is active', await cdp.eval(
      `(document.querySelector('[role="tab"][data-state="active"]') || {}).textContent?.trim() ?? null`), 'Folders');
    const menuOpened = await cdp.clickExpr(`(() => {
      const h4 = Array.from(document.querySelectorAll('h4')).find((h) => (h.textContent || '').includes(${JSON.stringify(folderName)}));
      if (!h4) return null;
      const card = h4.closest('div[class*="rounded-[20px]"]');
      return card ? card.querySelector('button[aria-haspopup="menu"]') : null;
    })()`);
    check('the folder menu opened', menuOpened, true);
    if (!menuOpened) {
      console.log('  h4 titles on the page: ' + await cdp.eval(
        `JSON.stringify(Array.from(document.querySelectorAll('h4')).map((h) => (h.textContent || '').trim()))`));
      console.log('  page text: ' + JSON.stringify((await cdp.eval(`document.body.innerText`)).slice(0, 160)));
      console.log('  stored folders: ' + await cdp.eval(`(localStorage.getItem('folders') || '').slice(0, 90)`));
    }
    await sleep(500);
    const archiveClicked = await cdp.clickText('[role="menuitem"]', 'Archive');
    check('the Archive item was clicked', archiveClicked, true);
    if (!archiveClicked) {
      console.log('  menu items on offer: ' + await cdp.eval(
        `JSON.stringify(Array.from(document.querySelectorAll('[role="menuitem"]')).map((m) => (m.textContent || '').trim()))`));
    }
    await sleep(900);
    /*
     * The folder dialog asks what to do with the items as well: "Archive All" takes them into
     * the archive with the folder, which is the state this check wants, and "Folder Only" would
     * leave them active.
     */
    const confirmed = await cdp.clickText('[role="alertdialog"] button', 'Archive All');
    check('the confirmation was accepted', confirmed, true);
    await sleep(1200);
  };

  const stored = async (key) => JSON.parse(await cdp.eval(`localStorage.getItem(${JSON.stringify(key)}) || '[]'`));
  const ids = (list) => list.map((entry) => entry.id);

  /** Restores the item from inside the archived folder and reports where it ended up. */
  const restoreInsideFolder = async (itemId, attribute, folderName, keys) => {
    console.log(`\n=== ${folderName}: the item inside it ===`);
    const archived = await stored(keys.archivedItems);
    const archivedFolders = await stored(keys.archivedFolders);
    console.log(`  archived items: ${JSON.stringify(ids(archived))}, archived folders: ${JSON.stringify(archivedFolders.map((f) => ({ id: f.id, ids: f[keys.folderIds] })))}`);
    check('the item really is in the archive', ids(archived).includes(itemId), true);

    const tabbed = await cdp.clickText('[role="tab"]', 'Archived');
    check('the Archived tab was clicked', tabbed, true);
    await sleep(1100);

    const trigger = await cdp.eval(`(() => {
      const h4 = Array.from(document.querySelectorAll('h4')).find((h) => (h.textContent || '').includes(${JSON.stringify(folderName)}));
      if (!h4) return null;
      const r = (h4.closest('[data-state]') || h4).getBoundingClientRect();
      return { x: r.left + 60, y: r.top + r.height / 2 };
    })()`);
    check('the archived folder is listed', Boolean(trigger), true);
    if (!trigger) return;
    await cdp.clickAt(trigger.x, trigger.y);
    await sleep(1100);

    /*
     * The buttons have to be taken from the card INSIDE the folder, not from the first card
     * with that id on the page: the same item is also listed flat above the folders, and that
     * card's restore button works — it is the path the report says already worked. Clicking it
     * would have made this check pass without touching the nested card at all, which is exactly
     * what a first version of this script did.
     */
    const cardsOnPage = await cdp.eval(`document.querySelectorAll('[${attribute}="${itemId}"]').length`);
    console.log(`  cards for this item on the page: ${cardsOnPage} (one flat, one inside the folder)`);
    check('the item is listed both flat and inside the folder', cardsOnPage, 2);

    const nestedInFolder = `(() => {
      const h4 = Array.from(document.querySelectorAll('h4')).find((h) => (h.textContent || '').includes(${JSON.stringify(folderName)}));
      if (!h4) return null;
      const card = h4.closest('div[class*="rounded-[20px]"]');
      return card ? card.querySelector('[${attribute}="${itemId}"]') : null;
    })()`;
    check('the item\'s card is inside the archived folder', await cdp.eval(`Boolean(${nestedInFolder})`), true);

    const restoreButton = `(() => {
      const nested = ${nestedInFolder};
      if (!nested) return null;
      return Array.from(nested.querySelectorAll('button')).find((b) => b.querySelector('svg.lucide-rotate-ccw')) || null;
    })()`;
    const restored = await cdp.clickExpr(restoreButton);
    check('the restore button inside the folder was clicked', restored, true);
    if (!restored) return;
    await sleep(1500);

    const afterActive = await stored(keys.activeItems);
    const afterArchived = await stored(keys.archivedItems);
    const afterFolders = [...await stored(keys.folders), ...await stored(keys.archivedFolders)];
    console.log(`  active items: ${JSON.stringify(ids(afterActive))}`);
    console.log(`  archived items: ${JSON.stringify(ids(afterArchived))}`);
    console.log(`  folders now hold: ${JSON.stringify(afterFolders.map((f) => ({ id: f.id, archived: Boolean(f.archived), ids: f[keys.folderIds] })))}`);
    check('the item left the archive', ids(afterArchived).includes(itemId), false);
    check('and it is back among the active items', ids(afterActive).includes(itemId), true);
  };

  await cdp.send('Page.navigate', { url: BASE + '/' });
  await sleep(2000);
  await cdp.eval(`(() => {
    const seed = ${JSON.stringify(SEED)};
    for (const key of Object.keys(seed)) localStorage.setItem(key, JSON.stringify(seed[key]));
    localStorage.setItem('habitrkr.language', 'en');
    localStorage.setItem('habitrkr.theme', 'light');
    return true;
  })()`);

  console.log('########## notes ##########');
  await archiveFolder(BASE + '/notes', 'Note box');
  await restoreInsideFolder('n1', 'data-note-id', 'Note box', {
    activeItems: 'notes', archivedItems: 'archivedNotes',
    folders: 'folders', archivedFolders: 'archivedFolders', folderIds: 'noteIds',
  });

  console.log('\n########## events ##########');
  await archiveFolder(BASE + '/events', 'Event box');
  await restoreInsideFolder('e1', 'data-event-id', 'Event box', {
    activeItems: 'events', archivedItems: 'archivedEvents',
    folders: 'eventFolders', archivedFolders: 'archivedEventFolders', folderIds: 'eventIds',
  });

  console.log('\n########## habits (the one that already worked) ##########');
  await archiveFolder(BASE + '/', 'Habit box');
  await restoreInsideFolder('h1', 'data-habit-id', 'Habit box', {
    activeItems: 'habits', archivedItems: 'archivedHabits',
    folders: 'habitFolders', archivedFolders: 'archivedHabitFolders', folderIds: 'habitIds',
  });

  const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(outDir, 'archived-folder-restore.png'), Buffer.from(shot.data, 'base64'));
  console.log('\n  screenshot: preview/archived-folder-restore.png');
} finally {
  chrome.kill();
  await sleep(200);
  try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch { /* windows lock */ }
}

console.log(failures === 0 ? '\nALL ARCHIVED-FOLDER RESTORE CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
