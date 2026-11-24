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
              ? "bg-ink/10 text-ink hover:bg-ink/20" 
              : "bg-stamp text-stamp-foreground hover:bg-stamp/90"
          )}
          onClick={() => onSelect(tag)}
        >
          #{tag}
        </Badge>
      ))}
    </div>
  );
}
