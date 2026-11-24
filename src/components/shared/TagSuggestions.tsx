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
              ? "bg-cocoa/10 text-cocoa hover:bg-cocoa/20" 
              : "bg-leaf text-leaf-foreground hover:bg-leaf/90"
          )}
          onClick={() => onSelect(tag)}
        >
          #{tag}
        </Badge>
      ))}
    </div>
  );
}
