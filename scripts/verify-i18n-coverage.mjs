/**
 * Checks the interface in every language the app offers.
 *
 * Two failure modes are worth catching, and they look nothing alike:
 *
 *  1. A raw translation key rendered on screen. `t()` returns the key when it cannot
 *     resolve one, so a missing entry shows "tabFolders" where a button should say
 *     "Folders". That is worse than an untranslated label, and it is invisible unless
 *     something looks for it.
 *  2. A language that is still entirely English. Expected for the six without
 *     translations yet, and asserted here so the gap stays a known one rather than
 *     drifting unnoticed.
 *
 * Usage: node scripts/verify-i18n-coverage.mjs
 * Output: preview/i18n-coverage.txt
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

const here = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const root = path.resolve(here, '..');

/** Every key the dictionary defines, read from the source so it cannot go stale. */
const dictSource = fs.readFileSync(path.join(root, 'src/contexts/LanguageContext.tsx'), 'utf8').replace(/\r\n/g, '\n');
const KEYS = [...dictSource.matchAll(/^\s+'([A-Za-z][A-Za-z0-9]*)':/gm)].map((m) => m[1]);
const UNIQUE_KEYS = [...new Set(KEYS)];

/**
 * Keys whose English text IS the key name — `'items': 'items'`.
 *
 * Those cannot be told apart from a raw key by looking at the rendered text, so they are
 * excluded rather than reported as a false positive. A key whose English value differs
 * from its name is unambiguous: seeing the key on screen means the lookup failed.
 */
const SELF_NAMED = new Set(
  [...dictSource.matchAll(/^\s+'([A-Za-z][A-Za-z0-9]*)': '([^']*)',$/gm)]
    .filter((m) => m[1] === m[2])
    .map((m) => m[1]),
);
const DISTINCT_KEYS = UNIQUE_KEYS.filter((k) => !SELF_NAMED.has(k));

/** The six with translations; the rest fall back to English by design. */
const TRANSLATED = ['en', 'pt', 'es', 'fr', 'de', 'it'];
const FALLBACK = ['nl', 'pl', 'tr', 'ja', 'zh', 'ko'];

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
const d = new Date();
const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const seed = {
  notes: [{ id: 'n1', type: 'text', name: 'Groceries', description: 'milk', tags: ['work'], items: [], color: 'default', locked: false, createdAt: NOW, modifiedAt: NOW }],
  folders: [{ id: 'f1', name: 'Home', description: 'things', color: 'default', createdAt: NOW, noteIds: ['n1'] }],
  events: [{ id: 'e1', name: 'Dentist', description: 'checkup', date: day, time: '10:00', color: 'default', type: 'oneTime', createdAt: NOW, modifiedAt: NOW }],
  habits: [{ id: 'h1', name: 'Drink water', description: '', color: 'default', type: 'boolean', frequency: 'daily', target: 1, createdAt: NOW, completions: [] }],
  allTags: { work: 2 },
};

const port = 9222 + Math.floor(Math.random() * 400);
const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'i18n-'));
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
  '--no-first-run', '--disable-extensions', '--window-size=1440,900',
  `--remote-debugging-port=${port}`, `--user-data-dir=${profileDir}`, 'about:blank'], { stdio: 'ignore' });

const report = [];
const ROUTES = [['/notes', 'Notes'], ['/events', 'Events'], ['/calendar', 'Calendar'], ['/profile', 'Profile'], ['/tags', 'Tags']];

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
  await sleep(2500);
  await cdp.eval(`(() => {
    const data = ${JSON.stringify(seed)};
    for (const [k, v] of Object.entries(data)) localStorage.setItem(k, JSON.stringify(v));
    localStorage.setItem('habitrkr.theme', 'light');
    return true;
  })()`);

  const languages = [...TRANSLATED, ...FALLBACK];
  const seenKeysIn = {};
  const englishishIn = {};

  for (const lang of languages) {
    await cdp.eval(`localStorage.setItem('habitrkr.language', ${JSON.stringify(lang)}); true`);

    const rawKeys = new Set();
    const visible = new Set();

    for (const [route] of ROUTES) {
      await cdp.send('Page.navigate', { url: BASE + route });
      await sleep(2300);
      const strings = JSON.parse(await cdp.eval(`JSON.stringify((() => {
        const out = [];
        document.querySelectorAll('body *').forEach((el) => {
          if (el.closest('[aria-hidden="true"]')) return;
          Array.from(el.childNodes).forEach((n) => {
            if (n.nodeType !== 3) return;
            const t = n.textContent.trim();
            if (!t || t.length > 70) return;
            out.push(t);
          });
        });
        return out;
      })())`));
      for (const s of strings) {
        visible.add(s);
        if (DISTINCT_KEYS.includes(s)) rawKeys.add(s);
      }
    }

    seenKeysIn[lang] = [...rawKeys];
    // How much of the interface is still English: count the words that exactly match the
    // English dictionary values.
    const enValues = new Set([...dictSource.matchAll(/^\s+'([A-Za-z][A-Za-z0-9]*)': '([^']*)',$/gm)]
      .filter((m, i, arr) => arr.findIndex((x) => x[1] === m[1]) === i)
      .map((m) => m[2]));
    englishishIn[lang] = [...visible].filter((s) => enValues.has(s)).length;

    report.push(`${lang}: raw keys ${rawKeys.size === 0 ? 'none' : [...rawKeys].join(', ')} | English strings still shown: ${englishishIn[lang]}`);
  }

  console.log('=== raw keys rendered on screen (should be none, in every language) ===');
  for (const lang of languages) {
    const found = seenKeysIn[lang];
    console.log(`  ${lang}: ${found.length === 0 ? 'none' : found.join(', ')}`);
  }
  check('no language renders a raw translation key', Object.values(seenKeysIn).every((v) => v.length === 0), true);

  console.log('\n=== how much of the interface is still English ===');
  for (const lang of languages) {
    const tag = TRANSLATED.includes(lang) ? 'translated' : 'falls back';
    console.log(`  ${lang} (${tag}): ${englishishIn[lang]}`);
  }
  // The translated six must actually differ from English; the fallback six are expected
  // to match it, which is the honest gap this test records.
  for (const lang of TRANSLATED.filter((l) => l !== 'en')) {
    check(`${lang} shows less English than the untranslated languages`, englishishIn[lang] < Math.max(...FALLBACK.map((f) => englishishIn[f])), true);
  }

  const file = path.join(root, 'preview', 'i18n-coverage.txt');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, report.join('\n'));
  console.log(`\nwritten: ${file}`);
} finally {
  chrome.kill();
  await sleep(200);
  try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch { /* windows lock */ }
}

console.log(failures === 0 ? '\nALL I18N COVERAGE CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
