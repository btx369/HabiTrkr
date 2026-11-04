import { Settings, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { useLanguage } from '@/contexts/LanguageContext';

export type HabitFolderSortType = 'name' | 'dateCreated' | 'dateModified' | 'habitCount';
export type HabitFolderSortDirection = 'asc' | 'desc';

interface HabitFolderViewSettingsProps {
  sortType: HabitFolderSortType;
  sortDirection: HabitFolderSortDirection;
  onSortTypeChange: (sortType: HabitFolderSortType) => void;
  onSortDirectionChange: (direction: HabitFolderSortDirection) => void;
}

export function HabitFolderViewSettings({
  sortType,
  sortDirection,
  onSortTypeChange,
  onSortDirectionChange
}: HabitFolderViewSettingsProps) {
  const { t } = useLanguage();

  const getSortLabel = (type: HabitFolderSortType) => {
    // `Name` is the folder's title field, which the editor labels with the `title` key.
    const labels = {
      name: t('title'),
      dateCreated: t('dateCreated'),
      dateModified: t('dateModified'),
      habitCount: t('habitCount')
    };
    return labels[type];
  };

  const handleSortClick = (newSortType: HabitFolderSortType) => {
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
          aria-label={t('viewSettings')}
          variant="ghostStatic"
          size="icon"
          className="text-foreground hover:bg-hover hover:text-foreground rounded-full data-[state=open]:bg-hover data-[state=open]:text-foreground focus-visible:ring-0 focus-visible:ring-offset-0 [&_svg]:!size-5"
        >
          <Settings className="h-6 w-6" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-background border border-border">
        <DropdownMenuLabel>{t('sortBy')}</DropdownMenuLabel>
        {(['name', 'dateCreated', 'dateModified', 'habitCount'] as const).map((type) => (
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
