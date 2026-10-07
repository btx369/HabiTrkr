/**
 * Checks that an archived item cannot be edited, and reproduces the defect that prompted it.
 *
 * Reported: a note was created, archived, and then opened from the Archived tab and typed into.
 * A *new* note appeared on the notes screen and the archived one was untouched. The page looked
 * for the note among the active notes only, did not find it, and took that to mean it was new.
 *
 * The rule now: archived notes, events and habits are read-only, and the only way to change one
 * is to restore it first. This checks both halves — that writing to an archived note leaves
 * storage alone, and that restoring it makes it editable again, so the guard did not simply
 * break editing everywhere.
 *
 * Usage: node scripts/verify-archived-read-only.mjs
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
    await sleep(600);
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
  /** `insertText` rather than key events: those insert every character twice. */
  async type(text) {
    await this.send('Input.insertText', { text });
    await sleep(500);
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

const port = 9222 + Math.floor(Math.random() * 400);
const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'readonly-'));
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
  await cdp.go(BASE + '/');
  console.log('  origin: ' + await cdp.eval('location.href'));

  const stored = async (key) => JSON.parse(await cdp.eval(`localStorage.getItem(${JSON.stringify(key)}) || '[]'`));
  const seed = async () => {
    await cdp.eval(`(() => {
      const set = (key, value) => localStorage.setItem(key, JSON.stringify(value));
      set('notes', []);
      set('archivedNotes', [{ id: 'n1', name: 'Archived note', type: 'text', description: 'Teste', tags: [],
        color: '#FFFFFF', pinned: false, locked: false, createdAt: ${JSON.stringify(NOW)}, modifiedAt: ${JSON.stringify(NOW)} }]);
      set('folders', []); set('archivedFolders', []);
      set('events', []);
      set('archivedEvents', [{ id: 'e1', name: 'Archived event', description: 'Teste', color: '#FFFFFF', createdAt: ${JSON.stringify(NOW)},
        isRecurrent: false, startDate: ${JSON.stringify(FUTURE)}, isAllDay: true, pinned: false }]);
      set('eventFolders', []); set('archivedEventFolders', []);
      set('habits', []);
      set('archivedHabits', [{ id: 'h1', name: 'Archived habit', description: 'Teste', color: '#FFFFFF', createdAt: ${JSON.stringify(NOW)},
        completedDates: [], activeDays: [true, true, true, true, true, true, true], pinned: false }]);
      set('habitFolders', []); set('archivedHabitFolders', []);
      localStorage.setItem('habitrkr.language', 'en');
      localStorage.setItem('habitrkr.theme', 'light');
      return true;
    })()`);
    await cdp.go(BASE + '/notes');
  };

  /** What the viewer is offering, and whether the read-only notice is on screen. */
  const viewerState = () => cdp.eval(`(() => {
    const dialog = document.querySelector('[role="dialog"]');
    if (!dialog) return { open: false };
    return {
      open: true,
      notice: document.body.innerText.includes('restore it to make changes'),
      editableField: Boolean(dialog.querySelector('textarea:not([readonly]), [contenteditable="true"]')),
      // The dock holds Add / Tick Boxes / Tags / Remind me / Transcribe / Format.
      dockButtons: Array.from(dialog.querySelectorAll('button')).filter((b) => b.querySelector('svg.lucide-plus, svg.lucide-tag, svg.lucide-mic, svg.lucide-bell, svg.lucide-type')).length,
      menuButton: Boolean(dialog.querySelector('button[aria-haspopup="menu"]')),
    };
  })()`);

  console.log('########## the reported case ##########');
  await seed();
  const onArchived = await cdp.clickTab('Archived');
  check('the Archived tab was clicked', onArchived, true);
  await sleep(1000);

  const opened = await cdp.clickExpr(`document.querySelector('[data-note-id="n1"]')`);
  check('the archived note opened', opened, true);
  await sleep(900);

  const viewer = await viewerState();
  console.log(`  viewer: ${JSON.stringify(viewer)}`);
  check('the viewer opened', viewer.open, true);
  check('it says the note is archived', viewer.notice, true);
  check('it offers no editing dock', viewer.dockButtons, 0);

  // Type into it, the way the report describes: click the body, then write.
  /**
   * A point inside the note's own content, preferring the element that actually holds its text.
   *
   * Clicking the scroll area around the text does nothing — the click handler that opens the
   * editor is on the content element — so a check that clicked the scroll area saw no edit mode
   * and concluded, wrongly, that typing was impossible.
   *
   * Hidden elements are skipped: they report a rectangle at (0,0) with no size, and clicking
   * those coordinates hits the backdrop and closes the viewer.
   */
  const bodyTarget = (text = 'Teste') => cdp.eval(`(() => {
    const dialog = document.querySelector('[role="dialog"]');
    if (!dialog) return null;
    const visible = (el) => {
      const r = el.getBoundingClientRect();
      return r.width > 20 && r.height > 10 ? r : null;
    };
    const withText = Array.from(dialog.querySelectorAll('*'))
      .filter((el) => el.children.length === 0 && (el.textContent || '').trim() === ${JSON.stringify(text)})
      .map((el) => ({ el, r: visible(el) }))
      .filter(({ r }) => r)
      .pop();
    const best = withText || Array.from(dialog.querySelectorAll('textarea, [contenteditable="true"], [data-radix-scroll-area-viewport], p'))
      .map((el) => ({ el, r: visible(el) }))
      .filter(({ r }) => r)
      .sort((a, b) => (b.r.width * b.r.height) - (a.r.width * a.r.height))[0];
    if (!best) return null;
    return { x: best.r.left + best.r.width / 2, y: best.r.top + best.r.height / 2, tag: best.el.tagName.toLowerCase() };
  })()`);

  const body = await bodyTarget();
  check('the note body is on screen', Boolean(body), true);
  if (body) {
    console.log(`  writing into: <${body.tag}>`);
    await cdp.clickAt(body.x, body.y);
    await sleep(400);
    console.log(`  dialogs after clicking the body: ${await cdp.eval(`document.querySelectorAll('[role="dialog"]').length`)}`);
    await cdp.type(' more text');
    await sleep(1200);
    console.log(`  dialogs after typing: ${await cdp.eval(`document.querySelectorAll('[role="dialog"]').length`)}`);
  }

  /*
   * Leave the editor, which is what saves a text note — and what the report describes doing.
   * Typing alone saves nothing, so a check that stopped here passed even against the old code:
   * the stray note only appeared once the editor was closed.
   */
  const leftEditor = await cdp.clickExpr(`(() => {
    const dialog = document.querySelector('[role="dialog"]');
    return dialog ? Array.from(dialog.querySelectorAll('button')).find((b) => b.querySelector('svg.lucide-arrow-left')) : null;
  })()`);
  console.log(`  left the editor (or it was not open): ${leftEditor}`);
  await sleep(1600);

  const activeNotes = await stored('notes');
  const archivedNotes = await stored('archivedNotes');
  console.log(`  notes: ${JSON.stringify(activeNotes.map((n) => ({ id: n.id, description: n.description })))}`);
  console.log(`  archivedNotes: ${JSON.stringify(archivedNotes.map((n) => ({ id: n.id, description: n.description })))}`);
  check('no new note was created on the notes screen', activeNotes.length, 0);
  check('the archived note was not changed', archivedNotes[0]?.description, 'Teste');

  const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(outDir, 'archived-note-read-only.png'), Buffer.from(shot.data, 'base64'));
  console.log('  screenshot: preview/archived-note-read-only.png');

  // Restoring it has to bring editing back, or the guard would have broken editing entirely.
  console.log('\n########## after restoring it ##########');
  // Leaving the editor above closed the viewer, so it is opened again from the archived list.
  const reopened = await cdp.clickExpr(`document.querySelector('[data-note-id="n1"]')`);
  check('the archived note opened again', reopened, true);
  await sleep(900);
  const restored = await cdp.clickExpr(`(() => {
    const dialog = document.querySelector('[role="dialog"]');
    if (!dialog) return null;
    const menu = dialog.querySelector('button[aria-haspopup="menu"]');
    return menu;
  })()`);
  check('the viewer has a menu', restored, true);
  if (!restored) {
    console.log('  dialogs on screen: ' + await cdp.eval(`document.querySelectorAll('[role="dialog"]').length`));
    console.log('  page text: ' + JSON.stringify((await cdp.eval(`document.body.innerText`)).slice(0, 200)));
  }
  await sleep(500);
  const restoreClicked = await cdp.clickExpr(
    `Array.from(document.querySelectorAll('[role="menuitem"]')).find((m) => (m.textContent || '').trim() === 'Restore')`);
  check('Restore was clicked', restoreClicked, true);
  await sleep(1400);
  check('the note is no longer archived', (await stored('archivedNotes')).length, 0);
  check('and it is back among the active notes', (await stored('notes')).length, 1);

  /*
   * The viewer stays open through the restore and has to become editable straight away. It
   * holds its own copy of the note, so a restore that did not hand it the restored note left it
   * read-only until it was closed and opened again.
   */
  const afterRestore = await viewerState();
  console.log(`  viewer: ${JSON.stringify(afterRestore)}`);
  check('the viewer is still open', afterRestore.open, true);
  check('it no longer says the note is archived', afterRestore.notice, false);
  check('and the editing dock is back', afterRestore.dockButtons > 0, true);

  // Write into it again: this time the change must reach the note.
  const restoredBody = await bodyTarget('Teste');
  check('the note body is on screen', Boolean(restoredBody), true);
  if (restoredBody) {
    await cdp.clickAt(restoredBody.x, restoredBody.y);
    await sleep(500);
    await cdp.type(' and now it saves');
    await sleep(600);
    /*
     * A text note is saved when the editor is left rather than on every keystroke: the back
     * button commits what is pending and closes the viewer.
     */
    const backClicked = await cdp.clickExpr(`(() => {
      const dialog = document.querySelector('[role="dialog"]');
      return dialog ? Array.from(dialog.querySelectorAll('button')).find((b) => b.querySelector('svg.lucide-arrow-left')) : null;
    })()`);
    check('the editor was closed, which saves the note', backClicked, true);
    await sleep(1600);
  }
  const editedNotes = await stored('notes');
  console.log(`  notes: ${JSON.stringify(editedNotes.map((n) => ({ id: n.id, description: n.description })))}`);
  check('the edit reached the restored note', (editedNotes[0]?.description ?? '').includes('and now it saves'), true);

  console.log('\n########## events and habits ##########');
  for (const [route, label, tab, attribute] of [['/events', 'events', 'Archived', 'data-event-id'], ['/', 'habits', 'Archived', 'data-habit-id']]) {
    await cdp.go(BASE + route);
    await cdp.clickTab(tab);
    await sleep(1100);
    const state = await cdp.eval(`(() => {
      const card = document.querySelector('[${attribute}]');
      if (!card) return { card: false };
      return {
        card: true,
        // An archived card offers restore and delete instead of the action menu, so there is no
        // way in to an editor.
        menuButton: Boolean(card.querySelector('button[aria-haspopup="menu"]')),
        restore: Boolean(card.querySelector('svg.lucide-rotate-ccw')),
      };
    })()`);
    console.log(`  ${label}: ${JSON.stringify(state)}`);
    check(`${label}: the archived card is listed`, state.card, true);
    check(`${label}: it offers no menu to edit from`, state.menuButton, false);
    check(`${label}: it offers restore instead`, state.restore, true);
  }
} finally {
  chrome.kill();
  await sleep(200);
  try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch { /* windows lock */ }
}

console.log(failures === 0 ? '\nALL ARCHIVED-READ-ONLY CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
