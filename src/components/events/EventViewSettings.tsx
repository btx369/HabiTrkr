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
import { VIEW_LABELS, type ViewType } from '@/types/view';

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
  const getSortLabel = (type: EventSortType) => {
    const labels = {
      title: 'Title',
      dateCreated: 'Date Created',
      dateModified: 'Date Modified',
      daysRemaining: 'Days Remaining'
    };
    return labels[type];
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
          variant="ghost"
          size="icon"
          className="text-foreground hover:bg-black hover:text-white rounded-full data-[state=open]:bg-black data-[state=open]:text-white focus-visible:ring-0 focus-visible:ring-offset-0 [&_svg]:!size-6"
        >
          <Settings className="h-6 w-6" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48 bg-background border border-border">
        <DropdownMenuLabel>View</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={viewType} onValueChange={onViewTypeChange}>
          <DropdownMenuRadioItem value="x3">{VIEW_LABELS.x3}</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="x2">{VIEW_LABELS.x2}</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="list">{VIEW_LABELS.list}</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        
        <DropdownMenuSeparator />
        
        <DropdownMenuLabel>Organise</DropdownMenuLabel>
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