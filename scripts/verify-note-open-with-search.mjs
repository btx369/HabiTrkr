/**
 * Repro + proof for: with a search active, clicking a filtered note does not open it.
 *
 * Mechanism under test: the header closes the search on `mousedown` when the press is
 * outside the search container. That clears the query, so the full list is restored
 * *between* mousedown and mouseup, the card moves out from under the cursor, and the
 * click never lands on it.
 *
 * The condition that makes it bite is a list long enough to scroll: the filtered result
 * sits at the top, and restoring every note pushes it down. With a short list nothing
 * moves far enough to matter, which is why it is intermittent.
 *
 * Usage: node scripts/verify-note-open-with-search.mjs   (needs `npm run dev`)
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const BASE = process.env.BASE_URL ?? 'http://localhost:8080';
const CHROME = ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'].find(p => fs.existsSync(p));
if (!CHROME) { console.error('No Chrome/Edge binary found.'); process.exit(1); }
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

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

// --- fixture: enough notes that restoring the full list moves the first one -----
const NOTES = [];
for (let i = 0; i < 40; i++) {
  const isTarget = i === 3;
  NOTES.push({
    id: `note-${String(i).padStart(2, '0')}`,
    type: 'text',
    name: isTarget ? 'Needle' : `Filler ${i}`,
    description: isTarget ? 'the note we are trying to open' : `unrelated filler body ${i}`,
    tags: [], items: [], color: 'default', locked: false,
    createdAt: new Date(Date.now() - i * 60000).toISOString(),
    modifiedAt: new Date(Date.now() - i * 60000).toISOString(),
  });
}

let failures = 0;
const check = (label, actual, expected) => {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  const ok = a === e;
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`);
  if (!ok) console.log(`        actual   = ${a}\n        expected = ${e}`);
};

const port = 9222 + Math.floor(Math.random() * 400);
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'openwithsearch-'));
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
    await sleep(140);
    await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 });
    await sleep(75);
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1 });
  };

  const openSearchWith = async (term) => {
    const box = JSON.parse(await cdp.eval(`(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.querySelector('svg.lucide-search'));
      const r = btn.getBoundingClientRect();
      return JSON.stringify({ x: Math.round(r.x + r.width/2), y: Math.round(r.y + r.height/2) });
    })()`));
    await mouseClick(box.x, box.y);
    await sleep(800);
    await cdp.eval(`(() => {
      const input = document.querySelector('input');
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      setter.call(input, ${JSON.stringify(term)});
      input.dispatchEvent(new Event('input', { bubbles: true }));
      return true;
    })()`);
    await sleep(1300);
  };

  /** Where the card sits, and what is under the cursor at that moment. */
  const cardBox = async (id) => JSON.parse(await cdp.eval(`(() => {
    const el = document.querySelector('[data-note-card="${id}"] > div');
    if (!el) return JSON.stringify(null);
    const r = el.getBoundingClientRect();
    const x = Math.round(r.x + r.width / 2), y = Math.round(r.y + r.height / 2);
    const top = document.elementFromPoint(x, y);
    return JSON.stringify({ x, y, topY: Math.round(r.y), insideCard: !!(top && top.closest('[data-note-card]')),
      topCard: top && top.closest('[data-note-card]') ? top.closest('[data-note-card]').dataset.noteCard : null });
  })()`));

  const snap = async () => JSON.parse(await cdp.eval(`JSON.stringify({
    cards: document.querySelectorAll('[data-note-card]').length,
    search: (document.querySelector('input') || {}).value ?? null,
    viewerOpen: !!document.querySelector('[role="dialog"]'),
    viewerText: (document.querySelector('[role="dialog"]') ? document.querySelector('[role="dialog"]').innerText.replace(/\\s+/g,' ').slice(0,40) : null),
  })`));

  console.log(`fixture: ${NOTES.length} notes, the target is "Needle"\n`);

  console.log('=== 1. Baseline: no search, click the note ===');
  await reload();
  let box = await cardBox('note-03');
  console.log(`  card at y=${box.topY}, under cursor is inside the card: ${box.insideCard}`);
  await mouseClick(box.x, box.y);
  await sleep(1500);
  let s = await snap();
  console.log(`  ${JSON.stringify(s)}`);
  check('the note opens when no search is active', s.viewerOpen, true);

  console.log('\n=== 2. With a search active, click the filtered result ===');
  await reload();
  await openSearchWith('Needle');
  s = await snap();
  console.log(`  filtered to ${s.cards} card(s), search="${s.search}"`);
  check('the search filtered the list to the one note', s.cards, 1);

  box = await cardBox('note-03');
  console.log(`  card at y=${box.topY}, under cursor is inside the card: ${box.insideCard}`);

  // Press, then look again before releasing: this is where the list is restored.
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: box.x, y: box.y, buttons: 0 });
  await sleep(140);
  await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: box.x, y: box.y, button: 'left', buttons: 1, clickCount: 1 });
  await sleep(260);
  const midPress = await cdp.eval(`(() => {
    const el = document.elementFromPoint(${box.x}, ${box.y});
    const card = el && el.closest('[data-note-card]');
    return JSON.stringify({
      cards: document.querySelectorAll('[data-note-card]').length,
      inputGone: !document.querySelector('input'),
      topCardUnderCursor: card ? card.dataset.noteCard : null,
    });
  })()`);
  console.log(`  while the button is held down: ${midPress}`);
  const mid = JSON.parse(midPress);
  // The field hides at once, which is the intended feedback. What must NOT happen yet
  // is the query being cleared: that is what restores the list mid-press.
  check('the search field hides as soon as the press starts', mid.inputGone, true);
  check('but the filter is still applied for the whole press', mid.cards, 1);
  check('so the card under the cursor is still the one aimed at', mid.topCardUnderCursor, 'note-03');
  console.log(`  card under the cursor mid-press: ${mid.topCardUnderCursor}`);

  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: box.x, y: box.y, button: 'left', buttons: 0, clickCount: 1 });
  await sleep(1600);
  s = await snap();
  console.log(`  after the click: ${JSON.stringify(s)}`);
  check('the note opens even with a search active', s.viewerOpen, true);
  check('and it is the note that was clicked', (s.viewerText || '').includes('Needle'), true);

  console.log('\n=== 3. The search is dismissed once the press has finished ===');
  // Close the viewer and confirm the list is unfiltered again, so the deferred clear
  // really did happen rather than being dropped.
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await sleep(900);
  const after = await snap();
  console.log(`  ${JSON.stringify(after)}`);

  check('nothing above failed', failures, 0);
} finally {
  chrome.kill();
  await sleep(200);
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* windows lock */ }
}

console.log(failures === 0 ? '\nALL OPEN-WITH-SEARCH CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
