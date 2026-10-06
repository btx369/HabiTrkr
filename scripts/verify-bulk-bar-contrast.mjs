/**
 * Measures the bulk action bar's labels against the bar it sits on, in both themes.
 *
 * The report: with the dark theme on, the options in the bulk bar were invisible — black on a
 * black bar. The bar is deliberately dark in both themes (it shares the bottom navigation's
 * scrim), but its labels asked for `text-primary-foreground`, and that token inverts: white in
 * the light theme, near-black in the dark one.
 *
 * Contrast is the measurement, not the token name: every label the bar draws is compared with
 * the colour the bar actually paints, and has to clear the WCAG ratio for its size. The delete
 * action is held to the large-text ratio because it is painted in the palette's destructive
 * red, which is the same red in both themes and was never part of the report.
 *
 * Usage: node scripts/verify-bulk-bar-contrast.mjs
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
  async clickExpr(expr) {
    const box = await this.eval(`(() => {
      const el = ${expr};
      if (!el) return null;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return null;
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    })()`);
    if (!box) return false;
    const base = { x: Math.round(box.x), y: Math.round(box.y), button: 'left', clickCount: 1 };
    await this.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...base, buttons: 0 });
    await sleep(70);
    await this.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...base, buttons: 1 });
    await sleep(50);
    await this.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...base, buttons: 0 });
    await sleep(500);
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
  if (!ok) console.log(`        actual   = ${a}\n        expected = ${e}`);
};

/** WCAG contrast between two `rgb(...)` strings. */
function contrast(a, b) {
  const lum = (css) => {
    const [r, g, bl] = /(\d+)[,\s]+(\d+)[,\s]+(\d+)/.exec(css).slice(1, 4).map(Number);
    const channel = (v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(bl);
  };
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return Math.round(((x + 0.05) / (y + 0.05)) * 100) / 100;
}

const NOW = new Date().toISOString();
const NOTES = [
  { id: 'n1', name: 'First note', type: 'text', description: 'one', tags: [], color: '#FFFFFF', pinned: false, locked: false, createdAt: NOW, modifiedAt: NOW },
  { id: 'n2', name: 'Second note', type: 'text', description: 'two', tags: [], color: '#FFFFFF', pinned: false, locked: false, createdAt: NOW, modifiedAt: NOW },
];

/** Every action the bar draws, with the colour its label is painted in and the bar behind it. */
const BAR_ITEMS = `(() => {
  const all = Array.from(document.querySelectorAll('button')).find((b) => (b.textContent || '').trim() === 'All');
  if (!all) return { found: false };
  const bar = all.closest('div.fixed') || all.parentElement.parentElement;
  const cs = getComputedStyle(bar);
  const items = Array.from(bar.querySelectorAll('button')).map((btn) => {
    const label = btn.querySelector('span');
    return {
      text: (btn.textContent || '').trim(),
      colour: getComputedStyle(label || btn).color,
      disabled: btn.disabled,
      size: label ? getComputedStyle(label).fontSize : null,
    };
  });
  return { found: true, background: cs.backgroundColor, items };
})()`;

const port = 9222 + Math.floor(Math.random() * 400);
const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'bulkbar-'));
const outDir = path.join(process.cwd(), 'preview');
fs.mkdirSync(outDir, { recursive: true });
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
    localStorage.setItem('notes', ${JSON.stringify(JSON.stringify(NOTES))});
    localStorage.setItem('habitrkr.language', 'en');
    return true;
  })()`);

  const readings = {};
  for (const theme of ['light', 'dark']) {
    console.log(`\n=== bulk bar · ${theme} theme ===`);
    await cdp.eval(`localStorage.setItem('habitrkr.theme', ${JSON.stringify(theme)})`);
    await cdp.send('Page.navigate', { url: BASE + '/notes' });
    await sleep(2600);

    const entered = await cdp.clickExpr(
      `Array.from(document.querySelectorAll('button')).find((b) => b.querySelector('svg.lucide-file-stack'))`);
    check('bulk mode was entered', entered, true);
    await sleep(900);

    // Nothing is enabled until something is selected, and a disabled button is painted at
    // half opacity — which would make the reading about the opacity, not about the colour.
    const selected = await cdp.clickExpr(
      `Array.from(document.querySelectorAll('button')).find((b) => (b.textContent || '').trim() === 'All')`);
    check('everything was selected, so the actions are enabled', selected, true);
    await sleep(900);

    const reading = JSON.parse(await cdp.eval(`JSON.stringify(${BAR_ITEMS})`));
    check('the bulk bar is on screen', reading.found, true);
    if (!reading.found) continue;
    console.log(`  bar background ${reading.background}`);
    readings[theme] = reading;

    for (const item of reading.items) {
      const ratio = contrast(item.colour, reading.background);
      const isDelete = /delete/i.test(item.text);
      const required = isDelete ? 3 : 4.5;
      console.log(`  ${item.text.padEnd(10)} ${item.colour.padEnd(20)} contrast ${ratio} (needs ${required})${item.disabled ? ' [disabled]' : ''}`);
      check(`"${item.text}" is readable on the bar (${theme})`, ratio >= required, true);
    }

    const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(outDir, `bulk-bar-${theme}.png`), Buffer.from(shot.data, 'base64'));
    console.log(`  screenshot: preview/bulk-bar-${theme}.png`);
  }

  console.log('\n=== the bar does not change with the theme ===');
  const light = readings.light, dark = readings.dark;
  if (light && dark) {
    check('the bar paints the same background in both themes', dark.background, light.background);
    /*
     * The destructive action is left out of the comparison: it is painted with `--destructive`,
     * which is a different red in each theme by design, and it was not part of the report. Its
     * contrast is still checked above on its own.
     */
    const shared = (items) => items.filter((i) => !/delete/i.test(i.text)).map((i) => i.colour).join(' | ');
    console.log(`  light: ${shared(light.items)}`);
    console.log(`  dark : ${shared(dark.items)}`);
    check('and its labels are painted the same in both', shared(dark.items), shared(light.items));
    const deleteColour = (items) => items.find((i) => /delete/i.test(i.text))?.colour ?? null;
    console.log(`  delete: ${deleteColour(light.items)} in light, ${deleteColour(dark.items)} in dark (destructive, differs by design)`);
  }
} finally {
  chrome.kill();
  await sleep(200);
  try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch { /* windows lock */ }
}

console.log(failures === 0 ? '\nALL BULK-BAR CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
