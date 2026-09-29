/**
 * Verifica o realce (highlight) das palavras encontradas pelo search.
 *
 * O que se testa: dado um texto e uma query, que pedaços ficam realçados.
 * Isto é o que o utilizador vê a amarelo.
 *
 * Uso: node scripts/verify-highlight.mjs
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

/** Reduz o resultado a uma string legível: [texto] para realçado, texto normal fora. */
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
  if (!ok) console.log(`        obtido   = ${JSON.stringify(actual)}\n        esperado = ${JSON.stringify(expected)}`);
};

const TEXT = 'Weekly goals and client budget review';

console.log('\n=== 1. Search simples (comportamento que já existia) ===');
check('palavra única', highlight(TEXT, 'client'), 'Weekly goals and [client] budget review');
check('maiúsculas/minúsculas', highlight(TEXT, 'WEEKLY'), '[Weekly] goals and client budget review');
check('query vazia -> sem realce', highlight(TEXT, ''), TEXT);
check('sem correspondência -> sem realce', highlight(TEXT, 'zzz'), TEXT);
check('ocorrências múltiplas', highlight('budget and budget', 'budget'), '[budget] and [budget]');

console.log('\n=== 2. Com tags e operadores (o que estava em falta) ===');
check('"#a and client" realça só a palavra', highlight(TEXT, '#a and client'), 'Weekly goals and [client] budget review');
check('"#a" sozinho não realça texto', highlight(TEXT, '#a'), TEXT);
check('"and" sozinho não realça', highlight(TEXT, 'and'), TEXT);
check('"#a or budget" realça budget', highlight(TEXT, '#a or budget'), 'Weekly goals and client [budget] review');
check('duas palavras com or', highlight(TEXT, 'weekly or budget'), '[Weekly] goals and client [budget] review');
check('tag + duas palavras', highlight(TEXT, '#x and weekly and review'), '[Weekly] goals and client budget [review]');

console.log('\n=== 3. Maiúsculas no operador e espaços ===');
check('"#a AND client"', highlight(TEXT, '#a AND client'), 'Weekly goals and [client] budget review');
check('"  #a   and   client  "', highlight(TEXT, '  #a   and   client  '), 'Weekly goals and [client] budget review');

console.log('\n=== 4. Casos difíceis ===');
check('palavra repetida na query não duplica realce', highlight('budget', 'budget or budget'), '[budget]');
check('prefixo de outra palavra', highlight('budgeting', 'budget'), '[budget]ing');
// Termo com caracteres de regex não pode rebentar nem realçar a mais.
check('termo com parênteses', highlight('a (b) c', '(b)'), 'a [(b)] c');
// Um termo só de pontuação não tem nada de útil para realçar, por isso é ignorado.
check('termo só com asterisco é ignorado', highlight('x * y', '*'), 'x * y');
check('termo com asterisco e letras funciona', highlight('x a*b y', 'a*b'), 'x [a*b] y');
check('texto vazio', highlight('', 'client'), '');
check('termo sem letras é ignorado', highlight(TEXT, 'and and'), TEXT);

console.log(failures === 0 ? '\nTODAS AS VERIFICAÇÕES DE REALCE PASSARAM' : `\n${failures} VERIFICAÇÃO(ÕES) FALHARAM`);
process.exit(failures === 0 ? 0 : 1);
