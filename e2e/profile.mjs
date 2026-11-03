import fs from 'node:fs';
import { start, BASE, wait, store, toasts, checker, OUT, finish } from './lib.mjs';

const { browser, page, problems } = await start();
const { check, report } = checker();
const raw = (k) => page.evaluate((key) => localStorage.getItem(key), k);

try {
  await page.goto(BASE + '/notes');
  await page.evaluate(() => {
    const now = new Date().toISOString();
    localStorage.setItem('notes', JSON.stringify([
      { id: 'n1', name: 'Invoice', type: 'text', color: '#FFFFFF', createdAt: now, pinned: false, description: 'march', tags: ['work', 'money'] },
      { id: 'n2', name: 'Plan', type: 'text', color: '#FFFFFF', createdAt: now, pinned: false, description: 'q2', tags: ['work'] },
    ]));
    localStorage.setItem('folders', JSON.stringify([{ id: 'f1', name: 'Work', color: '#FFFFFF', createdAt: now, noteIds: [], autoImportEnabled: true, autoImportTags: ['work'] }]));
    localStorage.setItem('allTags', JSON.stringify({ work: 2, money: 1 }));
    localStorage.setItem('archivedHabits', JSON.stringify([{ id: 'h9', name: 'Old habit', color: '#FFFFFF', createdAt: now, completedDates: [], activeDays: [true, true, true, true, true, true, true] }]));
  });

  // Tags manager
  await page.goto(BASE + '/tags');
  await wait(page, 1000);
  const tagsText = await page.locator('#root').innerText();
  check('tags page lists tags with counts', tagsText.includes('work') && tagsText.includes('money'), tagsText.slice(0, 200));
  const workRow = page.locator('div').filter({ has: page.getByText('#work', { exact: true }) }).filter({ has: page.getByRole('button', { name: 'Edit' }) }).last();
  await workRow.getByRole('button', { name: 'Edit' }).click();
  await wait(page, 400);
  await page.getByRole('dialog').locator('input').fill('job');
  await page.getByRole('dialog').getByRole('button', { name: /save|rename/i }).last().click();
  await wait(page, 600);
  const notesAfter = await store(page, 'notes');
  check('rename tag on notes', notesAfter.every((n) => !n.tags.includes('work')) && notesAfter.filter((n) => n.tags.includes('job')).length === 2, JSON.stringify(notesAfter.map((n) => n.tags)));
  check('rename tag in folder rule', (await store(page, 'folders'))[0].autoImportTags.includes('job'));
  const moneyRow = page.locator('div').filter({ has: page.getByText('#money', { exact: true }) }).filter({ has: page.getByRole('button', { name: 'Delete' }) }).last();
  await moneyRow.getByRole('button', { name: 'Delete' }).click();
  await wait(page, 400);
  await page.getByRole('alertdialog').getByRole('button', { name: /delete/i }).last().click().catch(async () => page.getByRole('dialog').getByRole('button', { name: /delete/i }).last().click());
  await wait(page, 600);
  check('delete tag', (await store(page, 'notes')).every((n) => !n.tags.includes('money')));

  // Profile: theme, language, week start, toasts
  await page.goto(BASE + '/profile');
  await wait(page, 1000);
  await page.getByText('Theme', { exact: true }).click();
  await wait(page, 300);
  check('theme toggles to dark', (await page.evaluate(() => document.documentElement.className)).includes('dark') && (await raw('habitrkr.theme')) === 'dark');
  await page.getByText('Theme', { exact: true }).click();
  await wait(page, 300);

  await page.getByText('Week starts on', { exact: true }).click();
  await wait(page, 400);
  await page.getByRole('dialog').getByText('Sunday', { exact: true }).click();
  await wait(page, 400);
  check('week start saved', (await raw('habitrkr.weekStartDay')) === 'sunday', await raw('habitrkr.weekStartDay'));
  await page.keyboard.press('Escape');
  await page.goto(BASE + '/');
  await wait(page, 800);
  const firstDay = await page.locator('#root').innerText();
  check('habits week starts on Sunday', /Sun[\s\S]*Mon/.test(firstDay.slice(0, 400)) && firstDay.indexOf('Sun') < firstDay.indexOf('Mon'), firstDay.slice(0, 200));
  await page.goto(BASE + '/profile');
  await wait(page, 800);
  await page.getByText('Week starts on', { exact: true }).click();
  await wait(page, 400);
  await page.getByRole('dialog').getByText('Monday', { exact: true }).click();
  await wait(page, 400);
  await page.keyboard.press('Escape');

  await page.getByText('Language', { exact: true }).click();
  await wait(page, 400);
  await page.getByRole('dialog').getByText('Português', { exact: true }).click();
  await wait(page, 600);
  await page.keyboard.press('Escape');
  await wait(page, 300);
  const ptText = await page.locator('#root').innerText();
  check('language switches to Portuguese', ptText.includes('Perfil') && ptText.includes('Definições') === false && ptText.includes('Tema'), ptText.slice(0, 200));
  await page.goto(BASE + '/notes');
  await wait(page, 800);
  const ptNotes = await page.locator('#root').innerText();
  check('pages follow the language', ptNotes.includes('Notas') && ptNotes.includes('Pastas'), ptNotes.slice(0, 120));
  await page.goto(BASE + '/profile');
  await wait(page, 800);
  await page.getByText('Idioma', { exact: true }).click();
  await wait(page, 400);
  await page.getByRole('dialog').getByText('English', { exact: true }).click();
  await wait(page, 600);
  await page.keyboard.press('Escape');

  // Export and re-import a backup through the real buttons
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Export' }).click()]);
  const file = `${OUT}/backup-test.json`;
  await download.saveAs(file);
  const backup = JSON.parse(fs.readFileSync(file, 'utf8'));
  check('export is version 2 with every key', backup.version === 2 && 'archivedHabits' in backup.data && 'folders' in backup.data && 'allTags' in backup.data, Object.keys(backup.data ?? {}).join(','));
  await page.evaluate(() => { localStorage.removeItem('archivedHabits'); localStorage.setItem('notes', '[]'); });
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Import' }).click();
  await (await chooser).setFiles(file);
  await wait(page, 400);
  await page.getByRole('alertdialog').getByRole('button', { name: 'Import' }).click().catch(async () => page.getByRole('dialog').getByRole('button', { name: 'Import' }).last().click());
  await page.waitForLoadState('load');
  await wait(page, 1500);
  check('import restores notes and archived habits', (await store(page, 'notes'))?.length === 2 && (await store(page, 'archivedHabits'))?.length === 1);
  check('theme and language unchanged by import', (await raw('habitrkr.language')) === 'en');

  // Bad file is refused without changes
  fs.writeFileSync(`${OUT}/bad.json`, '{"hello":1}');
  const chooser2 = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Import' }).click();
  await (await chooser2).setFiles(`${OUT}/bad.json`);
  await wait(page, 400);
  await page.getByRole('alertdialog').getByRole('button', { name: 'Import' }).click().catch(async () => page.getByRole('dialog').getByRole('button', { name: 'Import' }).last().click());
  await wait(page, 800);
  check('invalid backup refused', (await toasts(page)).some((t) => /invalid/i.test(t)) && (await store(page, 'notes'))?.length === 2, JSON.stringify(await toasts(page)));

  // Toasts off
  await page.getByText('Notifications', { exact: true }).click();
  await wait(page, 300);
  check('toasts can be switched off', (await raw('toasts-enabled')) === 'false', await raw('toasts-enabled'));
} catch (error) {
  check('script ran to the end', false, error.message.split('\n')[0]);
  await page.screenshot({ path: `${OUT}/profile-fail.png` });
}

report(problems);
await browser.close();
finish();
