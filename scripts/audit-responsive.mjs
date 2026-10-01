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
 * ## Hover mode
 *
 * `--hover` skips screenshots and instead measures the real hover feedback of every
 * interactive element on each route: it records the element's computed background,
 * dispatches a genuine mouse move over it via `Input.dispatchMouseEvent`, and reads
 * the background again. Several bugs in this codebase were invisible to every other
 * kind of check:
 *   - a class that Tailwind never compiled (`hover:bg-foreground/6`), so the element
 *     had no hover at all while the source *looked* correct;
 *   - a broken arbitrary variant (`[@media_(hover:_hover)]:`) that silently compiled
 *     to nothing;
 *   - a hardcoded colour overriding the theme token underneath it.
 * In all three cases the source read fine and the pixels were wrong, so the only
 * trustworthy signal is the computed style before vs. after a real pointer event.
 *
 * ## Active mode
 *
 * `--active` finds the opposite class of bug: a control that says it has a state but does
 * not look any different in it. It walks every element carrying a state attribute
 * (`data-state`, `aria-pressed`, `aria-checked`, `aria-selected`, `aria-expanded`), asks
 * the loaded stylesheets whether ANY rule keys off that attribute, flips the attribute in
 * the live DOM, and compares the computed style before and after.
 *
 * That catches the bug found in the note action bar, where Text Format reported its state
 * through `data-state="open"` — an attribute only Radix triggers ever set, so on a plain
 * button the rule never fired and the button never filled. Reading the source would not
 * have shown it, because the source looked correct.
 *
 * Usage:
 *   node scripts/audit-responsive.mjs                    # all routes, all widths
 *   node scripts/audit-responsive.mjs /notes             # one route
 *   node scripts/audit-responsive.mjs /notes tablet      # one route, one viewport
 *   node scripts/audit-responsive.mjs --dark             # dark theme
 *   node scripts/audit-responsive.mjs --hover            # hover report, all routes
 *   node scripts/audit-responsive.mjs /profile --hover   # hover report, one route
 *   node scripts/audit-responsive.mjs --active           # active-state report, all routes
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
const hoverMode = argv.includes('--hover');
const activeMode = argv.includes('--active');
const positional = argv.filter((a) => !a.startsWith('--'));
const routes = positional[0] ? [positional[0]] : ALL_ROUTES;
// Hover feedback is a function of the pointer, not of the container width, so the
// hover report only needs a single desktop pass. Same for state.
const viewportNames = positional[1] ? [positional[1]] : hoverMode || activeMode ? ['desktop'] : Object.keys(VIEWPORTS);

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

/**
 * Page-side collector for --hover, run once per scroll position.
 *
 * It deliberately only accepts elements that are *fully* inside the viewport. An
 * element clipped by the fold still reports a colour, but the pointer cannot be aimed
 * at its centre, so the measurement would describe whatever happened to be on top
 * instead — a silent source of wrong numbers.
 */
const HOVER_COLLECT = `(() => {
  const out = [];
  document.querySelectorAll('*').forEach((el) => {
    const hoverClasses = [...el.classList].filter((c) => c.startsWith('hover:bg-'));
    if (!hoverClasses.length) return;

    const r = el.getBoundingClientRect();
    if (r.width < 8 || r.height < 8) return;
    if (r.top < 4 || r.left < 0 || r.bottom > innerHeight - 4 || r.right > innerWidth) return;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return;
    if (el.closest('[aria-hidden="true"]')) return;
    // pointer-events:none makes hover physically unreachable: the FAB carries it while
    // it is hiding on scroll. Measuring such an element reports "no change", which is
    // true but says nothing about its styling, so skip it rather than report it.
    if (cs.pointerEvents === 'none' || el.closest('[inert]')) return;

    const text = (el.getAttribute('aria-label') || el.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 28);
    // Resolve the colour actually painted underneath this element by walking up to the
    // nearest opaque ancestor. Compositing against the page background instead reports a
    // translucent hover over a card as "no change", because the card — not the page — is
    // what the eye sees through it.
    let backdrop = 'rgba(0, 0, 0, 0)';
    for (let n = el.parentElement; n; n = n.parentElement) {
      const c = getComputedStyle(n).backgroundColor;
      const a = /rgba?\\([^)]*,\\s*([\\d.]+)\\)/.exec(c);
      const alpha = a ? parseFloat(a[1]) : (c.startsWith('rgb(') ? 1 : 0);
      if (alpha >= 0.99) { backdrop = c; break; }
    }
    out.push({
      sig: hoverClasses.join(' ') + '#' + el.tagName + '#' + text,
      tag: el.tagName.toLowerCase(),
      label: text,
      cls: hoverClasses.join(' '),
      base: cs.backgroundColor,
      backdrop,
    });
  });
  return JSON.stringify(out);
})()`;

