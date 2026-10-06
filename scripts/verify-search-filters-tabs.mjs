/**
 * Checks that a search narrows every tab of every list page, not just the first one.
 *
 * The report: on Events and Habits, the Folders tab and the Archived tab kept showing every
 * folder and every archived item while the matching text was merely highlighted, whereas on
 * Notes all three tabs answer the search. So all three pages are measured the same way, with
 * one item per tab whose name contains the query and one that does not.
 *
 * Visibility is read from the rendered text of the page, so a card that is still mounted but
 * has been filtered out cannot be mistaken for a match, and a name that is merely highlighted
 * still counts as visible only if its card is on screen.
 *
 * Usage: node scripts/verify-search-filters-tabs.mjs
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
  if (!ok) console.log(`        visible  = ${a}\n        expected = ${e}`);
};

const NOW = new Date().toISOString();
const FUTURE = new Date(Date.now() + 14 * 86400000).toISOString();

const SEED = {
  notes: [
    { id: 'n-alpha', name: 'Alpha memo', type: 'text', description: 'text', tags: [], color: '#FFFFFF', pinned: false, locked: false, createdAt: NOW, modifiedAt: NOW },
    { id: 'n-beta', name: 'Beta memo', type: 'text', description: 'text', tags: [], color: '#FFFFFF', pinned: false, locked: false, createdAt: NOW, modifiedAt: NOW },
  ],
  folders: [
    // Holds a note whose name is nowhere in the folder's own text, so the folder can only be
    // found by what is inside it. It holds a second note as well, which is what the check on
    // the expanded folder compares against.
    { id: 'nf-alpha', name: 'Alpha bundle', description: '', color: '#FFFFFF', createdAt: NOW, noteIds: ['n-beta', 'n-alpha'] },
    { id: 'nf-beta', name: 'Beta bundle', description: '', color: '#FFFFFF', createdAt: NOW, noteIds: [] },
  ],
  archivedNotes: [
    { id: 'na-alpha', name: 'Alpha archived memo', type: 'text', description: 'text', tags: [], color: '#FFFFFF', pinned: false, locked: false, createdAt: NOW, modifiedAt: NOW },
    { id: 'na-beta', name: 'Beta archived memo', type: 'text', description: 'text', tags: [], color: '#FFFFFF', pinned: false, locked: false, createdAt: NOW, modifiedAt: NOW },
  ],
  archivedFolders: [
    { id: 'nfa-alpha', name: 'Alpha archived bundle', description: '', color: '#FFFFFF', createdAt: NOW, noteIds: [] },
    { id: 'nfa-beta', name: 'Beta archived bundle', description: '', color: '#FFFFFF', createdAt: NOW, noteIds: [] },
  ],

  events: [
    { id: 'e-alpha', name: 'Alpha gathering', description: '', color: '#FFFFFF', createdAt: NOW, isRecurrent: false, startDate: FUTURE, isAllDay: true, pinned: false },
    { id: 'e-beta', name: 'Beta gathering', description: '', color: '#FFFFFF', createdAt: NOW, isRecurrent: false, startDate: FUTURE, isAllDay: true, pinned: false },
  ],
  eventFolders: [
    // Holds an event whose name is nowhere in the folder's own text, same as the note above,
    // plus a second one for the expanded-folder comparison.
    { id: 'ef-alpha', name: 'Alpha outing', description: '', color: '#FFFFFF', pinned: false, archived: false, createdAt: NOW, eventIds: ['e-beta', 'e-alpha'] },
    { id: 'ef-beta', name: 'Beta outing', description: '', color: '#FFFFFF', pinned: false, archived: false, createdAt: NOW, eventIds: [] },
  ],
  archivedEvents: [
    { id: 'ea-alpha', name: 'Alpha archived gathering', description: '', color: '#FFFFFF', createdAt: NOW, isRecurrent: false, startDate: FUTURE, isAllDay: true, pinned: false },
    { id: 'ea-beta', name: 'Beta archived gathering', description: '', color: '#FFFFFF', createdAt: NOW, isRecurrent: false, startDate: FUTURE, isAllDay: true, pinned: false },
  ],
  archivedEventFolders: [
    // An archived folder holds archived events, so the search of a folder in the archive has
    // to reach into that collection rather than the active one.
    { id: 'efa-alpha', name: 'Alpha archived outing', description: '', color: '#FFFFFF', pinned: false, archived: true, createdAt: NOW, eventIds: ['ea-beta'] },
    { id: 'efa-beta', name: 'Beta archived outing', description: '', color: '#FFFFFF', pinned: false, archived: true, createdAt: NOW, eventIds: [] },
  ],

  habits: [
    { id: 'h-alpha', name: 'Alpha routine', color: '#FFFFFF', createdAt: NOW, completedDates: [], activeDays: [true, true, true, true, true, true, true], pinned: false },
    { id: 'h-beta', name: 'Beta routine', color: '#FFFFFF', createdAt: NOW, completedDates: [], activeDays: [true, true, true, true, true, true, true], pinned: false },
  ],
  habitFolders: [
    // Holds a habit whose name is nowhere in the folder's own text, same as above, plus a
    // second one for the expanded-folder comparison.
    { id: 'hf-alpha', name: 'Alpha crate', description: '', color: '#FFFFFF', pinned: false, archived: false, createdAt: NOW, habitIds: ['h-beta', 'h-alpha'] },
    { id: 'hf-beta', name: 'Beta crate', description: '', color: '#FFFFFF', pinned: false, archived: false, createdAt: NOW, habitIds: [] },
  ],
  archivedHabits: [
    { id: 'ha-alpha', name: 'Alpha archived routine', color: '#FFFFFF', createdAt: NOW, completedDates: [], activeDays: [true, true, true, true, true, true, true], pinned: false },
    { id: 'ha-beta', name: 'Beta archived routine', color: '#FFFFFF', createdAt: NOW, completedDates: [], activeDays: [true, true, true, true, true, true, true], pinned: false },
  ],
  archivedHabitFolders: [
    { id: 'hfa-alpha', name: 'Alpha archived crate', description: '', color: '#FFFFFF', pinned: false, archived: true, createdAt: NOW, habitIds: [] },
    { id: 'hfa-beta', name: 'Beta archived crate', description: '', color: '#FFFFFF', pinned: false, archived: true, createdAt: NOW, habitIds: [] },
  ],
};

const PAGES = [
  {
    route: '/notes',
    names: ['Alpha memo', 'Beta memo', 'Alpha bundle', 'Beta bundle',
      'Alpha archived memo', 'Beta archived memo', 'Alpha archived bundle', 'Beta archived bundle'],
    tabs: {
      Notes: ['Alpha memo'],
      Folders: ['Alpha bundle'],
      Archived: ['Alpha archived memo', 'Alpha archived bundle'],
    },
    // A query that appears in the folder's contents but nowhere in the folder itself.
    contents: { query: 'Beta memo', folder: 'Alpha bundle' },
  },
  {
    route: '/events',
    names: ['Alpha gathering', 'Beta gathering', 'Alpha outing', 'Beta outing',
      'Alpha archived gathering', 'Beta archived gathering', 'Alpha archived outing', 'Beta archived outing'],
    tabs: {
      Events: ['Alpha gathering'],
      Folders: ['Alpha outing'],
      Archived: ['Alpha archived gathering', 'Alpha archived outing'],
    },
    contents: { query: 'Beta gathering', folder: 'Alpha outing', archivedQuery: 'Beta archived gathering', archivedFolder: 'Alpha archived outing' },
  },
  {
    // The habit tracker is the root route: `/habits` matches nothing and renders an empty page.
    route: '/',
    names: ['Alpha routine', 'Beta routine', 'Alpha crate', 'Beta crate',
      'Alpha archived routine', 'Beta archived routine', 'Alpha archived crate', 'Beta archived crate'],
    tabs: {
      Habits: ['Alpha routine'],
      Folders: ['Alpha crate'],
      Archived: ['Alpha archived routine', 'Alpha archived crate'],
    },
    contents: { query: 'Beta routine', folder: 'Alpha crate' },
  },
];

const port = 9222 + Math.floor(Math.random() * 400);
const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'searchtabs-'));
const outDir = path.join(process.cwd(), 'preview');
fs.mkdirSync(outDir, { recursive: true });
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
  '--no-first-run', '--disable-extensions', '--window-size=1440,900', '--force-device-scale-factor=1',
  `--remote-debugging-port=${port}`, `--user-data-dir=${profileDir}`, 'about:blank'], { stdio: 'ignore' });

/**
 * Which of the seeded names are on screen right now, and where.
 *
 * `innerText` is the gate, because it reports only what is actually rendered — a card that is
 * still mounted inside an inactive tab panel, or hidden by CSS, is not visible and must not
 * count. The location is then found by walking text nodes, so a name that should have been
 * filtered out can be traced to the element that kept it.
 */
