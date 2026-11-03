import { start, BASE, wait, store, checker, OUT, finish } from './lib.mjs';

const { browser, page, problems } = await start();
const { check, report } = checker();

try {
  // Reports replaced Tasks; old links still land on it
  await page.goto(BASE + '/');
  await wait(page, 800);
  await page.getByRole('button', { name: 'Reports' }).click();
  await wait(page, 600);
  check('bottom nav opens Reports', page.url().endsWith('/reports') && (await page.locator('h1').innerText()) === 'Reports', page.url());
  await page.goto(BASE + '/tasks');
  await wait(page, 600);
  check('old /tasks link redirects to Reports', page.url().endsWith('/reports'), page.url());

  // Security page holds the note password and fingerprint options
  await page.goto(BASE + '/profile');
  await wait(page, 800);
  check('profile no longer shows "Log out"', !(await page.getByText('Log out', { exact: true }).count()));
  await page.getByText('Security', { exact: true }).click();
  await wait(page, 600);
  check('Security opens its page', page.url().endsWith('/security'));
  await page.getByText('Note password', { exact: true }).click();
  await wait(page, 400);
  await page.getByRole('dialog').getByPlaceholder('New password', { exact: true }).fill('testpass1');
  await page.getByRole('dialog').getByPlaceholder('Repeat the new password').fill('testpass1');
  await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
  await wait(page, 1500);
  check('create note password from Security', !!(await store(page, 'habitrkr.noteVault')) && (await page.getByText('Set', { exact: true }).count()) > 0);

  // Help/About, Terms, Privacy
  for (const [label, path, needle] of [['Help / About', '/about', 'Version'], ['Terms of Service', '/terms', 'Draft'], ['Privacy Policy', '/privacy', 'What we collect']]) {
    await page.goto(BASE + '/profile');
    await wait(page, 700);
    await page.getByText(label, { exact: true }).click();
    await wait(page, 600);
    const text = await page.locator('body').innerText();
    check(`${label} page opens`, page.url().endsWith(path) && text.includes(needle), page.url());
  }

  // Feedback composes a mail
  await page.goto(BASE + '/profile');
  await wait(page, 700);
  await page.getByText('Feedback', { exact: true }).click();
  await wait(page, 400);
  const send = page.getByRole('dialog').getByRole('button', { name: 'Write email' });
  check('feedback send disabled while empty', await send.isDisabled());
  await page.getByRole('radio', { name: 'Idea' }).click();
  await page.getByRole('dialog').getByRole('textbox').fill('Dark mode calendar idea');
  const mailto = page.waitForEvent('request', { predicate: (r) => r.url().startsWith('mailto:'), timeout: 3000 }).catch(() => null);
  await send.click();
  const request = await mailto;
  await wait(page, 400);
  check('feedback dialog closes after send', !(await page.getByRole('dialog').count()), String(request?.url() ?? ''));

  // Delete all data, scoped to HabiTrkr keys only
  await page.goto(BASE + '/profile');
  await page.evaluate(() => {
    localStorage.setItem('notes', JSON.stringify([{ id: 'x', name: 'x', type: 'text', color: '#FFFFFF', createdAt: '', pinned: false, description: '' }]));
    localStorage.setItem('someOtherSite.key', 'keep me');
  });
  await page.reload();
  await wait(page, 800);
  await page.getByText('Delete all data', { exact: true }).click();
  await wait(page, 400);
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete all data' }).click().catch(async () => page.getByRole('dialog').getByRole('button', { name: 'Delete all data' }).click());
  await page.waitForLoadState('load');
  await wait(page, 1200);
  check('delete all data clears app data', (await store(page, 'notes')) === null && (await store(page, 'habitrkr.noteVault')) === null);
  check('delete all data leaves other sites\' keys', (await page.evaluate(() => localStorage.getItem('someOtherSite.key'))) === 'keep me');

  // Every language renders without English leftovers in the main nav
  for (const lang of ['nl', 'pl', 'tr', 'ja', 'zh', 'ko']) {
    await page.evaluate((l) => localStorage.setItem('habitrkr.language', l), lang);
    await page.goto(BASE + '/notes');
    await wait(page, 700);
    const text = await page.locator('#root').innerText();
    check(`${lang}: notes page translated`, !/\b(Folders|Archived|Create Note)\b/.test(text), text.slice(0, 80));
  }
} catch (error) {
  check('script ran to the end', false, error.message.split('\n')[0]);
  await page.screenshot({ path: `${OUT}/pages-fail.png` });
}

report(problems);
await browser.close();
finish();
