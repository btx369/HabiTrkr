/**
 * Checks the interface in every language the app offers.
 *
 * Three failure modes are worth catching, and they look nothing alike:
 *
 *  1. A raw translation key rendered on screen. `t()` returns the key when it cannot
 *     resolve one, so a missing entry shows "tabFolders" where a button should say
 *     "Folders". That is worse than an untranslated label.
 *  2. A translated language showing English text. This is the one that actually matters to
 *     a user, and it is the one an earlier version of this file failed to check: it only
 *     looked for raw keys, so a screen that was still 80% English passed happily. The list
 *     of English strings left on each screen is printed in full so the remaining work is
 *     visible rather than merely counted.
 *  3. A language that is still entirely English. Expected for the six without
 *     translations yet, and asserted here so the gap stays a known one.
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

/**
 * Which languages to check.
 *
 * All twelve by default. Opening eighteen surfaces in each is thorough and slow, so
 * `LANGS=pt,en node scripts/verify-i18n-coverage.mjs` narrows it while iterating: the
 * translated six share one dictionary layout, so a gap shows up in any of them.
 */
const LANGS = process.env.LANGS
  ? process.env.LANGS.split(',').map((s) => s.trim()).filter(Boolean)
  : null;

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

/**
 * Strings that are English by design, so a translated language showing them is not a
 * defect. Kept as an explicit list: the guard has to stay meaningful, and silencing it by
 * pattern would let real gaps through.
 *
 *  - product name and acronyms that are not translated
 *  - clock times and date/number output, which come from date-fns and Intl
 */
