/**
 * End-to-end check of the reported bug, in the running app.
 *
 * Builds a note that mirrors a real audio note — its `description` holds
 * `[audio:<base64 data URL>:<seconds>]` — and searches the Notes page for letters that
 * occur inside that encoded data but nowhere in the note's text. Before the fix the
 * note appeared in the results with nothing on the card to explain why.
 *
 * The payload is generated here, not copied from anyone's notes. It is deliberately
 * built so its base64 contains the searched letters, which is the only way to prove the
 * exclusion is real rather than luck.
 *
 * Usage: node scripts/verify-audio-note-search.mjs   (needs `npm run dev` running)
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const BASE = process.env.BASE_URL ?? 'http://localhost:8080';
const CHROME = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find((p) => fs.existsSync(p));
if (!CHROME) {
  console.error('No Chrome/Edge binary found.');
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.nextId = 1;
    this.pending = new Map();
    ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
      }
    });
  }
  send(method, params = {}) {
    const id = this.nextId++;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`CDP timeout: ${method}`));
        }
      }, 30000);
    });
  }
  async eval(expression) {
    const res = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (res.exceptionDetails) throw new Error(res.exceptionDetails.exception?.description ?? 'eval failed');
    return res.result.value;
  }
}

async function getWsUrl(port, attempts = 40) {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/list`);
      const page = (await res.json()).find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
      if (page) return page.webSocketDebuggerUrl;
    } catch { /* not up yet */ }
    await sleep(250);
  }
  throw new Error('Could not reach Chrome DevTools endpoint');
}

// --- the payload, built so its encoding contains the searched letters --------
const SEARCH_TERM = 'asd';
function buildAudioUrl() {
  const b = Buffer.alloc(6144);
  for (let i = 0; i < b.length; i++) b[i] = (i * 37 + 11) % 256;
  b.write('OggS', 0, 'latin1');
  b.write('OpusHead', 4, 'latin1');
  b[18] = 1; b[19] = 171; b[20] = 29; // this base64 group encodes to "Aasd"
  return `data:audio/wav;base64,${b.toString('base64')}`;
}
const AUDIO_URL = buildAudioUrl();
if (!AUDIO_URL.includes(SEARCH_TERM)) {
  console.error(`Payload does not contain "${SEARCH_TERM}"; the test would prove nothing.`);
  process.exit(1);
}

const NOW = new Date().toISOString();
const NOTES = [
  {
    id: 'audio-note-1', type: 'audio', name: '', description: `[audio:${AUDIO_URL}:3.5]`,
    tags: [], items: [], color: 'default', locked: false, createdAt: NOW, modifiedAt: NOW,
  },
  {
    id: 'text-note-1', type: 'text', name: 'Groceries', description: `this note really does mention ${SEARCH_TERM}`,
    tags: [], items: [], color: 'default', locked: false, createdAt: NOW, modifiedAt: NOW,
  },
  {
    id: 'text-note-2', type: 'text', name: 'Unrelated', description: 'nothing of interest in here',
    tags: [], items: [], color: 'default', locked: false, createdAt: NOW, modifiedAt: NOW,
  },
];

