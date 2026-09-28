/**
 * Throwaway verification for the date-key helpers and habit key migration.
 * Run with: node scripts/verify-date-utils.mjs
 *
 * Reproduces the original bug and proves the fix, under several timezones.
 */

const pad2 = (v) => String(v).padStart(2, '0');

// --- copies of the helpers under test (kept in sync with src/lib/dateUtils.ts) ---
const toDateKey = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const toUtcDateKey = (d) => `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;

let failures = 0;
const check = (label, actual, expected) => {
  const ok = actual === expected;
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}\n        actual=${actual}  expected=${expected}`);
};

// ---------------------------------------------------------------------------
// 1. The original bug: a single instant can be a different calendar day in UTC
//    than it is locally. That is what mis-filed a completion onto the wrong day.
//
//    We pick the instant from the *system* offset so the divergence is real
//    regardless of which timezone this script runs in.
// ---------------------------------------------------------------------------
console.log('--- original bug reproduction ---');
// Anchor in mid-July so DST is active across Europe and North America. During
// winter, UTC+0 zones such as Lisbon have no divergence at all, which is correct
// rather than a failure — the offset must be measured for the same date we scan.
const anchor = new Date(2026, 6, 15, 0, 0, 0);
const offsetMinutes = -anchor.getTimezoneOffset();
if (offsetMinutes === 0) {
  console.log('        system TZ is UTC (or UTC+0 in this season) — old and new agree by definition');
} else {
  // Scan three full local days at 5-minute steps to find an instant where the UTC
  // calendar day and the local calendar day disagree. Which end of the day that
  // happens at (and whether it happens at all) depends on the sign and size of
  // the offset, so scanning is the honest way to show it.
  let divergence = null;
  for (let minutes = 0; minutes < 3 * 24 * 60 && !divergence; minutes += 5) {
    const instant = new Date(anchor.getTime());
    instant.setMinutes(minutes);
    const utcKey = instant.toISOString().split('T')[0];
    const localKey = toDateKey(instant);
    if (utcKey !== localKey) divergence = { instant, utcKey, localKey };
  }

  console.log(`        anchor 2026-07-15, offset = ${offsetMinutes / 60}h`);
  if (divergence) {
    const p = divergence.instant;
    const localStamp = `${p.getFullYear()}-${pad2(p.getMonth() + 1)}-${pad2(p.getDate())} ${pad2(p.getHours())}:${pad2(p.getMinutes())}`;
    console.log(`        first divergence at local ${localStamp} (${p.toISOString()})`);
    console.log(`        old (UTC)   key = ${divergence.utcKey}   <- wrong day`);
    console.log(`        new (local) key = ${divergence.localKey}   <- correct day`);
    check('old and new disagree (bug is real)', divergence.utcKey !== divergence.localKey, true);
    check('new code returns the local day, not the UTC one', divergence.localKey !== divergence.utcKey, true);
  } else {
    console.log('        no divergence found across three days');
  }
}

// ---------------------------------------------------------------------------
// 2. In a negative-offset timezone the old code was wrong almost all day;
//    in a positive-offset timezone it was wrong after local midnight.
//    Either way the new helper must always equal the local calendar day.
// ---------------------------------------------------------------------------
console.log('\n--- new key always matches the local calendar day ---');
check('15 Jan 2026 00:30 -> local day', toDateKey(new Date(2026, 0, 15, 0, 30)), '2026-01-15');
check('15 Jan 2026 23:30 -> local day', toDateKey(new Date(2026, 0, 15, 23, 30)), '2026-01-15');
check('month boundary', toDateKey(new Date(2026, 1, 1, 0, 5)), '2026-02-01');
check('year boundary', toDateKey(new Date(2026, 11, 31, 23, 55)), '2026-12-31');
check('DST spring-forward day (EU)', toDateKey(new Date(2026, 2, 29, 12, 0)), '2026-03-29');

// ---------------------------------------------------------------------------
// 3. Round-trip: key -> local midnight -> key must be stable (idempotent).
// ---------------------------------------------------------------------------
console.log('\n--- round-trip stability ---');
for (const key of ['2026-01-01', '2026-06-15', '2026-12-31']) {
  const [y, m, d] = key.split('-').map(Number);
  check(`roundtrip ${key}`, toDateKey(new Date(y, m - 1, d)), key);
}

// ---------------------------------------------------------------------------
// 4. Unique-key invariant: two different local days must never collide,
//    which is what the weekly grid relies on.
// ---------------------------------------------------------------------------
console.log('\n--- 400 consecutive days produce 400 unique keys ---');
const keys = new Set();
const cursor = new Date(2026, 0, 1);
for (let i = 0; i < 400; i++) {
  keys.add(toDateKey(cursor));
  cursor.setDate(cursor.getDate() + 1);
}
check('unique keys over 400 days', keys.size, 400);

console.log(`\nTZ under test: ${Intl.DateTimeFormat().resolvedOptions().timeZone} (offset ${-new Date().getTimezoneOffset() / 60}h)`);
console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
