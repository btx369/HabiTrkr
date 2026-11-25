import { ReactNode } from 'react';
import { splitBySearchTerms } from './textHighlight';
import { parseInline, type InlineNode } from './inlineMarkdown';

/**
 * Inline markdown, from the same parser the editor uses (see inlineMarkdown.ts), so a note
 * looks identical in the viewer and in the editor. `leaf` renders the plain text pieces; the
 * search highlighter passes one so matches are marked INSIDE the formatting.
 */
const processInlineFormatting = (text: string, leaf?: (plain: string) => ReactNode[]): ReactNode[] => {
  const render = (nodes: InlineNode[], prefix: string): ReactNode[] =>
    nodes.flatMap((n, i): ReactNode[] => {
      const key = `${prefix}-${i}`;
      if (n.type === 'text') return leaf ? leaf(n.value) : [n.value];
      const inner = render(n.children, key);
      if (n.type === 'strong') return [<strong key={key}>{inner}</strong>];
      if (n.type === 'em') return [<em key={key}>{inner}</em>];
      return [<u key={key}>{inner}</u>];
    });
  const out = render(parseInline(text), 'f');
  return out.length > 0 ? out : leaf ? leaf(text) : [text];
};

export const renderMarkdown = (text: string): ReactNode => {
  if (!text) return null;
  
  const lines = text.split('\n');
  
  return lines.map((line, idx) => {
    const key = `line-${idx}`;
    
    // Check for headings
    if (line.startsWith('# ')) {
      const content = line.slice(2);
      return (
        <h1 key={key} className="text-[1.5rem] leading-relaxed font-bold mb-2 last:mb-0">
          {processInlineFormatting(content)}
        </h1>
      );
    } else if (line.startsWith('## ')) {
      const content = line.slice(3);
      return (
        <h2 key={key} className="text-[1.25rem] leading-relaxed font-bold mb-2 last:mb-0">
          {processInlineFormatting(content)}
        </h2>
      );
    } else if (line.trim() === '') {
      return <div key={key} className="h-[1.625em]" />;
    } else {
      return (
        <div key={key} className="mb-0.5 last:mb-0">
          {processInlineFormatting(line)}
        </div>
      );
    }
  });
};

export const renderMarkdownWithHighlight = (text: string, searchQuery: string): ReactNode => {
  if (!searchQuery.trim()) {
    return renderMarkdown(text);
  }

  // Uses the shared search-term splitter so this agrees with the plain highlighter.
  // It previously built its own regex from the raw query, which meant a query
  // containing an operator or a tag highlighted nothing here at all.
  const lines = text.split('\n');

  return lines.map((line, idx) => {
    const key = `line-${idx}`;

    /**
     * Splits on the search terms and renders them. Non-matching parts still get inline
     * markdown formatting applied, so `**bold**` keeps working next to a highlight.
     */
    let leafKey = 0;
    const highlightLeaf = (plain: string): ReactNode[] =>
      splitBySearchTerms(plain, searchQuery).map((segment) => {
        const k = `h-${leafKey++}`;
        return segment.matched
          ? <mark key={k} className="bg-highlight text-foreground rounded-sm px-0 py-0">{segment.text}</mark>
          : <span key={k}>{segment.text}</span>;
      });
    const processWithBoth = (text: string): ReactNode[] => processInlineFormatting(text, highlightLeaf);

    // Check for headings
    if (line.startsWith('# ')) {
      const content = line.slice(2);
      return (
        <h1 key={key} className="text-[1.5rem] leading-relaxed font-bold mb-2 last:mb-0">
          {processWithBoth(content)}
        </h1>
      );
    } else if (line.startsWith('## ')) {
      const content = line.slice(3);
      return (
        <h2 key={key} className="text-[1.25rem] leading-relaxed font-bold mb-2 last:mb-0">
          {processWithBoth(content)}
        </h2>
      );
    } else if (line.trim() === '') {
      return <div key={key} className="h-[1.625em]" />;
    } else {
      return (
        <div key={key} className="mb-0.5 last:mb-0">
          {processWithBoth(line)}
        </div>
      );
    }
  });
};
