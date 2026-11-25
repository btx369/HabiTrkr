import { inlineToHtml } from './inlineMarkdown';

/**
 * Converts markdown to HTML for rich text editor
 */
export function markdownToHtml(markdown: string): string {
  if (!markdown) return '';
  
  // Headings and inline formatting (bold, italic and underline nested in any order, one
  // parser shared with the read-only view), line by line.
  const html = markdown
    .split('\n')
    .map(line => {
      const heading = line.match(/^(#{1,2}) (.+)$/);
      if (heading) return `<h${heading[1].length}>${inlineToHtml(heading[2])}</h${heading[1].length}>`;
      return inlineToHtml(line);
    })
    .join('\n');
  
  // Convert line breaks to paragraphs, preserving blank lines
  const lines = html.split('\n');
  const paragraphs = lines.map(line => {
    // If line already has HTML tags, don't wrap it
    if (line.match(/^<h[12]>/)) {
      return line;
    }
    // Convert empty lines to empty paragraphs (preserves spacing in TipTap)
    if (line.trim() === '') {
      return '<p></p>';
    }
    return `<p>${line}</p>`;
  }).join('');
  
  return paragraphs;
}

/**
 * Converts HTML from rich text editor back to markdown
 */
export function htmlToMarkdown(html: string): string {
  if (!html) return '';
  
  let markdown = html;
  
  // Convert headings
  markdown = markdown.replace(/<h1>(.+?)<\/h1>/g, '# $1');
  markdown = markdown.replace(/<h2>(.+?)<\/h2>/g, '## $1');
  
  // Convert bold
  markdown = markdown.replace(/<strong>(.+?)<\/strong>/g, '**$1**');
  
  // Convert italic
  markdown = markdown.replace(/<em>(.+?)<\/em>/g, '*$1*');
  
  // Convert underline
  markdown = markdown.replace(/<u>(.+?)<\/u>/g, '__$1__');
  
  // Convert empty paragraphs to blank lines (preserve spacing)
  markdown = markdown.replace(/<p><\/p>/g, '\n');
  
  // Remove paragraph tags and convert to plain text with line breaks
  markdown = markdown.replace(/<p>/g, '');
  markdown = markdown.replace(/<\/p>/g, '\n');
  
  // Clean up excessive newlines (more than 2 consecutive)
  markdown = markdown.replace(/\n{3,}/g, '\n\n');
  
  // Trim only the very start and end, not internal spacing
  markdown = markdown.trim();
  
  return markdown;
}
