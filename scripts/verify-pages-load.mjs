/**
 * Loads every page of the app and reports any runtime error, React exception or blank
 * render.
 *
 * A crash in one component leaves the shell up but the page empty, which a status-code
 * check on the dev server does not see. This loads each route, records what the console and
 * the error overlay said, and checks that the page actually rendered something.
 *
 * Usage: node scripts/verify-pages-load.mjs
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
    this.exceptions = [];   // a thrown error blanks the page: this is the crash signal
    this.errors = [];       // React's own complaints, which do not stop the render
    ws.addEventListener('message', (e) => {
      const m = JSON.parse(e.data);
      if (m.id && this.pending.has(m.id)) {
        const { resolve, reject } = this.pending.get(m.id);
        this.pending.delete(m.id);
        m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result);
      }
      if (m.method === 'Runtime.exceptionThrown') {
        this.exceptions.push((m.params.exceptionDetails?.exception?.description || 'exception').split('\n')[0].slice(0, 200));
      }
      if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
        this.errors.push(m.params.args.map((a) => a.value ?? a.description ?? '').join(' ').split('\n')[0].slice(0, 200));
      }
    });
  }
  send(method, params = {}) {
    const id = this.nextId++;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      setTimeout(() => { if (this.pending.has(id)) { this.pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); } }, 20000);
    });
  }
  async eval(expression) {
    const r = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? 'eval failed');
    return r.result.value;
  }
  forget() { this.exceptions = []; this.errors = []; }
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
const SEED = {
  notes: [{ id: 'n1', name: 'Seeded note', type: 'text', description: 'text', tags: [], color: '#FFFFFF',
    pinned: true, locked: false, createdAt: NOW, modifiedAt: NOW }],
  folders: [{ id: 'nf1', name: 'Note folder', description: '', color: '#BFDBFE', createdAt: NOW, noteIds: ['n1'] }],
  events: [{ id: 'e1', name: 'Seeded event', description: '', color: '#FEF3C7', createdAt: NOW,
    isRecurrent: false, startDate: new Date(Date.now() + 10 * 86400000).toISOString(), isAllDay: true, pinned: true }],
  eventFolders: [{ id: 'ef1', name: 'Event folder', description: '', color: '#BFDBFE', pinned: false,
    archived: false, createdAt: NOW, eventIds: ['e1'] }],
  habits: [{ id: 'h1', name: 'Seeded habit', color: '#FFFFFF', createdAt: NOW, completedDates: [],
    activeDays: [true, true, true, true, true, true, true], pinned: true }],
  habitFolders: [{ id: 'hf1', name: 'Habit folder', description: '', color: '#BFDBFE', pinned: false,
    archived: false, createdAt: NOW, habitIds: ['h1'] }],
  tags: [{ name: 'seeded', count: 1 }],
};

const ROUTES = ['/', '/notes', '/events', '/calendar', '/tags', '/profile'];

const port = 9222 + Math.floor(Math.random() * 400);
const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pages-'));
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

  await cdp.send('Page.navigate', { url: BASE + '/' });
  await sleep(2000);
  await cdp.eval(`(() => {
    const seed = ${JSON.stringify(SEED)};
    for (const key of Object.keys(seed)) localStorage.setItem(key, JSON.stringify(seed[key]));
    localStorage.setItem('habitrkr.language', 'en');
    localStorage.setItem('habitrkr.theme', 'light');
    return true;
  })()`);

  let reactErrors = 0;
  for (const route of ROUTES) {
    cdp.forget();
    await cdp.send('Page.navigate', { url: BASE + route });
    await sleep(2600);
    const state = await cdp.eval(`(() => ({
      rootLength: (document.getElementById('root') || {}).innerHTML?.length ?? -1,
      text: (document.body.innerText || '').trim().slice(0, 60),
      overlay: document.querySelectorAll('vite-error-overlay').length,
      cards: document.querySelectorAll('[data-note-id], [data-event-id], [data-habit-id]').length,
    }))()`);
    console.log(`\n=== ${route} ===`);
    console.log(`  rendered characters: ${state.rootLength}, cards: ${state.cards}`);
    console.log(`  page says: ${JSON.stringify(state.text)}`);
    if (cdp.errors.length) {
      reactErrors += cdp.errors.length;
      for (const error of cdp.errors) console.log(`  React complaint: ${error}`);
    }
    // A thrown error takes the page down with it; that is the crash this script is for.
    check(`${route} throws nothing`, cdp.exceptions, []);
    check(`${route} renders content`, state.rootLength > 500, true);
    check(`${route} shows no Vite error overlay`, state.overlay, 0);
  }
  // React's own complaints do not stop the render, so they are reported rather than failed
  // on — but they are counted, so a page that starts complaining is visible in the output.
  console.log(`\nReact complaints across the pages: ${reactErrors}`);
} finally {
  chrome.kill();
  await sleep(200);
  try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch { /* windows lock */ }
}

console.log(failures === 0 ? '\nALL PAGES LOAD CLEANLY' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
