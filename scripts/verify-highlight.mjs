/**
 * Checks the search highlighting: which parts of a piece of text get marked.
 *
 * Given some text and a query, this reports the spans the user would see highlighted
 * in yellow.
 *
 * Usage: node scripts/verify-highlight.mjs
 */

import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

const res = await build({
  entryPoints: [path.join(root, 'src/lib/textHighlight.tsx')],
  bundle: true,
  format: 'esm',
  write: false,
  platform: 'neutral',
  jsx: 'automatic',
  external: ['react', 'react/jsx-runtime'],
  alias: { '@': path.join(root, 'src') },
});

// The bundle keeps a bare `react/jsx-runtime` import, which Node cannot resolve from a
// data: URL, so it is written next to node_modules and imported from there.
const bundleDir = path.join(root, 'scripts', '.tmp-highlight');
fs.mkdirSync(bundleDir, { recursive: true });
const bundleFile = path.join(bundleDir, 'textHighlight.mjs');
fs.writeFileSync(bundleFile, res.outputFiles[0].text);

const mod = await import(`file:///${bundleFile.replace(/\\/g, '/')}?v=${Date.now()}`);
fs.rmSync(bundleDir, { recursive: true, force: true });

/** Renders the result as a readable string: [text] for a highlight, plain text outside. */
function render(node) {
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(render).join('');
  if (node && node.type === 'mark') {
    const inner = node.props?.children;
    return `[${typeof inner === 'string' ? inner : render(inner)}]`;
  }
  if (node && node.props?.children !== undefined) return render(node.props.children);
  return '';
}

const highlight = (text, query) => render(mod.highlightText(text, query));

let failures = 0;
const check = (label, actual, expected) => {
  const ok = actual === expected;
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`);
  if (!ok) console.log(`        actual   = ${JSON.stringify(actual)}\n        expected = ${JSON.stringify(expected)}`);
};

const TEXT = 'Weekly goals and client budget review';

console.log('\n=== 1. Plain search (existing behaviour) ===');
check('single word', highlight(TEXT, 'client'), 'Weekly goals and [client] budget review');
check('upper/lower case', highlight(TEXT, 'WEEKLY'), '[Weekly] goals and client budget review');
check('empty query -> no highlight', highlight(TEXT, ''), TEXT);
check('no match -> no highlight', highlight(TEXT, 'zzz'), TEXT);
check('multiple occurrences', highlight('budget and budget', 'budget'), '[budget] and [budget]');

console.log('\n=== 2. With tags and operators (what was missing) ===');
check('"#a and client" highlights only the word', highlight(TEXT, '#a and client'), 'Weekly goals and [client] budget review');
check('"#a" alone highlights no text', highlight(TEXT, '#a'), TEXT);
check('"and" alone highlights nothing', highlight(TEXT, 'and'), TEXT);
check('"#a or budget" highlights budget', highlight(TEXT, '#a or budget'), 'Weekly goals and client [budget] review');
check('two words with or', highlight(TEXT, 'weekly or budget'), '[Weekly] goals and client [budget] review');
check('tag plus two words', highlight(TEXT, '#x and weekly and review'), '[Weekly] goals and client budget [review]');

console.log('\n=== 3. Operator casing and extra spaces ===');
check('"#a AND client"', highlight(TEXT, '#a AND client'), 'Weekly goals and [client] budget review');
check('"  #a   and   client  "', highlight(TEXT, '  #a   and   client  '), 'Weekly goals and [client] budget review');

console.log('\n=== 4. Edge cases ===');
check('repeated term does not double-highlight', highlight('budget', 'budget or budget'), '[budget]');
check('prefix of another word', highlight('budgeting', 'budget'), '[budget]ing');
// A term containing regex characters must neither throw nor highlight too much.
check('term with parentheses', highlight('a (b) c', '(b)'), 'a [(b)] c');
// A term made only of punctuation has nothing useful to highlight, so it is ignored.
check('punctuation-only term is ignored', highlight('x * y', '*'), 'x * y');
check('term with an asterisk and letters works', highlight('x a*b y', 'a*b'), 'x [a*b] y');
check('empty text', highlight('', 'client'), '');
check('term without letters is ignored', highlight(TEXT, 'and and'), TEXT);

console.log(failures === 0 ? '\nALL HIGHLIGHT CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
