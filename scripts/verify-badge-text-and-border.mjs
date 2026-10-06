/**
 * Checks the badge an event card draws for the days left, and the colours it is drawn in.
 *
 * Two reports are covered:
 *   1. the badge read "{count} days remaining" and now reads "{count} days", in every
 *      language, so the phrase does not have to be translated and pluralised per language;
 *   2. on an event that has a colour the badge's outline was white in the light theme.
 *      It was not, in fact, white: `getColoredBorderClass(hasColor, 100)` asks for
 *      `border-[#000000]/100`, Tailwind never generated that class — its `/30` sibling is in
 *      the built stylesheet and the `/100` one is not — so the outline fell back to the
 *      shared border, rgb(234, 232, 230), which reads as white on a pastel card.
 *
 * The light theme is the only one that may change: the dark theme's outline was reported as
 * looking right, so its colour is recorded here and asserted to stay put.
 *
 * Usage: node scripts/verify-badge-text-and-border.mjs
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
  async go(url, wait = 2200) {
    await this.send('Page.navigate', { url });
    await sleep(wait);
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

const NOW = new Date();
const inDays = (n) => new Date(NOW.getTime() + n * 86400000).toISOString();

const EVENTS = [
  { id: 'coloured-event', name: 'Coloured event', description: '', color: '#FEF3C7', createdAt: NOW.toISOString(),
    isRecurrent: false, startDate: inDays(10), isAllDay: true, pinned: false },
  { id: 'plain-event', name: 'Plain event', description: '', color: '#FFFFFF', createdAt: NOW.toISOString(),
    isRecurrent: false, startDate: inDays(10), isAllDay: true, pinned: false },
  { id: 'tomorrow-event', name: 'Tomorrow event', description: '', color: '#FEF3C7', createdAt: NOW.toISOString(),
    isRecurrent: false, startDate: inDays(1), isAllDay: true, pinned: false },
];

/*
 * Habits are seeded for a report rather than a check. The same wording was reported for
 * habits, and a habit card draws no countdown badge at all: these are the day-count badges it
 * does draw, so the report lists the strings that exist instead of guessing at one.
 */
const HABITS = [
  { id: 'habit-week', name: 'Times per week habit', color: '#FFFFFF', createdAt: NOW.toISOString(),
    completedDates: [], activeDays: [true, true, true, true, true, true, true],
    useNumberOfDays: true, numberOfDaysPerWeek: 5, pinned: false },
  { id: 'habit-week-times', name: 'Week and times habit', color: '#FFFFFF', createdAt: NOW.toISOString(),
    completedDates: [], activeDays: [true, true, true, true, true, true, true],
    useNumberOfDays: true, numberOfDaysPerWeek: 5, useTimesPerDay: true, timesPerDay: 3, pinned: false },
  { id: 'habit-unlimited', name: 'Unlimited habit', color: '#FFFFFF', createdAt: NOW.toISOString(),
    completedDates: [], activeDays: [true, true, true, true, true, true, true],
    useUnlimitedTimes: true, pinned: false },
];

/** Every piece of text a habit card draws in a badge. */
const HABIT_BADGE_TEXTS = `(() => {
  const out = [];
  for (const card of document.querySelectorAll('[data-habit-id]')) {
    for (const badge of card.querySelectorAll('div.rounded-full')) {
      const text = (badge.textContent || '').trim();
      if (text && !badge.querySelector('svg') && !badge.querySelector('button')) out.push(text);
    }
  }
  return out;
})()`;

/** The days badge of a given event card, with the colours it is painted in. */
const DAYS_BADGE = (eventId) => `(() => {
  const card = document.querySelector('[data-event-id="${eventId}"]');
  if (!card) return { card: false };
  const badge = Array.from(card.querySelectorAll('div.rounded-full'))
    .find((el) => /\\d/.test(el.textContent || '') && /day|dia|día|jour|tag|giorno|giorni|dias|días|jours|tage/i.test(el.textContent || ''));
  if (!badge) return { card: true, badge: false };
  const cs = getComputedStyle(badge);
  return { card: true, badge: true, text: (badge.textContent || '').trim(),
    border: cs.borderTopColor, borderWidth: cs.borderTopWidth,
    background: cs.backgroundColor, color: cs.color };
})()`;

const port = 9222 + Math.floor(Math.random() * 400);
const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'badges-'));
const outDir = path.join(process.cwd(), 'preview');
fs.mkdirSync(outDir, { recursive: true });
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
  '--no-first-run', '--disable-extensions', '--window-size=1440,900', '--force-device-scale-factor=1',
  `--remote-debugging-port=${port}`, `--user-data-dir=${profileDir}`, 'about:blank'], { stdio: 'ignore' });

