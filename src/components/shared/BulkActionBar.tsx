import { useState } from 'react';
import { 
  CheckSquare, 
  Square, 
  Pin, 
  Lock, 
  Share, 
  Copy, 
  FolderInput, 
  Palette, 
  Archive, 
  Trash2,
  ArchiveRestore,
  Notebook,
  FolderOpen
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ColorPicker } from '@/components/shared/ColorPicker';
import { cn } from '@/lib/utils';

export type BulkActionType = 
  | 'all' 
  | 'allItems'    // Select all notes or events only (for archived)
  | 'allFolders'  // Select all folders only (for archived)
  | 'pin' 
  | 'lock' 
  | 'share' 
  | 'copy' 
  | 'move' 
  | 'color' 
  | 'archive' 
  | 'delete'
  | 'restore';

interface BulkAction {
  type: BulkActionType;
  icon: typeof CheckSquare;
  label: string;
}

// Action configurations by context
const NOTES_ACTIONS: BulkAction[] = [
  { type: 'all', icon: CheckSquare, label: 'All' },
  { type: 'pin', icon: Pin, label: 'Pin' },
  { type: 'share', icon: Share, label: 'Share' },
  { type: 'copy', icon: Copy, label: 'Copy' },
  { type: 'move', icon: FolderInput, label: 'Move' },
  { type: 'color', icon: Palette, label: 'Color' },
  { type: 'archive', icon: Archive, label: 'Archive' },
  { type: 'delete', icon: Trash2, label: 'Delete' },
];

const EVENTS_ACTIONS: BulkAction[] = [
  { type: 'all', icon: CheckSquare, label: 'All' },
  { type: 'share', icon: Share, label: 'Share' },
  { type: 'copy', icon: Copy, label: 'Copy' },
  { type: 'move', icon: FolderInput, label: 'Move' },
  { type: 'color', icon: Palette, label: 'Color' },
  { type: 'archive', icon: Archive, label: 'Archive' },
  { type: 'delete', icon: Trash2, label: 'Delete' },
];

const FOLDERS_ACTIONS: BulkAction[] = [
  { type: 'all', icon: CheckSquare, label: 'All' },
  { type: 'pin', icon: Pin, label: 'Pin' },
  { type: 'color', icon: Palette, label: 'Color' },
  { type: 'archive', icon: Archive, label: 'Archive' },
  { type: 'delete', icon: Trash2, label: 'Delete' },
];

const HABITS_ACTIONS: BulkAction[] = [
  { type: 'all', icon: CheckSquare, label: 'All' },
  { type: 'pin', icon: Pin, label: 'Pin' },
  { type: 'move', icon: FolderInput, label: 'Move' },
  { type: 'color', icon: Palette, label: 'Color' },
  { type: 'archive', icon: Archive, label: 'Archive' },
  { type: 'delete', icon: Trash2, label: 'Delete' },
];

// Archived sections get separate "All Notes/Events" and "All Folders" buttons
const ARCHIVED_NOTES_ACTIONS: BulkAction[] = [
  { type: 'allItems', icon: Notebook, label: 'All Notes' },
  { type: 'allFolders', icon: FolderOpen, label: 'All Folders' },
  { type: 'restore', icon: ArchiveRestore, label: 'Restore' },
  { type: 'delete', icon: Trash2, label: 'Delete' },
];

const ARCHIVED_EVENTS_ACTIONS: BulkAction[] = [
  { type: 'allItems', icon: CheckSquare, label: 'All Events' },
  { type: 'allFolders', icon: FolderOpen, label: 'All Folders' },
  { type: 'restore', icon: ArchiveRestore, label: 'Restore' },
  { type: 'delete', icon: Trash2, label: 'Delete' },
];

const ARCHIVED_HABITS_ACTIONS: BulkAction[] = [
  { type: 'allItems', icon: CheckSquare, label: 'All Habits' },
  { type: 'allFolders', icon: FolderOpen, label: 'All Folders' },
  { type: 'restore', icon: ArchiveRestore, label: 'Restore' },
  { type: 'delete', icon: Trash2, label: 'Delete' },
];

// Keep legacy ARCHIVED_ACTIONS for standalone folder archives if needed
const ARCHIVED_ACTIONS: BulkAction[] = [
  { type: 'all', icon: CheckSquare, label: 'All' },
  { type: 'restore', icon: ArchiveRestore, label: 'Restore' },
  { type: 'delete', icon: Trash2, label: 'Delete' },
];

export type BulkActionContext = 'notes' | 'events' | 'noteFolders' | 'eventFolders' | 'archivedNotes' | 'archivedEvents' | 'archivedFolders' | 'habits' | 'habitFolders' | 'archivedHabits';

