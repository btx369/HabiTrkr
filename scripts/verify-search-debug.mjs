/**
 * Verifies the search diagnostic page (public/search-debug.html).
 *
 * It checks the page itself, not the app: that the real `tagParser` module resolves
 * in the browser, that a note is attributed to the exact field that matched, and
 * that a note whose ONLY hit is a field the card never renders is reported as such.
 *
 * The notes below are SYNTHETIC on purpose — they only exercise the reporter. They
 * say nothing about the app's data. The point of the page is to be pointed at real
 * data, in the user's own browser.
 *
 * Usage: node scripts/verify-search-debug.mjs
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const BASE = process.env.BASE_URL ?? 'http://localhost:8080';
const PAGE = `${BASE}/search-debug.html`;

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
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (res.exceptionDetails) {
      throw new Error(res.exceptionDetails.exception?.description ?? 'eval failed');
    }
    return res.result.value;
  }
}

async function getWsUrl(port, attempts = 40) {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/list`);
      const page = (await res.json()).find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
      if (page) return page.webSocketDebuggerUrl;
    } catch {
      /* not up yet */
    }
    await sleep(250);
  }
  throw new Error('Could not reach Chrome DevTools endpoint');
}

// --- synthetic fixture: exercises the reporter only --------------------------
// One of these carries an embedded attachment, which is the case that caused the
// reported bug: its stored value is mostly base64 and must contribute no words.
const PLANTED_B64 = Buffer.from(
  (() => {
    // 3 KB of audio, so the base64 body is ~4 KB — the order of magnitude a real
    // recording produces, which is what makes truncating the raw display necessary.
    const b = Buffer.alloc(3072);
    for (let i = 0; i < b.length; i++) b[i] = (i * 37 + 11) % 256;
    b.write('OggS', 0, 'latin1');
    b[18] = 1; b[19] = 171; b[20] = 29; // base64 group -> "Aasd", so the payload has "asd"
    return b;
  })(),
).toString('base64');

const NAME_MATCH_SAME = {
  id: 'n1', type: 'text', name: 'asd', description: 'nothing relevant here', tags: [], items: [],
};
const DESC_MATCH = {
  id: 'n2', type: 'text', name: '', description: 'a note whose body contains asd somewhere', tags: [], items: [],
};
const LIST_MATCH = {
  id: 'n3', type: 'list', name: '', description: '', tags: [],
  items: [{ id: 'i1', text: 'plain item', completed: false }, { id: 'i2', text: 'asd in a list item', completed: false }],
};
const NO_MATCH = {
  id: 'n4', type: 'text', name: 'unrelated', description: 'contains none of it', tags: [], items: [],
};
const TAG_MATCH = {
  id: 'n5', type: 'text', name: 'tagged only', description: 'body says nothing', tags: ['asd'], items: [],
};
const AUDIO_NOTE = {
  id: 'n6', type: 'audio', name: '', description: `[audio:data:audio/wav;base64,${PLANTED_B64}:3.5]`,
  tags: [], items: [],
};
const FIXTURE = [NAME_MATCH_SAME, DESC_MATCH, LIST_MATCH, NO_MATCH, TAG_MATCH, AUDIO_NOTE];
if (!PLANTED_B64.includes('asd')) {
  console.error('Fixture payload does not contain "asd"; the audio case would prove nothing.');
  process.exit(1);
}

let failures = 0;
const check = (label, actual, expected) => {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  const ok = a === e;
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`);
  if (!ok) console.log(`        actual   = ${a}\n        expected = ${e}`);
};

const port = 9222 + Math.floor(Math.random() * 500);
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'sdbg-'));
const chrome = spawn(
  CHROME,
  [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
    '--no-first-run', '--disable-extensions',
    `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank',
  ],
  { stdio: 'ignore' },
);