const visibleNames = (names) => `(() => {
  const rendered = document.body.innerText;
  const out = [];
  for (const name of ${JSON.stringify(names)}) {
    if (!rendered.includes(name)) continue;
    /*
     * The location is found by element, not by text node: a highlighted match is split into
     * a "mark" element and the text around it, so no single text node holds the whole name
     * and a text-node search finds nothing at all.
     */
    const hits = Array.from(document.querySelectorAll('body *'))
      .filter((el) => (el.textContent || '').includes(name));
    const deepest = hits[hits.length - 1];
    if (!deepest) continue;
    const chain = [];
    let el = deepest;
    for (let i = 0; el && i < 3; i++, el = el.parentElement) {
      chain.push(el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).split(/\\s+/).slice(0, 2).join('.') : ''));
    }
    const panel = deepest.closest('[role="tabpanel"]');
    out.push({ name, panel: panel ? (panel.getAttribute('data-state') || '?') : 'no panel', chain });
  }
  return out;
})()`;

const openSearch = `(() => {
  const header = document.querySelector('header') || document.body;
  const button = Array.from(header.querySelectorAll('button'))
    .find((b) => b.querySelector('svg.lucide-search, svg[class*="search"]'));
  if (button) { button.click(); return 'clicked'; }
  return document.querySelector('header input') ? 'already-open' : 'no button';
})()`;

