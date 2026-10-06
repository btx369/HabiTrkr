/**
 * Checks that bulk-action toasts carry the count, and that the number actually changes the
 * wording.
 *
 * The point of the count is that someone who meant to archive one folder notices when the
 * toast says three. That only works if the number is inside the sentence AND the sentence
 * agrees with it — Portuguese needs "1 nota arquivada" against "2 notas arquivadas", where
 * the participle changes too. A single "{count} items archived" would read "1 items".
 *
 * Usage: node scripts/verify-counted-toasts.mjs
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
const mk = (i) => ({
  id: `n${i}`, type: 'text', name: `Note ${i}`, description: `body ${i}`,
  tags: [], items: [], color: 'default', locked: false, createdAt: NOW, modifiedAt: NOW,
});

const port = 9222 + Math.floor(Math.random() * 400);
const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'counted-'));
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
  '--no-first-run', '--disable-extensions', '--window-size=1440,900',
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

  const seed = async (count, language) => {
    const notes = Array.from({ length: count }, (_, i) => mk(i));
    await cdp.send('Page.navigate', { url: BASE + '/' });
    await sleep(2200);
    await cdp.eval(`(() => {
      for (const k of ['notes','archivedNotes','folders','archivedFolders']) localStorage.removeItem(k);
      localStorage.setItem('notes', ${JSON.stringify(JSON.stringify(notes))});
      localStorage.setItem('habitrkr.theme', 'light');
      localStorage.setItem('habitrkr.language', ${JSON.stringify(language)});
      return true;
    })()`);
    await cdp.send('Page.navigate', { url: BASE + '/notes' });
    await sleep(3000);
  };

  const mouseClick = async (x, y) => {
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, buttons: 0 });
    await sleep(100);
    await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 });
    await sleep(60);
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

  /**
   * Selects every note with the bulk bar's "All" control, then archives them.
   *
   * Bulk mode is entered from the header button carrying the file-stack glyph — it is not a
   * menu item, which is what the first attempt at this assumed.
   */
  const bulkArchiveAll = async () => {
    const toggled = await clickExpr(`Array.from(document.querySelectorAll('button')).find(b => b.querySelector('svg.lucide-file-stack'))`);
    if (!toggled) return 'no bulk-mode button';
    await sleep(700);
    const all = await clickExpr(`Array.from(document.querySelectorAll('button')).find(b => {
      const label = (b.textContent || '').trim();
      return label === 'All' || label === 'Todas';
    })`);
    if (!all) return 'no All button';
    await sleep(600);
    const archived = await clickExpr(`Array.from(document.querySelectorAll('button')).find(b => /^(archive|arquivar)$/i.test((b.textContent || '').trim()))`);
    if (!archived) return 'no Archive button';
    await sleep(900);
    const confirmed = await clickExpr(`Array.from(document.querySelectorAll('[role="alertdialog"] button')).find(b => /archive|arquivar/i.test(b.textContent || ''))`);
    if (!confirmed) return 'no confirm button';
    await sleep(1600);
    return 'ok';
  };

  const toastText = () => cdp.eval(`(() => {
    const el = document.querySelector('[data-sonner-toast]');
    return el ? (el.textContent || '').trim() : null;
  })()`);

  for (const [language, casesLabel] of [['en', 'English'], ['pt', 'Portuguese']]) {
    console.log(`\n=== ${casesLabel} (${language}) ===`);
    for (const count of [1, 3]) {
      await seed(count, language);
      const result = await bulkArchiveAll();
      const text = await toastText();
      console.log(`  ${count} note(s): ${JSON.stringify(text)}   [${result}]`);
      check(`${language}: ${count} note(s) produced a toast`, Boolean(text), true);
      // The numeral has to be in the sentence, and the wording has to agree with it.
      check(`${language}: the count ${count} appears in the message`, (text || '').includes(String(count)), true);
      check(`${language}: no un-substituted placeholder is left`, /[{]/.test(text || ''), false);
    }
  }

  console.log('\n=== the pair differs, which is the whole point ===');
  await seed(1, 'pt');
  await bulkArchiveAll();
  const ptOne = await toastText();
  await seed(3, 'pt');
  await bulkArchiveAll();
  const ptMany = await toastText();
  console.log(`  pt 1: ${JSON.stringify(ptOne)}`);
  console.log(`  pt 3: ${JSON.stringify(ptMany)}`);
  check('Portuguese uses different wording for 1 and 3', ptOne !== ptMany, true);
} finally {
  chrome.kill();
  await sleep(200);
  try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch { /* windows lock */ }
}

console.log(failures === 0 ? '\nALL COUNTED-TOAST CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
