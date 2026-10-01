import { ReactNode } from 'react';
import { splitBySearchTerms } from './textHighlight';

interface TextPart {
  type: 'text' | 'bold' | 'italic' | 'underline';
  content: string;
}

const processInlineFormatting = (text: string): ReactNode[] => {
  const result: ReactNode[] = [];
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
      result.push(text.substring(position, m.index));
    }
    
    // Add formatted text (recursively process inner text for nested formatting)
    const key = `format-${idx}`;
    if (m.type === 'bold') {
      result.push(<strong key={key}>{processInlineFormatting(m.text)}</strong>);
    } else if (m.type === 'italic') {
      result.push(<em key={key}>{processInlineFormatting(m.text)}</em>);
    } else if (m.type === 'underline') {
      result.push(<u key={key}>{processInlineFormatting(m.text)}</u>);
    }
    
    // Update position
    const originalLength = m.type === 'bold' || m.type === 'underline' ? m.text.length + 4 : m.text.length + 2;
    position = m.index + originalLength;
  });
  
  // Add remaining text
  if (position < text.length) {
    result.push(text.substring(position));
  }
  
  return result.length > 0 ? result : [text];
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
    const processWithBoth = (text: string): ReactNode[] =>
      splitBySearchTerms(text, searchQuery).map((segment, partIdx) => {
        if (segment.matched) {
          return (
            <mark key={`h-${partIdx}`} className="bg-highlight text-foreground rounded-sm px-0 py-0">
              {segment.text}
            </mark>
          );
        }
        return <span key={`s-${partIdx}`}>{processInlineFormatting(segment.text)}</span>;
      });
    
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
