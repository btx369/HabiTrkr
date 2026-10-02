import { parseNoteContent } from '@/lib/noteContentRenderer';

/**
 * A note's stored fields are not the same thing as the text a reader sees.
 *
 * Every image and audio attachment lives inside `description` as a marker holding a
 * base64 data URL, e.g. `[audio:data:audio/wav;base64,T2dnUwAC…:3.5]`. That payload is
 * thousands of characters of arbitrary letters and digits, so searching the raw field
 * finds sequences such as "asd" inside the *encoding* of a sound — a note that says
 * nothing whatsoever would appear in the results, with no visible text explaining why.
 *
 * Both the search and the note card therefore have to look at the same thing: the
 * human-readable text. Extracting it through `parseNoteContent` is what guarantees the
 * two cannot drift apart, because it is the very same parser the card renders with.
 *
 * Only text parts are kept. Images and audio carry no searchable words: the marker
 * holds encoded bytes, not a filename or a caption, and a transcript does not exist.
 */
export interface ExtractOptions {
  /** Search needs a normalised haystack; the card and viewer display text as written. */
  lowercase?: boolean;
  /** The viewer renders the result as markdown, where leading whitespace is layout. */
  trim?: boolean;
}

/**
 * Returns the note's human-readable text, with image and audio attachments removed.
 *
 * @param source A note (its `name` and `description` are used), or a bare string such
 *   as a list item's text, which never holds a marker.
 */
export function extractSearchableText(
  source: { name?: string | null; description?: string | null } | string | null | undefined,
  { lowercase = true, trim = true }: ExtractOptions = {},
): string {
  if (source === null || source === undefined) return '';

  const shape = (value: string) => {
    const v = trim ? value.trim() : value;
    return lowercase ? v.toLowerCase() : v;
  };

  // A bare string is a list item's text, which never holds a marker.
  if (typeof source === 'string') return shape(source);

  const name = (source.name ?? '').trim();
  const body = typeof source.description === 'string' ? source.description : '';
  const text = parseNoteContent(body)
    .filter((part) => part.type === 'text')
    .map((part) => part.content)
    .join('');

  // The name is prepended only when there is one. Joining unconditionally would put a
  // stray leading space in front of every nameless note, which is invisible to the
  // search but changes indented markdown in the viewer.
  return shape(name === '' ? text : `${name} ${text}`);
}
