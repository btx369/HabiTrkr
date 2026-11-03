import { describe, expect, it } from 'vitest';
import { entitySentence } from './entityToast';

const dict: Record<string, Record<string, string>> = {
  en: { toastAdded: '{entity} added', entityHabitSingular: 'Habit', entityHabitGender: 'm', habits: 'Habits' },
  pt: {
    toastDeleted: '{entity} eliminado', toastDeletedF: '{entity} eliminada',
    entityNoteSingular: 'Nota', entityNoteGender: 'f', entityEventSingular: 'Evento', entityEventGender: 'm',
  },
  nl: { toastAdded: '{entity} toegevoegd', habits: 'Gewoontes' },
};
const t = (language: string) => (key: string) => dict[language][key] ?? key;

describe('entitySentence', () => {
  it('uses the singular noun', () => {
    expect(entitySentence(t('en'), 'en', 'toastAdded', 'habits')).toBe('Habit added');
  });

  it('agrees in gender where the language has a feminine template', () => {
    expect(entitySentence(t('pt'), 'pt', 'toastDeleted', 'noteViewerTitle')).toBe('Nota eliminada');
    expect(entitySentence(t('pt'), 'pt', 'toastDeleted', 'events')).toBe('Evento eliminado');
  });

  it('keeps the old wording for languages without singular nouns', () => {
    expect(entitySentence(t('nl'), 'nl', 'toastAdded', 'habits')).toBe('Gewoontes toegevoegd');
  });
});
