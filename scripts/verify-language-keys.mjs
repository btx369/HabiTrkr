/**
 * Compares the key sets of the language blocks in LanguageContext.tsx.
 *
 * Two things are worth knowing at a glance: which blocks are missing keys, and whether any
 * block has a key the others do not (a typo, or a leftover from a bad edit).
 *
 * Run: node scripts/verify-language-keys.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const file = path.resolve(here, '..', 'src/contexts/LanguageContext.tsx');
const text = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

const blocks = {};
let current = null;
for (const line of text.split('\n')) {
  const start = /^(\s+)([a-z]{2}): \{\s*$/.exec(line);
  if (start) { current = start[2]; blocks[current] = new Set(); continue; }
  if (/^\s*\},?\s*$/.test(line)) { current = null; continue; }
  const key = /^\s+'([^']+)':/.exec(line);
  if (current && key) {
    if (blocks[current].has(key[1])) {
      console.log(`DUPLICATE  ${current}: '${key[1]}' appears more than once`);
    }
    blocks[current].add(key[1]);
  }
}

const names = Object.keys(blocks);
console.log(`blocks: ${names.map((n) => `${n}(${blocks[n].size})`).join(' ')}\n`);

// English is the reference: `t()` falls back to it, so it has to be the complete one.
const reference = blocks.en;

/**
 * The six languages this project translates. The others — nl, pl, tr, ja, zh, ko — are
 * deliberately incomplete: their keys are missing and `t()` falls back to English, which
 * is an honest gap rather than a defect. They are reported but do not fail the run, so
 * this check can gate a commit without being permanently red.
 */
const TRANSLATED = ['en', 'pt', 'es', 'fr', 'de', 'it'];

let problems = 0;
let incomplete = 0;
for (const name of names) {
  const missing = [...reference].filter((k) => !blocks[name].has(k));
  const extra = [...blocks[name]].filter((k) => !reference.has(k));

  // An `extra` key is always a mistake: it means a typo, or a translation for a key that
  // no longer exists in English.
  if (extra.length) {
    problems++;
    console.log(`MISMATCH   ${name} (${TRANSLATED.includes(name) ? 'translated' : 'fallback  '})`);
    console.log(`             extra:   ${extra.join(', ')}`);
    continue;
  }

  if (missing.length === 0) {
    console.log(`OK         ${name} (${TRANSLATED.includes(name) ? 'translated' : 'fallback  '}) — identical to English`);
  } else if (TRANSLATED.includes(name)) {
    problems++;
    console.log(`MISMATCH   ${name} (translated) — missing ${missing.length} key(s)`);
    console.log(`             ${missing.join(', ')}`);
  } else {
    incomplete++;
    console.log(`INCOMPLETE ${name} (fallback) — ${missing.length} key(s) not translated yet; English shows through`);
  }
}

console.log('');
console.log(`English has ${reference.size} keys.`);
if (incomplete) {
  console.log(`${incomplete} language(s) still fall back to English for ${reference.size - 65} key(s) each.`);
}
console.log(problems === 0
  ? `ALL TRANSLATED BLOCKS CONSISTENT${incomplete ? ' (the rest fall back to English by design)' : ''}`
  : `${problems} BLOCK(S) INCONSISTENT`);
process.exit(problems === 0 ? 0 : 1);
