import { start, BASE, wait, store, toasts, checker, OUT, finish } from './lib.mjs';

const { browser, page, problems } = await start();
const { check, report } = checker();
const notes = () => store(page, 'notes');
const viewer = () => page.locator('[role=dialog]').last();
const card = (name) => page.locator('div').filter({ has: page.getByText(name, { exact: true }) }).filter({ has: page.getByRole('button', { name: 'More options' }) }).last();
const menu = async (name, item) => {
  await card(name).getByRole('button', { name: 'More options' }).click();
  await wait(page, 300);
  await page.getByRole('menuitem', { name: item, exact: true }).click();
  await wait(page, 500);
};
const confirmIfAsked = async (re) => {
  const dlg = page.getByRole('alertdialog');
  if (await dlg.count()) { await dlg.getByRole('button', { name: re }).last().click(); await wait(page, 500); }
};

async function newNote(type, title, fill) {
  await page.getByRole('button', { name: 'Add' }).click();
  await wait(page, 300);
  await page.getByRole('button', { name: type, exact: true }).click();
  await wait(page, 700);
  await viewer().getByText('Add a title').click();
  await wait(page, 200);
  await page.keyboard.type(title);
  await page.keyboard.press('Enter');
  await wait(page, 300);
  await fill();
  await viewer().getByRole('button', { name: 'Back' }).click();
  await wait(page, 700);
}

