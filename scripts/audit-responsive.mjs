/**
 * Responsive audit: captures every route at phone / tablet / desktop sizes with
 * realistic seeded data, so layout decisions can be judged against a populated app
 * rather than an empty state.
 *
 * ## Why CDP instead of `--screenshot`
 *
 * Two things are impossible with plain `--screenshot`:
 *   1. Seeding localStorage, so screenshots show real cards, grids and charts.
 *   2. A true viewport. `--window-size` sets the *window*; on some platforms the
 *      page then lays out wider than the requested width and the capture clips the
 *      right-hand side, which looks like a layout bug but is not one.
 *
 * So this connects to Chrome's DevTools Protocol over WebSocket (Node 22+ ships a
 * global WebSocket), sets `Emulation.setDeviceMetricsOverride` for an exact
 * viewport, seeds storage via `Runtime.evaluate`, then uses `Page.captureScreenshot`.
 *
 * Usage:
 *   node scripts/audit-responsive.mjs                    # all routes, all widths
 *   node scripts/audit-responsive.mjs /notes             # one route
 *   node scripts/audit-responsive.mjs /notes tablet      # one route, one viewport
 *   node scripts/audit-responsive.mjs --dark             # dark theme
 *
 * Output: .screenshots/ (gitignored)
 */

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { buildSeed } from './lib/demo-data.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

const BASE = process.env.BASE_URL ?? 'http://localhost:8080';

const VIEWPORTS = {
  phone: { width: 390, height: 844, mobile: true, label: '390x844 phone' },
  tablet: { width: 834, height: 1112, mobile: true, label: '834x1112 tablet' },
  desktop: { width: 1440, height: 900, mobile: false, label: '1440x900 desktop' },
};

const ALL_ROUTES = ['/', '/notes', '/events', '/calendar', '/profile', '/tags', '/tasks'];

const argv = process.argv.slice(2);
const dark = argv.includes('--dark');
const positional = argv.filter((a) => !a.startsWith('--'));
const routes = positional[0] ? [positional[0]] : ALL_ROUTES;
const viewportNames = positional[1] ? [positional[1]] : Object.keys(VIEWPORTS);

for (const v of viewportNames) {
  if (!VIEWPORTS[v]) {
    console.error(`Unknown viewport "${v}". Options: ${Object.keys(VIEWPORTS).join(', ')}`);
    process.exit(1);
  }
}

