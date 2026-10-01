import { useState, useEffect, useRef, KeyboardEvent } from 'react';
import { Input } from '@/components/ui/input';
import { getAllTags } from '@/lib/tagStorage';
import { cn } from '@/lib/utils';

interface TagAutocompleteInputProps {
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  autoFocus?: boolean;
}

export function TagAutocompleteInput({
  value,
  onChange,
  onKeyDown,
  placeholder,
  className,
  inputClassName,
  autoFocus,
}: TagAutocompleteInputProps) {
  const [suggestion, setSuggestion] = useState('');
  const [allTags, setAllTags] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Load all tags on mount
    setAllTags(getAllTags());
  }, []);

  useEffect(() => {
    // Find matching tag suggestion based on current input
    const currentWord = getCurrentTagWord(value);
    
    if (currentWord && currentWord.length > 0) {
      // Find a tag that starts with the current word (without #)
      const matchingTag = allTags.find(tag => 
        tag.toLowerCase().startsWith(currentWord.toLowerCase()) && 
        tag.toLowerCase() !== currentWord.toLowerCase()
      );
      
      if (matchingTag) {
        // Get the remaining part of the tag (what we suggest)
        const remainingSuggestion = matchingTag.slice(currentWord.length);
        setSuggestion(remainingSuggestion);
      } else {
        setSuggestion('');
      }
    } else {
      setSuggestion('');
    }
  }, [value, allTags]);

  // Extract the current tag word being typed (after # or as standalone, without the #)
  const getCurrentTagWord = (input: string): string => {
    // Check if we're typing a tag (after #)
    const hashMatch = input.match(/#(\w*)$/);
    if (hashMatch) {
      return hashMatch[1];
    }
    
    // Check for standalone word at the end (for search queries)
    const wordMatch = input.match(/(\w+)$/);
    if (wordMatch) {
      return wordMatch[1];
    }
    
    return '';
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    // Accept suggestion with Tab or Right arrow at end of input
    if ((e.key === 'Tab' || e.key === 'ArrowRight') && suggestion) {
      const cursorAtEnd = inputRef.current?.selectionStart === value.length;
      if (cursorAtEnd) {
        e.preventDefault();
        // Complete the suggestion
        onChange(value + suggestion);
        setSuggestion('');
        return;
      }
    }
    
    onKeyDown?.(e);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
    // Refresh tags in case new ones were added
    setAllTags(getAllTags());
  };

  return (
    <div className={cn("relative", className)}>
      {/* Actual input - on top for interaction */}
      <Input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className={cn("relative z-10 bg-transparent caret-foreground", inputClassName)}
        style={{ caretColor: 'currentColor' }}
      />
      
      {/* Suggestion overlay - must match input styling exactly */}
      {suggestion && (
        <div 
          className={cn(
            // Base input styles to match exactly (from input.tsx)
            "absolute inset-0 pointer-events-none flex items-center overflow-hidden",
            "px-3 py-2 text-sm md:text-sm",
            inputClassName
          )}
          aria-hidden="true"
        >
          {/* Single container with no gaps - invisible typed text + visible suggestion */}
          <span className="whitespace-pre"><span className="invisible">{value}</span><span className="text-muted-foreground/40">{suggestion}</span></span>
        </div>
      )}
    </div>
  );
}
