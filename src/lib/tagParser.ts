/** One condition in a search: a single tag or a single piece of text. */
export interface SearchCondition {
  type: 'tag' | 'text';
  /** Tag name without `#`, or the raw text term. Both lowercased. */
  value: string;
}

/**
 * A search is an OR of AND-groups: every group must have all of its conditions
 * matched, and any one matching group is enough for the item to be included.
 *
 * `[ [tag a, text clients], [tag b] ]` means `(#a AND clients) OR #b`.
 */
export type SearchExpression = SearchCondition[][];

/**
 * Parse tags from user input: "#work #project" -> ['work', 'project']
 * Tags are normalized to lowercase and stored without #
 */
export function parseTagsFromInput(input: string): string[] {
  if (!input.trim()) return [];
  
  const tagRegex = /#(\S+)/g;
  const tags: string[] = [];
  let match;
  
  while ((match = tagRegex.exec(input)) !== null) {
    const tag = match[1].toLowerCase();
    if (tag && !tags.includes(tag)) {
      tags.push(tag);
    }
  }
  
  return tags;
}

/**
 * Validate single tag: must start with # and have no spaces
 */
export function validateTag(tag: string): boolean {
  if (!tag.startsWith('#')) return false;
  if (tag.length <= 1) return false;
  if (tag.includes(' ')) return false;
  return true;
}

const AND = 'and';
const OR = 'or';

/**
 * Parses a search string into an expression with operator precedence:
 * `and` binds tighter than `or`, so `#a or #b and #c` means `#a OR (#b AND #c)`.
 *
 * Supported terms:
 *   #tag      a tag
 *   word      text, matched against the item's own fields
 *   +word     text (kept for backwards compatibility; identical to `word`)
 *   and / or  operators, case-insensitive
 *
 * With no operators, every term must match (an implicit AND), which is what a plain
 * search such as "clients" or "#work" has always meant.
 */
export function parseSearchExpression(query: string): SearchExpression {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const tokens = trimmed.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return [];

  // Pass 1: collect conditions and operators in order.
  const parts: Array<SearchCondition | 'and' | 'or'> = [];
  for (const token of tokens) {
    const lower = token.toLowerCase();

    if (lower === AND || lower === OR) {
      parts.push(lower);
    } else if (token.startsWith('#')) {
      const tag = token.substring(1).toLowerCase();
      if (tag) parts.push({ type: 'tag', value: tag });
    } else if (token.startsWith('+')) {
      const text = token.substring(1).toLowerCase();
      if (text) parts.push({ type: 'text', value: text });
    } else {
      parts.push({ type: 'text', value: lower });
    }
  }

  // Pass 2: split on `or` first (lowest precedence), then on `and` within each group.
  // Consecutive terms with no operator form an implicit AND.
  const expression: SearchExpression = [];

  const flush = (group: SearchCondition[]) => {
    if (group.length > 0) expression.push(group);
  };

  let group: SearchCondition[] = [];
  for (const part of parts) {
    if (part === OR) {
      flush(group);
      group = [];
    } else if (part === AND) {
      // An `and` between two conditions does not break the group; the conditions
      // either side simply both have to match, which is what the group already means.
      continue;
    } else {
      group.push(part);
    }
  }
  flush(group);

  return expression;
}

/**
 * Evaluates a parsed expression against an item.
 *
 * `matchesText` receives a lowercased term and decides how that item type searches,
 * so notes can look inside list items while events only look at name and description.
 * It is only called when the expression actually contains a text condition, so a
 * tag-only search stays O(tags) and the default "no operators" search is untouched.
 */
export function matchesSearchExpression(
  expression: SearchExpression,
  tags: string[] | undefined,
  matchesText: (term: string) => boolean,
): boolean {
  if (expression.length === 0) return true;

  const itemTags = tags ?? [];

  return expression.some((group) =>
    group.every((condition) =>
      condition.type === 'tag'
        ? itemTags.includes(condition.value)
        : matchesText(condition.value),
    ),
  );
}

/**
 * Format tags for display: ['work', 'project'] -> "#work #project"
 */
export function formatTagsForDisplay(tags: string[]): string {
  return tags.map(tag => `#${tag}`).join(' ');
}
