/**
 * Measures the hover feedback on the editor's Cancel and Save buttons, in both themes.
 *
 * Reports the computed background before and while hovered, so "the hover does nothing"
 * can be replaced with a number.
 *
 * Usage:
 *   node scripts/verify-editor-button-hover.mjs
 *   THEME=dark node scripts/verify-editor-button-hover.mjs
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const BASE = process.env.BASE_URL ?? 'http://localhost:8080';
const THEME = process.env.THEME === 'dark' ? 'dark' : 'light';
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

/** Average channel value and how it moves, as a percentage of the original. */
function level(css) {
  const m = /rgba?\(([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/.exec(css || '');
  if (!m) return null;
  return (Number(m[1]) + Number(m[2]) + Number(m[3])) / 3;
}

let failures = 0;
const check = (label, actual, expected) => {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  const ok = a === e;
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`);
  if (!ok) console.log(`        actual   = ${a}\n        expected = ${e}`);
};

const port = 9222 + Math.floor(Math.random() * 400);
const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'btnhover-'));
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

  await cdp.send('Page.navigate', { url: BASE + '/' });
  await sleep(2500);
  await cdp.eval(`localStorage.setItem('habitrkr.theme', ${JSON.stringify(THEME)}); true`);
  await cdp.send('Page.navigate', { url: BASE + '/events' });
  await sleep(3200);

  const settled = await cdp.eval(`document.documentElement.className`);
  console.log(`theme: ${THEME} -> ${settled}`);
  if (!settled.includes(THEME)) { console.error('  ! palette did not apply'); process.exitCode = 1; }

  // Open the create-event dialog.
  const box = JSON.parse(await cdp.eval(`(() => {
    const b = Array.from(document.querySelectorAll('button')).find(x => {
      const s = x.querySelector('svg');
      return s && String(s.getAttribute('class') || '').includes('plus');
    });
    const r = b.getBoundingClientRect();
    return JSON.stringify({ x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) });
  })()`));
  const click = async (x, y) => {
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, buttons: 0 });
    await sleep(120);
    await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 });
    await sleep(70);
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1 });
    await sleep(1000);
  };
  await click(box.x, box.y);
  check('the editor opened', await cdp.eval(`!!document.querySelector('[role="dialog"]')`), true);

  const park = () => cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 2, y: 2, buttons: 0 });

  /**
   * Reads a footer button at rest and under a real pointer.
   *
   * Both the computed `background-color` AND whether the element actually matched `:hover`
   * are reported. The pair is what makes this diagnostic rather than merely suggestive: an
   * empty alpha delta with `:hover` true means a rule is outranking the hover (which is
   * exactly what `dark:bg-muted` was doing); `:hover` false means the pointer never
   * arrived. Reporting only the colour cannot tell those two apart.
   */
  const readButton = (label) => cdp.eval(`JSON.stringify((() => {
    const d = document.querySelector('[role="dialog"]');
    const b = Array.from(d.querySelectorAll('button')).find(x => (x.textContent || '').trim() === ${JSON.stringify(label)});
    if (!b) return { error: 'not found' };
    const r = b.getBoundingClientRect();
    return {
      bg: getComputedStyle(b).backgroundColor,
      border: getComputedStyle(b).borderTopColor,
      hovered: b.matches(':hover'),
      disabled: b.disabled,
      x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2),
      cls: String(b.className).split(' ').filter(c => /hover|bg-|dark:/.test(c)).join(' '),
    };
  })())`).then(JSON.parse);

  /** Level of the painted colour *including* alpha, which is what the eye receives. */
  const painted = (css) => {
    const m = /rgba?\(([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?/.exec(css || '');
    if (!m) return null;
    const [r, g, b] = [Number(m[1]), Number(m[2]), Number(m[3])];
    const a = m[4] === undefined ? 1 : Number(m[4]);
    return { level: ((r + g + b) / 3), alpha: a };
  };

  const probe = async (label) => {
    await park();
    await sleep(400);
    const rest = await readButton(label);
    if (rest.error) { console.log(`  ${label}: not found`); return null; }
    const restPainted = painted(rest.bg);

    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: rest.x, y: rest.y, buttons: 0 });
    await sleep(700); // let transition-colors settle
    const hov = await readButton(label);
    const hovPainted = painted(hov.bg);

    // A hover veil keeps the same RGB and changes only the alpha, so the opacity is part
    // of the measurement. "Did anything change" is the question, not "did it get darker".
    const rgbChanged = rest.bg.replace(/[\d.]+\)$/, '') !== hov.bg.replace(/[\d.]+\)$/, '');
    const alphaChanged = Math.abs((hovPainted?.alpha ?? 1) - (restPainted?.alpha ?? 1)) > 0.01;
    const changed = rgbChanged || alphaChanged;

    console.log(`\n  ${label}`);
    console.log(`    classes : ${rest.cls}`);
    console.log(`    rest    : ${rest.bg}  hover-flag=${rest.hovered}  disabled=${rest.disabled}`);
    console.log(`    hovered : ${hov.bg}  hover-flag=${hov.hovered}`);
    console.log(`    change  : ${changed ? (rgbChanged ? 'colour' : 'alpha') + ' changed' : 'NOTHING CHANGED'}`);
    return { label, rest, hov, changed, hoverReached: hov.hovered };
  };

  console.log('\n=== footer button hover ===');
  const cancel = await probe('Cancel');
  const save = await probe('Create Event');

  // The save button is disabled until a title is typed, and a disabled element has no
  // hover either. Give it a title first so the measurement is of an enabled button.
  console.log('\n=== with a title typed, so Save is enabled ===');
  await cdp.send('Input.insertText', { text: 'Test' });
  await sleep(300);
  const titleBox = JSON.parse(await cdp.eval(`(() => {
    const d = document.querySelector('[role="dialog"]');
    const i = Array.from(d.querySelectorAll('input')).find(x => (x.id || '').includes('event-name')) || d.querySelector('input');
    if (!i) return 'null';
    const r = i.getBoundingClientRect();
    return JSON.stringify({ x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) });
  })()`));
  await click(titleBox.x, titleBox.y);
  await cdp.send('Input.insertText', { text: 'Test Event' });
  await sleep(500);
  const save2 = await probe('Create Event');

  console.log('\n=== verdict ===');
  for (const r of [cancel, save, save2].filter(Boolean)) {
    console.log(`  ${r.label.padEnd(14)} pointer reached: ${r.hoverReached}   changed: ${r.changed}`);
  }
  // The complaint was that these do nothing in dark mode. Assert a real change, and
  // assert separately that the pointer arrives, so a failure says which of the two broke.
  for (const r of [cancel, save2].filter(Boolean)) {
    check(`${r.label}: the pointer reached it`, r.hoverReached, true);
    check(`${r.label}: it reacts to the pointer`, r.changed, true);
  }
} finally {
  chrome.kill();
  await sleep(200);
  try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch { /* windows lock */ }
}

console.log(failures === 0 ? '\nDONE' : `\n${failures} CHECK(S) FAILED`);
process.exit(process.exitCode ?? (failures === 0 ? 0 : 1));