/** Locates one collected element, scrolls it into view and returns an aimable point. */
const HOVER_AIM = (sig) => `(() => {
  const want = ${JSON.stringify(sig)};
  const key = (e) => [...e.classList].filter((c) => c.startsWith('hover:bg-')).join(' ') + '#' + e.tagName + '#' +
    (e.getAttribute('aria-label') || e.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 28);
  document.querySelectorAll('[data-hovprobe]').forEach((e) => e.removeAttribute('data-hovprobe'));
  const el = [...document.querySelectorAll('[class*="hover:bg-"]')].find((e) => key(e) === want);
  if (!el) return JSON.stringify({ found: false });
  el.setAttribute('data-hovprobe', '1');
  // Instant scrolling matters: with smooth scrolling the position read on the next line
  // is mid-flight, which then reads as "the page cannot scroll any further".
  el.scrollIntoView({ block: 'center', behavior: 'instant' });
  const r = el.getBoundingClientRect();
  return JSON.stringify({
    found: true,
    x: Math.round(r.left + Math.min(r.width / 2, 8)),
    y: Math.round(r.top + Math.min(r.height / 2, 8)),
    visible: r.top >= 4 && r.left >= 0 && r.bottom <= innerHeight - 4,
  });
})()`;

/** Reads the probed element's hovered background, tolerating a node that vanished. */
const HOVER_BG = `(() => {
  const el = document.querySelector('[data-hovprobe="1"]');
  if (!el) return 'GONE';
  return getComputedStyle(el).backgroundColor;
})()`;

/**
 * Waits until an element is actually hoverable.
 *
 * Scrolling is not neutral: the floating action button slides away and goes
 * `opacity: 0; pointer-events: none` in response to a downward scroll, so an element
 * collected while scrolling can be unhoverable by the time it is measured. Reading it
 * then reports a perfectly true "no colour change" that has nothing to do with its
 * styling. This waits for the element to be painted and interactive.
 */
const HOVER_SETTLED = `(() => {
  const el = document.querySelector('[data-hovprobe="1"]');
  if (!el) return 'GONE';
  const cs = getComputedStyle(el);
  if (parseFloat(cs.opacity) < 0.99) return 'FADING';
  if (cs.pointerEvents === 'none' || cs.visibility === 'hidden') return 'INERT';
  const r = el.getBoundingClientRect();
  if (r.width < 8 || r.height < 8) return 'COLLAPSED';
  const hit = document.elementFromPoint(Math.round(r.left + Math.min(r.width / 2, 8)), Math.round(r.top + Math.min(r.height / 2, 8)));
  if (hit !== el && !el.contains(hit) && !hit?.contains(el)) return 'COVERED';
  return 'READY';
})()`;

