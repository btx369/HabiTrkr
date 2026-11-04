import { Settings, ChevronUp, GripVertical, Check } from 'lucide-react';
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
import { VIEW_LABELS, isViewType, type ViewType } from '@/types/view';
import { useLanguage } from '@/contexts/LanguageContext';

// Re-exported so existing importers keep working from this module.
export type { ViewType } from '@/types/view';
export type SortType = 'title' | 'dateCreated' | 'dateModified' | 'custom';
export type SortDirection = 'asc' | 'desc';

interface ViewSettingsProps {
  viewType: ViewType;
  sortType: SortType;
  sortDirection: SortDirection;
  customReorderingEnabled: boolean;
  onViewTypeChange: (viewType: ViewType) => void;
  onSortTypeChange: (sortType: SortType) => void;
  onSortDirectionChange: (direction: SortDirection) => void;
}

export function ViewSettings({
  viewType,
  sortType,
  sortDirection,
  customReorderingEnabled,
  onViewTypeChange,
  onSortTypeChange,
  onSortDirectionChange
}: ViewSettingsProps) {
  const { t } = useLanguage();

  /*
   * Sort option labels, resolved through `t()` here because the hook result is only in
   * scope inside the component. The four labels resolve to the `title` / `dateCreated` /
   * `dateModified` / `custom` keys.
   */
  const getSortLabel = (type: SortType) => {
    const labels = {
      title: t('title'),
      dateCreated: t('dateCreated'),
      dateModified: t('dateModified'),
      custom: t('custom')
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
          <DropdownMenuRadioItem value="x3" onSelect={(event) => event.preventDefault()}>{t('viewX3')}</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="x2" onSelect={(event) => event.preventDefault()}>{t('viewX2')}</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="list" onSelect={(event) => event.preventDefault()}>{t('viewList')}</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        
        <DropdownMenuSeparator />
        
        <DropdownMenuLabel>{t('sortBy')}</DropdownMenuLabel>
        {(['title', 'dateCreated', 'dateModified'] as const).map((type) => (
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
        {/* Unlike the other options this one closes the menu: choosing Custom is the start of
            dragging items around, not a setting to keep adjusting. Grip = drag mode is on;
            check = Custom is the current order but drag mode is off. */}
        <DropdownMenuItem
          onClick={() => handleSortClick('custom')}
          className="flex items-center gap-2 cursor-pointer"
        >
          <div className="w-4 h-4 flex items-center justify-center">
            {sortType === 'custom' && (customReorderingEnabled
              ? <GripVertical className="h-4 w-4" />
              : <Check className="h-4 w-4" />)}
          </div>
          <span>{t('custom')}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
