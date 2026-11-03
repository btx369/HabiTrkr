import { Settings, ChevronUp, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@/components/ui/dropdown-menu';
import { useLanguage } from '@/contexts/LanguageContext';
import { isViewType, type ViewType } from '@/types/view';

export type HabitSortType = 'name' | 'dateCreated' | 'dateModified' | 'custom';
export type HabitSortDirection = 'asc' | 'desc';

interface HabitViewSettingsProps {
  viewType: ViewType;
  sortType: HabitSortType;
  sortDirection: HabitSortDirection;
  customReorderingEnabled: boolean;
  onViewTypeChange: (viewType: ViewType) => void;
  onSortTypeChange: (sortType: HabitSortType) => void;
  onSortDirectionChange: (direction: HabitSortDirection) => void;
}

export function HabitViewSettings({
  viewType,
  sortType,
  sortDirection,
  customReorderingEnabled,
  onViewTypeChange,
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
      custom: t('custom')
    };
    return labels[type];
  };

  const handleSortClick = (newSortType: HabitSortType) => {
    if (newSortType === 'custom') {
      onSortTypeChange(newSortType);
      return;
    }

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
      <DropdownMenuContent align="end" className="w-48 bg-background border border-border">
        <DropdownMenuLabel>{t('view')}</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={viewType}
          onValueChange={(value) => {
            if (isViewType(value)) onViewTypeChange(value);
          }}
        >
          <DropdownMenuRadioItem value="x3" onSelect={(event) => event.preventDefault()}>{t('viewX3')}</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="x2" onSelect={(event) => event.preventDefault()}>{t('viewX2')}</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="list" onSelect={(event) => event.preventDefault()}>{t('viewList')}</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>{t('sortBy')}</DropdownMenuLabel>
        {(['name', 'dateCreated', 'dateModified', 'custom'] as const).map((type) => (
          <DropdownMenuItem
            key={type}
            onSelect={(event) => event.preventDefault()}
            onClick={() => handleSortClick(type)}
            className="flex items-center gap-2 cursor-pointer"
          >
            <div className="w-4 h-4 flex items-center justify-center">
              {sortType === type && (
                type === 'custom'
                  ? (customReorderingEnabled ? <GripVertical className="h-4 w-4" /> : null)
                  : <ChevronUp className={`h-4 w-4 transition-transform duration-200 ${sortDirection === 'desc' ? 'rotate-180' : ''}`} />
              )}
            </div>
            <span>{getSortLabel(type)}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