const CHROME = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find((p) => fs.existsSync(p));
if (!CHROME) {
  console.error('No Chrome/Edge binary found.');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Minimal CDP client
// ---------------------------------------------------------------------------
class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.nextId = 1;
    this.pending = new Map();
    ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
      }
    });
  }

  send(method, params = {}) {
    const id = this.nextId++;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`CDP timeout: ${method}`));
        }
      }, 30000);
    });
  }

  /** Evaluates an expression in the page and returns its JSON value. */
  async eval(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (res.exceptionDetails) {
      throw new Error('page eval failed: ' + JSON.stringify(res.exceptionDetails.exception?.description ?? res.exceptionDetails));
    }
    return res.result?.value;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getWsUrl(port, attempts = 40) {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/list`);
      const targets = await res.json();
      const page = targets.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
      if (page) return page.webSocketDebuggerUrl;
    } catch {
      /* not up yet */
    }
    await sleep(250);
  }
  throw new Error('Could not reach Chrome DevTools endpoint');
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------
const OUT = path.join(root, '.screenshots');
fs.mkdirSync(OUT, { recursive: true });

const port = 9222 + Math.floor(Math.random() * 500);
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-'));

const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--hide-scrollbars',
    '--no-first-run',
    '--disable-extensions',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    'about:blank',
  ],
  { stdio: 'ignore' },
);

let exitCode = 0;

try {
  const wsUrl = await getWsUrl(port);
  const ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', reject, { once: true });
  });

  const cdp = new Cdp(ws);
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');

  // --- seed storage once, on the app's own origin ---------------------------
  await cdp.send('Page.navigate', { url: BASE + '/' });
  await sleep(2500);

  const seed = buildSeed({ dark });
  const seeded = await cdp.eval(`(() => {
    const data = ${JSON.stringify(seed)};
    let n = 0;
    for (const [k, v] of Object.entries(data)) {
      localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
      n++;
    }
    return n;
  })()`);
  console.log(`seeded ${seeded} localStorage keys (theme: ${dark ? 'dark' : 'light'})`);

  // Reload so the app hydrates from the seeded storage.
  await cdp.send('Page.reload', { ignoreCache: false });
  await sleep(2500);

  const counts = await cdp.eval(`JSON.stringify({
    habits: JSON.parse(localStorage.getItem('habits') || '[]').length,
    notes: JSON.parse(localStorage.getItem('notes') || '[]').length,
    events: JSON.parse(localStorage.getItem('events') || '[]').length,
  })`);
  console.log(`storage after reload: ${counts}\n`);

  const slug = (r) => (r === '/' ? 'home' : r.replace(/^\//, '').replace(/\//g, '-'));
  const suffix = dark ? '-dark' : '';

  let shots = 0;
  for (const name of viewportNames) {
    const vp = VIEWPORTS[name];
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: vp.width,
      height: vp.height,
      deviceScaleFactor: 1,
      mobile: vp.mobile,
    });

    for (const route of routes) {
      await cdp.send('Page.navigate', { url: BASE + route });

      // Wait until the app has actually settled before capturing. A fixed sleep is not
      // enough: React only writes the theme class to <html> once it mounts, and a
      // screenshot taken before that silently renders in the wrong theme — which makes
      // a themed page look like it ignores the setting when it does not.
      const readiness = await cdp.eval(`(async () => {
        const started = Date.now();
        const wantTheme = ${JSON.stringify(dark ? 'dark' : 'light')};
        while (Date.now() - started < 10000) {
          const cls = document.documentElement.className;
          const mounted = (document.getElementById('root')?.innerHTML.length ?? 0) > 0;
          if (mounted && cls.includes(wantTheme)) return 'ready:' + (Date.now() - started) + 'ms';
          await new Promise((r) => setTimeout(r, 100));
        }
        return 'timeout:class="' + document.documentElement.className + '"';
      })()`);
      if (String(readiness).startsWith('timeout')) {
        console.log(`  !  ${slug(route)} @ ${name}: theme never settled (${readiness})`);
      }

      const png = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
      const file = path.join(OUT, `${slug(route)}--${name}${suffix}.png`);
      fs.writeFileSync(file, Buffer.from(png.data, 'base64'));

      // Report the layout width the app actually used, to catch horizontal overflow.
      const metrics = await cdp.eval(`JSON.stringify({
        viewport: window.innerWidth,
        docWidth: document.documentElement.scrollWidth,
        overflow: document.documentElement.scrollWidth > window.innerWidth,
      })`);

      const m = JSON.parse(metrics);
      const flag = m.overflow ? `  <-- HORIZONTAL OVERFLOW (doc ${m.docWidth} > vp ${m.viewport})` : '';
      console.log(
        `ok  ${slug(route).padEnd(10)} ${name.padEnd(8)} ${vp.label.padEnd(18)} ` +
          `${(fs.statSync(file).size / 1024).toFixed(0)} KB${flag}`,
      );
      shots++;
      if (m.overflow) exitCode = 0; // overflow is reported, not fatal
    }
  }

  console.log(`\n${shots} screenshot(s) in .screenshots/`);
  ws.close();
} catch (err) {
  console.error('audit failed:', err.message);
  exitCode = 1;
} finally {
  chrome.kill();
  await sleep(300);
  try {
    fs.rmSync(profile, { recursive: true, force: true });
  } catch {
    /* profile may still be locked on Windows */
  }
}

process.exit(exitCode);
