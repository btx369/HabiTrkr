/**
 * Numbers a duplicate instead of labelling it "(Copy)".
 *
 * "(Copy)" has to be translated to be understood, and worse, copying a copy produced
 * "Thing (Copy) (Copy)". A number is language-neutral and repeatable: copying "Thing" three
 * times gives "Thing (1)", "Thing (2)", "Thing (3)", and copying "Thing (1)" gives
 * "Thing (2)" if that is free.
 *
 * Kept in one place because five call sites across Notes and Events need to agree; they each
 * had their own template string before.
 */

/** `Thing (2)` -> { base: 'Thing', number: 2 }. Anything else -> { base: the name as given }. */
function splitCopyName(name: string): { base: string; number?: number } {
  const match = /^(.*?)\s*\((\d+)\)$/.exec(name);
  if (!match) return { base: name };
  return { base: match[1], number: Number(match[2]) };
}

/**
 * A name for a copy of `name` that no name in `existingNames` already uses.
 *
 * The first free number wins rather than one past the highest, so deleting "Thing (2)" frees
 * that number again instead of leaving a permanent gap.
 */
export function nextCopyName(name: string, existingNames: readonly string[]): string {
  const { base } = splitCopyName(name);
  // An untitled item stays untitled: numbering nothing gave a copy called " (1)".
  if (base.trim() === '') return '';
  const taken = new Set(existingNames);

  for (let n = 1; n < 1000; n++) {
    const candidate = `${base} (${n})`;
    if (!taken.has(candidate)) return candidate;
  }
  // A thousand copies of one item is not a real case; fall back to the old behaviour rather
  // than looping forever.
  return `${base} (Copy)`;
}
