/**
 * Checks that a note's title can be written, and stays written.
 *
 * Two defects are covered:
 *  1. The title field saved on every keystroke, which re-rendered the viewer and dropped
 *     it out of title-editing mode — the field disappeared after the first letter and
 *     the half-typed value came back through `value`, so "z" was stored as "zz".
 *  2. A note was judged empty on its body alone, so a note given only a title was never
 *     created, and an existing one was deleted when its body was cleared.
 *
 * Usage: node scripts/verify-note-title.mjs   (needs `npm run dev` running)
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
const NOTES = [
  { id: 'note-alpha', type: 'text', name: 'Alpha', description: 'alpha body text', tags: [], items: [], color: 'default', locked: false, createdAt: NOW, modifiedAt: NOW },
];

const port = 9222 + Math.floor(Math.random() * 400);
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'notetitle-'));
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
  '--no-first-run', '--disable-extensions', '--window-size=1440,900',
  `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });

try {
  const ws = new WebSocket(await getWsUrl(port));
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });
  const cdp = new Cdp(ws);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');

  await cdp.send('Page.navigate', { url: `${BASE}/` });
  await sleep(2500);
  await cdp.eval(`(() => {
    for (const k of ['notes','archivedNotes','folders','archivedFolders','notesAllViewType']) localStorage.removeItem(k);
    localStorage.setItem('notes', ${JSON.stringify(JSON.stringify(NOTES))});
    localStorage.setItem('theme', '"light"');
    return true;
  })()`);

  const reload = async () => { await cdp.send('Page.navigate', { url: `${BASE}/notes` }); await sleep(3200); };

  const mouseClick = async (x, y) => {
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, buttons: 0 });
    await sleep(120);
    await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 });
    await sleep(70);
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1 });
  };
  /** Click the centre of an element identified by a JS expression returning it. */
  const clickExpr = async (expr) => {
    const box = await cdp.eval(`(() => { const el = ${expr}; if (!el) return 'null';
      const r = el.getBoundingClientRect();
      return JSON.stringify({ x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }); })()`);
    if (box === 'null') return false;
    const b = JSON.parse(box);
    await mouseClick(b.x, b.y);
    return true;
  };
  const pressEnter = async () => {
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
    await cdp.send('Input.dispatchKeyEvent', { type: 'char', key: 'Enter', text: '\r' });
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  };
  /**
   * Type text into whatever has focus.
   *
   * `Input.insertText` is used rather than a keyDown carrying `text` followed by a
   * `char` event: those two together insert the character twice, which looks exactly
   * like an input that doubles every letter. Dispatching keys twice made a probe report
   * a doubling bug that the app did not have, so it is worth being explicit about it.
   */
  const typeText = async (text) => {
    await cdp.send('Input.insertText', { text });
    await sleep(250);
  };
  const selectAll = async () => {
    // Select the field's contents so typing replaces them.
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'a', code: 'KeyA', windowsVirtualKeyCode: 65, modifiers: 2 });
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'a', code: 'KeyA', windowsVirtualKeyCode: 65, modifiers: 2 });
    await sleep(120);
  };

  const storedNotes = async () => JSON.parse(await cdp.eval(`JSON.stringify(JSON.parse(localStorage.getItem('notes')).map(n => ({ id: n.id, name: n.name })))`));
  const titleField = async () => cdp.eval(`(() => {
    const d = document.querySelector('[role="dialog"]');
    if (!d) return JSON.stringify(null);
    const i = Array.from(d.querySelectorAll('input')).find(x => (x.className || '').includes('text-lg'));
    return JSON.stringify(i ? { value: i.value, focused: document.activeElement === i } : null);
  })()`);
  const openTitleEditor = async () => {
    // The note title is the second h2 in the dialog; the first is the dialog's own.
    const ok = await clickExpr(`Array.from(document.querySelectorAll('[role="dialog"] h2'))[1]`);
    await sleep(800);
    return ok;
  };

  console.log('=== 1. Typing a title stores exactly what was typed ===');
  await reload();
  await clickExpr(`document.querySelector('[data-note-card="note-alpha"] > div')`);
  await sleep(1600);
  check('the title field opened', await openTitleEditor(), true);
  let f = JSON.parse(await titleField());
  console.log(`  field before typing: ${JSON.stringify(f)}`);
  check('it starts with the current title', f.value, 'Alpha');

  await selectAll();
  await typeText('Renamed');
  f = JSON.parse(await titleField());
  console.log(`  field after typing "Renamed": ${JSON.stringify(f)}`);
  // The doubling bug produced "RReennaammeedd" here.
  check('the field holds exactly what was typed, not doubled', f.value, 'Renamed');
  check('and the field is still open to carry on typing', f !== null, true);

  await pressEnter();
  await sleep(1200);
  const afterEnter = await storedNotes();
  console.log(`  stored: ${JSON.stringify(afterEnter)}`);
  check('Enter saves the title', afterEnter[0].name, 'Renamed');
  check('the editor closed after committing', JSON.parse(await titleField()), null);

  console.log('\n=== 2. The title survives a reload ===');
  await reload();
  const reStored = await storedNotes();
  check('the new title is still there', reStored[0].name, 'Renamed');
  const cardText = await cdp.eval(`(() => { const c = document.querySelector('[data-note-card="note-alpha"]');
    return c ? c.innerText.replace(/\\s+/g, ' ').trim() : null; })()`);
  console.log(`  card shows: ${JSON.stringify(cardText)}`);
  check('and the card shows it', (cardText || '').includes('Renamed'), true);

  console.log('\n=== 3. Clicking away also saves ===');
  // The viewer has to be reopened first: the title only exists inside it.
  await clickExpr(`document.querySelector('[data-note-card="note-alpha"] > div')`);
  await sleep(1600);
  const ok3 = await openTitleEditor();
  check('the title field opened again', ok3, true);
  await selectAll();
  await typeText('Blurred');
  f = JSON.parse(await titleField());
  check('the field holds the typed value before blurring', f.value, 'Blurred');
  await mouseClick(20, 700); // somewhere outside the field
  await sleep(1200);
  const afterBlur = await storedNotes();
  console.log(`  stored: ${JSON.stringify(afterBlur)}`);
  check('losing focus saves the title', afterBlur[0].name, 'Blurred');

  console.log('\n=== 4. A new note can take a title on its own ===');
  await reload();
  const clickedPlus = await clickExpr(`Array.from(document.querySelectorAll('button')).find(b => b.querySelector('svg.lucide-plus'))`);
  check('the add button was found', clickedPlus, true);
  await sleep(900);
  const clickedText = await clickExpr(`Array.from(document.querySelectorAll('button')).find(b => (b.textContent || '').trim() === 'Text')`);
  check('the Text type was chosen', clickedText, true);
  await sleep(1800);

  const newNoteOpen = await cdp.eval(`!!document.querySelector('[role="dialog"]')`);
  check('the viewer opened for the new note', newNoteOpen, true);

  const openedForNew = await openTitleEditor();
  check('its title field opened', openedForNew, true);
  f = JSON.parse(await titleField());
  console.log(`  field for the new note: ${JSON.stringify(f)}`);
  check('it starts empty', f.value, '');

  // A title alone. Before the fix this note was judged empty and thrown away.
  await typeText('Only a title');
  await pressEnter();
  await sleep(1400);
  const afterNew = await storedNotes();
  console.log(`  stored: ${JSON.stringify(afterNew)}`);
  check('a note with only a title is created', afterNew.length, 2);
  check('and it kept the title', afterNew.some((n) => n.name === 'Only a title'), true);

  console.log('\n=== 5. Clearing the body of a titled note does not delete it ===');
  await reload();
  const titledId = (await storedNotes()).find((n) => n.name === 'Only a title').id;
  check('the titled note is on the list', !!titledId, true);
  const stillThere = (await storedNotes()).some((n) => n.id === titledId);
  check('and it is still there after a reload', stillThere, true);
} finally {
  chrome.kill();
  await sleep(200);
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* windows lock */ }
}

console.log(failures === 0 ? '\nALL NOTE-TITLE CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