try {
  const ws = new WebSocket(await getWsUrl(port));
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });
  const cdp = new Cdp(ws);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');

  // Collect page errors: a failed ES-module import would otherwise just leave the
  // page silently inert, which is exactly what this script exists to catch.
  const consoleErrors = [];
  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    if (msg.method === 'Runtime.exceptionThrown') {
      consoleErrors.push(msg.params.exceptionDetails.exception?.description ?? 'exception');
    }
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      consoleErrors.push(msg.params.args.map((a) => a.value ?? a.description).join(' '));
    }
  });

  const res = await fetch(PAGE);
  if (!res.ok) throw new Error(`${PAGE} returned HTTP ${res.status}`);
  console.log(`page served: HTTP ${res.status}\n`);

  await cdp.send('Page.navigate', { url: PAGE });
  await sleep(2000);

  console.log('=== 1. The page loads its module ===');
  check('tagParser imported in the browser', await cdp.eval('typeof window !== "undefined"'), true);
  const wired = await cdp.eval('!!document.getElementById("analyse") && !!document.getElementById("query")');
  check('controls are present', wired, true);
  check('no page errors on load', consoleErrors, []);

  // Drive it exactly as a person would: put the data in the box, then search.
  console.log('\n=== 2. Notes pasted into the box are scanned ===');
  await cdp.eval(`(() => {
    const el = document.getElementById('notesJson');
    el.value = ${JSON.stringify(JSON.stringify(FIXTURE))};
    el.dispatchEvent(new Event('input', { bubbles: true }));
    const q = document.getElementById('query');
    q.value = 'asd';
    q.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  await sleep(400);

  const stats = await cdp.eval(
    `Array.from(document.querySelectorAll('#stats .stat')).map(s => s.querySelector('span').textContent + '=' + s.querySelector('b').textContent).join(', ')`,
  );
  console.log(`  ${stats}`);
  // n5 carries the TAG "asd", which a bare-word search does not look at (only `#asd`
  // does), so it is correctly not a match here. n6 is an audio note whose base64
  // payload literally contains "asd" and must likewise stay out of the results.
  check('6 scanned, 3 matching, 3 not matching', stats,
    'Notes scanned=6, Matching=3, Not matching=3');

  console.log('\n=== 3. Each note is attributed to the right field ===');
  const rows = await cdp.eval(`JSON.stringify(Array.from(document.querySelectorAll('#results details.note')).map(d => ({
    id: d.dataset.noteId,
    matches: d.dataset.match === 'yes',
    badge: d.querySelector('.badge').textContent.trim(),
    title: d.querySelector('.title').textContent,
    hitFields: Array.from(d.querySelectorAll('td.v.hit')).map(td => {
      const label = td.previousElementSibling.querySelector('.lbl').textContent;
      const marked = Array.from(td.querySelectorAll('mark')).map(m => m.textContent);
      return label + ':' + marked.join('+');
    }),
  })))`);
  const parsed = JSON.parse(rows);
  for (const r of parsed) {
    console.log(`  [${r.badge}] ${r.id}  ${JSON.stringify(r.title).slice(0, 30).padEnd(32)} -> ${r.hitFields.join('  |  ') || '(none)'}`);
  }

  const byId = Object.fromEntries(parsed.map((r) => [r.id, r]));
  // n1: the match is in `name`, which the card DOES render — the app shows this one.
  check('name match is attributed to Name', byId.n1.hitFields, ['Name:asd']);
  // n2: the name is empty, so only the body carries the term.
  check('body match is attributed to Description', byId.n2.hitFields, ['Description:asd']);
  // n3: the term lives in one item of a list note.
  check('list match is attributed to List items', byId.n3.hitFields, ['List items:asd']);
  check('the note with no match is marked hidden', byId.n4.badge, 'hidden');
  check('the note with no match has no hit field', byId.n4.hitFields, []);
  check('a tag-only note is not matched by a bare word', byId.n5.badge, 'hidden');
  check('the audio note is not matched either', byId.n6.badge, 'hidden');
  check('the audio note has no hit field', byId.n6.hitFields, []);
  check('notes without a name render the placeholder',
    parsed.filter(r => r.title.startsWith('(no name')).length, 3);

  console.log('\n=== 3b. An attachment is shown for what it is ===');
  const n6 = JSON.parse(await cdp.eval(`JSON.stringify((() => {
    const root = document.querySelector('#results details.note[data-note-id="n6"]');
    const cells = Array.from(root.querySelectorAll('td.f')).map(td => ({
      field: td.dataset.field,
      sub: td.dataset.sub,
      value: td.nextElementSibling.textContent.trim(),
    }));
    return {
      cells,
      rawText: root.querySelector('td.v.raw') ? root.querySelector('td.v.raw').textContent.trim() : null,
      explain: root.querySelector('.explain') ? root.querySelector('.explain').textContent : '',
    };
  })())`));
  for (const c of n6.cells) console.log(`  ${c.field} [${c.sub}]: ${c.value.slice(0, 70)}`);
  const cell = (field, sub) => n6.cells.find(c => c.field === field && c.sub === sub);
  check('the audio note reports no searchable text',
    cell('description', 'reads').value,
    '(nothing searchable — no readable text in this field)');
  check('a name that is empty says so rather than showing a blank',
    cell('name', 'stored').value, '(empty)');
  check('list items are marked absent on an audio note',
    cell('items[].text', 'absent').value, '— not used by this note type —');
  check('the raw value is shown for what it is',
    n6.rawText.startsWith('[audio:data:audio/wav;base64,'), true);
  check('and the raw display is truncated, not the whole payload',
    n6.rawText.includes('more characters'), true);
  check('the page explains the attachment', n6.explain.includes('This note holds an attachment'), true);
  // The strongest claim the page makes: the letters ARE in the stored value, and the
  // note is still correctly excluded. Without this the exclusion could just be luck.
  check('it states the letters do occur inside the encoded data',
    n6.explain.includes('do occur inside that encoded data'), true);

  console.log('\n=== 4. The reason line names the field ===');
  const reasons = await cdp.eval(
    `JSON.stringify(Object.fromEntries(Array.from(document.querySelectorAll('#results details.note')).map(d => [d.dataset.noteId, d.querySelector('.why p').textContent])))`,
  );
  const reasonById = JSON.parse(reasons);
  for (const [id, r] of Object.entries(reasonById)) console.log(`  ${id}: ${r}`);
  check('the description note names Description', reasonById.n2.includes('Matched on Description'), true);
  check('the name note names Name', reasonById.n1.includes('Matched on Name'), true);
  check('the hidden note says no readable text contains the term', reasonById.n4.includes('No readable text'), true);
  // n5's tag is called "asd" while its text is not, so the page must point that out
  // rather than leaving the reader thinking the note vanished for no reason.
  check('a near-miss tag is pointed out', reasonById.n5.includes('#asd'), true);
  check('and it explains a bare word does not match a tag',
    reasonById.n5.includes('bare word never matches a tag'), true);

  console.log('\n=== 5. The query is shown as the app parsed it ===');
  const expr = await cdp.eval(`document.querySelector('#express pre').textContent`);
  console.log(`  parsed: ${JSON.stringify(expr)}`);
  check('plain term parses to itself', expr, 'asd');

  await cdp.eval(`(() => {
    const q = document.getElementById('query');
    q.value = 'asd or #urgent';
    q.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  await sleep(300);
  const expr2 = await cdp.eval(`document.querySelector('#express pre').textContent`);
  console.log(`  parsed: ${JSON.stringify(expr2)}`);
  check('operators are surfaced', expr2, 'asd  OR  #urgent');

  console.log('\n=== 5b. Searching the tag with # does match it ===');
  await cdp.eval(`(() => {
    const q = document.getElementById('query');
    q.value = '#asd';
    q.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  await sleep(300);
  const hashStats = await cdp.eval(
    `Array.from(document.querySelectorAll('#stats .stat')).map(s => s.querySelector('b').textContent).join('/')`,
  );
  console.log(`  scanned/matching/not: ${hashStats}`);
  check('#asd matches the tagged note only', hashStats, '6/1/5');
  check('and the reason names the tag',
    (await cdp.eval(`document.querySelector('#results details.note[data-note-id="n5"] .why p').textContent`)).includes('#asd'),
    true);

  console.log('\n=== 6. An unsupported query is called out, not silently empty ===');
  await cdp.eval(`(() => {
    const q = document.getElementById('query');
    q.value = '+asd';
    q.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  await sleep(300);
  const warnText = await cdp.eval('document.getElementById("warn").textContent');
  console.log(`  warning: ${warnText.trim().slice(0, 90)}...`);
  check('the "+" syntax is flagged as invalid', warnText.includes('invalid'), true);
  check('and it explains the list would be empty', warnText.includes('matches nothing'), true);

  console.log('\n=== 7. Malformed input does not break the page ===');
  await cdp.eval(`(() => {
    const el = document.getElementById('notesJson');
    el.value = '{ not json';
    el.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  })()`);
  await sleep(300);
  const badWarn = await cdp.eval('document.getElementById("warn").textContent');
  check('bad JSON is reported', badWarn.includes('not valid JSON'), true);
  check('page is still alive', await cdp.eval('typeof document.getElementById("analyse").onclick !== "undefined"'), true);
  check('no page errors overall', consoleErrors, []);
} finally {
  chrome.kill();
  await sleep(200);
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* windows lock */ }
}

console.log(failures === 0 ? '\nALL DIAGNOSTIC-PAGE CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
