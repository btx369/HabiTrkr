import { useState } from 'react';
import { 
  CheckCheck,
  Pin, 
  Lock, 
  Share2,
  Copy, 
  FolderInput, 
  Palette, 
  Archive, 
  Trash2,
  ArchiveRestore,
  Notebook,
  FolderOpen,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ColorPicker } from '@/components/shared/ColorPicker';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

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
  icon: typeof CheckCheck;
  /**
   * A translation key — every label in the tables below is one — or plain English text if a
   * label is ever added without a key. See `resolveLabel` and `LABEL_KEYS` for how the two
   * are told apart.
   */
  label: string;
}

/**
 * The labels in the tables below that are translation keys rather than literal text.
 *
 * Every label is a key today; the set stays explicit so that a literal label added later is
 * rendered as written instead of being passed to `t()`.
 */
const LABEL_KEYS = new Set([
  'all',
  'pin',
  'share',
  'copy',
  'makeACopy',
  'move',
  'color',
  'archive',
  'delete',
  'restore',
  'allNotes',
  'allEvents',
  'allHabits',
  'allFolders',
]);

// Action configurations by context
const NOTES_ACTIONS: BulkAction[] = [
  { type: 'all', icon: CheckCheck, label: 'all' },
  { type: 'pin', icon: Pin, label: 'pin' },
  { type: 'share', icon: Share2, label: 'share' },
  { type: 'copy', icon: Copy, label: 'copy' },
  { type: 'move', icon: FolderInput, label: 'move' },
  { type: 'color', icon: Palette, label: 'color' },
  { type: 'archive', icon: Archive, label: 'archive' },
  { type: 'delete', icon: Trash2, label: 'delete' },
];

const EVENTS_ACTIONS: BulkAction[] = [
  { type: 'all', icon: CheckCheck, label: 'all' },
  { type: 'pin', icon: Pin, label: 'pin' },
  { type: 'share', icon: Share2, label: 'share' },
  { type: 'copy', icon: Copy, label: 'copy' },
  { type: 'move', icon: FolderInput, label: 'move' },
  { type: 'color', icon: Palette, label: 'color' },
  { type: 'archive', icon: Archive, label: 'archive' },
  { type: 'delete', icon: Trash2, label: 'delete' },
];

const FOLDERS_ACTIONS: BulkAction[] = [
  { type: 'all', icon: CheckCheck, label: 'all' },
  { type: 'pin', icon: Pin, label: 'pin' },
  { type: 'color', icon: Palette, label: 'color' },
  { type: 'archive', icon: Archive, label: 'archive' },
  { type: 'delete', icon: Trash2, label: 'delete' },
];

const HABITS_ACTIONS: BulkAction[] = [
  { type: 'all', icon: CheckCheck, label: 'all' },
  { type: 'pin', icon: Pin, label: 'pin' },
  { type: 'share', icon: Share2, label: 'share' },
  { type: 'copy', icon: Copy, label: 'copy' },
  { type: 'move', icon: FolderInput, label: 'move' },
  { type: 'color', icon: Palette, label: 'color' },
  { type: 'archive', icon: Archive, label: 'archive' },
  { type: 'delete', icon: Trash2, label: 'delete' },
];

// Archived sections get separate allItems (allNotes/allEvents/allHabits) and allFolders buttons
const ARCHIVED_NOTES_ACTIONS: BulkAction[] = [
  { type: 'allItems', icon: Notebook, label: 'allNotes' },
  { type: 'allFolders', icon: FolderOpen, label: 'allFolders' },
  { type: 'restore', icon: ArchiveRestore, label: 'restore' },
  { type: 'delete', icon: Trash2, label: 'delete' },
];

const ARCHIVED_EVENTS_ACTIONS: BulkAction[] = [
  { type: 'allItems', icon: CheckCheck, label: 'allEvents' },
  { type: 'allFolders', icon: FolderOpen, label: 'allFolders' },
  { type: 'restore', icon: ArchiveRestore, label: 'restore' },
  { type: 'delete', icon: Trash2, label: 'delete' },
];

const ARCHIVED_HABITS_ACTIONS: BulkAction[] = [
  { type: 'allItems', icon: CheckCheck, label: 'allHabits' },
  { type: 'allFolders', icon: FolderOpen, label: 'allFolders' },
  { type: 'restore', icon: ArchiveRestore, label: 'restore' },
  { type: 'delete', icon: Trash2, label: 'delete' },
];

