import { ReactNode } from 'react';

interface TextPart {
  type: 'text' | 'bold' | 'italic' | 'underline';
  content: string;
}

const processInlineFormatting = (text: string): ReactNode[] => {
  const result: ReactNode[] = [];
  let currentIndex = 0;
  
  // Parse inline formatting: **bold**, *italic*, __underline__
  const regex = /(\*\*.*?\*\*|\*.*?\*|__.*?__)/g;
  let match;
  let lastIndex = 0;
  
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
  
  // For search highlighting, we'll apply a simpler approach
  // that highlights the search term while preserving markdown formatting
  const lines = text.split('\n');
  const regex = new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  
  return lines.map((line, idx) => {
    const key = `line-${idx}`;
    
    const highlightInline = (textToHighlight: string): ReactNode[] => {
      const parts = textToHighlight.split(regex);
      return parts.map((part, partIdx) => {
        if (part.toLowerCase() === searchQuery.toLowerCase()) {
          return (
            <mark key={`highlight-${partIdx}`} className="bg-yellow-200 dark:bg-yellow-800 text-foreground rounded-sm px-0 py-0">
              {part}
            </mark>
          );
        }
        return part;
      });
    };
    
    // Process inline formatting with highlighting
    const processWithBoth = (text: string): ReactNode[] => {
      // First apply search highlighting
      const highlightedParts = text.split(regex);
      
      return highlightedParts.map((part, partIdx) => {
        if (part.toLowerCase() === searchQuery.toLowerCase()) {
          return (
            <mark key={`h-${partIdx}`} className="bg-yellow-200 dark:bg-yellow-800 text-foreground rounded-sm px-0 py-0">
              {part}
            </mark>
          );
        }
        // Then apply inline formatting to non-highlighted parts
        return <span key={`s-${partIdx}`}>{processInlineFormatting(part)}</span>;
      });
    };
    
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
