/**
 * Harness: runs the REAL `src/lib/dateMigration.ts` against a stubbed localStorage
 * to prove the opt-in repair tool does exactly what its contract says:
 *
 *   - shifts completion keys in [start, end] forward by exactly one day
 *   - touches nothing outside that window
 *   - is previewable (dryRun) and refuses to run into the future
 *   - never throws on malformed data, and never silently drops an entry
 *
 * Run with: node scripts/verify-date-migration.mjs
 */

import { build } from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

// ---------------------------------------------------------------------------
// Stub localStorage with a shared backing store.
// ---------------------------------------------------------------------------
const store = new Map();
globalThis.window = {
  localStorage: {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  },
};

const stubPlugin = {
  name: 'stub-localstorage',
  setup(b) {
    b.onResolve({ filter: /localStorageUtils$/ }, () => ({ path: 'localstorage-stub', namespace: 'stub' }));
    b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({
      contents: `
        export function getLocalStorageItem(key, fallback) {
          const raw = globalThis.window.localStorage.getItem(key);
          if (raw === null) return fallback;
          try { return JSON.parse(raw); } catch { return fallback; }
        }
        export function setLocalStorageItem(key, value) {
          globalThis.window.localStorage.setItem(key, JSON.stringify(value));
        }
        export function getLocalStorageString(key, fallback) {
          const raw = globalThis.window.localStorage.getItem(key);
          return raw === null ? fallback : raw;
        }
        export function setLocalStorageString(key, value) {
          globalThis.window.localStorage.setItem(key, value);
        }
      `,
      loader: 'js',
    }));
  },
};

const result = await build({
  entryPoints: [path.join(root, 'src/lib/dateMigration.ts')],
  bundle: true,
  format: 'esm',
  write: false,
  platform: 'neutral',
  plugins: [stubPlugin],
  alias: { '@': path.join(root, 'src') },
});

const mod = await import(
  `data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}#${Date.now()}`
);

