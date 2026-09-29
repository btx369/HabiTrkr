/**
 * Checks the search engine: `and`/`or` precedence, plain words as conditions, and that
 * a simple search still behaves as it always did.
 *
 * Runs the app's real parser, compiled with esbuild.
 *
 * Usage: node scripts/verify-search.mjs
 */

import { build } from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

const res = await build({
  entryPoints: [path.join(root, 'src/lib/tagParser.ts')],
  bundle: true,
  format: 'esm',
  write: false,
  platform: 'neutral',
});
const { parseSearchExpression, matchesSearchExpression, parseTagsFromInput, validateTag } =
  await import(`data:text/javascript;base64,${Buffer.from(res.outputFiles[0].text).toString('base64')}#${Date.now()}`);

let failures = 0;
const check = (label, actual, expected) => {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  const ok = a === e;
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`);
  if (!ok) console.log(`        actual   = ${a}\n        expected = ${e}`);
};

/**
 * Compares result sets ignoring order. The pages filter in array order, which is an
 * implementation detail and not what these tests are about.
 */
const checkSet = (label, actual, expected) => {
  const sorted = [...actual].sort();
  const wanted = [...expected].sort();
  const ok = JSON.stringify(sorted) === JSON.stringify(wanted);
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`);
  if (!ok) console.log(`        actual   = ${JSON.stringify(sorted)}\n        expected = ${JSON.stringify(wanted)}`);
};

/** Test notes. Note that none of them carries both [a] and [c] at once. */
const NOTES = [
  { id: '1', name: 'Alpha', type: 'text', description: 'first note about clients', tags: ['a'] },
  { id: '2', name: 'Charlie', type: 'text', description: 'third note', tags: ['c'] },
  { id: '3', name: 'Both', type: 'text', description: 'has both tags and budget', tags: ['a', 'c'] },
  { id: '4', name: 'Bravo', type: 'text', description: 'second note', tags: ['b'] },
  { id: '5', name: 'List note', type: 'list', description: '', tags: ['a'], items: [{ id: 'i', text: 'groceries and milk', completed: false }] },
];

/** The same matching function the app uses in Notes.tsx. */
function search(query) {
  const expression = parseSearchExpression(query);
  return NOTES.filter((note) => {
    const matchesText = (term) => {
      if (note.name.toLowerCase().includes(term)) return true;
      switch (note.type) {
        case 'text': return note.description.toLowerCase().includes(term);
        case 'list': return note.items.some((i) => i.text.toLowerCase().includes(term));
        default: return false;
      }
    };
    return matchesSearchExpression(expression, note.tags, matchesText);
  }).map((n) => n.name);
}

console.log('\n=== 1. Plain search (must not regress) ===');
check('free text: "clients"', search('clients'), ['Alpha']);
// "Both" has the description "has both tags and budget", which does NOT contain "note",
// so it is absent — correct for a character-based search.
check('character matching: "note"', search('note'), ['Alpha', 'Charlie', 'Bravo', 'List note']);
check('single character: "a" finds everything with an A', search('a'), ['Alpha', 'Charlie', 'Both', 'Bravo', 'List note']);
check('tag alone: "#a"', search('#a'), ['Alpha', 'Both', 'List note']);
check('name is searchable', search('Charlie'), ['Charlie']);
check('list item content', search('groceries'), ['List note']);
check('no results', search('zzzz'), []);

console.log('\n=== 2. AND requires ALL conditions on the SAME note ===');
check('"#a and #c" -> only notes with both', search('#a and #c'), ['Both']);
check('"#a AND #c" -> uppercase works', search('#a AND #c'), ['Both']);
check('"#a and #b" -> nothing has both', search('#a and #b'), []);
check('implicit AND: "#a #c"', search('#a #c'), ['Both']);
check('three tags: "#a and #c and #b" -> nothing', search('#a and #c and #b'), []);

console.log('\n=== 3. OR is a union ===');
checkSet('"#a or #c"', search('#a or #c'), ['Alpha', 'Both', 'List note', 'Charlie']);
checkSet('"#a or #b or #c" -> everything', search('#a or #b or #c'), ['Alpha', 'Both', 'List note', 'Charlie', 'Bravo']);

console.log('\n=== 4. Precedence: `and` binds tighter than `or` ===');
checkSet('"#a or #b and #c" = #a OR (#b AND #c)', search('#a or #b and #c'), ['Alpha', 'Both', 'List note']);
// (#a AND clients) OR #c  ->  Alpha (a+clients), Charlie (c), Both (c)
checkSet('"#a and clients or #c" = (#a AND clients) OR #c', search('#a and clients or #c'), ['Alpha', 'Charlie', 'Both']);
checkSet('"#a and #c or #b" = (#a AND #c) OR #b', search('#a and #c or #b'), ['Both', 'Bravo']);

console.log('\n=== 5. Plain words as conditions ===');
checkSet('"#a and clients" -> tag plus word', search('#a and clients'), ['Alpha']);
checkSet('"#a and budget" -> tag plus word on another note', search('#a and budget'), ['Both']);
checkSet('"#a and zzzz" -> word that matches nothing', search('#a and zzzz'), []);
checkSet('bare word with or: "clients or budget"', search('clients or budget'), ['Alpha', 'Both']);

console.log('\n=== 5b. The "+" syntax was removed ===');
// "+" is no longer supported. It must return NOTHING (not the whole list), so that a
// search the app cannot honour never looks like it succeeded.
check('"+clients" is no longer supported', search('+clients'), []);
check('"#a and +clients" likewise', search('#a and +clients'), []);
check('"+" on its own does not throw', search('+'), []);

console.log('\n=== 6. Case and spacing ===');
checkSet('"#A AND #C"', search('#A AND #C'), ['Both']);
checkSet('"#a Or #c"', search('#a Or #c'), ['Alpha', 'Both', 'List note', 'Charlie']);
checkSet('extra spaces: "  #a   and   #c  "', search('  #a   and   #c  '), ['Both']);
checkSet('empty query returns everything', search('   '), ['Alpha', 'Charlie', 'Both', 'Bravo', 'List note']);

console.log('\n=== 7. Malformed queries must not throw ===');
checkSet('"and" alone', search('and'), ['Alpha', 'Charlie', 'Both', 'Bravo', 'List note']);
checkSet('"or" alone', search('or'), ['Alpha', 'Charlie', 'Both', 'Bravo', 'List note']);
checkSet('"#a and" (trailing operator)', search('#a and'), ['Alpha', 'Both', 'List note']);
checkSet('"or #a" (leading operator)', search('or #a'), ['Alpha', 'Both', 'List note']);
checkSet('"#a or or #c" (duplicated operator)', search('#a or or #c'), ['Alpha', 'Both', 'List note', 'Charlie']);
checkSet('"#" alone', search('#'), ['Alpha', 'Charlie', 'Both', 'Bravo', 'List note']);

console.log('\n=== 8. Tag parsing for creation (must not regress) ===');
check('"#work #project"', parseTagsFromInput('#work #project'), ['work', 'project']);
check('normalises case', parseTagsFromInput('#Work'), ['work']);
check('no duplicates', parseTagsFromInput('#a #a'), ['a']);
check('no tags', parseTagsFromInput('hello world'), []);
check('validateTag("#work")', validateTag('#work'), true);
check('validateTag("work") without #', validateTag('work'), false);
check('validateTag("#") without text', validateTag('#'), false);
check('validateTag("#work project") with a space', validateTag('#work project'), false);

console.log(failures === 0 ? '\nALL SEARCH CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
