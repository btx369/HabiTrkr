import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Every language must translate every English key, so no screen mixes languages.
 * Read from the source text: the translations object is not exported.
 */
// Tests run from the app folder; import.meta.url is not a file URL under jsdom.
const source = readFileSync(path.join(process.cwd(), 'src/contexts/LanguageContext.tsx'), 'utf8');

function keysOf(language: string): Set<string> {
  const start = source.search(new RegExp(`\\n  ${language}: \\{\\n`));
  const body = source.slice(start + 1);
  const end = body.search(/\n {2}\},?\n/);
  return new Set([...body.slice(0, end).matchAll(/^\s+'([A-Za-z0-9_]+)':/gm)].map((m) => m[1]));
}

// Internal to the singular-toast wording (lib/entityToast), which these languages do not use.
const ENTITY_GRAMMAR = /^entity(Note|Event|Habit|Folder)(Singular|Gender)$/;
const WITHOUT_ENTITY_GRAMMAR = ['nl', 'pl', 'tr', 'ja', 'zh', 'ko'];

describe('translations', () => {
  const english = keysOf('en');

  it.each(['pt', 'es', 'fr', 'de', 'it', 'nl', 'pl', 'tr', 'ja', 'zh', 'ko'])('%s has every English key', (language) => {
    const have = keysOf(language);
    const missing = [...english].filter(
      (key) => !have.has(key) && !(WITHOUT_ENTITY_GRAMMAR.includes(language) && ENTITY_GRAMMAR.test(key)),
    );
    expect(missing).toEqual([]);
  });
});
