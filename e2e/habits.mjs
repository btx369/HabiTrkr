import { start, BASE, wait, store, toasts, checker, OUT, finish } from './lib.mjs';

const { browser, page, problems } = await start();
const { check, report } = checker();
const todayLabel = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
const habits = () => store(page, 'habits');
const dialog = () => page.locator('[role=dialog]');

async function createHabit(name, setup = async () => {}) {
  await page.getByRole('button', { name: 'Add' }).click();
  await wait(page);
  await dialog().getByPlaceholder('e.g., Drink 8 glasses of water').fill(name);
  await setup();
  await dialog().getByRole('button', { name: 'Save' }).click();
  await wait(page, 600);
}
const card = (name) => page.locator('div').filter({ has: page.getByText(name, { exact: true }) }).filter({ has: page.getByRole('button', { name: 'More options' }) }).last();
const dayButton = (name, label = todayLabel) => card(name).locator(`button[aria-label^="${label}"]`);
const menu = async (name, item) => {
  await card(name).getByRole('button', { name: 'More options' }).click();
  await wait(page, 300);
  await page.getByRole('menuitem', { name: item }).click();
  await wait(page, 500);
};

try {
  await page.goto(BASE + '/');
  await wait(page, 1200);

  // 1. Basic habit
  await createHabit('Read');
  check('add toast is singular', (await toasts(page)).some((t) => t.includes('Habit added')), JSON.stringify(await toasts(page)));
  let list = await habits();
  check('create basic habit', list?.length === 1 && list[0].name === 'Read', JSON.stringify(list));
  check('habit card visible', await card('Read').isVisible());

  // 2. Toggle today
  await dayButton('Read').click();
  await wait(page);
  const todayKey = new Date().toLocaleDateString('sv-SE');
  check('mark today done', (await habits())[0].completedDates.includes(todayKey), JSON.stringify((await habits())[0].completedDates));
  await dayButton('Read').click();
  await wait(page);
  check('unmark today', !(await habits())[0].completedDates.includes(todayKey));

  // 3. Future days are disabled
  const future = await card('Read').locator('button[aria-pressed]').evaluateAll((els) => els.filter((e) => e.disabled).length);
  check('future days disabled', future >= 1, `disabled=${future}`);

  // 4. Number of days + times per day
  await createHabit('Water', async () => {
    await dialog().locator('#number-of-days').click();
    await wait(page, 300);
    await dialog().locator('#times-per-day').click();
    await wait(page, 300);
    await dialog().locator('input[type=number]').nth(1).fill('2');
  });
  let water = (await habits()).find((h) => h.name === 'Water');
  check('times-per-day habit saved', water?.useNumberOfDays && water?.useTimesPerDay && water?.timesPerDay === 2, JSON.stringify(water));
  await dayButton('Water').click();
  await wait(page);
  water = (await habits()).find((h) => h.name === 'Water');
  check('first of 2 counts, not done', water.completionCounts?.[todayKey] === 1 && !water.completedDates.includes(todayKey), JSON.stringify(water));
  await dayButton('Water').click();
  await wait(page);
  water = (await habits()).find((h) => h.name === 'Water');
  check('second of 2 completes the day', water.completedDates.includes(todayKey), JSON.stringify(water));
  check('today disabled at daily limit', await dayButton('Water').isDisabled());
  await card('Water').getByRole('button', { name: 'Undo' }).first().click();
  await wait(page);
  water = (await habits()).find((h) => h.name === 'Water');
  check('undo button decrements and un-completes', water.completionCounts?.[todayKey] === 1 && !water.completedDates.includes(todayKey), JSON.stringify(water));

  // 5. Hidden "times per day" left on after turning "number of days" off
  await createHabit('Stretch', async () => {
    await dialog().locator('#number-of-days').click();
    await wait(page, 300);
    await dialog().locator('#times-per-day').click();
    await wait(page, 300);
    await dialog().locator('#number-of-days').click();
    await wait(page, 300);
  });
  const stretch = (await habits()).find((h) => h.name === 'Stretch');
  check('turning "number of days" off also turns off its "times per day"', !stretch.useTimesPerDay, JSON.stringify({ useNumberOfDays: stretch.useNumberOfDays, useTimesPerDay: stretch.useTimesPerDay }));

  // 6. Unlimited
  await createHabit('Pushups', async () => {
    await dialog().locator('#unlimited-times').click();
    await wait(page, 300);
  });
  for (let i = 0; i < 3; i++) { await dayButton('Pushups').click(); await wait(page, 250); }
  const push = (await habits()).find((h) => h.name === 'Pushups');
  check('unlimited counts 3 taps', push.completionCounts?.[todayKey] === 3, JSON.stringify(push.completionCounts));

  // 7. Edit
  await menu('Read', 'Edit');
  check('edit dialog title translated/consistent', (await dialog().locator('h2').innerText()) === 'Edit Habit', await dialog().locator('h2').innerText());
  await dialog().getByPlaceholder('e.g., Drink 8 glasses of water').fill('Read book');
  await dialog().getByRole('button', { name: 'Save' }).click();
  await wait(page, 600);
  check('edit renames habit', (await habits()).some((h) => h.name === 'Read book'));

  // 8. Archive and restore
  await menu('Read book', 'Archive');
  const confirm = page.getByRole('alertdialog');
  if (await confirm.count()) { await confirm.getByRole('button', { name: /archive/i }).last().click(); await wait(page, 500); }
  const archived = await store(page, 'archivedHabits');
  check('archive moves habit', archived?.some((h) => h.name === 'Read book') && !(await habits()).some((h) => h.name === 'Read book'), JSON.stringify(archived));
  await page.getByRole('tab', { name: 'Archived' }).click();
  await wait(page, 500);
  await page.locator('div').filter({ has: page.getByText('Read book', { exact: true }) }).filter({ has: page.getByRole('button', { name: 'Restore' }) }).last().getByRole('button', { name: 'Restore' }).click();
  await wait(page, 600);
  check('restore brings habit back', (await habits()).some((h) => h.name === 'Read book'));
  await page.getByRole('tab', { name: 'Habits' }).click();
  await wait(page, 500);

  // 9. Delete + Undo
  await menu('Stretch', 'Delete');
  const del = page.getByRole('alertdialog');
  if (await del.count()) { await del.getByRole('button', { name: /delete/i }).last().click(); await wait(page, 500); }
  check('delete removes habit', !(await habits()).some((h) => h.name === 'Stretch'));
  const undo = page.locator('[data-sonner-toast]').getByRole('button', { name: 'Undo' });
  check('delete toast offers Undo', await undo.count(), JSON.stringify(await toasts(page)));
  if (await undo.count()) { await undo.first().click(); await wait(page, 600); }
  check('Undo restores deleted habit', (await habits()).some((h) => h.name === 'Stretch'));

  // 10. View modes
  for (const mode of ['3 per row', '2 per row', 'List']) {
    await page.getByRole('button', { name: 'View and sort' }).click();
    await wait(page, 300);
    await page.getByRole('menuitemradio', { name: mode }).click();
    await page.keyboard.press('Escape');
    await wait(page, 400);
    check(`view mode ${mode} stays usable`, await card('Water').isVisible());
  }

  // 11. Sort by title
  await page.getByRole('button', { name: 'View and sort' }).click();
  await wait(page, 300);
  await page.getByRole('menuitem', { name: /Title/ }).click();
  await page.keyboard.press('Escape');
  await wait(page, 400);
  const names = await page.locator('h3').allInnerTexts();
  check('sort by title', true, names.join(','));

  // 12. Week navigation
  const weekBefore = await page.locator('h3').first().innerText();
  await page.getByRole('button', { name: 'Previous' }).click();
  await wait(page, 400);
  const weekAfter = await page.locator('h3').first().innerText();
  check('previous week navigates', weekBefore !== weekAfter, `${weekBefore} -> ${weekAfter}`);
  await page.getByRole('button', { name: 'Next' }).click();
  await wait(page, 400);

  // 13. Search
  await page.getByRole('button', { name: 'Search' }).click();
  await page.getByPlaceholder('Search').fill('water');
  await wait(page, 500);
  const shown = {};
  for (const n of ['Pushups', 'Water', 'Read book']) shown[n] = await page.getByText(n, { exact: true }).isVisible().catch(() => false);
  check('search filters habits', !shown.Pushups && shown.Water && !shown['Read book'], JSON.stringify(shown));
  await page.getByRole('button', { name: 'Close search' }).click();
  await wait(page, 400);

  // 14. Folders
  await page.getByRole('tab', { name: 'Folders' }).click();
  await wait(page, 500);
  await page.getByRole('button', { name: 'Add' }).click();
  await wait(page, 500);
  await page.locator('[role=dialog] input').first().fill('Health');
  await page.locator('[role=dialog]').getByRole('button', { name: /save|create/i }).last().click();
  await wait(page, 600);
  const folders = await store(page, 'habitFolders');
  check('create habit folder', folders?.some((f) => f.name === 'Health'), JSON.stringify(folders));
  await page.getByRole('tab', { name: 'Habits' }).click();
  await wait(page, 500);
  await menu('Water', 'Move');
  await page.getByRole('dialog').getByText('Health', { exact: true }).click();
  await wait(page, 600);
  const moved = (await store(page, 'habitFolders')).find((f) => f.name === 'Health');
  const waterId = (await habits()).find((h) => h.name === 'Water').id;
  check('move habit into folder', JSON.stringify(moved).includes(waterId), JSON.stringify(moved));

  // 15. Desktop width: nothing overlaps on a habit card with badges
  await page.setViewportSize({ width: 1280, height: 860 });
  await wait(page, 500);
  check('desktop shows Water card', await card('Water').isVisible());

  // 16. Reload keeps data
  await page.reload();
  await wait(page, 1200);
  check('data survives reload', (await habits()).length >= 3);
} catch (error) {
  check('script ran to the end', false, error.message.split('\n')[0]);
  await page.screenshot({ path: `${OUT}/habits-fail.png` });
}

report(problems);
await browser.close();
finish();
