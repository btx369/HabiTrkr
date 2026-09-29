
interface ContentPart {
  type: 'text' | 'image' | 'audio';
  content: string;
  duration?: number; // For audio parts
}

// Helper function to reorder content parts: images -> audio -> text
const reorderContentParts = (parts: ContentPart[]): ContentPart[] => {
  const images = parts.filter(p => p.type === 'image');
  const audio = parts.filter(p => p.type === 'audio');
  const text = parts.filter(p => p.type === 'text');
  return [...images, ...audio, ...text];
};

export const parseNoteContent = (content: string): ContentPart[] => {
  const parts: ContentPart[] = [];
  
  // Remove audionote markers first (they're metadata, not content to display)
  const cleanContent = content.replace(/\[audionote:.+?\]/g, '');
  
  // Create a combined regex to match both images and audio in order
  const combinedRegex = /\[image:(.*?)\]|\[audio:(.+):([\d.]+)\]/g;
  let lastIndex = 0;
  let match;

  while ((match = combinedRegex.exec(cleanContent)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      const textContent = cleanContent.substring(lastIndex, match.index);
      if (textContent) {
        parts.push({ type: 'text', content: textContent });
      }
    }

    // Check if it's an image or audio match
    if (match[1] !== undefined) {
      // Image match
      parts.push({ type: 'image', content: match[1] });
    } else if (match[2] !== undefined && match[3] !== undefined) {
      // Audio match
      parts.push({ type: 'audio', content: match[2], duration: parseFloat(match[3]) });
    }
    
    lastIndex = match.index + match[0].length;
  }

  // Add remaining text after last match
  if (lastIndex < cleanContent.length) {
    const textContent = cleanContent.substring(lastIndex);
    if (textContent) {
      parts.push({ type: 'text', content: textContent });
    }
  }

  // If no matches found, return the whole content as text
  if (parts.length === 0 && cleanContent) {
    parts.push({ type: 'text', content: cleanContent });
  }

  // Reorder parts: images first, then audio, then text
  return reorderContentParts(parts);
};

