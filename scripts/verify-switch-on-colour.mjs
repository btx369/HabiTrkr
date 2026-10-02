/**
 * Checks the colour a switch paints when it is ON.
 *
 * The fill was briefly a saturated blue borrowed from the references, but the app's own
 * filled controls are black, so the blue read as an import. Every switch goes through one
 * component; this asserts the rendered result rather than trusting that.
 *
 * The dark theme deliberately inverts the fill to near-white. A black track on a 7%
 * lightness page is invisible, which would leave an ON switch looking like a stray dot
 * beside nothing.
 *
 * Usage:
 *   node scripts/verify-switch-on-colour.mjs            # light
 *   THEME=dark node scripts/verify-switch-on-colour.mjs # dark
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
    if (r.exceptionDetails) throw new Error(res.exceptionDetails.exception?.description ?? 'eval failed');
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

/** Read a computed `rgb(...)` into its parts, or null when it is not a colour. */
function rgb(css) {
  const m = /rgba?\(([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?/.exec(css || '');
  if (!m) return null;
  const [r, g, b] = [Number(m[1]), Number(m[2]), Number(m[3])];
  return { r, g, b, a: m[4] === undefined ? 1 : Number(m[4]), light: (r + g + b) / 3 };
}

const NOW = new Date().toISOString();
const NOTES = [
  { id: 'note-a', type: 'text', name: 'Groceries', description: 'milk and bread', tags: ['work'], items: [], color: 'default', locked: false, createdAt: NOW, modifiedAt: NOW },
];

const port = 9330 + Math.floor(Math.random() * 400);
const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'switch-'));
const outDir = path.join(process.cwd(), 'preview');
fs.mkdirSync(outDir, { recursive: true });
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

  // The theme is read with `getLocalStorageString`, so the key holds a RAW string.
  await cdp.eval(`(() => {
    for (const k of ['notes','archivedNotes','folders','archivedFolders','habits','archivedHabits']) localStorage.removeItem(k);
    localStorage.setItem('notes', ${JSON.stringify(JSON.stringify(NOTES))});
    localStorage.setItem('habitrkr.theme', ${JSON.stringify(THEME)});
    return true;
  })()`);
  await cdp.send('Page.navigate', { url: BASE + '/profile' });
  await sleep(3200);

  const settled = await cdp.eval(`document.documentElement.className`);
  console.log(`theme requested: ${THEME}  ->  ${settled}`);
  if (!settled.includes(THEME)) {
    console.error('  !  the requested palette did not apply; colours would be misleading');
    process.exitCode = 1;
  }

  const mouseClick = async (x, y) => {
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, buttons: 0 });
    await sleep(120);
    await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 });
    await sleep(70);
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1 });
    await sleep(700); // let transition-colors settle before sampling
  };

  /** Every switch on screen, with the colour of its track, border and knob. */
  const readSwitches = async () => JSON.parse(await cdp.eval(`JSON.stringify(
    Array.from(document.querySelectorAll('button[role="switch"]')).map(el => {
      const cs = getComputedStyle(el);
      const knob = el.querySelector('span');
      const r = el.getBoundingClientRect();
      return {
        state: el.getAttribute('data-state'),
        track: cs.backgroundColor,
        border: cs.borderTopColor,
        knob: knob ? getComputedStyle(knob).backgroundColor : null,
        x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2),
      };
    }))`));

  const switches = await readSwitches();
  console.log(`\n=== ${switches.length} switch(es) on /profile ===`);
  for (const s of switches) console.log(`  ${s.state.padEnd(7)} track=${s.track}  border=${s.border}  knob=${s.knob}`);
  check('the page rendered switches to inspect', switches.length > 0, true);

  /**
   * The first row on this page is the theme picker, and switching it on repaints the whole
   * page — which silently turned a "light mode" run into a dark one and made every colour
   * assertion below meaningless. It is identified by its label and left alone.
   */
  const withLabels = JSON.parse(await cdp.eval(`JSON.stringify(
    Array.from(document.querySelectorAll('button[role="switch"]')).map(el => {
      const row = el.closest('div')?.parentElement;
      return { label: (row ? row.innerText : '').replace(/\\s+/g, ' ').trim().slice(0, 30) };
    }))`));
  const themeRowIndex = withLabels.findIndex((w) => /theme|tema/i.test(w.label));
  console.log(`  row labels: ${JSON.stringify(withLabels.map((w) => w.label))}`);
  console.log(`  theme picker is row ${themeRowIndex} — it will not be switched`);
  check('the theme picker was identified and excluded', themeRowIndex >= 0, true);

  const isThemeRow = (i) => i === themeRowIndex;

  // Turn the rest ON, so the checked colour is measured from the rendered page.
  for (let i = 0; i < switches.length; i++) {
    if (isThemeRow(i)) continue;
    if (switches[i].state !== 'checked') await mouseClick(switches[i].x, switches[i].y);
  }
  const all = await readSwitches();
  const on = all.filter((s, i) => s.state === 'checked' && !isThemeRow(i));
  console.log(`\n--- after switching the non-theme rows on (${on.length} checked) ---`);
  for (const s of on) {
    const c = rgb(s.track);
    console.log(`  track=${s.track}  light=${c ? c.light.toFixed(1) : 'n/a'}  knob=${s.knob}`);
  }
  check('every non-theme switch is now ON', on.length, switches.length - 1);

  const onColour = rgb(on[0].track);
  check('the ON fill is opaque, not a tint', onColour.a, 1);
  // Every switch must agree, or one of them carries its own colour override.
  const distinct = new Set(on.map((s) => s.track));
  check('all switches paint the same ON colour', distinct.size, 1);

  // Capture while they are ON: the point of the change is the ON fill, and a shot taken
  // after they are switched back off would show the one state that did not change.
  const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
  const file = path.join(outDir, `switch-on-${THEME}.png`);
  fs.writeFileSync(file, Buffer.from(shot.data, 'base64'));
  console.log(`\nscreenshot (switches ON): ${file}`);

  if (THEME === 'light') {
    check('the ON fill is near-black in light mode', onColour.light < 40, true);
    check('it is neutral, not tinted',
      Math.max(onColour.r, onColour.g, onColour.b) - Math.min(onColour.r, onColour.g, onColour.b) <= 6, true);
    const knob = rgb(on[0].knob);
    console.log(`  knob light=${knob.light.toFixed(1)}`);
    check('the knob is light against the dark fill', knob.light > 200, true);
    // The page must still be the one that was asked for.
    const cls = await cdp.eval(`document.documentElement.className`);
    check('toggling those switches did not change the theme', cls.includes(THEME), true);
  } else {
    // On a 7% lightness page a black track would disappear, so the fill inverts.
    const pageCss = await cdp.eval(`getComputedStyle(document.body).backgroundColor`);
    const page = rgb(pageCss);
    console.log(`  page=${pageCss} light=${page.light.toFixed(1)}`);
    check('the ON fill is light in dark mode', onColour.light > 200, true);
    check('and clearly lighter than the page behind it', onColour.light - page.light > 100, true);
    const knob = rgb(on[0].knob);
    console.log(`  knob light=${knob.light.toFixed(1)}`);
    check('the knob is dark against the light fill', knob.light < 60, true);
  }

  // Off must stay visually distinct, or the two states cannot be told apart.
  const beforeOff = await readSwitches();
  for (let i = 0; i < beforeOff.length; i++) {
    if (isThemeRow(i)) continue;
    if (beforeOff[i].state === 'checked') await mouseClick(beforeOff[i].x, beforeOff[i].y);
  }
  const off = (await readSwitches()).filter((s, i) => s.state === 'unchecked' && !isThemeRow(i));
  console.log(`\n--- after switching the non-theme rows off (${off.length} unchecked) ---`);
  for (const s of off) console.log(`  track=${s.track}`);
  check('every non-theme switch is now OFF', off.length, switches.length - 1);
  const offColour = rgb(off[0].track);
  check('OFF is clearly different from ON', Math.abs(offColour.light - onColour.light) > 60, true);
} finally {
  chrome.kill();
  await sleep(200);
  try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch { /* windows lock */ }
}

console.log(failures === 0 ? '\nALL SWITCH-COLOUR CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