// ---------------------------------------------------------------------------
let failures = 0;
const check = (label, actual, expected) => {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  const ok = a === e;
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`);
  if (!ok) console.log(`        actual   = ${a}\n        expected = ${e}`);
};

const pad2 = (v) => String(v).padStart(2, '0');
const localKeyOf = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const oldKeyOf = (d) => `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
const nextDay = (key) => {
  const [y, m, d] = key.split('-').map(Number);
  return localKeyOf(new Date(y, m - 1, d + 1));
};

const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
const today = localKeyOf(new Date());
console.log(`\ntimezone = ${tz}`);
console.log(`today    = ${today}\n`);

const WINDOW_START = '2026-01-01';
const WINDOW_END = '2026-01-31';
// Chosen so that no shifted key collides with another entry.
const INSIDE = ['2026-01-10', '2026-01-14', '2026-01-18'];
const OUTSIDE = ['2025-12-31', '2026-02-01', '2026-06-15'];
const MALFORMED = ['not-a-date', '2026-13-45', ''];

// ===========================================================================
// TEST A — only in-window keys shift, always forward by exactly one day
// ===========================================================================
console.log('--- range-scoped, forward-only shift ---');
store.clear();
store.set('habits', JSON.stringify([{
  id: 'h1', name: 'Drink water', createdAt: '2025-01-01T00:00:00.000Z',
  completedDates: [...INSIDE, ...OUTSIDE],
  completionCounts: Object.fromEntries(INSIDE.map((k) => [k, 3])),
}]));

mod.repairHabitDateKeys(WINDOW_START, WINDOW_END);
const habit = JSON.parse(store.get('habits'))[0];

check('every in-window date moved forward one day',
  INSIDE.every((k) => habit.completedDates.includes(nextDay(k))), true);
check('no in-window date remains at its old value',
  INSIDE.some((k) => habit.completedDates.includes(k)), false);
check('out-of-window dates are untouched',
  OUTSIDE.every((k) => habit.completedDates.includes(k)), true);
check('counts moved with the dates',
  INSIDE.every((k) => habit.completionCounts[nextDay(k)] === 3), true);
check('no stale count keys left behind',
  INSIDE.some((k) => k in habit.completionCounts), false);
check('total date count preserved',
  habit.completedDates.length, INSIDE.length + OUTSIDE.length);

// ===========================================================================
// TEST B — dryRun previews without writing
// ===========================================================================
console.log('\n--- dry run ---');
store.clear();
store.set('habits', JSON.stringify([{
  id: 'h2', name: 'Dry', createdAt: '2025-01-01T00:00:00.000Z',
  completedDates: ['2026-01-10'], completionCounts: { '2026-01-10': 1 },
}]));

const snapshotBefore = store.get('habits');
const wouldChange = mod.repairHabitDateKeys(WINDOW_START, WINDOW_END, { dryRun: true });
check('dry run reports the habit it would change', wouldChange, 1);
check('dry run writes nothing', store.get('habits'), snapshotBefore);

// ===========================================================================
// TEST C — the real run after the dry run does apply, then refuses to repeat
// ===========================================================================
check('real run after preview reports 1 change',
  mod.repairHabitDateKeys(WINDOW_START, WINDOW_END), 1);
check('and actually rewrote the key',
  JSON.parse(store.get('habits'))[0].completedDates.includes('2026-01-11'), true);

let repeatError = null;
try { mod.repairHabitDateKeys(WINDOW_START, WINDOW_END); } catch (e) { repeatError = e.message; }
check('a repeat run is refused', typeof repeatError === 'string', true);
check('the repaired key did not drift further',
  JSON.parse(store.get('habits'))[0].completedDates, ['2026-01-11']);
check('the repaired range was recorded',
  mod.listRepairedRanges().length, 1);
check('dry run over a repaired range is still allowed',
  mod.repairHabitDateKeys(WINDOW_START, WINDOW_END, { dryRun: true }), 1);

// An overlapping-but-not-identical range must also be refused.
let overlapError = null;
try { mod.repairHabitDateKeys('2026-01-15', '2026-02-15'); } catch (e) { overlapError = e.message; }
check('an overlapping range is refused', typeof overlapError === 'string', true);

// A disjoint range is still permitted.
check('a disjoint range is allowed',
  mod.repairHabitDateKeys('2026-03-01', '2026-03-31'), 0);

// Forgetting the record re-enables a range.
mod.forgetRepairedRanges();
check('forgetRepairedRanges clears the record', mod.listRepairedRanges().length, 0);

// ===========================================================================
// TEST D — refuses to repair into the future
// ===========================================================================
console.log('\n--- guards ---');
let futureError = null;
try { mod.repairHabitDateKeys('2026-01-01', '2099-12-31'); } catch (e) { futureError = e.message; }
check('refuses a future end date', typeof futureError === 'string', true);

let orderError = null;
try { mod.repairHabitDateKeys('2026-02-01', '2026-01-01'); } catch (e) { orderError = e.message; }
check('refuses an inverted range', typeof orderError === 'string', true);

// ===========================================================================
// TEST E — malformed entries never throw and are never dropped
// ===========================================================================
console.log('\n--- malformed input ---');
store.clear();
store.set('habits', JSON.stringify([{
  id: 'h3', name: 'Weird', createdAt: '2025-01-01T00:00:00.000Z',
  completedDates: [...MALFORMED], completionCounts: { garbage: 1 },
}]));

let threw = null;
try { mod.repairHabitDateKeys(WINDOW_START, WINDOW_END); } catch (e) { threw = e.message; }
check('does not throw', threw, null);
check('malformed entries preserved, not dropped',
  JSON.parse(store.get('habits'))[0].completedDates.length, MALFORMED.length);

// ===========================================================================
// TEST F — inspect is read-only
// ===========================================================================
console.log('\n--- inspect ---');
store.clear();
store.set('habits', JSON.stringify([{
  id: 'h4', name: 'Inspect me', createdAt: '2025-01-01T00:00:00.000Z',
  completedDates: ['2026-01-05', '2026-06-01'], completionCounts: {},
}]));
const before = store.get('habits');
const report = mod.inspectHabitDateKeys(WINDOW_START, WINDOW_END);
check('inspect finds the in-window entry', report[0]?.entriesInWindow, 1);
check('inspect does not modify storage', store.get('habits'), before);

// ===========================================================================
// TEST G — empty storage is safe
// ===========================================================================
store.clear();
check('\nempty storage: repair returns 0', mod.repairHabitDateKeys(WINDOW_START, WINDOW_END), 0);
check('empty storage: inspect returns []', mod.inspectHabitDateKeys(WINDOW_START, WINDOW_END).length, 0);

console.log(failures === 0 ? '\nALL REPAIR-TOOL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