/** One scroll step of the app's own scroll container, or the document. */
const HOVER_SCROLL = (fraction) => `(() => {
  const el = document.querySelector('[class*="hover:bg-"]');
  let node = el, scroller = null;
  while (node && node !== document.body) {
    const cs = getComputedStyle(node);
    if (/(auto|scroll)/.test(cs.overflowY) && node.scrollHeight > node.clientHeight + 8) { scroller = node; break; }
    node = node.parentElement;
  }
  const target = scroller ?? document.scrollingElement;
  const before = target.scrollTop;
  // behavior:'instant' is required: with smooth scrolling the position read on the next
  // line is mid-flight, which then reads as "the page cannot scroll any further".
  target.scrollTo({ top: before + Math.round(innerHeight * ${fraction}), behavior: 'instant' });
  return JSON.stringify({ moved: target.scrollTop !== before, at: target.scrollTop, max: target.scrollHeight - target.clientHeight, inScroller: !!scroller });
})()`;

/** Rewinds to the top of the page. A previous route leaves the scroll position behind. */
const HOVER_REWIND = `(() => {
  const el = document.querySelector('[class*="hover:bg-"]');
  let node = el, scroller = null;
  while (node && node !== document.body) {
    const cs = getComputedStyle(node);
    if (/(auto|scroll)/.test(cs.overflowY) && node.scrollHeight > node.clientHeight + 8) { scroller = node; break; }
    node = node.parentElement;
  }
  (scroller ?? document.scrollingElement).scrollTo({ top: 0, behavior: 'instant' });
  return 1;
})()`;

/**
 * The colour actually painted behind everything.
 *
 * `document.body` is transparent in this app — the background lives on a `min-h-screen`
 * wrapper — so reading the body's background-yields `rgba(0,0,0,0)`. Compositing against
 * that makes every translucent hover compute to transparent, which then *prints* as
 * "0,0,0" and reads like a black element. Walk up until something is opaque.
 */
const PAGE_BG = `(() => {
  for (const el of [document.body, document.documentElement]) {
    const c = getComputedStyle(el).backgroundColor;
    const m = /rgba?\\([^)]*,\\s*([\\d.]+)\\)/.exec(c);
    const alpha = m ? parseFloat(m[1]) : (c.startsWith('rgb(') ? 1 : 0);
    if (alpha >= 0.99) return c;
  }
  for (const el of document.querySelectorAll('div,main,section')) {
    const c = getComputedStyle(el).backgroundColor;
    const m = /rgba?\\([^)]*,\\s*([\\d.]+)\\)/.exec(c);
    const alpha = m ? parseFloat(m[1]) : (c.startsWith('rgb(') ? 1 : 0);
    if (alpha >= 0.99) return c;
  }
  return 'rgb(255, 255, 255)';
})()`;

/** RGBA string -> [r, g, b, a]. */
function parseRgba(s) {
  const m = /rgba?\(([^)]+)\)/.exec(s ?? '');
  if (!m) return null;
  const p = m[1].split(',').map((v) => parseFloat(v));
  if (p.length < 3 || p.some(Number.isNaN)) return null;
  return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
}

/** Composites a translucent colour over an opaque backdrop. */
function over(fg, bg) {
  if (!fg || !bg) return null;
  return fg.slice(0, 3).map((c, i) => Math.round(c * fg[3] + bg[i] * (1 - fg[3])));
}

const luma = (c) => (c ? 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2] : null);

// ---------------------------------------------------------------------------
// Active-state mode
// ---------------------------------------------------------------------------

/** Attributes that carry a control's state, and the value that means "engaged". */
const STATE_ATTRS = {
  'data-state': 'open',
  'aria-pressed': 'true',
  'aria-checked': 'true',
  'aria-selected': 'true',
  'aria-expanded': 'true',
};

/**
 * Counterpart values for `data-state`, which is the one attribute with several vocabularies
 * rather than a boolean: Radix uses open/closed for disclosure, checked/unchecked for
 * switches and boxes, active/inactive for tabs. Flipping "unchecked" to "open" would test a
 * state the component can never be in and quietly prove nothing.
 */
