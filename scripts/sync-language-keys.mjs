/**
 * Adds any key from the shared list that a translated language block is missing.
 *
 * The list lives in `add-language-keys.mjs`; this only inserts what is absent, so it is
 * safe to run repeatedly. Keys are matched by name, which is what a previous one-off
 * removal script failed to do: it deleted `'delete'` from every translated block, having
 * mistaken an existing key for one of the new ones.
 *
 * Languages outside the six this project translates are skipped: `t()` falls back to
 * English for them, which is honest, where invented translations would not be.
 *
 * Run: node scripts/sync-language-keys.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const file = path.resolve(here, '..', 'src/contexts/LanguageContext.tsx');

// Import the list without executing the other script's side effects.
const source = fs.readFileSync(path.join(here, 'add-language-keys.mjs'), 'utf8');
const listMatch = /const KEYS = \[([\s\S]*?)\n\];/.exec(source);
if (!listMatch) throw new Error('Could not find the KEYS list in add-language-keys.mjs');
const KEYS = listMatch[1]
  .split('\n')
  .map((l) => l.trim())
  .filter((l) => l.startsWith('['))
  .map((l) => JSON.parse(l.replace(/,\s*$/, '').replace(/'/g, '"')));

const COLUMNS = ['en', 'pt', 'es', 'fr', 'de', 'it'];

const text = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
const lines = text.split('\n');

// First pass: which keys does each block already have?
const present = {};
let current = null;
for (const line of lines) {
  const block = /^\s+([a-z]{2}): \{\s*$/.exec(line);
  if (block) { current = block[1]; present[current] = new Set(); continue; }
  const key = /^\s+'([^']+)':/.exec(line);
  if (current && key) present[current].add(key[1]);
}

// Second pass: append whatever is missing, at the end of each block.
const out = [];
current = null;
const added = {};
for (const line of lines) {
  if (/^\s+\},?\s*$/.test(line) && current && COLUMNS.includes(current)) {
    const col = COLUMNS.indexOf(current);
    const missing = KEYS.filter((e) => !present[current].has(e[0]));
    if (missing.length) {
      const indent = /^(\s+)/.exec(line)[1] + '  ';
      out.push(`${indent}// Added by scripts/sync-language-keys.mjs.`);
      for (const entry of missing) {
        // `%Q%` stands in for the quote character. Written literally it would nest inside
        // the source list, which this script parses with JSON.parse and cannot cope with.
        const value = JSON.stringify(entry[col + 1]).replace(/"/g, "'").replaceAll('%Q%', '"');
        out.push(`${indent}'${entry[0]}': ${value},`);
      }
      added[current] = missing.length;
    }
    out.push(line);
    current = null;
    continue;
  }
  const block = /^\s+([a-z]{2}): \{\s*$/.exec(line);
  if (block) current = block[1];
  out.push(line);
}

fs.writeFileSync(file, out.join('\n'));
const summary = Object.entries(added).map(([k, n]) => `${k}+${n}`).join(' ') || 'nothing missing';
console.log(`synced: ${summary}`);
