import { ReactNode } from 'react';
import { parseSearchExpression } from './tagParser';

/** Escapes a literal string for safe use inside a RegExp. */
const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Builds a regex matching any text term of the search query.
 *
 * This is the single place the search terms are turned into a pattern. Both the plain
 * highlighter and the markdown highlighter use it, so they can never disagree about
 * what counts as a match. Tags and operators are excluded: only text conditions are
 * highlightable.
 *
 * Returns null when the query has no highlightable text term, which is the common case
 * for a tag-only search.
 */
export function buildSearchHighlightRegex(searchQuery: string): RegExp | null {
  const expression = parseSearchExpression(searchQuery);

  const terms = new Set<string>();
  for (const group of expression) {
    for (const condition of group) {
      if (condition.type !== 'text') continue;
      // Skip terms with nothing highlightable (a lone operator character, say).
      if (!/[\p{L}\p{N}]/u.test(condition.value)) continue;
      terms.add(condition.value);
    }
  }

  if (terms.size === 0) return null;

  // Longest first so overlapping terms highlight the most specific match.
  const alternatives = [...terms].sort((a, b) => b.length - a.length).map(escapeRegExp);
  return new RegExp(`(?:${alternatives.join('|')})`, 'gi');
}

export interface HighlightSegment {
  text: string;
  matched: boolean;
}

/**
 * Splits `text` into alternating plain and matched segments.
 *
 * Used by the markdown renderer, which has to apply inline formatting to the plain
 * segments only.
 *
 * Built from match indices rather than `String.split(regex)`: with a non-capturing
 * group, split() DROPS the separator, so the matched term itself would disappear from
 * the output. Walking the matches keeps every character of the original text.
 */
export function splitBySearchTerms(text: string, searchQuery: string): HighlightSegment[] {
  if (!searchQuery.trim()) return [{ text, matched: false }];

  const regex = buildSearchHighlightRegex(searchQuery);
  if (!regex) return [{ text, matched: false }];

  const segments: HighlightSegment[] = [];
  let cursor = 0;

  for (const match of text.matchAll(regex)) {
    if (match.index === undefined || match[0].length === 0) continue;

    if (match.index > cursor) {
      segments.push({ text: text.slice(cursor, match.index), matched: false });
    }
    segments.push({ text: match[0], matched: true });
    cursor = match.index + match[0].length;
  }

  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor), matched: false });
  }

  return segments.length > 0 ? segments : [{ text, matched: false }];
}

interface Span {
  start: number;
  end: number;
}

/**
 * How much text to keep either side of a match when excerpting.
 *
 * The cards clamp their body text, so a match further down the note was highlighted but
 * never seen: a search for "lor" returned cards showing only their opening words, with the
 * reason they matched somewhere below the cut. The excerpt starts just before the match so
 * the match itself always lands inside the visible clamp.
 */
const EXCERPT_BEFORE = 32;
const EXCERPT_AFTER = 420;

/**
 * Returns the part of `text` around its first match, or `text` unchanged when nothing
 * matches or no search is active.
 *
 * Adds an ellipsis on whichever side was cut, so it reads as an excerpt rather than as the
 * whole note. Whitespace is collapsed first because note bodies contain newlines that would
 * otherwise eat the limited clamp with empty lines.
 */
export function excerptAroundMatch(text: string, searchQuery: string): string {
  if (!searchQuery.trim() || !text) return text;

  const regex = buildSearchHighlightRegex(searchQuery);
  if (!regex) return text;

  const flat = text.replace(/\s+/g, ' ').trim();
  const match = regex.exec(flat);
  if (!match || match.index === undefined) return flat;

  const start = Math.max(0, match.index - EXCERPT_BEFORE);
  const end = Math.min(flat.length, match.index + match[0].length + EXCERPT_AFTER);

  const head = flat.slice(start, end);
  return `${start > 0 ? '…' : ''}${head}${end < flat.length ? '…' : ''}`;
}

/**
 * Finds every span of `text` matched by the text terms of the query.
 *
 * Uses a non-capturing group so nothing depends on how `String.split` positions its
 * capture groups, and so a term that happens to contain regex syntax cannot be
 * mistaken for a separator.
 */
function findHighlightSpans(text: string, searchQuery: string): Span[] {
  const regex = buildSearchHighlightRegex(searchQuery);
  if (!regex) return [];

  const spans: Span[] = [];
  for (const match of text.matchAll(regex)) {
    if (match.index === undefined || match[0].length === 0) continue;
    spans.push({ start: match.index, end: match.index + match[0].length });
  }
  return spans;
}

/**
 * Highlights the parts of `text` that the current search matched.
 *
 * The query is parsed the same way the search itself parses it, so:
 *   - `clients`            highlights "clients"
 *   - `#a and clients`     highlights "clients" (a tag is not text; `and` is an operator)
 *   - `clients or budget`  highlights both words
 *
 * Previously the whole raw query was matched literally, so any query containing an
 * operator or a tag highlighted nothing at all.
 */
export const highlightText = (text: string, searchQuery: string): ReactNode => {
  if (!searchQuery.trim()) {
    return text;
  }

  const spans = findHighlightSpans(text, searchQuery);
  if (spans.length === 0) {
    return text;
  }

  const nodes: ReactNode[] = [];
  let cursor = 0;

  spans.forEach((span, index) => {
    if (span.start > cursor) {
      nodes.push(text.slice(cursor, span.start));
    }
    nodes.push(
      <mark
        key={index}
        className="bg-highlight text-foreground rounded-sm px-0 py-0 leading-[inherit] tracking-[inherit] font-[inherit]"
      >
        {text.slice(span.start, span.end)}
      </mark>,
    );
    cursor = span.end;
  });

  if (cursor < text.length) {
    nodes.push(text.slice(cursor));
  }

  return nodes;
};
