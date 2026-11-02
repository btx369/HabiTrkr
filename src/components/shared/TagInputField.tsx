import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';
import { parseTagsFromInput } from '@/lib/tagParser';
import { getTopTags } from '@/lib/tagStorage';
import { TagSuggestions } from '@/components/shared/TagSuggestions';
import { useLanguage } from '@/contexts/LanguageContext';

interface TagInputFieldProps {
  tags: string[];
  onTagsChange: (tags: string[]) => void;
  placeholder?: string;
  showSuggestions?: boolean;
}

export function TagInputField({ 
  tags, 
  onTagsChange, 
  placeholder = "Add tags (e.g., #work #personal)",
  showSuggestions = true
}: TagInputFieldProps) {
  const { t } = useLanguage();
  const [tagInput, setTagInput] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);

  useEffect(() => {
    if (showSuggestions) {
      const topTags = getTopTags(5);
      setSuggestions(topTags);
    }
  }, [showSuggestions]);

  const handleAddTags = () => {
    const newTags = parseTagsFromInput(tagInput);
    if (newTags.length === 0) return;

    const updatedTags = [...new Set([...tags, ...newTags])];
    onTagsChange(updatedTags);
    setTagInput('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    onTagsChange(tags.filter(tag => tag !== tagToRemove));
  };

  const handleSuggestionClick = (tag: string) => {
    if (tags.includes(tag)) return;
    onTagsChange([...tags, tag]);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
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

      <Input
        value={tagInput}
        onChange={(e) => setTagInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="h-10 text-sm"
      />
      <Button 
        type="button"
        onClick={handleAddTags} 
        className="w-full h-10 text-sm"
        disabled={!tagInput.trim()}
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
