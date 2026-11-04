import { Settings, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { useLanguage } from '@/contexts/LanguageContext';

export type EventFolderSortType = 'title' | 'dateCreated' | 'dateModified' | 'daysRemaining';
export type EventFolderSortDirection = 'asc' | 'desc';

interface EventFolderViewSettingsProps {
  sortType: EventFolderSortType;
  sortDirection: EventFolderSortDirection;
  onSortTypeChange: (sortType: EventFolderSortType) => void;
  onSortDirectionChange: (direction: EventFolderSortDirection) => void;
}

export function EventFolderViewSettings({
  sortType,
  sortDirection,
  onSortTypeChange,
  onSortDirectionChange
}: EventFolderViewSettingsProps) {
  const { t } = useLanguage();

  const getSortLabel = (type: EventFolderSortType) => {
    // Values are translation keys, resolved through `t` below.
    const labels = {
      title: 'title',
      dateCreated: 'dateCreated',
      dateModified: 'dateModified',
      daysRemaining: 'daysRemaining'
    };
    return t(labels[type]);
  };

  const handleSortClick = (newSortType: EventFolderSortType) => {
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
          className="text-foreground hover:bg-hover hover:text-foreground rounded-full data-[state=open]:bg-hover data-[state=open]:text-foreground focus-visible:ring-0 focus-visible:ring-offset-0 [&_svg]:!size-6"
        >
          <Settings />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-background border border-border">
        <DropdownMenuLabel>{t('sortBy')}</DropdownMenuLabel>
        {(['title', 'dateCreated', 'dateModified', 'daysRemaining'] as const).map((type) => (
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
