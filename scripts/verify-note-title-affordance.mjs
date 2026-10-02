/**
 * Checks that an untitled note says so, and that the prompt leads to a title.
 *
 * A note with no title used to render nothing in the title position: an invisible hit
 * area with no hint that a title could be given. It only looked filled in before because
 * new notes were seeded with the literal word "Title", which was a real value in the
 * data and had to be filtered back out of the cards.
 *
 * Usage:
 *   node scripts/verify-note-title-affordance.mjs            # light
 *   THEME=dark node scripts/verify-note-title-affordance.mjs # dark
 *
 * Screenshots land in preview/, which is gitignored.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const BASE = process.env.BASE_URL ?? 'http://localhost:8080';
const THEME = process.env.THEME === 'dark' ? 'dark' : 'light';
const SUFFIX = THEME === 'dark' ? '-dark' : '';
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
  { id: 'note-untitled', type: 'text', name: '', description: 'a note that has no title yet', tags: [], items: [], color: 'default', locked: false, createdAt: NOW, modifiedAt: NOW },
  { id: 'note-titled', type: 'text', name: 'Has a title', description: 'this one is named', tags: [], items: [], color: 'default', locked: false, createdAt: NOW, modifiedAt: NOW },
];

const port = 9222 + Math.floor(Math.random() * 400);
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'titleaff-'));
const outDir = path.join(process.cwd(), 'preview');
fs.mkdirSync(outDir, { recursive: true });
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

  await cdp.send('Page.navigate', { url: BASE + '/' });
  await sleep(2500);

  // The theme is read with `getLocalStorageString`, so the key holds a RAW string:
  // storing it JSON-quoted as `"dark"` fails the `stored !== 'dark'` check and falls
  // back to light without complaining.
  await cdp.eval(`(() => {
    for (const k of ['notes','archivedNotes','folders','archivedFolders','notesAllViewType']) localStorage.removeItem(k);
    localStorage.setItem('notes', ${JSON.stringify(JSON.stringify(NOTES))});
    localStorage.setItem('habitrkr.theme', ${JSON.stringify(THEME)});
    return true;
  })()`);

  await cdp.send('Page.navigate', { url: BASE + '/notes' });
  await sleep(3200);

  // React only writes the class to <html> once it has mounted, so assert the palette
  // really applied instead of assuming it did — otherwise a "dark" screenshot silently
  // renders in light.
  const settled = await cdp.eval(`JSON.stringify({ cls: document.documentElement.className })`);
  console.log(`  theme requested: ${THEME}  ->  ${settled}`);
  if (!JSON.parse(settled).cls.includes(THEME)) {
    console.error(`  !  the ${THEME} palette did not apply; screenshots would be misleading`);
    process.exitCode = 1;
  }

  const mouseClick = async (x, y) => {
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, buttons: 0 });
    await sleep(120);
    await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 });
    await sleep(70);
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1 });
  };
  const clickSel = async (sel) => {
    const box = await cdp.eval(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return 'null';
      const r = el.getBoundingClientRect();
      return JSON.stringify({ x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }); })()`);
    if (box === 'null') return false;
    const b = JSON.parse(box);
    await mouseClick(b.x, b.y);
    return true;
  };
  const shoot = async (name) => {
    const res = await cdp.send('Page.captureScreenshot', { format: 'png' });
    const file = path.join(outDir, name + '.png');
    fs.writeFileSync(file, Buffer.from(res.data, 'base64'));
    return file;
  };
  /** The title element inside the note dialog, described as the user sees it. */
  const titleArea = async () => JSON.parse(await cdp.eval(`JSON.stringify((() => {
    const d = document.querySelector('[role="dialog"]');
    if (!d) return { open: false };
    const h2s = Array.from(d.querySelectorAll('h2'));
    const el = h2s[1];
    if (!el) return { open: true, title: null };
    const parts = Array.from(el.querySelectorAll('span, svg')).map(n => ({
      tag: n.tagName, text: (n.textContent || '').trim().slice(0, 20),
      color: getComputedStyle(n).color, fontStyle: getComputedStyle(n).fontStyle,
      w: Math.round(n.getBoundingClientRect().width),
    }));
    const r = el.getBoundingClientRect();
    return { open: true, text: el.textContent.trim(), width: Math.round(r.width), cursor: getComputedStyle(el).cursor, parts };
  })())`));

  console.log('\n=== 1. An untitled note announces the title field ===');
  await clickSel('[data-note-card="note-untitled"] > div');
  await sleep(1600);
  const untitled = await titleArea();
  console.log(`  title area: ${JSON.stringify(untitled)}`);
  check('the note dialog is open', untitled.open, true);
  check('the title area has a visible prompt', untitled.text, 'Add a title');
  check('it is not empty, so it cannot be an invisible hit area', untitled.width > 0, true);
  check('it reads as a control', untitled.cursor, 'pointer');
  // The prompt must be muted, not solid: it is a hint, not a value.
  const prompt = untitled.parts.find((p) => p.text === 'Add a title');
  check('the prompt is shown in muted text', /rgba?\([^)]*,\s*0?\.\d+\)/.test(prompt.color), true);
  check('and in italic, so it does not read as content', prompt.fontStyle, 'italic');
  const pencil = untitled.parts.find((p) => p.tag === 'svg');
  check('a pencil is present to signal it is editable', !!pencil, true);
  check('the pencil has a size', pencil.w > 0, true);
  console.log(`  screenshot: ${await shoot('title-untitled' + SUFFIX)}`);

  console.log('\n=== 2. Clicking the prompt opens the field ===');
  // The title is the second h2 in the dialog; the first is the dialog's own label.
  const box = JSON.parse(await cdp.eval(`(() => {
    const el = Array.from(document.querySelectorAll('[role="dialog"] h2'))[1];
    if (!el) return 'null';
    const r = el.getBoundingClientRect();
    return JSON.stringify({ x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) });
  })()`));
  await mouseClick(box.x, box.y);
  await sleep(900);
  const opened = JSON.parse(await cdp.eval(`JSON.stringify((() => {
    const d = document.querySelector('[role="dialog"]');
    const i = Array.from(d.querySelectorAll('input')).find(x => (x.className || '').includes('text-lg'));
    return i ? { value: i.value, focused: document.activeElement === i } : null;
  })())`));
  console.log(`  field: ${JSON.stringify(opened)}`);
  check('an empty input appeared', opened, { value: '', focused: true });

  console.log('\n=== 3. Typing a title replaces the prompt ===');
  await cdp.send('Input.insertText', { text: 'Now it has one' });
  await sleep(250);
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  await sleep(1200);
  const named = await titleArea();
  console.log(`  title area: ${JSON.stringify(named)}`);
  check('the prompt is gone', named.text.includes('Add a title'), false);
  check('the title is shown instead', named.text, 'Now it has one');
  check('and the pencil is gone too', named.parts.some((p) => p.tag === 'svg'), false);
  console.log(`  screenshot: ${await shoot('title-named' + SUFFIX)}`);

  console.log('\n=== 4. A note that already has a title is unchanged ===');
  await cdp.send('Page.navigate', { url: BASE + '/notes' });
  await sleep(3000);
  await clickSel('[data-note-card="note-titled"] > div');
  await sleep(1600);
  const titled = await titleArea();
  console.log(`  title area: ${JSON.stringify(titled)}`);
  check('the real title is shown', titled.text, 'Has a title');
  check('no prompt is added to it', titled.text.includes('Add a title'), false);
  console.log(`  screenshot: ${await shoot('title-existing' + SUFFIX)}`);

  check('nothing above failed', failures, 0);
} finally {
  chrome.kill();
  await sleep(200);
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* windows lock */ }
}

console.log(failures === 0 ? '\nALL TITLE-AFFORDANCE CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
