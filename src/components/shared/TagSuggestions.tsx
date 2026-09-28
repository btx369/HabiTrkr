import { Badge } from '@/components/ui/badge';
import { isDefaultColor } from '@/lib/cardColorStyles';
import { cn } from '@/lib/utils';

interface TagSuggestionsProps {
  suggestions: string[];
  onSelect: (tag: string) => void;
  noteColor?: string;
}

export function TagSuggestions({ suggestions, onSelect, noteColor }: TagSuggestionsProps) {
  if (suggestions.length === 0) return null;

  const hasNoteColor = noteColor && !isDefaultColor(noteColor);

  return (
    <div className="flex flex-wrap gap-1.5 py-1">
      {suggestions.map((tag, index) => (
        <Badge
          key={`${tag}-${index}`}
          variant="secondary"
          className={cn(
            "cursor-pointer transition-colors",
            hasNoteColor 
              ? "bg-[#000000]/10 text-[#000000] hover:bg-[#000000]/20" 
              : "bg-black text-white hover:bg-black/80 dark:bg-muted dark:text-foreground dark:hover:bg-accent dark:hover:text-accent-foreground"
          )}
          onClick={() => onSelect(tag)}
        >
          #{tag}
        </Badge>
      ))}
    </div>
  );
}