/**
 * Sets the search field the way React sees a keystroke: through the native value setter and
 * an input event. Assigning `.value` directly does not reach React's state, and dispatching
 * a key event per character doubles them.
 */
const setQuery = (query) => `(() => {
  const input = document.querySelector('header input')
    || Array.from(document.querySelectorAll('input')).find((i) => /^(Search|Pesquisar|Buscar|Rechercher|Suchen)$/.test(i.placeholder || ''));
  if (!input) return 'no input';
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(input, ${JSON.stringify(query)});
  input.dispatchEvent(new Event('input', { bubbles: true }));
  return 'ok';
})()`;

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
  console.log(`seeded: notes=${await cdp.eval(`(JSON.parse(localStorage.getItem('notes') || '[]')).length`)} events=${await cdp.eval(`(JSON.parse(localStorage.getItem('events') || '[]')).length`)} habits=${await cdp.eval(`(JSON.parse(localStorage.getItem('habits') || '[]')).length`)}`);

  for (const page of PAGES) {
    console.log(`\n########## ${page.route} ##########`);
    await cdp.send('Page.navigate', { url: BASE + page.route });
    await sleep(2600);
    console.log(`  search field: ${await cdp.eval(openSearch)}`);
    await sleep(600);
    check('the query could be typed', await cdp.eval(setQuery('Alpha')), 'ok');
    await sleep(1200);

    for (const [tab, expected] of Object.entries(page.tabs)) {
      console.log(`\n=== ${page.route} · ${tab} tab, searching "Alpha" ===`);
      const clicked = await cdp.clickExpr(
        `Array.from(document.querySelectorAll('[role="tab"]')).find((b) => (b.textContent || '').trim() === ${JSON.stringify(tab)})`);
      check(`the ${tab} tab was clicked`, clicked, true);
      await sleep(900);
      const reading = await cdp.eval(visibleNames(page.names));
      const visible = reading.map((entry) => entry.name);
      console.log(`  visible: ${JSON.stringify(visible)}`);
      if (visible.length !== expected.length) {
        for (const entry of reading) console.log(`    ${entry.name}  <-  ${entry.panel}  ${entry.chain.join(' < ')}`);
        console.log(`    page text: ${JSON.stringify(await cdp.eval(`document.body.innerText.slice(0, 160)`))}`);
      }
      check(`${tab}: only the match is shown`, visible, expected);

      const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
      const slug = `${page.route.replace('/', '') || 'habits'}-${tab.toLowerCase()}`;
      fs.writeFileSync(path.join(outDir, `search-${slug}.png`), Buffer.from(shot.data, 'base64'));
    }

    // A query that matches nothing must leave nothing behind.
    console.log(`\n=== ${page.route} · nothing matches ===`);
    // The field closes again once a tab has been switched, so it is reopened before typing.
    await cdp.eval(openSearch);
    await sleep(600);
    check('the query was replaced', await cdp.eval(setQuery('Zzz')), 'ok');
    await sleep(1000);
    for (const tab of Object.keys(page.tabs)) {
      await cdp.clickExpr(
        `Array.from(document.querySelectorAll('[role="tab"]')).find((b) => (b.textContent || '').trim() === ${JSON.stringify(tab)})`);
      await sleep(800);
      const reading = await cdp.eval(visibleNames(page.names));
      const visible = reading.map((entry) => entry.name);
      if (visible.length) {
        for (const entry of reading) console.log(`    ${entry.name}  <-  ${entry.panel}  ${entry.chain.join(' < ')}`);
      }
      check(`${tab}: nothing survives a query that matches nothing`, visible, []);
    }

    /*
     * A folder is also found by what is inside it. The folder's own name and description do
     * not contain the query here, so only the contents rule can keep it on screen.
     */
    console.log(`\n=== ${page.route} · a folder found by its contents ("${page.contents.query}") ===`);
    await cdp.eval(openSearch);
    await sleep(600);
    check('the query was replaced', await cdp.eval(setQuery(page.contents.query)), 'ok');
    await sleep(1000);
    await cdp.clickExpr(
      `Array.from(document.querySelectorAll('[role="tab"]')).find((b) => (b.textContent || '').trim() === 'Folders')`);
    await sleep(900);
    const withContents = (await cdp.eval(visibleNames(page.names))).map((entry) => entry.name);
    console.log(`  visible: ${JSON.stringify(withContents)}`);
    check('the folder holding a match is shown', withContents.includes(page.contents.folder), true);
    check('and the folder that holds nothing matching is not',
      withContents.filter((name) => name.endsWith('bundle') || name.endsWith('outing') || name.endsWith('crate')).length, 1);

    if (page.contents.archivedQuery) {
      console.log(`\n=== ${page.route} · an archived folder found by its contents ("${page.contents.archivedQuery}") ===`);
      await cdp.eval(openSearch);
      await sleep(600);
      check('the query was replaced', await cdp.eval(setQuery(page.contents.archivedQuery)), 'ok');
      await sleep(1000);
      await cdp.clickExpr(
        `Array.from(document.querySelectorAll('[role="tab"]')).find((b) => (b.textContent || '').trim() === 'Archived')`);
      await sleep(900);
      const archivedWithContents = (await cdp.eval(visibleNames(page.names))).map((entry) => entry.name);
      console.log(`  visible: ${JSON.stringify(archivedWithContents)}`);
      check('the archived folder holding the match is shown',
        archivedWithContents.includes(page.contents.archivedFolder), true);
    }

    /*
     * Reported, not asserted: what an expanded folder lists while a search is active. The
     * notes page is the reference the request points at, so it is measured first and the
     * other two are printed beside it — a difference here is a difference from Notes.
     */
    console.log(`\n=== ${page.route} · inside the matching folder while searching (report) ===`);
    await cdp.eval(openSearch);
    await sleep(600);
    await cdp.eval(setQuery(page.contents.query));
    await sleep(1000);
    await cdp.clickExpr(
      `Array.from(document.querySelectorAll('[role="tab"]')).find((b) => (b.textContent || '').trim() === 'Folders')`);
    await sleep(900);
    const opened = await cdp.eval(`(() => {
      const title = Array.from(document.querySelectorAll('h4'))
        .find((h) => (h.textContent || '').includes(${JSON.stringify(page.contents.folder)}));
      if (!title) return false;
      const r = (title.closest('[data-state]') || title).getBoundingClientRect();
      return { x: r.left + 60, y: r.top + r.height / 2 };
    })()`);
    if (opened) {
      await cdp.clickAt(opened.x, opened.y);
      await sleep(1000);
      const nested = await cdp.eval(visibleNames(page.names));
      console.log(`  nested cards visible: ${JSON.stringify(nested.map((entry) => entry.name))}`);
    } else {
      console.log('  the folder could not be expanded');
    }
  }
} finally {
  chrome.kill();
  await sleep(200);
  try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch { /* windows lock */ }
}

console.log(failures === 0 ? '\nALL SEARCH-FILTER CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