let failures = 0;
const check = (label, actual, expected) => {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  const ok = a === e;
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`);
  if (!ok) console.log(`        actual   = ${a}\n        expected = ${e}`);
};

const port = 9222 + Math.floor(Math.random() * 500);
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'audionote-'));
const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
  '--no-first-run', '--disable-extensions',
  `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank',
], { stdio: 'ignore' });

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

  console.log(`payload: ${AUDIO_URL.length.toLocaleString()} chars of base64`);
  console.log(`it contains "${SEARCH_TERM}": ${AUDIO_URL.includes(SEARCH_TERM)}`);
  console.log(`the note's readable text is: ${JSON.stringify('')}\n`);

  await cdp.eval(`(() => {
    for (const k of ['notes','archivedNotes','folders','archivedFolders']) localStorage.removeItem(k);
    localStorage.setItem('notes', ${JSON.stringify(JSON.stringify(NOTES))});
    localStorage.setItem('theme', '"light"');
    return true;
  })()`);

  await cdp.send('Page.navigate', { url: `${BASE}/notes` });
  await sleep(3000);

  console.log('=== The notes are loaded ===');
  const cardTitles = await cdp.eval(`JSON.stringify(
    Array.from(document.querySelectorAll('[class*="cursor-pointer"]'))
      .map(e => (e.textContent || '').slice(0, 40))
      .filter(t => /Groceries|Unrelated/.test(t))
  )`);
  console.log(`  cards visible before searching: ${cardTitles}`);
  check('both text notes are on screen', JSON.parse(cardTitles).length >= 2, true);

  console.log('\n=== Searching for letters that only exist inside the audio encoding ===');
  // The header's search field is collapsed behind a button, and its placeholder is
  // translated, so neither an attribute selector nor an English string would be safe.
  const opened = await cdp.eval(`(() => {
    const header = document.querySelector('header') || document.body;
    const btn = Array.from(header.querySelectorAll('button'))
      .find(b => b.querySelector('svg.lucide-search, svg[class*="search"]'));
    if (btn) { btn.click(); return 'clicked'; }
    const already = document.querySelector('header input');
    return already ? 'already-open' : 'NO BUTTON';
  })()`);
  check('the search field could be opened', ['clicked', 'already-open'].includes(opened), true);
  console.log(`  search field: ${opened}`);
  await sleep(700);

  const typed = await cdp.eval(`(() => {
    const input = document.querySelector('header input')
      || Array.from(document.querySelectorAll('input'))
        .find(i => /^(Search|Pesquisar|Buscar|Rechercher|Suchen)$/.test(i.placeholder || ''));
    if (!input) return 'NO INPUT';
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, ${JSON.stringify(SEARCH_TERM)});
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return 'ok';
  })()`);
  check('the term could be typed into it', typed, 'ok');
  await sleep(1500);

  const afterSearch = await cdp.eval(`(() => {
    const text = document.body.innerText;
    const cards = Array.from(document.querySelectorAll('[data-note-card]'));
    return JSON.stringify({
      hasGroceries: text.includes('Groceries'),
      hasUnrelated: text.includes('Unrelated'),
      cardIds: cards.map(c => c.dataset.noteCard),
      hasAudioPlayer: !!document.querySelector('audio'),
      hasBase64: text.includes('data:audio'),
    });
  })()`);
  const s = JSON.parse(afterSearch);
  console.log(`  "Groceries" present  : ${s.hasGroceries}   (contains the term, must stay)`);
  console.log(`  "Unrelated" present  : ${s.hasUnrelated}   (does not contain it, must go)`);
  console.log(`  note cards rendered  : ${JSON.stringify(s.cardIds)}`);
  console.log(`  raw base64 in the DOM: ${s.hasBase64}`);

  check('the note that really contains the term is still listed', s.hasGroceries, true);
  check('the unrelated note is filtered out', s.hasUnrelated, false);
  // The bug: the audio note has no text at all, so before the fix it was an extra card
  // appearing with nothing on it to explain the match.
  check('exactly one card remains', s.cardIds, ['text-note-1']);
  check('the audio note is not among the results', s.cardIds.includes('audio-note-1'), false);
  check('no base64 ever reaches the page text', s.hasBase64, false);

  console.log('\n=== The card that remains is the right one ===');
  const cardText = await cdp.eval(`(() => {
    const card = document.querySelector('[data-note-card="text-note-1"]');
    return card ? card.innerText.replace(/\\s+/g, ' ').trim() : 'NOT FOUND';
  })()`);
  console.log(`  card content: ${JSON.stringify(cardText.slice(0, 110))}`);
  check('the surviving card is the Groceries note', cardText.includes('Groceries'), true);
  check('and it shows the matching excerpt', cardText.includes(SEARCH_TERM), true);

  console.log('\n=== Nothing is hidden by the fix: clearing the search restores all notes ===');
  const clearedInput = await cdp.eval(`(() => {
    const input = document.querySelector('header input')
      || Array.from(document.querySelectorAll('input'))
        .find(i => /^(Search|Pesquisar|Buscar|Rechercher|Suchen)$/.test(i.placeholder || ''));
    if (!input) return 'NO INPUT';
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
    setter.call(input, '');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return 'ok';
  })()`);
  check('the search field could be cleared', clearedInput, 'ok');
  await sleep(1200);
  const cleared = await cdp.eval(
    `JSON.stringify(Array.from(document.querySelectorAll('[data-note-card]')).map(c => c.dataset.noteCard))`,
  );
  console.log(`  cards with no query: ${cleared}`);
  check('the audio note is back once the search is cleared', JSON.parse(cleared).includes('audio-note-1'), true);
  check('and all three notes are listed', JSON.parse(cleared).length, 3);
} finally {
  chrome.kill();
  await sleep(200);
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* windows lock */ }
}

console.log(failures === 0 ? '\nALL AUDIO-NOTE SEARCH CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
