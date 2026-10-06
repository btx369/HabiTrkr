import type { Language } from '@/contexts/LanguageContext';

/**
 * Counted sentences for bulk actions.
 *
 * The count is what lets someone notice they archived three folders when they meant to
 * archive one, so it belongs inside the sentence. It cannot be pasted onto a noun in the
 * call site, though: in Portuguese "1 nota arquivada" and "2 notas arquivadas" change the
 * participle as well as the noun, and German changes the article. The dictionary therefore
 * holds a singular and a plural form of each sentence, and this picks between them.
 *
 * English and Portuguese are the two languages this is verified in; the other four are
 * filled in so nothing renders a placeholder, and their plural forms genuinely differ too
 * ("1 élément archivé" against "2 éléments archivés"), so the pair is not English-only
 * ceremony.
 */

/**
 * Which form to use for a count.
 *
 * English treats 0 as plural ("0 items"); French treats 0 and 1 as singular. Getting this
 * wrong produces "0 item archived", which reads like a defect in its own right.
 */
function needsPluralForm(count: number, language: Language): boolean {
  if (language === 'fr') return count > 1;
  return count !== 1;
}

/** The dictionary key pair for an entity, used to label the count. */
export type EntityKind = 'note' | 'event' | 'habit' | 'folder';

const ENTITY_KEYS: Record<EntityKind, { one: string; many: string }> = {
  note: { one: 'entityNoteOne', many: 'entityNoteMany' },
  event: { one: 'entityEventOne', many: 'entityEventMany' },
  habit: { one: 'entityHabitOne', many: 'entityHabitMany' },
  folder: { one: 'entityFolderOne', many: 'entityFolderMany' },
};

/** The noun for a count: "1 note" / "3 notes", "1 nota" / "3 notas". */
export function countedNoun(
  t: (key: string) => string,
  language: Language,
  kind: EntityKind,
  count: number,
): string {
  const keys = ENTITY_KEYS[kind];
  return `${count} ${t(needsPluralForm(count, language) ? keys.many : keys.one)}`;
}

/**
 * A sentence for a count, e.g. `bulkArchived` with 3 gives "3 items archived".
 *
 * `baseKey` names the pair: pass `bulkArchived` and it resolves `bulkArchivedOne` or
 * `bulkArchivedMany`. Any `{count}` in the sentence is replaced by the numeral.
 */
export function countedSentence(
  t: (key: string) => string,
  language: Language,
  baseKey: string,
  count: number,
): string {
  const key = `${baseKey}${needsPluralForm(count, language) ? 'Many' : 'One'}`;
  return t(key).replace('{count}', String(count));
}

/**
 * A sentence for a count of items belonging to a folder, e.g. "Folder and 3 notes archived".
 *
 * Two substitutions, because the noun inside the count has to agree with the number too.
 */
export function folderAndCount(
  t: (key: string) => string,
  language: Language,
  baseKey: 'folderAndCountArchived' | 'folderAndCountDeleted' | 'folderAndCountRestored',
  kind: EntityKind,
  count: number,
): string {
  const label = countedNoun(t, language, kind, count);
  return t(baseKey).replace('{count_label}', label);
}

/** How many words of a note's body stand in for a missing title. */
const NAME_FROM_BODY_WORDS = 3;

/**
 * What to call an item in a confirmation dialog.
 *
 * A dialog reading "Delete this item?" tells the user nothing about which item they are
 * about to lose, and these dialogs offer no other clue: the heading says "Delete Note"
 * whether one note is selected or a whole folder of them.
 *
 * Events and habits always have a name. A note need not — its title is optional and notes
 * are created with an empty one — so for a nameless note the opening words of its body are
 * used instead. That is the only case where something has to be derived, and the body is the
 * note's own content, so it identifies the note rather than guessing at it.
 */
export function itemDisplayName(
  t: (key: string) => string,
  item: { name?: string | null; description?: string | null },
): string {
  const name = (item.name ?? '').trim();
  if (name !== '') return name;

  const body = (item.description ?? '').replace(/\s+/g, ' ').trim();
  if (body === '') return t('untitledItem');

  const words = body.split(' ');
  const opening = words.slice(0, NAME_FROM_BODY_WORDS).join(' ');
  // An ellipsis marks this as a fragment, so a three-word note is not mistaken for a title
  // that simply happens to be three words long.
  return words.length > NAME_FROM_BODY_WORDS ? `${opening}…` : opening;
}

/** Fills `{name}` in a confirmation sentence that names the item. */
export function namedSentence(
  t: (key: string) => string,
  baseKey: 'confirmDeleteNamed' | 'confirmArchiveNamed' | 'confirmDeleteNamedBody' | 'confirmArchiveNamedBody',
  name: string,
): string {
  return t(baseKey).replace('{name}', name);
}