const ALWAYS_ENGLISH = /^(\d|HabiTrkr$|#|OK$)/;

/** One item of seeded user content per key, excluded from the count: it is data, not copy. */
const SEEDED = new Set(['Groceries', 'milk and bread', 'milk', 'Home', 'home things', 'Dentist', 'checkup', 'Drink water', 'work', 'To do', 'call mum', 'test']);

/** Text that is never interface copy: values, ids, single characters. */
const isCopy = (s) =>
  s.length > 1
  && !/^[\d\s.,:/#%×✓+-]+$/.test(s)
  && !ALWAYS_ENGLISH.test(s)
  && /[A-Za-zÀ-ÿ]/.test(s);

/**
 * English strings that are also the translation in the language being checked.
 *
 * "Feedback" is "Feedback" in Italian, "Tags" is "Tags" in French — those are translated
 * labels that happen to be spelled the same, and reporting them as untranslated would send
 * whoever reads this output chasing strings that are already correct. A word is only
 * considered a false positive when the TARGET language's dictionary value equals the
 * English one.
 */
const sameInBoth = (sourceText, lang) => {
  const block = new RegExp(`\\n  ${lang}: \\{([\\s\\S]*?)\\n  \\},`).exec(sourceText);
  if (!block) return new Set();
  const values = new Map();
  for (const m of block[1].matchAll(/^\s+'([A-Za-z][A-Za-z0-9]*)': '([^']*)',$/gm)) {
    values.set(m[1], m[2]);
  }
  const english = new Map();
  const enBlock = /\n  en: \{([\s\S]*?)\n  \},/.exec(sourceText);
  if (enBlock) {
    for (const m of enBlock[1].matchAll(/^\s+'([A-Za-z][A-Za-z0-9]*)': '([^']*)',$/gm)) {
      english.set(m[1], m[2]);
    }
  }
  const out = new Set();
  for (const [key, value] of values) {
    if (english.get(key) === value) out.add(value);
  }
  return out;
};

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

  const languages = LANGS ?? [...TRANSLATED, ...FALLBACK];
  const seenKeysIn = {};
  const englishishIn = {};
  const detailIn = {};

  const mouseClick = async (x, y) => {
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, buttons: 0 });
    await sleep(110);
    await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 });
    await sleep(65);
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1 });
    await sleep(700);
  };
  const clickExpr = async (expr) => {
    const box = await cdp.eval(`(() => { const el = ${expr}; if (!el) return 'null';
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return 'null';
      return JSON.stringify({ x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }); })()`);
    if (box === 'null') return false;
    const b = JSON.parse(box);
    await mouseClick(b.x, b.y);
    return true;
  };
  const escape = async () => {
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await sleep(600);
  };

  /**
   * Collects the visible strings on the page, optionally including any open dialog.
   *
   * The editors matter most: hiding one behind a click is exactly how a check that only
   * reads the main pages reports "3 English strings" while the user sees dozens. Every
   * screen below is exercised with its editor open.
   */
  const collectStrings = () => cdp.eval(`JSON.stringify((() => {
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
    // Placeholders are copy too, and they never appear as text nodes.
    document.querySelectorAll('input[placeholder], textarea[placeholder]').forEach((el) => {
      const p = el.getAttribute('placeholder');
      if (p && p.length <= 70) out.push(p);
    });
    return out;
  })())`).then(JSON.parse);

  /**
   * Each entry opens something that holds copy the main page does not show. `open` returns
   * whether it managed to, so a silent failure is reported rather than passing quietly.
   */
  const SURFACES = [
    { name: 'Notes list', route: '/notes' },
    { name: 'Note editor', route: '/notes', open: () => clickExpr(`Array.from(document.querySelectorAll('[data-note-card] button')).find(b => b.getAttribute('aria-haspopup') === 'menu')`) },
    { name: 'Note viewer', route: '/notes', open: () => clickExpr(`document.querySelector('[data-note-card] > div')`) },
    { name: 'Note type popup', route: '/notes', open: () => clickExpr(`Array.from(document.querySelectorAll('button')).find(b => b.querySelector('svg.lucide-plus'))`) },
    { name: 'Notes view settings', route: '/notes', open: () => clickExpr(`Array.from(document.querySelectorAll('button')).find(b => b.querySelector('svg.lucide-settings'))`) },
    // The card's 3-dot menu, and the confirmation behind Delete. The dialogs hold copy that
    // is nowhere on the page until something opens them, which is exactly where the reported
    // English was hiding — a check that only reads the main pages cannot see it.
    { name: 'Note card menu', route: '/notes', open: () => clickExpr(`Array.from(document.querySelectorAll('[data-note-card] button')).find(b => b.getAttribute('aria-haspopup') === 'menu')`) },
    { name: 'Delete confirmation', route: '/notes', open: async () => {
      await clickExpr(`Array.from(document.querySelectorAll('[data-note-card] button')).find(b => b.getAttribute('aria-haspopup') === 'menu')`);
      await sleep(500);
      return clickExpr(`Array.from(document.querySelectorAll('[role="menuitem"]')).find(m => /delete/i.test(m.textContent || ''))`);
    } },
    { name: 'Lock note dialog', route: '/notes', open: async () => {
      await clickExpr(`Array.from(document.querySelectorAll('[data-note-card] button')).find(b => b.getAttribute('aria-haspopup') === 'menu')`);
      await sleep(500);
      return clickExpr(`Array.from(document.querySelectorAll('[role="menuitem"]')).find(m => /^(lock|unlock)/i.test((m.textContent || '').trim()))`);
    } },
    { name: 'Notes folders tab', route: '/notes', open: () => clickExpr(`Array.from(document.querySelectorAll('button,[role="tab"]')).find(b => (b.textContent || '').trim() === 'Folders')`) },
    { name: 'Events list', route: '/events' },
    { name: 'Event editor', route: '/events', open: () => clickExpr(`Array.from(document.querySelectorAll('button')).find(b => { const s = b.querySelector('svg'); return s && String(s.getAttribute('class') || '').includes('plus'); })`) },
    { name: 'Events view settings', route: '/events', open: () => clickExpr(`Array.from(document.querySelectorAll('button')).find(b => b.querySelector('svg.lucide-settings'))`) },
    { name: 'Calendar', route: '/calendar' },
    { name: 'Habits list', route: '/' },
    { name: 'Habit editor', route: '/', open: () => clickExpr(`Array.from(document.querySelectorAll('button')).find(b => { const s = b.querySelector('svg'); return s && String(s.getAttribute('class') || '').includes('plus'); })`) },
    { name: 'Habits view settings', route: '/', open: () => clickExpr(`Array.from(document.querySelectorAll('button')).find(b => b.querySelector('svg.lucide-settings'))`) },
    { name: 'Profile', route: '/profile' },
    { name: 'Tags', route: '/tags' },
  ];

  // The English dictionary values, for one specific signal: a string identical to a
  // dictionary value while a non-English language is active means the label exists but was
  // never wired. This is NOT the completeness measure — see the differential below.
  const EN_VALUES = new Set([...dictSource.matchAll(/^\s+'([A-Za-z][A-Za-z0-9]*)': '([^']*)',$/gm)]
    .filter((m, i, arr) => arr.findIndex((x) => x[1] === m[1]) === i)
    .map((m) => m[2])
    .filter(isCopy));

  /**
   * Reads every surface once, in the given language.
   *
   * A set of strings is not enough to judge translation, because the interesting case is a
   * string that has NO key at all — it is invisible to any check that compares against the
   * dictionary. So the same surfaces are read twice, once in English and once in the target
   * language, and the two are compared: anything byte-identical between them never went
   * through `t()`.
   */
  const readAllSurfaces = async (lang) => {
    await cdp.eval(`localStorage.setItem('habitrkr.language', ${JSON.stringify(lang)}); true`);
    const strings = new Set();
    const failed = [];
    for (const surface of SURFACES) {
      await cdp.send('Page.navigate', { url: BASE + surface.route });
      await sleep(2200);
      if (surface.open) {
        const ok = await surface.open();
        if (!ok) failed.push(surface.name);
        await sleep(600);
      }
      for (const s of await collectStrings()) strings.add(s);
      if (surface.open) await escape();
    }
    return { strings, failed };
  };

  // English first: it is the reference for "what was left untranslated".
  const english = await readAllSurfaces('en');
  console.log(`surfaces read: ${SURFACES.length - english.failed.length}/${SURFACES.length}`);
  if (english.failed.length) {
    console.log(`  !  could not open: ${english.failed.join(', ')} — their copy was not checked`);
  }
  console.log(`English run collected ${english.strings.size} string(s)\n`);

  for (const lang of languages.filter((l) => l !== 'en')) {
    const { strings, failed } = await readAllSurfaces(lang);

    // A string present in both reads, unchanged, was never translated. Product names,
    // pure numbers, the seeded user data and words that are genuinely the same in both
    // languages are excluded; everything else is a real gap.
    const sameWords = sameInBoth(dictSource, lang);
    const untranslated = [...strings].filter((s) =>
      english.strings.has(s) && isCopy(s) && !/^HabiTrkr/.test(s) && !sameWords.has(s) && !SEEDED.has(s));
    const rawKeys = untranslated.filter((s) => DISTINCT_KEYS.includes(s));

    seenKeysIn[lang] = rawKeys;
    englishishIn[lang] = untranslated.length;
    detailIn[lang] = untranslated.sort();

    report.push(`=== ${lang} ===`);
    report.push(`surfaces read: ${SURFACES.length - failed.length}/${SURFACES.length}${failed.length ? ` (could not open: ${failed.join(', ')})` : ''}`);
    report.push(`raw keys rendered: ${rawKeys.length === 0 ? 'none' : rawKeys.join(', ')}`);
    report.push(`identical to English: ${untranslated.length}`);
    for (const s of untranslated.sort()) report.push(`    ${JSON.stringify(s)}`);
    report.push('');
  }
  seenKeysIn.en = [];
  englishishIn.en = 0;

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
  // The translated six must actually differ from English, and the fallback six are expected
  // to match it — that is the honest gap this test records. The comparison needs both groups
  // measured, so a filtered run skips it rather than reporting a false failure.
  if (!LANGS) {
    for (const lang of TRANSLATED.filter((l) => l !== 'en')) {
      check(`${lang} shows less English than the untranslated languages`, englishishIn[lang] < Math.max(...FALLBACK.map((f) => englishishIn[f])), true);
    }
  } else {
    console.log(`\n(skipped the translated-vs-fallback comparison: LANGS=${process.env.LANGS} does not measure both groups)`);
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
