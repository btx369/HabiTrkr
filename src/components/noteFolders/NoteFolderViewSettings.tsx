import { Settings, ChevronUp, ChevronDown } from 'lucide-react';
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

export type NoteFolderSortType = 'name' | 'dateCreated' | 'dateModified' | 'recentlyAdded' | 'noteCount';
export type NoteFolderSortDirection = 'asc' | 'desc';

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
  const getSortLabel = (type: NoteFolderSortType) => {
    const labels = {
      name: 'Name',
      dateCreated: 'Date Created',
      dateModified: 'Date Modified',
      recentlyAdded: 'Recently Added',
      noteCount: 'Note Count'
    };
    return labels[type];
  };

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
        <DropdownMenuLabel>Organise</DropdownMenuLabel>
        {(['name', 'dateCreated', 'dateModified', 'recentlyAdded', 'noteCount'] as const).map((type) => (
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