try {
  await page.goto(BASE + '/notes');
  await wait(page, 1200);

  // 1. Text note
  await newNote('Text', 'Shopping', async () => {
    await viewer().getByText('Start writing...').click();
    await wait(page, 400);
    await page.keyboard.type('Buy apples and #groceries');
  });
  let list = await notes();
  const shopping = list?.find((n) => n.name === 'Shopping');
  check('create text note', !!shopping, JSON.stringify(list));
  check('text note content saved', shopping?.description?.includes('apples'), shopping?.description);
  check('text note card shows preview', await card('Shopping').getByText(/apples/).count());

  // 2. List note
  await newNote('List', 'Todo', async () => {
    await viewer().getByRole('button', { name: 'List item' }).click();
    await wait(page, 300);
    await page.keyboard.type('First');
    await page.keyboard.press('Enter');
    await wait(page, 300);
    await page.keyboard.type('Second');
    await wait(page, 300);
  });
  const todo = (await notes()).find((n) => n.name === 'Todo');
  check('create list note with 2 items', todo?.items?.filter((i) => i.text).length === 2, JSON.stringify(todo?.items));

  // 3. Tick an item from the card or viewer
  await card('Todo').click();
  await wait(page, 700);
  await viewer().getByRole('checkbox', { name: 'First' }).click();
  await wait(page, 400);
  const ticked = (await notes()).find((n) => n.name === 'Todo')?.items?.filter((i) => i.completed).length;
  check('tick a list item', ticked === 1, `completed=${ticked}`);
  await viewer().getByRole('button', { name: 'Back' }).click();
  await wait(page, 600);

  // 3b. Reminder, Keep style: the bell, a quick choice, a chip in the note and on the card
  await card('Todo').click();
  await wait(page, 700);
  await viewer().getByTestId('note-remind-button').click();
  await wait(page, 500);
  await page.getByTestId('reminder-dialog').getByText('Tomorrow', { exact: true }).click();
  await wait(page, 600);
  const reminder = (await notes()).find((n) => n.name === 'Todo')?.reminder;
  check('set a note reminder', /T08:00$/.test(reminder?.at ?? ''), JSON.stringify(reminder));
  check('reminder chip in the note', await viewer().getByTestId('note-reminder-chip').isVisible());
  await viewer().getByRole('button', { name: 'Back' }).click();
  await wait(page, 600);
  check('reminder bell on the card', (await card('Todo').getByTestId('note-reminder-icon').count()) === 1);
  await page.goto(`${BASE}/reports`);
  await wait(page, 900);
  check('reports list notes with reminders', await page.getByTestId('reports-note-reminders').getByText('Todo').isVisible());
  await page.getByTestId('reports-note-reminders').getByText('Todo').click();
  await wait(page, 900);
  check('reports opens the note', await viewer().getByTestId('note-reminder-chip').isVisible());
  await viewer().getByRole('button', { name: 'Remove' }).click();
  await wait(page, 500);
  check('remove a note reminder', !(await notes()).find((n) => n.name === 'Todo')?.reminder);
  await viewer().getByRole('button', { name: 'Back' }).click();
  await wait(page, 600);

  // 4. Pin
  await menu('Todo', 'Pin');
  check('pin note', (await notes()).find((n) => n.name === 'Todo')?.pinned === true);

  // 5. Copy
  await menu('Shopping', 'Copy');
  const copies = (await notes()).filter((n) => n.name.startsWith('Shopping'));
  check('copy note', copies.length === 2 && new Set(copies.map((c) => c.id)).size === 2, copies.map((c) => c.name).join(','));

  // 6. Colour via Edit
  await menu('Shopping', 'Edit');
  await wait(page, 300);
  await page.getByRole('dialog').getByRole('button', { name: 'Color 1', exact: true }).click();
  await page.getByRole('dialog').locator('input').nth(1).fill('#groceries');
  await page.getByRole('dialog').getByRole('button', { name: 'Add', exact: true }).click();
  await wait(page, 300);
  await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
  await wait(page, 500);
  check('change note colour', (await notes()).find((n) => n.name === 'Shopping')?.color !== '#FFFFFF');

  // 7. Search
  await page.getByRole('button', { name: 'Search' }).click();
  await page.getByPlaceholder('Search').fill('apples');
  await wait(page, 500);
  check('search finds by content', await page.getByText('Shopping', { exact: true }).isVisible() && !(await page.getByText('Todo', { exact: true }).isVisible()));
  await page.getByPlaceholder('Search').fill('#groceries');
  await wait(page, 500);
  check('search by tag', await page.getByText('Shopping', { exact: true }).isVisible(), JSON.stringify((await notes()).map((n) => [n.name, n.tags])));
  await page.getByRole('button', { name: 'Close search' }).click();
  await wait(page, 400);

  // 8. Archive / restore / delete + Undo
  await menu('Todo', 'Archive');
  await confirmIfAsked(/archive/i);
  check('archive note', (await store(page, 'archivedNotes'))?.some((n) => n.name === 'Todo'));
  await page.getByRole('tab', { name: 'Archived' }).click();
  await wait(page, 500);
  const archivedRow = page.locator('div').filter({ has: page.getByText('Todo', { exact: true }) }).filter({ has: page.getByRole('button', { name: 'Restore' }) }).last();
  await archivedRow.getByRole('button', { name: 'Restore' }).click();
  await wait(page, 600);
  check('restore note', (await notes()).some((n) => n.name === 'Todo'));
  await page.getByRole('tab', { name: 'Notes' }).click();
  await wait(page, 400);

  const copyName = copies.map((c) => c.name).find((n) => n !== 'Shopping');
  await menu(copyName, 'Delete');
  await confirmIfAsked(/delete/i);
  check('delete note', !(await notes()).some((n) => n.name === copyName));
  const undo = page.locator('[data-sonner-toast]').getByRole('button', { name: 'Undo' });
  if (await undo.count()) { await undo.first().click(); await wait(page, 600); }
  check('Undo restores deleted note', (await notes()).some((n) => n.name === copyName), JSON.stringify(await toasts(page)));

  // 9. PIN lock
  await menu('Shopping', 'Lock');
  await page.getByRole('button', { name: /^PIN/ }).click();
  await wait(page, 500);
  for (const d of '1234') await page.getByRole('dialog').getByRole('button', { name: d, exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Set PIN' }).click();
  await wait(page, 800);
  const locked = (await notes()).find((n) => n.name === 'Shopping');
  check('PIN lock hashes the PIN', locked?.locked && locked.pinHash && !locked.pin, JSON.stringify({ locked: locked?.locked, pin: locked?.pin }));
  check('locked card hides content', !(await card('Shopping').getByText(/apples/).count()));

  // 10. Folders
  await page.getByRole('tab', { name: 'Folders' }).click();
  await wait(page, 400);
  await page.getByRole('button', { name: 'Add' }).click();
  await wait(page, 400);
  await page.getByRole('dialog').locator('input').first().fill('Home');
  await page.getByRole('dialog').getByRole('button', { name: /save|create/i }).last().click();
  await wait(page, 600);
  check('create note folder', (await store(page, 'folders'))?.some((f) => f.name === 'Home'));
  await page.getByRole('tab', { name: 'Notes' }).click();
  await wait(page, 400);
  await menu('Todo', 'Move');
  await page.getByRole('dialog').getByText('Home', { exact: true }).click();
  await wait(page, 600);
  const home = (await store(page, 'folders')).find((f) => f.name === 'Home');
  check('move note to folder', home?.noteIds?.length === 1, JSON.stringify(home));

  // 11. View modes
  for (const mode of ['3 per row', '2 per row', 'List']) {
    await page.getByRole('button', { name: 'View and sort' }).click();
    await wait(page, 300);
    await page.getByRole('menuitemradio', { name: mode }).click().catch(async () => page.getByRole('menuitem', { name: mode }).click());
    await page.keyboard.press('Escape');
    await wait(page, 400);
    check(`notes view ${mode}`, await page.getByText('Todo', { exact: true }).first().isVisible());
  }

  await page.reload();
  await wait(page, 1200);
  check('notes survive reload', (await notes()).length >= 3);
} catch (error) {
  check('script ran to the end', false, error.message.split('\n')[0]);
  await page.screenshot({ path: `${OUT}/notes-fail.png` });
}

report(problems);
await browser.close();
finish();
