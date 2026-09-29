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
export type SortType = 'title' | 'dateCreated' | 'dateModified' | 'custom';
export type SortDirection = 'asc' | 'desc';

interface ViewSettingsProps {
  viewType: ViewType;
  sortType: SortType;
  sortDirection: SortDirection;
  onViewTypeChange: (viewType: ViewType) => void;
  onSortTypeChange: (sortType: SortType) => void;
  onSortDirectionChange: (direction: SortDirection) => void;
}

export function ViewSettings({
  viewType,
  sortType,
  sortDirection,
  onViewTypeChange,
  onSortTypeChange,
  onSortDirectionChange
}: ViewSettingsProps) {
  const getSortLabel = (type: SortType) => {
    const labels = {
      title: 'Title',
      dateCreated: 'Date Created',
      dateModified: 'Date Modified',
      custom: 'Custom'
    };
    return labels[type];
  };

  const handleSortClick = (newSortType: SortType) => {
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
        {(['title', 'dateCreated', 'dateModified'] as const).map((type) => (
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
        <DropdownMenuItem
          onClick={() => handleSortClick('custom')}
          className="flex items-center gap-2 cursor-pointer"
        >
          <div className="w-4 h-4 flex items-center justify-center">
            {sortType === 'custom' && (
              <span className="h-2 w-2 rounded-full bg-primary" />
            )}
          </div>
          <span>Custom</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}