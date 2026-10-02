/**
 * Proves the bug: a note whose only "text" is an embedded base64 audio payload is
 * matched by a search for a string that occurs inside that payload.
 *
 * The fixture is a realistic OggS/Opus data URL whose base64 body happens to contain
 * the letters "asd". Nothing here is copied from anyone's real notes: the payload is
 * generated from binary that is then base64-encoded, which is exactly how the audio
 * gets into the note in the first place.
 *
 * Run: node scripts/verify-note-search-text.mjs
 */

import { build } from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

async function load(entry) {
  const res = await build({
    entryPoints: [path.join(root, entry)],
    bundle: true,
    format: 'esm',
    write: false,
    platform: 'neutral',
  });
  return import(
    `data:text/javascript;base64,${Buffer.from(res.outputFiles[0].text).toString('base64')}#${Date.now()}`
  );
}

const { parseSearchExpression, matchesSearchExpression } = await load('src/lib/tagParser.ts');
const { extractSearchableText } = await load('src/lib/noteSearchText.ts');

let failures = 0;
const check = (label, actual, expected) => {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  const ok = a === e;
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`);
  if (!ok) console.log(`        actual   = ${a}\n        expected = ${e}`);
};

// --- a realistic embedded audio payload -------------------------------------
// An OggS/Opus-like blob of 2 KB, base64-encoded the way the app stores it. Base64
// works in 3-byte groups, so the planted bytes must start on a multiple of 3: the
// group at offset 18 is set to [1, 171, 29], which encodes to "Aasd" and puts the
// letters "asd" in the encoded text. That is the whole point — the sound says nothing,
// but its ENCODING contains the letters. This is the false positive that was reported.
const raw = Buffer.alloc(2048);
for (let i = 0; i < raw.length; i++) raw[i] = (i * 37 + 11) % 256;
raw.write('OggS', 0, 'latin1');
raw.write('OpusHead', 4, 'latin1');
raw[18] = 1; raw[19] = 171; raw[20] = 29;
const audioUrl = `data:audio/wav;base64,${raw.toString('base64')}`;
if (!audioUrl.includes('asd')) {
  console.error('The generated payload does not contain "asd"; aborting.');
  process.exit(1);
}
console.log(`audio payload: ${audioUrl.length} chars, contains "asd": ${audioUrl.includes('asd')}`);
console.log(`it is ${(audioUrl.length / 1024).toFixed(1)} KB of base64 for a 2 KB sound\n`);

const AUDIO_NOTE = {
  id: 'a1',
  type: 'audio',
  name: '',
  description: `[audio:${audioUrl}:3.5]`,
  tags: [],
  items: [],
};
const TEXT_NOTE = {
  id: 't1',
  type: 'text',
  name: '',
  description: 'a note that genuinely talks about asd',
  tags: [],
  items: [],
};

/**
 * The OLD behaviour, kept here only so the bug can be demonstrated and then guarded
 * against. This is what Notes.tsx did before: match against the raw stored field.
 */
function matchesRaw(note, query) {
  const expression = parseSearchExpression(query);
  const matchesText = (term) => {
    if (note.name.toLowerCase().includes(term)) return true;
    switch (note.type) {
      case 'text':
        return note.description.toLowerCase().includes(term);
      case 'list':
        return note.items.some((i) => i.text.toLowerCase().includes(term));
      default:
        return note.description?.toLowerCase().includes(term) || false;
    }
  };
  return matchesSearchExpression(expression, note.tags, matchesText);
}

/** The NEW behaviour: match against the human-readable text only. */
function matchesExtracted(note, query) {
  const expression = parseSearchExpression(query);
  const matchesText = (term) => {
    const haystack = extractSearchableText(note);
    if (haystack.includes(term)) return true;
    return (note.items ?? []).some((i) => extractSearchableText(i.text).includes(term));
  };
  return matchesSearchExpression(expression, note.tags, matchesText);
}

console.log('=== 1. The bug, reproduced (old behaviour) ===');
check('OLD: an audio-only note is matched by "asd"', matchesRaw(AUDIO_NOTE, 'asd'), true);
check('OLD: ...and the note has no readable text at all',
  AUDIO_NOTE.description.replace(/\[audio:.+?:[\d.]+\]/g, ''), '');
console.log('  ^ this is the false positive: the query is nowhere in the note,');
console.log('    it is inside the base64 encoding of the sound itself.\n');

console.log('=== 2. The fix (new behaviour) ===');
check('NEW: the audio-only note is NOT matched by "asd"', matchesExtracted(AUDIO_NOTE, 'asd'), false);
check('NEW: a note that really says "asd" still matches', matchesExtracted(TEXT_NOTE, 'asd'), true);
check('NEW: the audio note is still found by its own tag', matchesExtracted({ ...AUDIO_NOTE, tags: ['asd'] }, '#asd'), true);
check('NEW: an empty query still returns everything', matchesExtracted(AUDIO_NOTE, ''), true);

console.log('\n=== 3. Extraction, part by part ===');
check('audio marker yields no text', extractSearchableText({ type: 'audio', description: `[audio:${audioUrl}:3.5]` }), '');
check('image marker yields no text', extractSearchableText({ type: 'image', description: '[image:data:image/png;base64,iVBORw0KGgo=]' }), '');
check('text kept around a marker',
  extractSearchableText({ type: 'text', description: `before [audio:${audioUrl}:3.5] after` }), 'before  after');
check('name is part of the haystack',
  extractSearchableText({ type: 'text', name: 'Shopping', description: 'milk' }), 'shopping milk');
check('a plain description passes through',
  extractSearchableText({ type: 'text', description: 'plain words' }), 'plain words');
check('null-safe on a missing note', extractSearchableText({}), '');
check('undefined-safe', extractSearchableText(undefined), '');

console.log('\n=== 3b. Case and whitespace are the caller\'s choice ===');
check('search lowercases by default',
  extractSearchableText({ type: 'text', description: 'Buy Milk' }), 'buy milk');
check('the card keeps the original case',
  extractSearchableText({ type: 'text', description: 'Buy Milk' }, { lowercase: false }), 'Buy Milk');
check('the viewer keeps leading whitespace',
  extractSearchableText({ type: 'text', description: '  indented\n  lines' }, { lowercase: false, trim: false }),
  '  indented\n  lines');
check('trimming is the default',
  extractSearchableText({ type: 'text', description: '  indented  ' }), 'indented');
check('lowercase does not lose the attachment stripping',
  extractSearchableText({ type: 'text', description: `Buy Milk [audio:${audioUrl}:3]` }), 'buy milk');

console.log('\n=== 3c. A huge payload cannot leak through ===');
const haystack = extractSearchableText({ type: 'audio', description: `[audio:${audioUrl}:3.5]` });
check('the haystack is empty, not the payload', haystack, '');
check('and it is not merely short by accident', audioUrl.length > 2000 && haystack.length === 0, true);
// The letters really are in the payload, so this is the search being right, not lucky.
check('the payload itself does contain the letters', audioUrl.includes('asd'), true);

console.log('\n=== 4. The user-facing scenario, end to end ===');
const NOTES = [AUDIO_NOTE, TEXT_NOTE];
const shownOld = NOTES.filter((n) => matchesRaw(n, 'asd')).map((n) => n.id);
const shownNew = NOTES.filter((n) => matchesExtracted(n, 'asd')).map((n) => n.id);
console.log(`  searching "asd"  old -> ${JSON.stringify(shownOld)}   new -> ${JSON.stringify(shownNew)}`);
check('the audio note stops appearing', shownOld.includes('a1') && !shownNew.includes('a1'), true);
check('the text note keeps appearing', shownNew, ['t1']);

console.log(failures === 0 ? '\nALL NOTE-SEARCH-TEXT CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
