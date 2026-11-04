import { ReactNode } from 'react';
import { splitBySearchTerms } from './textHighlight';

interface TextPart {
  type: 'text' | 'bold' | 'italic' | 'underline';
  content: string;
}

/**
 * Inline markdown. `leaf` renders the plain text pieces; the search highlighter passes one so
 * that matches are marked INSIDE the formatting. Highlighting first and formatting after split
 * `**leite**` around the match and left the asterisks on screen.
 */
const processInlineFormatting = (text: string, leaf?: (plain: string) => ReactNode[]): ReactNode[] => {
  const result: ReactNode[] = [];
  const pushPlain = (plain: string) => {
    if (!plain) return;
    if (leaf) result.push(...leaf(plain));
    else result.push(plain);
  };
  const currentIndex = 0;
  
  // Parse inline formatting: **bold**, *italic*, __underline__
  const regex = /(\*\*.*?\*\*|\*.*?\*|__.*?__)/g;
  let match;
  const lastIndex = 0;
  
  const matches: Array<{ index: number; text: string; type: 'bold' | 'italic' | 'underline' }> = [];
  
  while ((match = regex.exec(text)) !== null) {
    const matchedText = match[0];
    if (matchedText.startsWith('**') && matchedText.endsWith('**') && matchedText.length > 4) {
      matches.push({ index: match.index, text: matchedText.slice(2, -2), type: 'bold' });
    } else if (matchedText.startsWith('*') && matchedText.endsWith('*') && matchedText.length > 2 && !text[match.index - 1]?.match(/\*/)) {
      matches.push({ index: match.index, text: matchedText.slice(1, -1), type: 'italic' });
    } else if (matchedText.startsWith('__') && matchedText.endsWith('__') && matchedText.length > 4) {
      matches.push({ index: match.index, text: matchedText.slice(2, -2), type: 'underline' });
    }
  }
  
  let position = 0;
  matches.forEach((m, idx) => {
    // Add text before this match
    if (m.index > position) {
      pushPlain(text.substring(position, m.index));
    }
    
    // Add formatted text (recursively process inner text for nested formatting)
    const key = `format-${idx}`;
    if (m.type === 'bold') {
      result.push(<strong key={key}>{processInlineFormatting(m.text, leaf)}</strong>);
    } else if (m.type === 'italic') {
      result.push(<em key={key}>{processInlineFormatting(m.text, leaf)}</em>);
    } else if (m.type === 'underline') {
      result.push(<u key={key}>{processInlineFormatting(m.text, leaf)}</u>);
    }
    
    // Update position
    const originalLength = m.type === 'bold' || m.type === 'underline' ? m.text.length + 4 : m.text.length + 2;
    position = m.index + originalLength;
  });
  
  // Add remaining text
  if (position < text.length) {
    pushPlain(text.substring(position));
  }
  
  if (result.length > 0) return result;
  return leaf ? leaf(text) : [text];
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
        <h1 key={key} className="text-2xl font-bold mb-2 mt-1">
          {processInlineFormatting(content)}
        </h1>
      );
    } else if (line.startsWith('## ')) {
      const content = line.slice(3);
      return (
        <h2 key={key} className="text-xl font-semibold mb-2 mt-1">
          {processInlineFormatting(content)}
        </h2>
      );
    } else if (line.trim() === '') {
      return <div key={key} className="h-2" />;
    } else {
      return (
        <div key={key} className="mb-1">
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
        <h1 key={key} className="text-2xl font-bold mb-2 mt-1">
          {processWithBoth(content)}
        </h1>
      );
    } else if (line.startsWith('## ')) {
      const content = line.slice(3);
      return (
        <h2 key={key} className="text-xl font-semibold mb-2 mt-1">
          {processWithBoth(content)}
        </h2>
      );
    } else if (line.trim() === '') {
      return <div key={key} className="h-2" />;
    } else {
      return (
        <div key={key} className="mb-1">
          {processWithBoth(line)}
        </div>
      );
    }
  });
};
