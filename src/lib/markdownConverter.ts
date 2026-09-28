/**
 * Converts markdown to HTML for rich text editor
 */
export function markdownToHtml(markdown: string): string {
  if (!markdown) return '';
  
  let html = markdown;
  
  // Convert headings
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  
  // Convert bold (must come before italic to avoid conflicts)
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  
  // Convert italic
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  
  // Convert underline
  html = html.replace(/__(.+?)__/g, '<u>$1</u>');
  
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