const shotCards = async (cdp, file, selector) => {
  const box = await cdp.eval(`(() => {
    const cards = Array.from(document.querySelectorAll(${JSON.stringify(selector)}));
    if (!cards.length) return null;
    const rects = cards.map((c) => c.getBoundingClientRect());
    const left = Math.min(...rects.map((r) => r.left)), top = Math.min(...rects.map((r) => r.top));
    const right = Math.max(...rects.map((r) => r.right)), bottom = Math.max(...rects.map((r) => r.bottom));
    return { x: Math.max(0, left - 8), y: Math.max(0, top - 8), width: right - left + 16, height: bottom - top + 16 };
  })()`);
  if (!box) return false;
  const shot = await cdp.send('Page.captureScreenshot', { format: 'png', clip: { ...box, scale: 2 } });
  fs.writeFileSync(path.join(outDir, file), Buffer.from(shot.data, 'base64'));
  return true;
};

// Recorded before the change, so "the dark theme did not move" is a measured claim.
const DARK_OUTLINE = 'rgb(57, 54, 50)';
const LIGHT_SHARED_OUTLINE = 'rgb(234, 232, 230)';

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
    for (const k of ['notes','archivedNotes','folders','archivedFolders','events','archivedEvents',
                     'eventFolders','archivedEventFolders','habits','archivedHabits',
                     'habitFolders','archivedHabitFolders']) localStorage.removeItem(k);
    localStorage.setItem('events', ${JSON.stringify(JSON.stringify(EVENTS))});
    localStorage.setItem('habits', ${JSON.stringify(JSON.stringify(HABITS))});
    return true;
  })()`);

  console.log('=== the wording ===');
  await cdp.eval(`localStorage.setItem('habitrkr.language', 'en'); localStorage.setItem('habitrkr.theme', 'light')`);
  await cdp.go(BASE + '/events');
  const english = {};
  for (const id of ['coloured-event', 'plain-event', 'tomorrow-event']) {
    english[id] = JSON.parse(await cdp.eval(`JSON.stringify(${DAYS_BADGE(id)})`));
  }
  console.log(`  coloured 10 days out: "${english['coloured-event'].text}"`);
  console.log(`  plain 10 days out   : "${english['plain-event'].text}"`);
  console.log(`  1 day out           : "${english['tomorrow-event'].text}"`);
  check('English says just the count', english['coloured-event'].text, '10 days');
  check('and the count is pluralised on its own', english['tomorrow-event'].text, '1 day');

  await cdp.eval(`localStorage.setItem('habitrkr.language', 'pt')`);
  await cdp.go(BASE + '/events');
  const portuguese = JSON.parse(await cdp.eval(`JSON.stringify(${DAYS_BADGE('coloured-event')})`));
  const portugueseOne = JSON.parse(await cdp.eval(`JSON.stringify(${DAYS_BADGE('tomorrow-event')})`));
  console.log(`  Portuguese: "${portuguese.text}" and "${portugueseOne.text}"`);
  check('Portuguese says just the count', portuguese.text, '10 dias');
  check('and pluralises', portugueseOne.text, '1 dia');

  console.log('\n=== the outline ===');
  for (const theme of ['light', 'dark']) {
    await cdp.eval(`localStorage.setItem('habitrkr.language', 'en'); localStorage.setItem('habitrkr.theme', '${theme}')`);
    await cdp.go(BASE + '/events');
    const coloured = JSON.parse(await cdp.eval(`JSON.stringify(${DAYS_BADGE('coloured-event')})`));
    const plain = JSON.parse(await cdp.eval(`JSON.stringify(${DAYS_BADGE('plain-event')})`));
    console.log(`  ${theme}: coloured card outline ${coloured.border}, uncoloured card outline ${plain.border}`);
    console.log(`    coloured badge text ${coloured.color} on ${coloured.background}`);

    if (theme === 'light') {
      check('on a coloured card the outline is black', coloured.border, 'rgb(0, 0, 0)');
      check('the uncoloured card keeps the shared outline', plain.border, LIGHT_SHARED_OUTLINE);
    } else {
      check('the dark theme keeps its own outline on a coloured card', coloured.border, DARK_OUTLINE);
      check('and on an uncoloured card', plain.border, DARK_OUTLINE);
    }
    console.log(`  preview/badges-events-${theme}.png: ${await shotCards(cdp, `badges-events-${theme}.png`, '[data-event-id]')}`);
  }

  // Reported, not asserted: this is the answer to "which day badge do habits draw?".
  console.log('\n=== habits · which day badges exist (report only) ===');
  await cdp.eval(`localStorage.setItem('habits', ${JSON.stringify(JSON.stringify(HABITS))})`);
  await cdp.eval(`localStorage.setItem('habitrkr.theme', 'light')`);
  await cdp.go(BASE + '/');
  const habitBadges = await cdp.eval(HABIT_BADGE_TEXTS);
  console.log(`  a habit card draws: ${JSON.stringify(habitBadges)}`);
  console.log(`  none of them is a countdown: ${habitBadges.every((text) => !/remaining|restante|restants|verbleibend|rimanent/i.test(text))}`);
  console.log(`  preview/badges-habits-light.png: ${await shotCards(cdp, 'badges-habits-light.png', '[data-habit-id]')}`);
} finally {
  chrome.kill();
  await sleep(200);
  try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch { /* windows lock */ }
}

console.log(failures === 0 ? '\nALL BADGE CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
