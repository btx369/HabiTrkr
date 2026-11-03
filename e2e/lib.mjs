// Shared helpers for the end-to-end checks.
//
// Each suite drives the real app in a phone-sized Chrome with a fresh profile, so the
// data in your own browsers is never touched. They need the dev server running
// (`npm run dev`); then `npm run test:e2e`.
//
// Environment:
//   E2E_BASE_URL  app address        (default http://localhost:8080)
//   CHROME_PATH   Chrome executable  (default: the standard Windows install)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

export const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:8080';
const CHROME = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';

/** Failure screenshots and temporary files (git-ignored). */
export const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'output');
fs.mkdirSync(OUT, { recursive: true });

let failed = false;

export async function start({ mobile = true } = {}) {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  const context = await browser.newContext(
    mobile ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } : { viewport: { width: 1280, height: 860 } }
  );
  await context.grantPermissions(['notifications'], { origin: BASE });
  const page = await context.newPage();
  const problems = [];
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    // The invalid-backup check logs its expected refusal; anything else is a problem.
    if (m.type() === 'error' && !m.text().startsWith('Import error: BackupError')) problems.push(`console: ${m.text()}`);
  });
  return { browser, context, page, problems };
}

export const wait = (page, ms = 400) => page.waitForTimeout(ms);
export const store = (page, key) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null'), key);
export const toasts = (page) => page.locator('[data-sonner-toast]').allInnerTexts();

export function checker() {
  const results = [];
  const check = (name, ok, detail = '') => results.push({ name, ok: !!ok, detail: ok ? '' : String(detail) });
  const report = (problems = []) => {
    for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? `  -> ${r.detail}` : ''}`);
    for (const p of problems) console.log(`ERROR ${p}`);
    console.log(`\n${results.filter((r) => r.ok).length}/${results.length} passed`);
    if (results.some((r) => !r.ok) || problems.length) failed = true;
  };
  return { check, report };
}

/** Exit non-zero when anything failed, so `npm run test:e2e` reports it. */
export function finish() {
  if (failed) process.exitCode = 1;
}
