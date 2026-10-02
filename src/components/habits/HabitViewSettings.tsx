import { Settings, ChevronUp, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { useLanguage } from '@/contexts/LanguageContext';

export type HabitSortType = 'name' | 'dateCreated' | 'dateModified' | 'completionRate';
export type HabitSortDirection = 'asc' | 'desc';

interface HabitViewSettingsProps {
  sortType: HabitSortType;
  sortDirection: HabitSortDirection;
  onSortTypeChange: (sortType: HabitSortType) => void;
  onSortDirectionChange: (direction: HabitSortDirection) => void;
}

export function HabitViewSettings({
  sortType,
  sortDirection,
  onSortTypeChange,
  onSortDirectionChange
}: HabitViewSettingsProps) {
  const { t } = useLanguage();

  const getSortLabel = (type: HabitSortType) => {
    // `Name` is the habit's title field, which the editor labels with the `title` key.
    const labels = {
      name: t('title'),
      dateCreated: t('dateCreated'),
      dateModified: t('dateModified'),
      completionRate: t('completionRate')
    };
    return labels[type];
  };

  const handleSortClick = (newSortType: HabitSortType) => {
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
        {(['name', 'dateCreated', 'dateModified', 'completionRate'] as const).map((type) => (
          <DropdownMenuItem
            key={type}
            onClick={() => handleSortClick(type)}
            className="flex items-center gap-2 cursor-pointer"
          >
            <div className="w-4 h-4 flex items-center justify-center">
              {sortType === type && (
                <>
                  {sortDirection === 'asc' ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
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
