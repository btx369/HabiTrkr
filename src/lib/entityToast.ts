/**
 * "Note deleted", "Nota eliminada", "Evento eliminado": the one-item toasts.
 *
 * These used to fill `{entity}` with the page's plural title ("Habits added" after
 * adding one habit), and the Portuguese, Spanish, French and Italian templates were
 * masculine only, so a feminine noun read "Nota eliminado". Each entity now has a
 * singular noun and a grammatical gender, and a feminine template (`<key>F`) is used
 * where the language has one.
 *
 * Languages without singular nouns yet keep the previous wording rather than mixing
 * an English noun into a translated sentence.
 */

type Translate = (key: string) => string;

const ENTITY_BY_KEY: Record<string, string> = {
  notes: 'Note',
  noteViewerTitle: 'Note',
  events: 'Event',
  habits: 'Habit',
  tabFolders: 'Folder',
};

const WITH_SINGULAR_NOUNS = new Set(['en', 'pt', 'es', 'fr', 'de', 'it']);

export function entitySentence(t: Translate, language: string, key: string, entityKey: string): string {
  const entity = ENTITY_BY_KEY[entityKey];
  if (!entity || !WITH_SINGULAR_NOUNS.has(language)) return t(key).replace('{entity}', t(entityKey));

  const feminine = t(`entity${entity}Gender`) === 'f';
  const feminineKey = `${key}F`;
  const template = feminine && t(feminineKey) !== feminineKey ? t(feminineKey) : t(key);
  return template.replace('{entity}', t(`entity${entity}Singular`));
}
