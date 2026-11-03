import { start, BASE, wait, store, toasts, checker, OUT, finish } from './lib.mjs';

const { browser, page, problems } = await start();
const { check, report } = checker();
const events = () => store(page, 'events');
const dlg = () => page.getByRole('dialog').last();
const card = (name) => page.locator('div').filter({ has: page.getByText(name, { exact: true }) }).filter({ has: page.getByRole('button', { name: 'More options' }) }).last();
const menu = async (name, item) => {
  await card(name).getByRole('button', { name: 'More options' }).click();
  await wait(page, 300);
  await page.getByRole('menuitem', { name: item, exact: true }).click();
  await wait(page, 500);
};
const confirmIfAsked = async (re) => {
  const d = page.getByRole('alertdialog');
  if (await d.count()) { await d.getByRole('button', { name: re }).last().click(); await wait(page, 500); }
};
const todayKey = new Date().toLocaleDateString('sv-SE');
const jsToday = new Date().getDay();

try {
  await page.goto(BASE + '/events');
  await wait(page, 1200);

  // 1. One-off event today with a time and an alert
  await page.getByRole('button', { name: 'Add' }).click();
  await wait(page, 500);
  await dlg().getByPlaceholder('e.g., Birthday party').fill('Dentist');
  await dlg().getByRole('button', { name: 'Set time' }).first().click();
  await wait(page, 400);
  const timeDlg = page.getByRole('dialog').filter({ hasText: 'Select time' });
  await timeDlg.locator('input').nth(0).fill('23');
  await timeDlg.locator('input').nth(1).fill('30');
  await timeDlg.getByRole('button', { name: 'OK' }).click();
  await wait(page, 400);
  await dlg().getByRole('combobox').last().click();
  await wait(page, 300);
  await page.getByRole('option', { name: /15 min/i }).click();
  await wait(page, 300);
  await dlg().getByRole('button', { name: 'Save' }).click();
  await wait(page, 700);
  let dentist = (await events())?.find((e) => e.name === 'Dentist');
  check('create one-off event', !!dentist, JSON.stringify(await events()));
  check('event defaults to today', dentist?.startDate === todayKey, dentist?.startDate);
  check('event time saved', dentist?.startTime === '23:30', dentist?.startTime);
  check('event alert saved', dentist?.alertType === '15min', dentist?.alertType);
  check('card says today', await page.getByText('Today!').count(), await page.locator('#root').innerText());

  // 2. Recurring every 2 weeks on today's weekday
  await page.getByRole('button', { name: 'Add' }).click();
  await wait(page, 500);
  await dlg().getByPlaceholder('e.g., Birthday party').fill('Gym');
  await dlg().getByText('Recurrent Event').locator('..').getByRole('switch').click();
  await wait(page, 400);
  await dlg().locator('input[type=number]').first().fill('2');
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const pressed = await dlg().getByRole('button', { name: dayNames[jsToday], exact: true }).getAttribute('aria-pressed');
  check('weekday buttons report their state', pressed === 'true' || pressed === 'false', pressed);
  if (pressed !== 'true') await dlg().getByRole('button', { name: dayNames[jsToday], exact: true }).click();
  await dlg().getByRole('button', { name: 'Save' }).click();
  await wait(page, 700);
  const gym = (await events())?.find((e) => e.name === 'Gym');
  check('recurring event saved', gym?.isRecurrent && gym.recurrenceType === 'weekly' && gym.recurrenceInterval === 2 && gym.recurrenceDays?.includes(jsToday), JSON.stringify(gym));

  // 3. Edit
  await menu('Dentist', 'Edit');
  await dlg().getByPlaceholder('e.g., Birthday party').fill('Dentist check-up');
  await dlg().getByRole('button', { name: 'Save' }).click();
  await wait(page, 600);
  dentist = (await events())?.find((e) => e.name === 'Dentist check-up');
  check('edit event keeps time and alert', dentist?.startTime === '23:30' && dentist?.alertType === '15min', JSON.stringify(dentist));

  // 4. Pin / copy / delete + undo
  await menu('Gym', 'Pin');
  check('pin event', (await events()).find((e) => e.name === 'Gym')?.pinned);
  await menu('Gym', 'Copy');
  const gyms = (await events()).filter((e) => e.name.startsWith('Gym'));
  check('copy event gets a unique id', gyms.length === 2 && new Set(gyms.map((g) => g.id)).size === 2, gyms.map((g) => g.name).join(','));
  const copyName = gyms.map((g) => g.name).find((n) => n !== 'Gym');
  await menu(copyName, 'Delete');
  await confirmIfAsked(/delete/i);
  check('delete event', !(await events()).some((e) => e.name === copyName));
  const undo = page.locator('[data-sonner-toast]').getByRole('button', { name: 'Undo' });
  if (await undo.count()) { await undo.first().click(); await wait(page, 600); }
  check('Undo restores event', (await events()).some((e) => e.name === copyName), JSON.stringify(await toasts(page)));
  check('toast wording is singular', !(await toasts(page)).some((t) => /Events (added|deleted|copied|pinned)/.test(t)), JSON.stringify(await toasts(page)));

  // 5. Manual archive and restore
  await menu(copyName, 'Archive');
  await confirmIfAsked(/archive/i);
  check('archive event', (await store(page, 'archivedEvents'))?.some((e) => e.name === copyName));
  await page.getByRole('tab', { name: 'Archived' }).click();
  await wait(page, 500);
  const row = page.locator('div').filter({ has: page.getByText(copyName, { exact: true }) }).filter({ has: page.getByRole('button', { name: 'Restore' }) }).last();
  if (await row.count()) await row.getByRole('button', { name: 'Restore' }).click();
  else await menu(copyName, 'Restore');
  await wait(page, 600);
  check('restore event', (await events()).some((e) => e.name === copyName));
  await page.getByRole('tab', { name: 'Events' }).click();
  await wait(page, 400);

  // 6. Past one-off events are auto-archived, without a useless Undo
  await page.evaluate(() => {
    const list = JSON.parse(localStorage.getItem('events'));
    list.push({ id: 'old', name: 'Old dinner', color: '#FFFFFF', createdAt: new Date().toISOString(), isRecurrent: false, startDate: '2026-10-01', endDate: '2026-10-01' });
    localStorage.setItem('events', JSON.stringify(list));
  });
  await page.reload();
  await wait(page, 1200);
  check('past event auto-archived', (await store(page, 'archivedEvents'))?.some((e) => e.id === 'old') && !(await events()).some((e) => e.id === 'old'));
  const archToast = await toasts(page);
  check('auto-archive toast has no Undo', !archToast.some((t) => t.includes('Undo')), JSON.stringify(archToast));

  // 7. Search
  await page.getByRole('button', { name: 'Search' }).click();
  await page.getByPlaceholder('Search').fill('dentist');
  await wait(page, 500);
  check('search events', (await page.getByText('Dentist check-up', { exact: true }).isVisible()) && !(await page.getByText('Gym', { exact: true }).isVisible()));
  await page.getByRole('button', { name: 'Close search' }).click();
  await wait(page, 400);

  // 8. Folders
  await page.getByRole('tab', { name: 'Folders' }).click();
  await wait(page, 400);
  await page.getByRole('button', { name: 'Add' }).click();
  await wait(page, 400);
  await dlg().locator('input').first().fill('Health');
  await dlg().getByRole('button', { name: /save|create/i }).last().click();
  await wait(page, 600);
  check('create event folder', (await store(page, 'eventFolders'))?.some((f) => f.name === 'Health'));
  await page.getByRole('tab', { name: 'Events' }).click();
  await wait(page, 400);
  await menu('Dentist check-up', 'Move');
  await dlg().getByText('Health', { exact: true }).click();
  await wait(page, 600);
  check('move event to folder', (await store(page, 'eventFolders')).find((f) => f.name === 'Health')?.eventIds?.length === 1);

  // 9. Calendar shows them on the right days
  await page.getByRole('button', { name: 'Calendar' }).click();
  await wait(page, 1000);
  const weekText = await page.locator('#root').innerText();
  check('calendar week shows today\'s events', weekText.includes('Dentist check-up') && weekText.includes('Gym'), weekText.slice(0, 300));
  check('calendar hides archived past event outside its week', !weekText.includes('Old dinner'));
  await page.getByRole('tab', { name: 'Month' }).click();
  await wait(page, 600);
  await page.getByRole('tab', { name: 'Day' }).click();
  await wait(page, 600);
  const dayText = await page.locator('#root').innerText();
  check('calendar day view shows timed event', dayText.includes('Dentist check-up'), dayText.slice(0, 300));
  await page.getByRole('button', { name: 'Next' }).click();
  await wait(page, 400);
  await page.getByRole('button', { name: 'Previous' }).click();
  await wait(page, 400);
  await page.getByText('Dentist check-up').first().click();
  await wait(page, 600);
  check('open event from calendar', await page.getByRole('dialog').getByText('Dentist check-up').count());
} catch (error) {
  check('script ran to the end', false, error.message.split('\n')[0]);
  await page.screenshot({ path: `${OUT}/events-fail.png` });
}

report(problems);
await browser.close();
finish();
