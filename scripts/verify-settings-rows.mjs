/**
 * Checks the settings rows on the profile screen, where a switch sits inside a row.
 *
 * The defect: every row rendered as a `<button>`, so the Theme and Notifications rows put
 * their switch — itself a button — inside a button. That is invalid HTML (React reported it
 * on every visit) and it made the two handlers run off the same click, setting the value
 * twice.
 *
 * Three things are measured, because "no warning in the console" alone would not notice a
 * row that stopped responding:
 *   - no button contains another button anywhere on the screen;
 *   - a click on the switch changes the setting exactly once;
 *   - a click on the label still changes it, and a row without a control still opens its
 *     dialog.
 *
 * Usage: node scripts/verify-settings-rows.mjs
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
    this.ws = ws; this.nextId = 1; this.pending = new Map(); this.errors = [];
    ws.addEventListener('message', (e) => {
      const m = JSON.parse(e.data);
      if (m.id && this.pending.has(m.id)) {
        const { resolve, reject } = this.pending.get(m.id);
        this.pending.delete(m.id);
        m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result);
      }
      if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
        this.errors.push(m.params.args.map((a) => a.value ?? a.description ?? '').join(' ').split('\n')[0].slice(0, 160));
      }
      if (m.method === 'Runtime.exceptionThrown') {
        this.errors.push('exception: ' + (m.params.exceptionDetails?.exception?.description || '').split('\n')[0].slice(0, 160));
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
  async clickAt(x, y) {
    const base = { x: Math.round(x), y: Math.round(y), button: 'left', clickCount: 1 };
    await this.send('Input.dispatchMouseEvent', { type: 'mouseMoved', ...base, buttons: 0 });
    await sleep(70);
    await this.send('Input.dispatchMouseEvent', { type: 'mousePressed', ...base, buttons: 1 });
    await sleep(50);
    await this.send('Input.dispatchMouseEvent', { type: 'mouseReleased', ...base, buttons: 0 });
    await sleep(500);
  }
  /** Clicks the first element matching `expr`, by its centre. */
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
  if (!ok) console.log(`        actual   = ${a}\n        expected = ${e}`);
};

/** The row that carries a given label. */
const ROW = (label) => `Array.from(document.querySelectorAll('button, div.flex.items-center.justify-between'))
  .find((el) => (el.textContent || '').includes(${JSON.stringify(label)}) && el.querySelector('span.text-sm.font-medium'))`;

const port = 9222 + Math.floor(Math.random() * 400);
const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'settings-'));
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
    localStorage.setItem('habitrkr.theme', 'light');
    localStorage.setItem('habitrkr.language', 'en');
    localStorage.setItem('toasts-enabled', 'true');
    return true;
  })()`);
  await cdp.send('Page.navigate', { url: BASE + '/profile' });
  await sleep(2600);
  cdp.errors = [];

  console.log('=== the structure ===');
  const nested = await cdp.eval(`(() => {
    const inside = Array.from(document.querySelectorAll('button button'));
    return { count: inside.length,
      where: inside.slice(0, 3).map((b) => (b.getAttribute('role') || b.tagName) + ' in ' + (b.closest('button').textContent || '').trim().slice(0, 30)) };
  })()`);
  console.log(`  buttons inside buttons: ${nested.count}${nested.count ? ' -> ' + JSON.stringify(nested.where) : ''}`);
  check('no button sits inside another button', nested.count, 0);

  console.log('\n=== the switches ===');
  const themeSwitch = `document.querySelector('[role="switch"]')`;
  check('the theme switch is on screen', await cdp.eval(`Boolean(${themeSwitch})`), true);
  console.log(`  theme before: ${await cdp.eval(`localStorage.getItem('habitrkr.theme')`)}`);
  await cdp.clickExpr(themeSwitch);
  const afterSwitch = await cdp.eval(`localStorage.getItem('habitrkr.theme')`);
  console.log(`  theme after clicking the switch: ${afterSwitch}`);
  check('clicking the switch changes the theme once, not twice', afterSwitch, 'dark');

  const themeRow = `${ROW('Theme')}`;
  await cdp.clickExpr(themeRow);
  const afterRow = await cdp.eval(`localStorage.getItem('habitrkr.theme')`);
  console.log(`  theme after clicking the row: ${afterRow}`);
  check('clicking the row still changes it back', afterRow, 'light');

  const toastsSwitch = `Array.from(document.querySelectorAll('[role="switch"]'))[1]`;
  const beforeToasts = await cdp.eval(`localStorage.getItem('toasts-enabled')`);
  await cdp.clickExpr(toastsSwitch);
  const afterToasts = await cdp.eval(`localStorage.getItem('toasts-enabled')`);
  console.log(`  notifications: ${beforeToasts} -> ${afterToasts}`);
  check('the notifications switch also changes once', afterToasts, 'false');

  console.log('\n=== a row with no control ===');
  // Photographed with nothing open: the point is the rows themselves.
  const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(outDir, 'profile-settings-rows.png'), Buffer.from(shot.data, 'base64'));
  console.log('  screenshot: preview/profile-settings-rows.png');

  const opened = await cdp.clickExpr(`${ROW('Language')}`);
  await sleep(600);
  check('the Language row was clicked', opened, true);
  const dialog = await cdp.eval(`Boolean(document.querySelector('[role="dialog"]'))`);
  console.log(`  a dialog opened: ${dialog}`);
  check('it still opens its dialog', dialog, true);

  console.log('');
  check('the screen logs nothing', cdp.errors, []);
} finally {
  chrome.kill();
  await sleep(200);
  try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch { /* windows lock */ }
}

console.log(failures === 0 ? '\nALL SETTINGS-ROW CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
