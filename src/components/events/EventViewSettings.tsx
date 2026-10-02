import { Settings, ChevronUp, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { useLanguage } from '@/contexts/LanguageContext';
import { VIEW_LABELS, isViewType, type ViewType } from '@/types/view';

// Re-exported so existing importers keep working from this module.
export type { ViewType } from '@/types/view';
export type EventSortType = 'title' | 'dateCreated' | 'dateModified' | 'daysRemaining';
export type EventSortDirection = 'asc' | 'desc';

interface EventViewSettingsProps {
  viewType: ViewType;
  sortType: EventSortType;
  sortDirection: EventSortDirection;
  onViewTypeChange: (viewType: ViewType) => void;
  onSortTypeChange: (sortType: EventSortType) => void;
  onSortDirectionChange: (direction: EventSortDirection) => void;
}

export function EventViewSettings({
  viewType,
  sortType,
  sortDirection,
  onViewTypeChange,
  onSortTypeChange,
  onSortDirectionChange
}: EventViewSettingsProps) {
  const { t } = useLanguage();

  const getSortLabel = (type: EventSortType) => {
    // Values are translation keys, resolved through `t` below.
    const labels = {
      title: 'title',
      dateCreated: 'dateCreated',
      dateModified: 'dateModified',
      daysRemaining: 'daysRemaining'
    };
    return t(labels[type]);
  };

  const handleSortClick = (newSortType: EventSortType) => {
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
        <DropdownMenuLabel>{t('view')}</DropdownMenuLabel>
        {/*
          Radix types this callback as `(value: string) => void`, so the value has to be
          narrowed back to ViewType. The guard runs the same membership check the union
          describes — the stored value comes from localStorage, and a cast would let an
          unknown string through into a Record<ViewType, number> lookup.
        */}
        <DropdownMenuRadioGroup
          value={viewType}
          onValueChange={(value) => {
            if (isViewType(value)) onViewTypeChange(value);
          }}
        >
          <DropdownMenuRadioItem value="x3">{t('viewX3')}</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="x2">{t('viewX2')}</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="list">{t('viewList')}</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        
        <DropdownMenuSeparator />
        
        <DropdownMenuLabel>{t('sortBy')}</DropdownMenuLabel>
        {(['title', 'dateCreated', 'dateModified', 'daysRemaining'] as const).map((type) => (
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