const STATE_PAIRS = {
  open: 'closed',
  closed: 'open',
  checked: 'unchecked',
  unchecked: 'checked',
  active: 'inactive',
  inactive: 'active',
  on: 'off',
  off: 'on',
};

/** The properties a state change is allowed to affect. */
const STATE_PROPS = [
  'backgroundColor', 'color', 'borderTopColor', 'borderBottomColor', 'borderLeftColor',
  'borderRightColor', 'borderTopWidth', 'opacity', 'boxShadow', 'transform', 'fontWeight',
  'textDecorationLine',
];

/**
 * Page-side collector for --active.
 *
 * For every element carrying a state attribute it records the current computed style, the
 * opposite state value, and whether ANY rule in the loaded stylesheets keys off that
 * attribute. That last check is the important half: an element whose state is never
 * referenced by CSS cannot possibly look different in it, which is exactly the bug that
 * made the Text Format button never fill.
 */
const ACTIVE_COLLECT = `(() => {
  const attrs = ${JSON.stringify(Object.keys(STATE_ATTRS))};
  const props = ${JSON.stringify(STATE_PROPS)};

  // Every state value the stylesheets actually react to.
  const styledValues = new Set();
  // State values for which some rule paints a background.
  const paintedStates = new Set();
  for (const sheet of document.styleSheets) {
    let rules;
    try { rules = sheet.cssRules; } catch { continue; }
    for (const rule of rules) {
      const sel = rule.selectorText || '';
      for (const a of attrs) {
        const re = new RegExp(a + '\\\\s*=\\\\s*"?([\\\\w-]+)"?');
        const m = re.exec(sel);
        if (m) {
          styledValues.add(a + '=' + m[1]);
          // A rule that keys off the state AND paints a background is what makes a control
          // look engaged. Collecting these separately lets the report distinguish "styled
          // but the rule loses to another class" from "not styled at all".
          if (rule.style && rule.style.backgroundColor) paintedStates.add(a + '=' + m[1]);
        }
      }
    }
  }

  const pick = (el) => {
    void el.offsetHeight;                       // force a reflow before reading
    const cs = getComputedStyle(el);
    const o = {};
    for (const p of props) o[p] = cs[p];
    return o;
  };

  const out = [];
  document.querySelectorAll('[data-stateprobe]').forEach((e) => e.removeAttribute('data-stateprobe'));
  document.querySelectorAll('*').forEach((el) => {
    for (const a of attrs) {
      if (!el.hasAttribute(a)) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 8 || r.height < 8) continue;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;

      const current = el.getAttribute(a);
      // The opposite of whatever it is now, using the right vocabulary for this attribute.
      const pairs = ${JSON.stringify(STATE_PAIRS)};
      const next = pairs[current] ?? (a === 'data-state' ? 'closed' : (current === 'true' ? 'false' : 'true'));

      const text = (el.getAttribute('aria-label') || el.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 24);
      // Tag the element so the flip can address exactly this node rather than re-deriving
      // a key from attributes that the flip itself is about to change.
      el.setAttribute('data-stateprobe', String(out.length));

      out.push({
        idx: out.length,
        attr: a,
        current,
        next,
        tag: el.tagName.toLowerCase(),
        label: text,
        cls: String(el.className).slice(0, 400),
        // Just the parts that describe state and background, which is what matters here.
        keys: String(el.getAttribute('class') || '').split(/\s+/).filter((c) => /data-|state|bg-/.test(c)).join(' | '),
        styledValue: styledValues.has(a + '=' + current) || styledValues.has(a + '=' + next),
        // Is there a rule painting a background for either state? If so and the element
        // still shows none, the rule is being beaten by another class.
        paintedState: paintedStates.has(a + '=' + current) || paintedStates.has(a + '=' + next),
        style: pick(el),
      });
      break;  // one state attribute per element is enough
    }
  });
  return JSON.stringify(out);
})()`;