// Keep legacy ARCHIVED_ACTIONS for standalone folder archives if needed
const ARCHIVED_ACTIONS: BulkAction[] = [
  { type: 'all', icon: CheckCheck, label: 'all' },
  { type: 'restore', icon: ArchiveRestore, label: 'restore' },
  { type: 'delete', icon: Trash2, label: 'delete' },
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
  onClearSelection: () => void;
}

export function BulkActionBar({
  context,
  isVisible,
  isAllSelected,
  isAllItemsSelected = false,
  isAllFoldersSelected = false,
  selectedCount,
  onAction,
  onClearSelection,
}: BulkActionBarProps) {
  const [colorPopoverOpen, setColorPopoverOpen] = useState(false);
  const [selectedColor, setSelectedColor] = useState('#FFFFFF');
  const { t } = useLanguage();

  /**
   * Turns an action's label into text.
   *
   * The action tables are module level — no hook can run there — so a label is either a
   * translation KEY or plain English text, and the two have to be told apart. They are
   * listed explicitly rather than guessed from the shape of the string: every key is
   * lowerCamelCase and every literal starts with a capital, so a heuristic would work
   * today and break silently the first time a key or a phrase does not fit that pattern.
   *
   * Every label in the tables above is a key, so the literal branch is unused today. It is
   * kept so that a label added without a key renders as written instead of putting the key
   * name on the button.
   */
  const resolveLabel = (label: string): string =>
    LABEL_KEYS.has(label) ? t(label) : label;

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

  if (!isVisible) return null;

  return (
    <div 
      className={cn(
        "fixed bottom-[88px] left-1/2 z-40 -translate-x-1/2"
      )}
    >
      <div className="flex w-max max-w-[calc(100vw-16px)] items-center justify-center gap-2 rounded-full border border-nav-border bg-nav p-2">
        {selectedCount > 0 && (
          <Button
            variant="ghostStatic"
            onClick={onClearSelection}
            aria-label={t('clearSelection')}
            className="flex h-11 min-w-[44px] items-center justify-center gap-1 px-1.5 text-nav-foreground transition-all duration-300 ease-out hover:bg-white/10 hover:text-nav-foreground"
          >
            <X size={15} />
            <span className="text-xs font-medium">{selectedCount}</span>
          </Button>
        )}
        {actions.map((action) => {
          const Icon = action.icon;
          const isSelectionAction = action.type === 'all' || action.type === 'allItems' || action.type === 'allFolders';
          
          if (action.type === 'color') {
            return (
              <Popover key={action.type} open={colorPopoverOpen} onOpenChange={setColorPopoverOpen}>
              <PopoverTrigger asChild>
                  <Button
                    variant="ghostStatic"
                    className="flex h-11 min-w-0 flex-1 basis-0 flex-col items-center justify-center gap-0 px-0.5 text-nav-foreground transition-all duration-300 ease-out hover:bg-white/10 hover:text-nav-foreground data-[state=open]:bg-white/10 md:min-w-[48px] md:basis-auto md:px-2"
                    disabled={selectedCount === 0}
                  >
                    <Icon size={20} className="shrink-0 md:h-[22px] md:w-[22px]" />
                    <span className="whitespace-nowrap text-[9px] leading-tight md:text-xs">{resolveLabel(action.label)}</span>
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
                "flex h-11 min-w-0 flex-1 basis-0 flex-col items-center justify-center gap-0 px-2.5 transition-all duration-300 ease-out md:min-w-[48px] md:basis-auto md:px-2",
                isSelectionAction && isActionSelected(action.type) && "bg-nav-active hover:bg-nav-active",
                action.type === 'delete'
                  ? "text-destructive hover:text-destructive hover:bg-white/10"
                  : "text-nav-foreground hover:text-nav-foreground hover:bg-white/10 data-[state=open]:bg-white/10"
              )}
              onClick={() => onAction(action.type)}
              disabled={!isSelectionAction && selectedCount === 0}
              aria-pressed={isSelectionAction ? isActionSelected(action.type) : undefined}
            >
              <Icon size={20} className="shrink-0 md:h-[22px] md:w-[22px]" />
              <span className="whitespace-nowrap text-[9px] leading-tight md:text-xs">{resolveLabel(action.label)}</span>
            </Button>
          );
        })}
      </div>
    </div>
  );
}
