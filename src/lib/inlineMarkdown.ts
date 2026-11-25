/**
 * Inline markdown of the notes: **bold**, *italic*, __underline__, nested in any order.
 *
 * One parser for the editor (markdown to HTML) and for the read-only view (markdown to React),
 * so a note looks the same before and after you tap it. The old regex pairs matched `***w***`
 * as `**` + `*w` + `**` and left stray asterisks, and the two places disagreed on the rest.
 *
 * Rules, in short: `***` closes or opens bold and italic together; a delimiter that is next to
 * whitespace on its inner side is plain text (so "2 * 3 * 4" stays as typed); a delimiter that
 * never finds its partner is plain text too.
 */
export type InlineNode =
  | { type: 'text'; value: string }
  | { type: 'strong' | 'em' | 'u'; children: InlineNode[] };

type Kind = 'strong' | 'em' | 'u';
type Frame = { kind: Kind | null; marker: string; children: InlineNode[] };

const MARKER: Record<Kind, string> = { strong: '**', em: '*', u: '__' };

export function parseInline(text: string): InlineNode[] {
  const root: Frame = { kind: null, marker: '', children: [] };
  const stack: Frame[] = [root];
  const top = () => stack[stack.length - 1];
  const pushText = (value: string) => {
    if (!value) return;
    const children = top().children;
    const last = children[children.length - 1];
    if (last && last.type === 'text') last.value += value;
    else children.push({ type: 'text', value });
  };
  const open = (kind: Kind) => stack.push({ kind, marker: MARKER[kind], children: [] });
  const close = () => {
    const frame = stack.pop()!;
    top().children.push({ type: frame.kind as Kind, children: frame.children });
  };
  const isSpace = (c: string | undefined) => c === undefined || /\s/.test(c);

  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (c === '*') {
      let run = 0;
      while (text[i + run] === '*') run += 1;
      let left = run;
      let at = i;
      while (left > 0) {
        const prev = text[at - 1];
        const canClose = !isSpace(prev) && stack.length > 1;
        const topKind = top().kind;
        if (canClose && left >= 2 && topKind === 'strong') { close(); at += 2; left -= 2; continue; }
        if (canClose && topKind === 'em') { close(); at += 1; left -= 1; continue; }
        const after = text[at + (left >= 2 ? 2 : 1)];
        if (!isSpace(after) && after !== undefined && after !== '*') {
          if (left >= 2) { open('strong'); at += 2; left -= 2; continue; }
          open('em'); at += 1; left -= 1; continue;
        }
        // `***` followed by text: strong then em, handled by the loop; otherwise literal.
        if (left >= 3 || (left >= 1 && after === '*')) {
          if (left >= 2) { open('strong'); at += 2; left -= 2; continue; }
          open('em'); at += 1; left -= 1; continue;
        }
        pushText('*'.repeat(left));
        at += left;
        left = 0;
      }
      i += run;
      continue;
    }
    if (c === '_' && text[i + 1] === '_') {
      const topKind = top().kind;
      if (topKind === 'u' && !isSpace(text[i - 1])) { close(); i += 2; continue; }
      if (!isSpace(text[i + 2]) && !stack.some((f) => f.kind === 'u')) { open('u'); i += 2; continue; }
      pushText('__');
      i += 2;
      continue;
    }
    pushText(c);
    i += 1;
  }

  // Delimiters that never closed are literal text again, with whatever they held.
  while (stack.length > 1) {
    const frame = stack.pop()!;
    const parent = top();
    parent.children.push({ type: 'text', value: frame.marker }, ...frame.children);
  }
  return merge(root.children);
}

function merge(nodes: InlineNode[]): InlineNode[] {
  const out: InlineNode[] = [];
  for (const n of nodes) {
    const last = out[out.length - 1];
    if (n.type === 'text' && last && last.type === 'text') last.value += n.value;
    else out.push(n.type === 'text' ? { ...n } : { ...n, children: merge(n.children) });
  }
  return out;
}

const TAG = { strong: 'strong', em: 'em', u: 'u' } as const;

/** The nodes as HTML for the editor (text is passed through, as the old converter did). */
export function inlineToHtml(text: string): string {
  const render = (nodes: InlineNode[]): string =>
    nodes.map((n) => (n.type === 'text' ? n.value : `<${TAG[n.type]}>${render(n.children)}</${TAG[n.type]}>`)).join('');
  return render(parseInline(text));
}
