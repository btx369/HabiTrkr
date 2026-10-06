import { useState, useRef, useEffect } from 'react';
import { FolderOpen, ChevronDown, ChevronRight, Pin, Check, RotateCcw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useLanguage } from '@/contexts/LanguageContext';
import { NoteFolder } from '@/types/noteFolder';
import { Note } from '@/types/note';
import { NoteCard } from '@/components/notes/NoteCard';
import { ItemActionMenu } from '@/components/shared/ItemActionMenu';
import { highlightText } from '@/lib/textHighlight';
import { ColoredCard } from '@/components/shared/ColoredCard';
import { isDefaultColor } from '@/lib/cardColorStyles';
import { getColoredIconClass } from '@/lib/coloredButtonStyles';
import { cn } from '@/lib/utils';

interface NoteFolderCardProps {
  folder: NoteFolder;
  notes: Note[];
  onToggleListItem: (noteId: string, itemId: string) => void;
  onArchiveNote: (noteId: string) => void;
  onDeleteNote: (noteId: string) => void;
  onPinNote: (noteId: string) => void;
  onUnpinNote: (noteId: string) => void;
  onCopyNote: (noteId: string) => void;
  onMoveToFolder: (noteId: string) => void;
  onOpenNote: (note: Note) => void;
  onLockNote: (noteId: string) => void;
  onUnlockNote: (noteId: string) => void;
  onPinFolder: (folderId: string) => void;
  onUnpinFolder: (folderId: string) => void;
  onEditFolder: (folderId: string) => void;
  /*
   * Optional, and the body already treats it that way (`onArchiveFolder ? ... : undefined`)
   * because Notes passes undefined while the Archived tab is open. The non-optional type
   * was simply wrong, which is why this only surfaced once strict mode was switched on.
   */
  onArchiveFolder?: (folderId: string) => void;
  onDeleteFolder: (folderId: string) => void;
  onRestoreFolder?: (folderId: string) => void;
  /*
   * Restoring a note that lives in an archived folder.
   *
   * The nested card has always drawn its restore button — the folder marks it as archived, and
   * an archived card shows restore and delete instead of the menu — but nothing was wired to
   * it here, so the button did nothing at all. The only ways out were restoring the whole
   * folder or restoring the note from the archived list above. The habits page passed its
   * equivalent handler, which is why only that one worked.
   */
  onRestoreNote?: (noteId: string) => void;
  isDeleted?: boolean;
  searchQuery?: string;
  /** Bulk selection props */
  showBulkCheckbox?: boolean;
  isBulkSelected?: boolean;
  onBulkSelect?: (id: string) => void;
}

