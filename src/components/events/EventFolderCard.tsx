import { useState, useRef, useEffect } from 'react';
import { FolderOpen, ChevronDown, ChevronRight, Pin, Check, RotateCcw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { EventFolder } from '@/types/eventFolder';
import { Event } from '@/types/event';
import { EventCard } from '@/components/events/EventCard';
import { ItemActionMenu } from '@/components/shared/ItemActionMenu';
import { highlightText } from '@/lib/textHighlight';
import { ColoredCard } from '@/components/shared/ColoredCard';
import { isDefaultColor } from '@/lib/cardColorStyles';
import { useLanguage } from '@/contexts/LanguageContext';
import { countedNoun } from '@/lib/countedMessage';
import { getColoredIconClass } from '@/lib/coloredButtonStyles';
import { cn } from '@/lib/utils';

interface EventFolderCardProps {
  folder: EventFolder;
  events: Event[];
  onEdit?: (folderId: string) => void;
  onArchive?: (folderId: string) => void;
  onUnarchive?: (folderId: string) => void;
  onDelete?: (folderId: string) => void;
  onPin?: (folderId: string) => void;
  onUnpin?: (folderId: string) => void;
  onRestore?: (folderId: string) => void;
  /*
   * Restoring an event that lives in an archived folder. The nested card draws its restore
   * button because the folder marks it as archived, but nothing was wired to it, so it did
   * nothing: only restoring the whole folder or restoring the event from the archived list
   * worked. The habits page passed its equivalent, which is why that one worked.
   */
  onRestoreEvent?: (eventId: string) => void;
  isArchived?: boolean;
  isDeleted?: boolean;
  searchQuery?: string;
  onEditEvent?: (event: Event) => void;
  /** Tapping an event opens its details; Edit is inside them. Falls back to the editor. */
  onViewEvent?: (event: Event) => void;
  onArchiveEvent?: (eventId: string) => void;
  onDeleteEvent?: (eventId: string) => void;
  /*
   * Note there is no onCopy for the folder and no pin/unpin for the events inside it.
   * Folder actions are pin/edit/archive/delete/restore, the same set NoteFolderCard offers;
   * an event's own actions live on the nested EventCard, which does receive onCopyEvent.
   * `onCopy`, `onPinEvent` and `onUnpinEvent` used to be declared and destructured here
   * without ever being used or passed in — dead props left behind by a refactor.
   */
  onCopyEvent?: (eventId: string) => void;
  onShareEvent?: (eventId: string) => void;
  onMoveEventToFolder?: (eventId: string) => void;
  /** Bulk selection props */
  showBulkCheckbox?: boolean;
  isBulkSelected?: boolean;
  onBulkSelect?: (id: string) => void;
}

export function EventFolderCard({ 
  folder, 
  events,
  onEdit, 
  onArchive, 
  onUnarchive, 
  onDelete, 
  onPin, 
  onUnpin, 
  onRestore,
  onRestoreEvent,
  isArchived = false,
  isDeleted = false,
  searchQuery = '',
  onEditEvent,
  onViewEvent,
  onArchiveEvent,
  onDeleteEvent,
  onCopyEvent,
  onShareEvent,
  onMoveEventToFolder,
  showBulkCheckbox = false,
  isBulkSelected = false,
  onBulkSelect,
}: EventFolderCardProps) {
  const { t, language } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const folderEvents = events.filter(event => folder.eventIds.includes(event.id));

  // Track when bulk mode was enabled for animation control
  const bulkModeEntryRef = useRef<number | null>(null);

  useEffect(() => {
    if (showBulkCheckbox) {
      if (bulkModeEntryRef.current === null) {
        bulkModeEntryRef.current = Date.now();
      }
    } else {
      bulkModeEntryRef.current = null;
    }
  }, [showBulkCheckbox]);

  // Only animate checkbox on initial bulk mode entry (within 100ms)
  const shouldAnimateCheckbox = bulkModeEntryRef.current !== null && 
    (Date.now() - bulkModeEntryRef.current) < 100;
  
  // Use standardized color helpers
  const hasColor = !isDefaultColor(folder.color);
  const iconColorClass = getColoredIconClass(hasColor);
  const mutedTextColorClass = hasColor ? 'text-[#000000]/70' : 'text-muted-foreground';
  const textColorClass = hasColor ? 'text-[#000000]' : 'text-foreground';

  // Bulk selection checkbox component - renders inline, replacing the menu
  const BulkCheckbox = () => (
    <div 
      className={shouldAnimateCheckbox ? "animate-in zoom-in-50 duration-300" : ""}
      onClick={(e) => {
        e.stopPropagation();
        onBulkSelect?.(folder.id);
      }}
    >
      <div className={cn(
        "h-6 w-6 rounded-full border-2 flex items-center justify-center transition-colors cursor-pointer",
        isBulkSelected 
          ? "bg-black border-black" 
          : "border-muted-foreground bg-background/80 backdrop-blur-sm"
      )}>
        {isBulkSelected && <Check size={20} className="text-white" />}
      </div>
    </div>
  );

  return (
    <ColoredCard 
      color={folder.color}
      className="transition-all group relative"
    >
      <Collapsible open={isOpen} onOpenChange={showBulkCheckbox ? undefined : setIsOpen}>
        <CardContent className="px-2 py-2">
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <CollapsibleTrigger asChild>
                <div 
                  className="flex items-center gap-2 cursor-pointer"
                  onClick={(e) => {
                    if (showBulkCheckbox) {
                      e.preventDefault();
                      onBulkSelect?.(folder.id);
                    }
                  }}
                >
                  {isOpen ? (
                    <ChevronDown size={20} className={iconColorClass} />
                  ) : (
                    <ChevronRight size={20} className={iconColorClass} />
                  )}
                  <h4 className={`text-sm font-medium truncate flex-1 ${textColorClass}`}>{highlightText(folder.name, searchQuery)}</h4>
                </div>
              </CollapsibleTrigger>
              {folder.description && (
                <p className={`text-xs ${mutedTextColorClass} mb-1 ml-6`}>{highlightText(folder.description, searchQuery)}</p>
              )}
              <p className={`text-xs ${mutedTextColorClass} ml-6`}>
                {countedNoun(t, language, 'event', folderEvents.length)}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <FolderOpen size={20} className={iconColorClass} />
              {folder.pinned && !isArchived && <Pin size={20} className={iconColorClass} />}
              {showBulkCheckbox ? (
                <BulkCheckbox />
              ) : (isArchived || isDeleted) ? (
                <div className="flex gap-1">
                  <Button 
                    aria-label={t('restore')}
                    size="icon" 
                    variant="outline" 
                    className="rounded-full h-8 w-8" 
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onUnarchive) onUnarchive(folder.id);
                      else onRestore?.(folder.id);
                    }}
                  >
                    <RotateCcw size={20} />
                  </Button>
                  <Button 
                    aria-label={t('delete')}
                    size="icon" 
                    variant="destructive" 
                    className="rounded-full h-8 w-8" 
                    onClick={(e) => { e.stopPropagation(); onDelete?.(folder.id); }}
                  >
                    <Trash2 size={20} />
                  </Button>
                </div>
              ) : (
                <ItemActionMenu
                  isPinned={folder.pinned}
                  isArchived={isArchived}
                  isDeleted={isDeleted}
                  onPin={onPin ? () => onPin(folder.id) : undefined}
                  onUnpin={onUnpin ? () => onUnpin(folder.id) : undefined}
                  onEdit={onEdit ? () => onEdit(folder.id) : undefined}
                  onArchive={onArchive ? () => onArchive(folder.id) : undefined}
                  onDelete={onDelete ? () => onDelete(folder.id) : undefined}
                  onRestore={isArchived && onUnarchive ? () => onUnarchive(folder.id) : onRestore ? () => onRestore(folder.id) : undefined}
                />
              )}
            </div>
          </div>
        </CardContent>
        
        <CollapsibleContent>
          <CardContent className="pt-0 pb-2.5 px-1">
            {folderEvents.length === 0 ? (
              <div className={`text-center py-4 ${mutedTextColorClass} text-sm`}>
                {t('noEventsInFolder')}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-1">
                {folderEvents.map(event => (
                  <div key={event.id} className="scale-95">
                    <EventCard 
                      event={event} 
                      onClick={() => (onViewEvent ?? onEditEvent)?.(event)}
                      onEdit={() => onEditEvent?.(event)}
                      onArchive={() => onArchiveEvent?.(event.id)}
                      onUnarchive={onRestoreEvent ? () => onRestoreEvent(event.id) : undefined}
                      onDelete={() => onDeleteEvent?.(event.id)}
                      onCopy={() => onCopyEvent?.(event.id)}
                      onShare={onShareEvent}
                      onMoveToFolder={() => onMoveEventToFolder?.(event.id)}
                      isDeleted={isDeleted}
                      isArchived={isArchived}
                      searchQuery={searchQuery}
                      /* No `forceBackground`: see the note in NoteFolderCard. */
                    />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </ColoredCard>
  );
}
