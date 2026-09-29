/**
 * Verifica o motor de busca: precedência de `and`/`or`, palavras como texto, e o
 * comportamento de um search simples (que não pode regredir).
 *
 * Corre o parser verdadeiro da app, compilado com esbuild.
 *
 * Uso: node scripts/verify-search.mjs
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
  if (!ok) console.log(`        obtido   = ${a}\n        esperado = ${e}`);
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
  if (!ok) console.log(`        obtido   = ${JSON.stringify(sorted)}\n        esperado = ${JSON.stringify(wanted)}`);
};

/** Notas de teste: repara que NENHUMA tem [a,c] ao mesmo tempo. */
const NOTES = [
  { id: '1', name: 'Alpha', type: 'text', description: 'first note about clients', tags: ['a'] },
  { id: '2', name: 'Charlie', type: 'text', description: 'third note', tags: ['c'] },
  { id: '3', name: 'Both', type: 'text', description: 'has both tags and budget', tags: ['a', 'c'] },
  { id: '4', name: 'Bravo', type: 'text', description: 'second note', tags: ['b'] },
  { id: '5', name: 'List note', type: 'list', description: '', tags: ['a'], items: [{ id: 'i', text: 'groceries and milk', completed: false }] },
];

/** Mesma função que a app usa em Notes.tsx. */
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

console.log('\n=== 1. Search simples (não pode regredir) ===');
check('texto livre: "clients"', search('clients'), ['Alpha']);
// "Both" tem descrição "has both tags and budget", que NÃO contém "note",
// por isso não aparece — correto para um search por caracteres.
check('texto por caracteres: "note"', search('note'), ['Alpha', 'Charlie', 'Bravo', 'List note']);
check('caractere único: "a" encontra tudo o que tenha A', search('a'), ['Alpha', 'Charlie', 'Both', 'Bravo', 'List note']);
check('tag sozinha: "#a"', search('#a'), ['Alpha', 'Both', 'List note']);
check('nome encontrável', search('Charlie'), ['Charlie']);
check('conteúdo de lista', search('groceries'), ['List note']);
check('sem resultados', search('zzzz'), []);

console.log('\n=== 2. AND exige TODAS as condições na MESMA nota ===');
check('"#a and #c" -> só quem tem ambas', search('#a and #c'), ['Both']);
check('"#a AND #c" -> maiúsculas funcionam', search('#a AND #c'), ['Both']);
check('"#a and #b" -> nenhuma tem ambas', search('#a and #b'), []);
check('AND implícito: "#a #c"', search('#a #c'), ['Both']);
check('3 tags: "#a and #c and #b" -> nenhuma', search('#a and #c and #b'), []);

console.log('\n=== 3. OR = união ===');
checkSet('"#a or #c"', search('#a or #c'), ['Alpha', 'Both', 'List note', 'Charlie']);
checkSet('"#a or #b or #c" -> todas', search('#a or #b or #c'), ['Alpha', 'Both', 'List note', 'Charlie', 'Bravo']);

console.log('\n=== 4. Precedência: `and` liga mais forte que `or` ===');
checkSet('"#a or #b and #c" = #a OR (#b AND #c)', search('#a or #b and #c'), ['Alpha', 'Both', 'List note']);
// (#a AND clients) OR #c  ->  Alpha (a+clients), Charlie (c), Both (c)
checkSet('"#a and clients or #c" = (#a AND clients) OR #c', search('#a and clients or #c'), ['Alpha', 'Charlie', 'Both']);
checkSet('"#a and #c or #b" = (#a AND #c) OR #b', search('#a and #c or #b'), ['Both', 'Bravo']);

console.log('\n=== 5. Palavras como texto ===');
checkSet('"#a and clients" -> tag + palavra', search('#a and clients'), ['Alpha']);
checkSet('"#a and budget" -> tag + palavra noutra nota', search('#a and budget'), ['Both']);
checkSet('"#a and zzzz" -> palavra inexistente', search('#a and zzzz'), []);
checkSet('palavra sozinha com or: "clients or budget"', search('clients or budget'), ['Alpha', 'Both']);

console.log('\n=== 5b. A sintaxe "+" foi removida ===');
// O "+" já não é suportado. Tem de devolver NADA (não a lista toda), para não
// parecer que a pesquisa funcionou.
check('"+clients" já não é suportado', search('+clients'), []);
check('"#a and +clients" também não', search('#a and +clients'), []);
check('"+" sozinho não rebenta', search('+'), []);

console.log('\n=== 6. Maiúsculas e espaços ===');
checkSet('"#A AND #C"', search('#A AND #C'), ['Both']);
checkSet('"#a Or #c"', search('#a Or #c'), ['Alpha', 'Both', 'List note', 'Charlie']);
checkSet('espaços a mais: "  #a   and   #c  "', search('  #a   and   #c  '), ['Both']);
checkSet('query vazia devolve tudo', search('   '), ['Alpha', 'Charlie', 'Both', 'Bravo', 'List note']);

console.log('\n=== 7. Tolerância a queries mal formadas (não devem rebentar) ===');
checkSet('"and" sozinho', search('and'), ['Alpha', 'Charlie', 'Both', 'Bravo', 'List note']);
checkSet('"or" sozinho', search('or'), ['Alpha', 'Charlie', 'Both', 'Bravo', 'List note']);
checkSet('"#a and" (a terminar em operador)', search('#a and'), ['Alpha', 'Both', 'List note']);
checkSet('"or #a" (a começar em operador)', search('or #a'), ['Alpha', 'Both', 'List note']);
checkSet('"#a or or #c" (operador duplicado)', search('#a or or #c'), ['Alpha', 'Both', 'List note', 'Charlie']);
checkSet('"#" sozinho', search('#'), ['Alpha', 'Charlie', 'Both', 'Bravo', 'List note']);

console.log('\n=== 8. Parsing de tags para criação (não pode regredir) ===');
check('"#work #project"', parseTagsFromInput('#work #project'), ['work', 'project']);
check('normaliza maiúsculas', parseTagsFromInput('#Work'), ['work']);
check('sem duplicados', parseTagsFromInput('#a #a'), ['a']);
check('sem tags', parseTagsFromInput('hello world'), []);
check('validateTag("#work")', validateTag('#work'), true);
check('validateTag("work") sem #', validateTag('work'), false);
check('validateTag("#") sem texto', validateTag('#'), false);
check('validateTag("#work project") com espaço', validateTag('#work project'), false);

console.log(failures === 0 ? '\nTODAS AS VERIFICAÇÕES DE SEARCH PASSARAM' : `\n${failures} VERIFICAÇÃO(ÕES) FALHARAM`);
process.exit(failures === 0 ? 0 : 1);
