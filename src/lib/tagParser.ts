export interface SearchQuery {
  tags: string[];
  operator: 'and' | 'or';
  textFilters: string[];
}

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

/**
 * Parse search query with AND/OR logic and text filters
 * Examples:
 * - "#work" -> { tags: ['work'], operator: 'and', textFilters: [] }
 * - "#work and #project" -> { tags: ['work', 'project'], operator: 'and', textFilters: [] }
 * - "#work or #project" -> { tags: ['work', 'project'], operator: 'or', textFilters: [] }
 * - "#work +clients +budget" -> { tags: ['work'], operator: 'and', textFilters: ['clients', 'budget'] }
 * - "clients" -> { tags: [], operator: 'and', textFilters: [] } (no tags, use existing search)
 */
export function parseSearchQuery(query: string): SearchQuery {
  if (!query.trim()) {
    return { tags: [], operator: 'and', textFilters: [] };
  }

  const tokens = query.trim().split(/\s+/);
  const tags: string[] = [];
  const textFilters: string[] = [];
  let operator: 'and' | 'or' = 'and';

  for (const token of tokens) {
    const lowerToken = token.toLowerCase();
    
    if (lowerToken === 'and') {
      operator = 'and';
    } else if (lowerToken === 'or') {
      operator = 'or';
    } else if (token.startsWith('#')) {
      // Extract tag without # and normalize to lowercase
      const tag = token.substring(1).toLowerCase();
      if (tag && !tags.includes(tag)) {
        tags.push(tag);
      }
    } else if (token.startsWith('+')) {
      // Extract text filter without +
      const filter = token.substring(1);
      if (filter && !textFilters.includes(filter)) {
        textFilters.push(filter);
      }
    }
  }

  return { tags, operator, textFilters };
}

/**
 * Format tags for display: ['work', 'project'] -> "#work #project"
 */
export function formatTagsForDisplay(tags: string[]): string {
  return tags.map(tag => `#${tag}`).join(' ');
}