interface BulkActionBarProps {
  context: BulkActionContext;
  isVisible: boolean;
  isAllSelected: boolean;
  isAllItemsSelected?: boolean;    // For notes/events only in archived view
  isAllFoldersSelected?: boolean;  // For folders only in archived view
  selectedCount: number;
  onAction: (action: BulkActionType, color?: string) => void;
}

export function BulkActionBar({
  context,
  isVisible,
  isAllSelected,
  isAllItemsSelected = false,
  isAllFoldersSelected = false,
  selectedCount,
  onAction,
}: BulkActionBarProps) {
  const [colorPopoverOpen, setColorPopoverOpen] = useState(false);
  const [selectedColor, setSelectedColor] = useState('#FFFFFF');

  const getActions = (): BulkAction[] => {
    switch (context) {
      case 'notes':
        return NOTES_ACTIONS;
      case 'events':
        return EVENTS_ACTIONS;
      case 'habits':
        return HABITS_ACTIONS;
      case 'noteFolders':
      case 'eventFolders':
      case 'habitFolders':
        return FOLDERS_ACTIONS;
      case 'archivedNotes':
        return ARCHIVED_NOTES_ACTIONS;
      case 'archivedEvents':
        return ARCHIVED_EVENTS_ACTIONS;
      case 'archivedHabits':
        return ARCHIVED_HABITS_ACTIONS;
      case 'archivedFolders':
        return ARCHIVED_ACTIONS;
      default:
        return NOTES_ACTIONS;
    }
  };

  const actions = getActions();

  const handleColorSelect = (color: string) => {
    setSelectedColor(color);
    setColorPopoverOpen(false);
    onAction('color', color);
  };

  // Determine if a selection action is "checked"
  const isActionSelected = (actionType: BulkActionType): boolean => {
    switch (actionType) {
      case 'all':
        return isAllSelected;
      case 'allItems':
        return isAllItemsSelected;
      case 'allFolders':
        return isAllFoldersSelected;
      default:
        return false;
    }
  };

  return (
    <div 
      className={cn(
        "fixed bottom-[72px] left-0 right-0 z-40 bg-nav border-t border-nav-border",
        "transform transition-transform duration-300",
        isVisible ? "translate-y-0" : "translate-y-[calc(100%+72px)] pointer-events-none"
      )}
      style={{
        transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      }}
    >
      <div className="flex items-center justify-center w-full px-2 md:px-4 py-3">
        {actions.map((action) => {
          const Icon = action.icon;
          const isSelectionAction = action.type === 'all' || action.type === 'allItems' || action.type === 'allFolders';
          
          if (action.type === 'color') {
            return (
              <Popover key={action.type} open={colorPopoverOpen} onOpenChange={setColorPopoverOpen}>
              <PopoverTrigger asChild>
                  <Button
                    variant="ghostStatic"
                    className="flex flex-1 flex-col items-center justify-center h-11 md:h-14 min-w-0 px-1 md:px-2 gap-0 text-primary-foreground hover:text-primary-foreground hover:bg-primary-foreground/20 data-[state=open]:bg-primary-foreground/20"
                    disabled={selectedCount === 0}
                  >
                    <Icon size={20} className="md:w-[22px] md:h-[22px] shrink-0" />
                    <span className="text-[10px] md:text-xs leading-tight truncate">{action.label}</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-3" align="center" side="top">
                  <ColorPicker
                    selectedColor={selectedColor}
                    onColorChange={handleColorSelect}
                    label=""
                  />
                </PopoverContent>
              </Popover>
            );
          }

          return (
            <Button
              key={action.type}
              variant="ghost"
              className={cn(
                "flex flex-1 flex-col items-center justify-center h-11 md:h-14 min-w-0 px-1 md:px-2 gap-0",
                action.type === 'delete'
                  ? "text-destructive hover:text-destructive hover:bg-destructive/20" 
                  : "text-primary-foreground hover:text-primary-foreground hover:bg-primary-foreground/20 data-[state=open]:bg-primary-foreground/20"
              )}
              onClick={() => onAction(action.type)}
              disabled={!isSelectionAction && selectedCount === 0}
            >
              {isSelectionAction ? (
                isActionSelected(action.type) ? <CheckSquare size={20} className="md:w-[22px] md:h-[22px] shrink-0" /> : <Square size={20} className="md:w-[22px] md:h-[22px] shrink-0" />
              ) : (
                <Icon size={20} className="md:w-[22px] md:h-[22px] shrink-0" />
              )}
              <span className="text-[10px] md:text-xs leading-tight truncate">{action.label}</span>
            </Button>
          );
        })}
      </div>
    </div>
  );
}
