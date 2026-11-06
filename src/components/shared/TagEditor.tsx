import { useState, useEffect } from 'react';
import { X, LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { parseTagsFromInput } from '@/lib/tagParser';
import { getAllTags, getActiveTagsFromStorage } from '@/lib/tagStorage';
import { TagSuggestions } from '@/components/shared/TagSuggestions';
import { useToastSettings } from '@/contexts/ToastContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { isDefaultColor } from '@/lib/cardColorStyles';
import { getColoredIconClass, getColoredBorderClass } from '@/lib/coloredButtonStyles';

import { PREMIUM_TAG_LIMIT, TAG_MAX_LENGTH, tagLimitFor } from '@/lib/tagLimits';
import { usePremiumAccount } from '@/hooks/usePremiumAccount';

interface TagEditorProps {
  tags: string[];
  onTagsChange: (tags: string[]) => void;
  onValidationChange?: (hasError: boolean) => void;
  placeholder?: string;
  suggestionsLimit?: number;
  icon?: LucideIcon;
  iconColor?: string;
  noteColor?: string;
}

export function TagEditor({ 
  tags, 
  onTagsChange,
  onValidationChange,
  placeholder,
  suggestionsLimit = 5,
  icon: Icon,
  iconColor,
  noteColor
}: TagEditorProps) {
  const hasNoteColor = noteColor && !isDefaultColor(noteColor);
  const iconColorClass = getColoredIconClass(!!hasNoteColor);
  const borderClass = getColoredBorderClass(!!hasNoteColor, 30);
  const [tagInput, setTagInput] = useState('#');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [hasError, setHasError] = useState(false);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [suggestion, setSuggestion] = useState('');
  const { toast } = useToastSettings();
  const { t } = useLanguage();
  // 5 tags per item, 25 with Premium.
  const [premiumAccount] = usePremiumAccount();
  const TAG_LIMIT = tagLimitFor(premiumAccount.isPremium);
  const limitMessage = () => premiumAccount.isPremium
    ? t('toastTagLimit').replace('{count}', String(TAG_LIMIT))
    : t('toastTagLimitPremium').replace('{count}', String(TAG_LIMIT)).replace('{premium}', String(PREMIUM_TAG_LIMIT));
  useEffect(() => {
    // Get only tags that are currently in use, excluding ones already on this note
    const activeTags = getActiveTagsFromStorage();
    const filteredTags = activeTags.filter(tag => !tags.includes(tag));
    setSuggestions(filteredTags);
    setAllTags(getAllTags());
  }, [tags, suggestionsLimit]);

  // Check for autocomplete suggestion
  useEffect(() => {
    const currentWord = getCurrentTagWord(tagInput);
    
    if (currentWord && currentWord.length > 0) {
      const matchingTag = allTags.find(tag => 
        tag.toLowerCase().startsWith(currentWord.toLowerCase()) && 
        tag.toLowerCase() !== currentWord.toLowerCase()
      );
      
      if (matchingTag) {
        setSuggestion(matchingTag.slice(currentWord.length));
      } else {
        setSuggestion('');
      }
    } else {
      setSuggestion('');
    }
  }, [tagInput, allTags]);

  const currentTagLength = (tagInput.trim().split(/\s+/).pop() ?? '').replace(/^#+/, '').length;

  const getCurrentTagWord = (input: string): string => {
    const hashMatch = input.match(/#(\w*)$/);
    if (hashMatch) {
      return hashMatch[1];
    }
    return '';
  };

  const validateInput = (input: string): boolean => {
    if (!input.trim() || input.trim() === '#') return true; // Empty is ok
    
    // Check if all words that aren't just whitespace have # prefix
    const words = input.trim().split(/\s+/).filter(w => w.length > 0);
    for (const word of words) {
      if (!word.startsWith('#')) {
        return false;
      }
    }
    return true;
  };

  const handleInputChange = (value: string) => {
    // If user deleted everything including #, add it back
    if (value === '') {
      setTagInput('#');
      setHasError(false);
      onValidationChange?.(false);
      return;
    }
    
    // Ensure input starts with #
    if (!value.startsWith('#')) {
      value = '#' + value;
    }
    
    // A tag stops at 30 characters: typing past it does nothing, as in the title field.
    if (value.split(/\s+/).some(word => word.replace(/^#+/, '').length > TAG_MAX_LENGTH)) {
      return;
    }

    setTagInput(value);
    
    // Validate and show/hide error
    const isValid = validateInput(value);
    setHasError(!isValid);
    onValidationChange?.(!isValid);
  };

  const handleAddTags = () => {
    if (!tagInput.trim() || tagInput.trim() === '#') return;
    
    // Check tag limit
    if (tags.length >= TAG_LIMIT) {
      toast.error(limitMessage());
      return;
    }
    
    // Check if valid before adding
    if (!validateInput(tagInput)) {
      setHasError(true);
      toast.error(t('toastTagMustStartWithHash'));
      return;
    }
    
    const newTags = parseTagsFromInput(tagInput);
    if (newTags.length === 0) {
      setHasError(true);
      toast.error(t('toastTagMustStartWithHash'));
      return;
    }
    if (newTags.some(tag => tag.length > TAG_MAX_LENGTH)) {
      setHasError(true);
      toast.error(t('toastTagTooLong').replace('{count}', String(TAG_MAX_LENGTH)));
      return;
    }

    // Limit new tags to not exceed maximum
    const availableSlots = TAG_LIMIT - tags.length;
    const tagsToAdd = newTags.slice(0, availableSlots);
    
    if (tagsToAdd.length < newTags.length) {
      toast.warning(limitMessage());
    }

    const updatedTags = [...new Set([...tags, ...tagsToAdd])];
    onTagsChange(updatedTags);
    setTagInput('#');
    setHasError(false);
    onValidationChange?.(false);
    setAllTags(getAllTags());
  };

  const handleRemoveTag = (tagToRemove: string) => {
    onTagsChange(tags.filter(tag => tag !== tagToRemove));
  };

  const handleSuggestionClick = (tag: string) => {
    if (tags.includes(tag)) return;
    if (tags.length >= TAG_LIMIT) {
      toast.error(limitMessage());
      return;
    }
    onTagsChange([...tags, tag]);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Accept suggestion with Tab or Right arrow at end of input
    if ((e.key === 'Tab' || e.key === 'ArrowRight') && suggestion) {
      const target = e.target as HTMLInputElement;
      if (target.selectionStart === tagInput.length) {
        e.preventDefault();
        setTagInput(tagInput + suggestion);
        setSuggestion('');
        return;
      }
    }
    
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTags();
    }
  };

  return (
    <div className="space-y-2">
      <Label className={cn("text-sm flex items-center gap-2", hasNoteColor && iconColorClass)}>
        {Icon && <Icon size={20} className={hasNoteColor ? iconColorClass : ''} style={!hasNoteColor && iconColor ? { color: iconColor } : {}} />}
        {/* Like Title and Description: how long the tag being typed is, out of 30. */}
        {t('tags')} <span className={cn(
          "text-xs font-normal",
          currentTagLength >= TAG_MAX_LENGTH
            ? "text-destructive"
            : currentTagLength >= Math.floor(TAG_MAX_LENGTH * 0.85)
              ? "text-orange-500"
              : hasNoteColor
                ? "text-[#000000]/60"
                : "text-muted-foreground"
        )}>{currentTagLength}/{TAG_MAX_LENGTH}</span>
      </Label>
      
      {/* Current tags, followed by how many of the 20 allowed are used. */}
      <div className="flex flex-wrap items-center gap-2">
          {tags.map((tag, index) => (
            <Badge
              key={`${tag}-${index}`}
              variant="secondary"
              className={cn(
                "gap-1", 
                hasNoteColor 
                  ? `bg-[#000000]/20 ${iconColorClass} hover:bg-[#000000]/30` 
                  : "bg-black text-white hover:bg-black/90"
              )}
            >
              #{tag}
              <button
                type="button"
                onClick={() => handleRemoveTag(tag)}
                className={cn("ml-1", hasNoteColor ? "hover:opacity-60" : "hover:text-destructive")}
              >
                <X size={12} />
              </button>
            </Badge>
          ))}
        <span className={cn(
          "text-xs",
          tags.length >= TAG_LIMIT
            ? "text-destructive"
            : hasNoteColor
              ? "text-[#000000]/60"
              : "text-muted-foreground"
        )}>{tags.length}/{TAG_LIMIT}</span>
      </div>

      {/* Tag Input */}
      <div className={cn(
        "flex gap-2 rounded-lg transition-colors",
        hasError && "bg-destructive/20 p-1 -m-1"
      )}>
        <div className="relative flex-1 bg-muted rounded-md">
          <Input
            type="text"
            value={tagInput}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            className={cn(
              "h-10 text-sm relative z-10 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0",
              hasError && "border-destructive/50",
              hasNoteColor && `${borderClass} ${iconColorClass} placeholder:text-[#000000]/50`
            )}
          />
          {/* Placeholder overlay - shows when input is just '#' */}
          {tagInput === '#' && (
            <div 
              className="absolute inset-0 pointer-events-none flex items-center overflow-hidden px-3 py-2 text-sm h-10"
              aria-hidden="true"
            >
              <span className={hasNoteColor ? "text-[#000000]/40" : "text-muted-foreground"}>{t('tagExample')}</span>
            </div>
          )}
          {/* Suggestion overlay */}
          {suggestion && (
            <div 
              className="absolute inset-0 pointer-events-none flex items-center overflow-hidden px-3 py-2 text-sm h-10"
              aria-hidden="true"
            >
              <span className="whitespace-pre">
                <span className="invisible">{tagInput}</span>
                <span className={hasNoteColor ? "text-[#000000]/40" : "text-muted-foreground/40"}>{suggestion}</span>
              </span>
            </div>
          )}
        </div>
        <Button 
          type="button"
          onClick={handleAddTags}
          className={cn(
            "h-10 px-3 text-sm",
            hasNoteColor 
              ? `bg-[#000000]/20 ${iconColorClass} hover:bg-[#000000]/30` 
              : "bg-black text-white hover:bg-black/90"
          )}
          disabled={tagInput.trim() === '#' || tagInput.trim() === '' || tags.length >= TAG_LIMIT}
        >
          {t('add')}
        </Button>
      </div>

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <div className="space-y-1">
          <Label className={cn("text-xs", hasNoteColor ? "text-[#000000]" : "text-foreground")}>{t('suggestions')}</Label>
          <TagSuggestions 
            suggestions={suggestions} 
            onSelect={handleSuggestionClick}
            noteColor={noteColor}
          />
        </div>
      )}
    </div>
  );
}