/**
 * Flips the tagged element's state.
 *
 * The read has to happen in a LATER call, after a delay, not in this one. These controls
 * carry `transition-colors`, and while a CSS transition is running `getComputedStyle`
 * reports the value at the current point of the animation — at t=0 that is still the old
 * colour. Reading immediately therefore reports "the state changes nothing" for every
 * transitioning control, which is a false negative that would hide the very bugs this mode
 * exists to find. The separate read also forces a reflow before sampling.
 */
const ACTIVE_FLIP = (idx, attr, next) => `(() => {
  const el = document.querySelector('[data-stateprobe="${idx}"]');
  if (!el) return JSON.stringify({ found: false });
  el.setAttribute(${JSON.stringify(attr)}, ${JSON.stringify(next)});
  return JSON.stringify({ found: true, state: el.getAttribute(${JSON.stringify(attr)}) });
})()`;

/** Reads the flipped element's computed style, by which time transitions have settled. */
const ACTIVE_READ = (idx) => `(() => {
  const props = ${JSON.stringify(STATE_PROPS)};
  const el = document.querySelector('[data-stateprobe="${idx}"]');
  if (!el) return JSON.stringify({ found: false });
  void el.offsetHeight;                       // force the cascade to recalculate
  const cs = getComputedStyle(el);
  const o = {};
  for (const p of props) o[p] = cs[p];
  return JSON.stringify({ found: true, style: o });
})()`;

/**
 * Which of the watched properties differ between two computed styles.
 *
 * Deliberately returns the differing property names rather than a boolean. A state that
 * matches a rule but changes nothing visible is often intentional — an icon button whose
 * colour comes from a custom class, for instance — so the interesting signal is not "did
 * anything move" but "is there a rule for this state at all".
 */
function styleDiff(before, after) {
  if (!before || !after) return [];
  return STATE_PROPS.filter((p) => before[p] !== after[p]);
}

/**
 * Asks the browser which of the declared `hover:bg-*` classes actually produced a rule.
 *
 * This cannot be answered from the source. Tailwind only emits classes it recognises, so
 * a typo such as `hover:bg-foreground/6` (6 is off the opacity scale) compiles to
 * nothing: the markup looks right, the element has no hover, and nothing anywhere
 * reports a problem. Verifying against the loaded stylesheets is the only honest check.
 */
async function findUncompiledClasses(cdp, classes) {
  const unique = [...new Set(classes)];
  const res = await cdp.eval(`(() => {
    const esc = (c) => c.replace(/[^a-zA-Z0-9_-]/g, (m) => '\\\\' + m);
    const wanted = ${JSON.stringify(unique)};
    const out = {};
    for (const cls of wanted) {
      let matched = 0;
      for (const sheet of document.styleSheets) {
        let list;
        try { list = sheet.cssRules; } catch { continue; }
        for (const rule of list) {
          if (rule.selectorText && rule.selectorText.includes('.' + esc(cls) + ':hover')) matched++;
        }
      }
      out[cls] = matched;
    }
    return JSON.stringify(out);
  })()`);
  return Object.entries(JSON.parse(res)).filter(([, n]) => n === 0).map(([c]) => c);
}

/**
 * Measures hover feedback for every `hover:bg-*` element on the page, walking the whole
 * scrollable area rather than only the first screen.
 */