export function NoteFolderCard({
  folder,
  notes,
  onToggleListItem,
  onArchiveNote,
  onDeleteNote,
  onPinNote,
  onUnpinNote,
  onCopyNote,
  onMoveToFolder,
  onOpenNote,
  onLockNote,
  onUnlockNote,
  onPinFolder,
  onUnpinFolder,
  onEditFolder,
  onArchiveFolder,
  onDeleteFolder,
  onRestoreFolder,
  onRestoreNote,
  isDeleted = false,
  searchQuery = '',
  showBulkCheckbox = false,
  isBulkSelected = false,
  onBulkSelect,
}: NoteFolderCardProps) {
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const folderNotes = notes.filter(note => folder.noteIds.includes(note.id));

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

  // Treat folders rendered with a restore handler as archived (even if older localStorage items lack `archived: true`)
  const isFolderArchived = Boolean(onRestoreFolder) || Boolean(folder.archived);
  
  // Use standardized color helpers for consistent styling
  const hasColor = !isDefaultColor(folder.color);
  const iconColorClass = getColoredIconClass(hasColor);
  const mutedTextColorClass = hasColor ? 'text-[#000000]/70' : 'text-muted-foreground';

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
        {isBulkSelected && <Check size={14} className="text-white" />}
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
                    <ChevronDown size={14} className={iconColorClass} />
                  ) : (
                    <ChevronRight size={14} className={iconColorClass} />
                  )}
                  <h4 className="text-sm font-medium truncate flex-1">{highlightText(folder.name, searchQuery)}</h4>
                </div>
              </CollapsibleTrigger>
              {folder.description && (
                <p className={`text-xs ${mutedTextColorClass} mb-1 ml-6`}>{highlightText(folder.description, searchQuery)}</p>
              )}
              <p className={`text-xs ${mutedTextColorClass} ml-6`}>
                {folderNotes.length} {t('notes')}
              </p>
            </div>
            <div className="flex items-center gap-1">
              {folder.pinned && <Pin size={14} className={iconColorClass} />}
              <FolderOpen size={14} className={iconColorClass} />
              {showBulkCheckbox ? (
                <BulkCheckbox />
              ) : (isFolderArchived || isDeleted) ? (
                <div className="flex gap-1">
                  <Button 
                    size="icon" 
                    variant="outline" 
                    className="rounded-full h-8 w-8" 
                    onClick={(e) => { e.stopPropagation(); onRestoreFolder?.(folder.id); }}
                  >
                    <RotateCcw size={14} />
                  </Button>
                  <Button 
                    size="icon" 
                    variant="destructive" 
                    className="rounded-full h-8 w-8" 
                    onClick={(e) => { e.stopPropagation(); onDeleteFolder(folder.id); }}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              ) : (
                <ItemActionMenu
                  isPinned={folder.pinned}
                  isArchived={isFolderArchived}
                  isDeleted={isDeleted}
                  onPin={!isFolderArchived ? () => onPinFolder(folder.id) : undefined}
                  onUnpin={!isFolderArchived ? () => onUnpinFolder(folder.id) : undefined}
                  onEdit={!isFolderArchived ? () => onEditFolder(folder.id) : undefined}
                  onArchive={!isFolderArchived && onArchiveFolder ? () => onArchiveFolder(folder.id) : undefined}
                  onDelete={() => onDeleteFolder(folder.id)}
                  onRestore={isFolderArchived && onRestoreFolder ? () => onRestoreFolder(folder.id) : undefined}
                />
              )}
            </div>
          </div>
        </CardContent>
        
        <CollapsibleContent>
          <div className="pt-0 pb-2 px-1">
            {folderNotes.length === 0 ? (
              <div className={`text-center py-4 ${mutedTextColorClass} text-sm`}>
                {t('noNotesInFolderYet')}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-1">
                {folderNotes.map(note => (
                  <div key={note.id} className="scale-95">
                    <NoteCard 
                      note={note} 
                      onClick={() => onOpenNote(note)} 
                      onEdit={() => onOpenNote(note)}
                      onToggleListItem={onToggleListItem}
                      onArchive={onArchiveNote}
                      onUnarchive={onRestoreNote}
                      onDelete={onDeleteNote}
                      onPin={onPinNote}
                      onUnpin={onUnpinNote}
                      onCopy={onCopyNote}
                      onShare={() => {}}
                      onMoveToFolder={onMoveToFolder}
                      onLock={onLockNote}
                      onUnlock={onUnlockNote}
                      compact={true}
                      isDeleted={isDeleted}
                      isArchived={folder.archived && !isDeleted}
                      searchQuery={searchQuery}
                      /*
                       * No `forceBackground`. It was passed the folder's colour, and its only
                       * effect is on a note that has NO colour of its own: it painted that
                       * note with the translucent --glass-bg, a warm grey that mixed with the
                       * folder's colour and made the note look dingy as well as see-through.
                       *
                       * The folder's colour is still behind the notes, so a plain note here
                       * still picks some of it up — measured rgb(244, 249, 255) inside a blue
                       * folder against rgb(254, 254, 254) for the same note on the main list.
                       * Reported, measured and deliberately left alone; see
                       * scripts/preview-folder-bleed-options.mjs for the alternatives and
                       * scripts/verify-nested-note-card.mjs for the numbers.
                       */
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </ColoredCard>
  );
}
