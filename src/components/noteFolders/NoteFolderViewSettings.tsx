import { Settings, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';

export type NoteFolderSortType = 'name' | 'dateCreated' | 'dateModified' | 'recentlyAdded' | 'noteCount';
export type NoteFolderSortDirection = 'asc' | 'desc';

/**
 * Sort labels, as translation KEYS rather than text.
 *
 * The menu is rendered inside the component, so `t()` is called there. 'name' maps to the
 * `title` key because there is no separate key for it and the same field is labelled
 * "Title" in the editors.
 */
const SORT_LABELS = {
  name: 'title',
  dateCreated: 'dateCreated',
  dateModified: 'dateModified',
  recentlyAdded: 'recentlyAdded',
  noteCount: 'noteCount',
} as const;

interface NoteFolderViewSettingsProps {
  sortType: NoteFolderSortType;
  sortDirection: NoteFolderSortDirection;
  onSortTypeChange: (sortType: NoteFolderSortType) => void;
  onSortDirectionChange: (direction: NoteFolderSortDirection) => void;
}

export function NoteFolderViewSettings({
  sortType,
  sortDirection,
  onSortTypeChange,
  onSortDirectionChange
}: NoteFolderViewSettingsProps) {
  const { t } = useLanguage();

  const getSortLabel = (type: NoteFolderSortType): string => t(SORT_LABELS[type]);

  const handleSortClick = (newSortType: NoteFolderSortType) => {
    if (sortType === newSortType) {
      // Toggle direction if same sort type
      onSortDirectionChange(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new sort type with default ascending direction
      onSortTypeChange(newSortType);
      onSortDirectionChange('asc');
    }
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghostStatic"
          size="icon"
          className="text-foreground hover:bg-hover hover:text-foreground rounded-full data-[state=open]:bg-hover data-[state=open]:text-foreground focus-visible:ring-0 focus-visible:ring-offset-0 [&_svg]:!size-5"
        >
          <Settings className="h-6 w-6" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48 bg-background border border-border">
        <DropdownMenuLabel>{t('sortBy')}</DropdownMenuLabel>
        {(['name', 'dateCreated', 'dateModified', 'recentlyAdded', 'noteCount'] as const).map((type) => (
          <DropdownMenuItem
            key={type}
            onSelect={(event) => event.preventDefault()}
            onClick={() => handleSortClick(type)}
            className="flex items-center gap-2 cursor-pointer"
          >
            <div className="w-4 h-4 flex items-center justify-center">
              {sortType === type && (
                <>
                  <ChevronUp className={`h-4 w-4 transition-transform duration-200 ${sortDirection === 'desc' ? 'rotate-180' : ''}`} />
                </>
              )}
            </div>
            <span>{getSortLabel(type)}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