async function measureHover(cdp) {
  const seen = new Set();
  const items = [];

  await cdp.eval(HOVER_REWIND);
  await sleep(200);
  const pageHeight = await cdp.eval(`Math.max(document.documentElement.scrollHeight, document.body.scrollHeight)`);
  // Walk the whole document in sub-viewport steps. A step larger than the viewport
  // would skip the elements that pass through the gap between two samples, which is how
  // the last rows of a settings page end up never being tested.
  const steps = Math.min(40, Math.max(2, Math.ceil(pageHeight / (900 * 0.6)) + 1));
  let atBottom = false;
  const trace = [];

  for (let pass = 0; pass < steps; pass++) {
    const found = JSON.parse(await cdp.eval(HOVER_COLLECT));
    let fresh = 0;
    for (const f of found) {
      if (seen.has(f.sig)) continue;
      seen.add(f.sig);
      items.push(f);
      fresh++;
    }
    // Keep scrolling until the container genuinely refuses to move, rather than trusting
    // a single step: one step may land short of the end and stop the walk early.
    let step = JSON.parse(await cdp.eval(HOVER_SCROLL(0.6)));
    while (!atBottom && step.moved && step.at < step.max - 2) {
      await sleep(120);
      step = JSON.parse(await cdp.eval(HOVER_SCROLL(0.6)));
    }
    trace.push(`pass ${pass}: visible=${found.length} fresh=${fresh} total=${items.length} scroll=${step.at}/${step.max}`);
    if (!step.moved || step.at >= step.max - 2) atBottom = true;
    else await sleep(280);
  }
  if (process.env.HOVER_TRACE) console.log('    ' + trace.join('\n    '));

  // Rewind before measuring. The scroll-hiding FAB only exists near the top of the
  // document, so leaving the page at the bottom would make it permanently invisible.
  await cdp.eval(HOVER_REWIND);
  await sleep(700);

  const results = [];
  const skipped = [];
  for (const it of items) {
    const aim = JSON.parse(await cdp.eval(HOVER_AIM(it.sig)));
    if (!aim.found || !aim.visible) {
      skipped.push(`${it.tag} "${it.label}" [${it.cls}] not fully on screen`);
      continue;
    }

    // Give the element a chance to finish reacting to the scroll we just caused.
    let state = 'PENDING';
    for (let i = 0; i < 14; i++) {
      await sleep(120);
      state = await cdp.eval(HOVER_SETTLED);
      if (state === 'READY' || state === 'GONE') break;
    }
    if (state !== 'READY') {
      skipped.push(`${it.tag} "${it.label}" [${it.cls}] ${state}`);
      continue;
    }

    if (process.env.HOVER_TRACE) {
      const who = await cdp.eval(`(() => { const el = document.querySelector('[data-hovprobe="1"]'); return el ? el.tagName + '|' + String(el.className).slice(0, 40) : 'NONE'; })()`);
      console.log(`    aim "${it.label}" cls=${it.cls} -> (${aim.x},${aim.y}) target=${who}`);
    }

    // Park the pointer in a dead corner first: a leftover hover from the previous
    // element would otherwise be measured as this element's own feedback.
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 1, y: 1, buttons: 0 });
    await sleep(60);
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: aim.x, y: aim.y, buttons: 0 });

    // Poll until the value stops changing instead of sleeping a fixed amount: most of
    // these elements carry `transition-colors`, so a fixed wait samples mid-animation
    // and reports a translucent colour that never appears in real use.
    let last = null;
    let settled = null;
    for (let i = 0; i < 12; i++) {
      await sleep(70);
      settled = await cdp.eval(HOVER_BG);
      if (settled === last) break;
      last = settled;
    }

    // Re-resolve the backdrop while hovered: React may swap the element's own
    // background, and a translucent hover has to be composited against what is really
    // behind it, not against the page.
    const backdrop = await cdp.eval(`(() => {
      const el = document.querySelector('[data-hovprobe="1"]');
      if (!el) return 'rgba(0, 0, 0, 0)';
      for (let n = el.parentElement; n; n = n.parentElement) {
        const c = getComputedStyle(n).backgroundColor;
        const m = /rgba?\\([^)]*,\\s*([\\d.]+)\\)/.exec(c);
        const alpha = m ? parseFloat(m[1]) : (c.startsWith('rgb(') ? 1 : 0);
        if (alpha >= 0.99) return c;
      }
      return 'rgba(0, 0, 0, 0)';
    })()`);

    results.push({ ...it, backdrop, hoverBg: settled });
  }
  return { results, skipped };
}

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
/** Hover-mode tallies: `missing` = declared-but-never-compiled, `flat` = no pixel change. */
let missing = 0;
let flat = 0;
/** Active-mode tallies. */
let unresponsive = 0;
let styledButStatic = 0;
let unstyled = 0;
const skippedActive = [];

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

      if (activeMode) {
        await sleep(600);
        const found = JSON.parse(await cdp.eval(ACTIVE_COLLECT));
        console.log(`--- ${slug(route)} (${found.length} stateful element(s)) ---`);

        for (const f of found) {
          const flip = JSON.parse(await cdp.eval(ACTIVE_FLIP(f.idx, f.attr, f.next)));
          if (!flip.found) {
            skippedActive.push(`${f.tag} "${f.label}" [${f.attr}] vanished before it could be flipped`);
            continue;
          }
          // Let the colour transition finish, then poll until the values stop moving.
          await sleep(400);
          let after = { found: false };
          let last = null;
          for (let i = 0; i < 8; i++) {
            after = JSON.parse(await cdp.eval(ACTIVE_READ(f.idx)));
            if (!after.found) break;
            const now = JSON.stringify(after.style);
            if (now === last) break;
            last = now;
            await sleep(120);
          }
          const changed = styleDiff(f.style, after.style);
          if (process.env.ACTIVE_TRACE) {
            console.log(`    [${f.idx}] ${f.tag} "${f.label}" ${f.attr}: ${f.current} -> ${flip.state}`);
            console.log(`         before color=${f.style.color} bg=${f.style.backgroundColor}`);
            console.log(`         after  color=${after.style?.color} bg=${after.style?.backgroundColor}`);
          }
          const label = f.label ? `"${f.label}"` : '(icon)';

          /*
           * The verdict that matters is whether the stylesheets define a rule for the state
           * value at all. An element whose state value no CSS rule mentions cannot possibly
           * render differently in it — that is the Text Format bug, and it is a real defect.
           * A state that IS styled but happens to change nothing is reported separately and
           * more quietly, because it is often deliberate.
           */
          if (!f.styledValue) {
            /*
             * No rule anywhere keys off this state value. That is often legitimate — a
             * Radix trigger that only exists to reveal a menu, for instance, has no reason
             * to look different itself — so this is reported as a note, not a failure.
             */
            unstyled++;
            console.log(`  ${f.tag.padEnd(6)} ${label.padEnd(26)} ${f.attr}=${f.current} -> ${f.next}   no rule uses this state`);
          } else if (!changed.length && f.paintedState) {
            /*
             * A rule DOES paint a background for this state, yet the element shows none.
             * That is the real defect: the rule exists and is being beaten by another
             * class, so the control reports a state it cannot display.
             */
            unresponsive++;
            console.log(`  ${f.tag.padEnd(6)} ${label.padEnd(26)} ${f.attr}=${f.current} -> ${f.next}`);
            console.log(`         !! a rule paints a background for this state, but the element shows none`);
            console.log(`         state/bg: ${f.keys}`);
          } else if (!changed.length) {
            styledButStatic++;
            console.log(`  ${f.tag.padEnd(6)} ${label.padEnd(26)} ${f.attr}=${f.current} -> ${f.next}   styled, no visual delta`);
            console.log(`         state/bg: ${f.keys}`);
          } else {
            console.log(`  ${f.tag.padEnd(6)} ${label.padEnd(26)} ${f.attr}=${f.current} -> ${f.next}   ${changed.join(', ')}`);
          }
        }
        if (!found.length) console.log('  (no stateful elements)');
        console.log('');
        continue;
      }

      if (hoverMode) {
        // Let any entrance animation finish before measuring: a mid-transition opacity
        // would make an element look unresponsive when it simply had not appeared yet.
        await sleep(700);
        const { results, skipped } = await measureHover(cdp);
        const pageBg = parseRgba(await cdp.eval(PAGE_BG));
        const brokenClasses = await findUncompiledClasses(cdp, results.map((r) => r.cls));

        console.log(`--- ${slug(route)} (${results.length} hover element(s)) ---`);
        for (const r of results) {
          const base = parseRgba(r.base);
          const hov = parseRgba(r.hoverBg);
          // Composite against the element's real backdrop, never against the element's
          // own base colour. An element can be opaque at rest and translucent on hover
          // (the black FAB is exactly that), and using its resting colour as the backdrop
          // would paint the hover black-over-black and hide a hover that works.
          const backdrop = base && base[3] >= 0.99 && hov && hov[3] >= 0.99
            ? base
            : (parseRgba(r.backdrop) ?? pageBg);
          const b = base && base[3] >= 0.99 ? base.slice(0, 3) : over(base, backdrop);
          const h = over(hov, backdrop);
          if (process.env.HOVER_TRACE && r.cls.includes('black')) {
            console.log(`    RAW base=${JSON.stringify(base)} hov=${JSON.stringify(hov)} bd=${JSON.stringify(backdrop)} b=${JSON.stringify(b)} h=${JSON.stringify(h)}`);
          }
          // The relative jump is undefined over black (luminance 0), which is where the
          // black FAB and buttons live, so fall back to a 0-255 difference there.
          const lb = luma(b);
          const lh = luma(h);
          const delta = lb > 1 && lh !== null
            ? `${lh - lb >= 0 ? '+' : ''}${(((lh - lb) / lb) * 100).toFixed(1)}%`
            : lb !== null && lh !== null
              ? `${lh - lb >= 0 ? '+' : ''}${(lh - lb).toFixed(0)}/255`
              : 'n/a';
          const unchanged = b && h && b.join() === h.join();
          if (unchanged) flat++;

          const label = r.label ? `"${r.label}"` : '(icon)';
          console.log(
            `  ${r.tag.padEnd(6)} ${label.padEnd(30)} ${r.cls.slice(0, 24).padEnd(24)} ` +
              `${(b ? `rgb(${b.join(',')})` : '?').padEnd(17)} -> ` +
              `${(h ? `rgb(${h.join(',')})` : '?').padEnd(17)} ` +
              `${delta.padStart(8)}` +
              `${unchanged ? '   <== NO VISIBLE CHANGE' : ''}`,
          );
        }
        if (!results.length) console.log('  (no hover-reactive elements)');
        if (skipped.length) {
          console.log(`  -- skipped ${skipped.length}, not hoverable at rest (scroll-hiding, covered or gone):`);
          for (const s of skipped) console.log(`       ${s}`);
        }
        if (brokenClasses.length) {
          console.log(`  !! declared but never compiled: ${brokenClasses.join(', ')}`);
          missing += brokenClasses.length;
        }
        console.log('');
        continue;
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

  if (hoverMode) {
    console.log('='.repeat(96));
    if (missing) console.log(`${missing} element group(s) declare a hover class that NO CSS rule matches.`);
    if (flat) console.log(`${flat} element group(s) render identically before and after hover.`);
    if (!missing && !flat) console.log('Every hover-reactive element changed on hover, and every class resolved to real CSS.');
    if (missing) exitCode = 1;
  } else if (activeMode) {
    console.log('='.repeat(96));
    if (skippedActive.length) {
      console.log(`${skippedActive.length} stateful element(s) could not be measured:`);
      for (const s of skippedActive) console.log(`  ${s}`);
    }
    if (unstyled) console.log(`${unstyled} element(s) report a state that no rule styles (usually fine — a menu trigger need not look different).`);
    if (styledButStatic) console.log(`${styledButStatic} element(s) are styled for their state but showed no visual delta.`);
    if (unresponsive) {
      console.log(`${unresponsive} element(s) have a rule painting their state's background that the element never shows — the rule is losing.`);
      exitCode = 1;
    } else {
      console.log('No element is styled for a state it cannot display.');
    }
  } else {
    console.log(`\n${shots} screenshot(s) in .screenshots/`);
  }
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
