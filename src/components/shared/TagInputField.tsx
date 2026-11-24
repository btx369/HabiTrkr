import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';
import { parseTagsFromInput } from '@/lib/tagParser';
import { getTopTags, getAllTags } from '@/lib/tagStorage';
import { TagSuggestions } from '@/components/shared/TagSuggestions';
import { useLanguage } from '@/contexts/LanguageContext';
import { TAG_MAX_LENGTH } from '@/lib/tagLimits';

interface TagInputFieldProps {
  tags: string[];
  onTagsChange: (tags: string[]) => void;
  placeholder?: string;
  showSuggestions?: boolean;
}

export function TagInputField({ 
  tags, 
  onTagsChange, 
  placeholder,
  showSuggestions = true
}: TagInputFieldProps) {
  const { t } = useLanguage();
  // Starts with "#", like the tag field on notes and events; the "#" is put back if deleted.
  const [tagInput, setTagInput] = useState('#');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [allTags] = useState<string[]>(() => getAllTags());

  // Inline completion of the tag being typed, shown greyed after the cursor (Tab or → accepts).
  const currentWord = tagInput.match(/#(\w*)$/)?.[1] ?? '';
  const completion = (() => {
    if (!currentWord) return '';
    const match = allTags.find(tag =>
      tag.toLowerCase().startsWith(currentWord.toLowerCase()) &&
      tag.toLowerCase() !== currentWord.toLowerCase() &&
      !tags.includes(tag));
    return match ? match.slice(currentWord.length) : '';
  })();

  const handleInputChange = (value: string) => {
    if (value === '') value = '#';
    else if (!value.startsWith('#')) value = '#' + value;
    setTagInput(value);
  };

  useEffect(() => {
    if (showSuggestions) {
      const topTags = getTopTags(5);
      setSuggestions(topTags);
    }
  }, [showSuggestions]);

  const handleAddTags = () => {
    // The same 15-character limit as tags on items; longer ones are left out.
    const newTags = parseTagsFromInput(tagInput).filter(tag => tag.length <= TAG_MAX_LENGTH);
    if (newTags.length === 0) return;

    const updatedTags = [...new Set([...tags, ...newTags])];
    onTagsChange(updatedTags);
    setTagInput('#');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    onTagsChange(tags.filter(tag => tag !== tagToRemove));
  };

  const handleSuggestionClick = (tag: string) => {
    if (tags.includes(tag)) return;
    onTagsChange([...tags, tag]);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === 'Tab' || e.key === 'ArrowRight') && completion &&
        e.currentTarget.selectionStart === tagInput.length) {
      e.preventDefault();
      setTagInput(tagInput + completion);
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTags();
    }
  };

  return (
    <div className="space-y-2">
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {tags.map((tag, index) => (
            <Badge key={`${tag}-${index}`} variant="secondary" className="gap-1">
              #{tag}
              <button
                onClick={() => handleRemoveTag(tag)}
                className="ml-1 hover:text-destructive"
              >
                <X size={12} />
              </button>
            </Badge>
          ))}
        </div>
      )}

      <div className="relative rounded-md bg-background">
        <Input
          value={tagInput}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          aria-label={t('tags')}
          spellCheck={false}
          autoCapitalize="none"
          className="h-10 text-sm relative z-10 bg-transparent"
        />
        {tagInput === '#' && (
          <div className="absolute inset-0 pointer-events-none flex items-center overflow-hidden px-3 text-sm" aria-hidden="true">
            <span className="invisible">#</span>
            <span className="text-muted-foreground">{placeholder ?? t('placeholderAddTagsWork')}</span>
          </div>
        )}
        {completion && (
          <div className="absolute inset-0 pointer-events-none flex items-center overflow-hidden px-3 text-sm" aria-hidden="true">
            <span className="whitespace-pre">
              <span className="invisible">{tagInput}</span>
              <span className="text-muted-foreground/40">{completion}</span>
            </span>
          </div>
        )}
      </div>
      <Button 
        type="button"
        onClick={handleAddTags} 
        className="w-full h-10 text-sm"
        disabled={!tagInput.trim() || tagInput.trim() === '#'}
      >
        {t('addTags')}
      </Button>

      {showSuggestions && suggestions.length > 0 && (
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">{t('suggestions')}</Label>
          <TagSuggestions 
            suggestions={suggestions} 
            onSelect={handleSuggestionClick}
          />
        </div>
      )}
    </div>
  );
}
