/**
 * Walks every folder action on all three pages and checks what it did to the folder and to the
 * items inside it.
 *
 * Archiving, deleting and restoring a folder each ask one question with two answers — the
 * folder alone, or the folder and everything it holds — and the same logic now serves notes,
 * events and habits. Before this, archiving and deleting a folder always took its items along
 * without asking, and the three pages did not even agree on that: deleting a folder on the
 * events page left its events in place while the notes page deleted the notes with it.
 *
 * The matrix is three pages × three actions × two answers, plus the case that needs no question
 * at all (a folder with nothing in it). Every case is driven through the interface — the
 * folder's own menu and the dialog's own buttons — and the result is read back from storage,
 * so a state that merely looks right on screen cannot pass.
 *
 * Usage: node scripts/verify-folder-action-dialogs.mjs
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
    await sleep(450);
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
  async clickTab(label) {
    return this.clickExpr(
      `Array.from(document.querySelectorAll('[role="tab"]')).find((b) => (b.textContent || '').trim() === ${JSON.stringify(label)})`);
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
let checks = 0;
const check = (label, actual, expected) => {
  checks++;
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  const ok = a === e;
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`);
  if (!ok) console.log(`        actual   = ${a}\n        expected = ${e}`);
};

const NOW = new Date().toISOString();
const FUTURE = new Date(Date.now() + 14 * 86400000).toISOString();

const item = (id, name) => ({
  id, name, description: 'text', tags: [], color: '#FFFFFF', pinned: false, locked: false, createdAt: NOW, modifiedAt: NOW,
});
const event = (id, name) => ({
  id, name, description: '', color: '#FFFFFF', createdAt: NOW, isRecurrent: false, startDate: FUTURE, isAllDay: true, pinned: false,
});
const habit = (id, name) => ({
  id, name, color: '#FFFFFF', createdAt: NOW, completedDates: [], activeDays: [true, true, true, true, true, true, true], pinned: false,
});

const PAGES = [
  {
    label: 'notes', route: '/notes', cardAttribute: 'data-note-id',
    keys: { items: 'notes', archivedItems: 'archivedNotes', folders: 'folders', archivedFolders: 'archivedFolders', ids: 'noteIds' },
    makeItem: (id) => item(id, `Note ${id}`),
    makeFolder: (id, ids, archived) => ({ id, name: `Box ${id}`, description: '', color: '#FFFFFF', createdAt: NOW, noteIds: ids, ...(archived ? { archived: true } : {}) }),
  },
  {
    label: 'events', route: '/events', cardAttribute: 'data-event-id',
    keys: { items: 'events', archivedItems: 'archivedEvents', folders: 'eventFolders', archivedFolders: 'archivedEventFolders', ids: 'eventIds' },
    makeItem: (id) => event(id, `Event ${id}`),
    makeFolder: (id, ids, archived) => ({ id, name: `Box ${id}`, description: '', color: '#FFFFFF', pinned: false, archived: Boolean(archived), createdAt: NOW, eventIds: ids }),
  },
  {
    label: 'habits', route: '/', cardAttribute: 'data-habit-id',
    keys: { items: 'habits', archivedItems: 'archivedHabits', folders: 'habitFolders', archivedFolders: 'archivedHabitFolders', ids: 'habitIds' },
    makeItem: (id) => habit(id, `Habit ${id}`),
    makeFolder: (id, ids, archived) => ({ id, name: `Box ${id}`, description: '', color: '#FFFFFF', pinned: false, archived: Boolean(archived), createdAt: NOW, habitIds: ids }),
  },
];

const port = 9222 + Math.floor(Math.random() * 400);
const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'folderactions-'));
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

  // The app's origin has to be loaded before storage can be written: on `about:blank`
  // localStorage is a different, inaccessible document.
  await cdp.go(BASE + '/');

  const stored = async (key) => JSON.parse(await cdp.eval(`localStorage.getItem(${JSON.stringify(key)}) || '[]'`));
  const ids = (list) => list.map((entry) => entry.id);

  /** Seeds the page's storage and reloads it. `archived` puts the folder and items in the archive. */
  const seed = async (page, { archived = false, folderItems = ['i1', 'i2'], emptyFolder = true } = {}) => {
    const { keys } = page;
    const folder = page.makeFolder('f1', folderItems, archived);
    const folders = archived ? [] : [folder, ...(emptyFolder ? [page.makeFolder('f2', [], false)] : [])];
    const archivedFolders = archived ? [folder] : [];
    const items = archived ? [] : folderItems.map(page.makeItem);
    const archivedItems = archived ? folderItems.map((id) => ({ ...page.makeItem(id), archived: true })) : [];

    await cdp.eval(`(() => {
      const set = (key, value) => localStorage.setItem(key, JSON.stringify(value));
      set(${JSON.stringify(keys.items)}, ${JSON.stringify(items)});
      set(${JSON.stringify(keys.archivedItems)}, ${JSON.stringify(archivedItems)});
      set(${JSON.stringify(keys.folders)}, ${JSON.stringify(folders)});
      set(${JSON.stringify(keys.archivedFolders)}, ${JSON.stringify(archivedFolders)});
      localStorage.setItem('habitrkr.language', 'en');
      localStorage.setItem('habitrkr.theme', 'light');
      return true;
    })()`);
    await cdp.go(BASE + page.route);
  };

  /** Opens the 3-dot menu of the folder named `Box f1` and clicks one of its items. */
  const folderMenu = async (menuItem) => {
    const opened = await cdp.clickExpr(`(() => {
      const h4 = Array.from(document.querySelectorAll('h4')).find((h) => (h.textContent || '').includes('Box f1'));
      if (!h4) return null;
      const card = h4.closest('div[class*="rounded-[20px]"]');
      return card ? card.querySelector('button[aria-haspopup="menu"]') : null;
    })()`);
    check('the folder menu opened', opened, true);
    await sleep(500);
    const clicked = await cdp.clickExpr(
      `Array.from(document.querySelectorAll('[role="menuitem"]')).find((m) => (m.textContent || '').trim() === ${JSON.stringify(menuItem)})`);
    check(`the ${menuItem} item was clicked`, clicked, true);
    await sleep(900);
  };

  /**
   * Clicks the restore button on the archived folder's own card.
   *
   * An archived folder draws no 3-dot menu — it shows restore and delete buttons instead — so the
   * restore cases start here rather than in a menu. The folder is collapsed, so the first restore
   * button inside its card is the folder's own and not one of a card nested in it.
   */
  const folderRestoreButton = async () => {
    const clicked = await cdp.clickExpr(`(() => {
      const h4 = Array.from(document.querySelectorAll('h4')).find((h) => (h.textContent || '').includes('Box f1'));
      if (!h4) return null;
      const card = h4.closest('div[class*="rounded-[20px]"]');
      return card ? Array.from(card.querySelectorAll('button')).find((b) => b.querySelector('svg.lucide-rotate-ccw')) : null;
    })()`);
    check('the archived folder\'s restore button was clicked', clicked, true);
    await sleep(900);
  };

  /** The buttons the folder dialog is offering, by their text. */
  const dialogButtons = async () =>
    cdp.eval(`(() => {
      const dialog = document.querySelector('[role="alertdialog"]');
      if (!dialog) return null;
      return {
        title: (dialog.querySelector('h2') || {}).textContent || '',
        description: (dialog.querySelector('p') || {}).textContent || '',
        buttons: Array.from(dialog.querySelectorAll('button')).map((b) => (b.textContent || '').trim()),
      };
    })()`);

  const answerDialog = async (label) => {
    const clicked = await cdp.clickExpr(
      `Array.from(document.querySelectorAll('[role="alertdialog"] button')).find((b) => (b.textContent || '').trim() === ${JSON.stringify(label)})`);
    check(`the dialog's "${label}" button was clicked`, clicked, true);
    await sleep(1400);
  };

  /** Runs one case: open the folder's menu, answer the dialog, read the result back. */
  const runCase = async (page, { name, archived, menuItem, answer, actionLabel, expect }) => {
    console.log(`\n### ${page.label} · ${name} ###`);
    await seed(page, { archived });
    // The folder cards live on the Folders tab, and an archived folder on the Archived one.
    const tab = archived ? 'Archived' : 'Folders';
    const onTab = await cdp.clickTab(tab);
    check(`the ${tab} tab was clicked`, onTab, true);
    await sleep(1000);
    check(`the ${tab} tab is active`, await cdp.eval(
      `(document.querySelector('[role="tab"][data-state="active"]') || {}).textContent?.trim() ?? null`), tab);
    if (menuItem === 'Restore') await folderRestoreButton(); else await folderMenu(menuItem);

    const dialog = await dialogButtons();
    if (answer === null) {
      check('no question was asked, because there was nothing to choose', dialog, null);
    } else {
      check('the dialog opened', Boolean(dialog), true);
      if (dialog) {
        console.log(`  "${dialog.title}" / "${dialog.description}" -> ${JSON.stringify(dialog.buttons)}`);
        check('it offers Cancel, Folder Only and the action on everything',
          dialog.buttons.slice(-3), ['Cancel', 'Folder Only', actionLabel]);
      }
      await answerDialog(answer);
    }

    const folders = await stored(page.keys.folders);
    const archivedFolders = await stored(page.keys.archivedFolders);
    const items = await stored(page.keys.items);
    const archivedItems = await stored(page.keys.archivedItems);
    const folder = [...folders, ...archivedFolders].find((f) => f.id === 'f1');
    console.log(`  folders: ${JSON.stringify(folders.map((f) => ({ id: f.id, ids: f[page.keys.ids] })))} archived: ${JSON.stringify(archivedFolders.map((f) => ({ id: f.id, ids: f[page.keys.ids] })))}`);
    console.log(`  active items: ${JSON.stringify(ids(items))}, archived items: ${JSON.stringify(ids(archivedItems))}`);

    check('the folder ended up where it should', archivedFolders.some((f) => f.id === 'f1'), expect.folderArchived);
    check('and in the active list only if it belongs there', folders.some((f) => f.id === 'f1'), expect.folderActive);
    if (expect.folderExists) {
      check('the ids the folder holds are the expected ones', folder?.[page.keys.ids] ?? null, expect.folderIds);
    } else {
      check('the folder is gone entirely', folder ?? null, null);
    }
    check('the active items are the expected ones', ids(items).sort(), [...expect.activeItems].sort());
    check('the archived items are the expected ones', ids(archivedItems).sort(), [...expect.archivedItems].sort());
  };

  for (const page of PAGES) {
    console.log(`\n########## ${page.label} ##########`);

    // Archive a folder that holds two items.
    await runCase(page, {
      name: 'archive · Archive All', archived: false, menuItem: 'Archive', answer: 'Archive All', actionLabel: 'Archive All',
      expect: { folderArchived: true, folderActive: false, folderExists: true, folderIds: ['i1', 'i2'], activeItems: [], archivedItems: ['i1', 'i2'] },
    });
    await runCase(page, {
      name: 'archive · Folder Only', archived: false, menuItem: 'Archive', answer: 'Folder Only', actionLabel: 'Archive All',
      expect: { folderArchived: true, folderActive: false, folderExists: true, folderIds: [], activeItems: ['i1', 'i2'], archivedItems: [] },
    });

    // Delete a folder that holds two items.
    await runCase(page, {
      name: 'delete · Delete All', archived: false, menuItem: 'Delete', answer: 'Delete All', actionLabel: 'Delete All',
      expect: { folderArchived: false, folderActive: false, folderExists: false, activeItems: [], archivedItems: [] },
    });
    await runCase(page, {
      name: 'delete · Folder Only', archived: false, menuItem: 'Delete', answer: 'Folder Only', actionLabel: 'Delete All',
      expect: { folderArchived: false, folderActive: false, folderExists: false, activeItems: ['i1', 'i2'], archivedItems: [] },
    });

    // Restore an archived folder whose items are archived with it.
    await runCase(page, {
      name: 'restore · Restore All', archived: true, menuItem: 'Restore', answer: 'Restore All', actionLabel: 'Restore All',
      expect: { folderArchived: false, folderActive: true, folderExists: true, folderIds: ['i1', 'i2'], activeItems: ['i1', 'i2'], archivedItems: [] },
    });
    await runCase(page, {
      name: 'restore · Folder Only', archived: true, menuItem: 'Restore', answer: 'Folder Only', actionLabel: 'Restore All',
      expect: { folderArchived: false, folderActive: true, folderExists: true, folderIds: ['i1', 'i2'], activeItems: [], archivedItems: ['i1', 'i2'] },
    });

    // A folder with nothing in it has one possible outcome, so it is not asked about.
    await seed(page, { folderItems: [], emptyFolder: false });
    await cdp.clickTab('Folders');
    await sleep(1000);
    await folderMenu('Archive');
    check('an empty folder is archived without a question', await dialogButtons(), null);
    const emptyFolders = await stored(page.keys.archivedFolders);
    check('and it did reach the archive', emptyFolders.some((f) => f.id === 'f1'), true);

    const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(outDir, `folder-actions-${page.label}.png`), Buffer.from(shot.data, 'base64'));
  }

  // One picture of the dialog itself, for the record.
  await seed(PAGES[0], {});
  await cdp.clickTab('Folders');
  await sleep(1000);
  await folderMenu('Archive');
  const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(outDir, 'folder-action-dialog.png'), Buffer.from(shot.data, 'base64'));
  console.log('\n  screenshot of the dialog: preview/folder-action-dialog.png');
} finally {
  chrome.kill();
  await sleep(200);
  try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch { /* windows lock */ }
}

console.log(`\n${checks} checks, ${failures} failed`);
console.log(failures === 0 ? 'ALL FOLDER-ACTION CHECKS PASSED' : 'FOLDER-ACTION CHECKS FAILED');
process.exit(failures === 0 ? 0 : 1);
