import { useRef, useEffect } from 'react';
import { 
  Check, 
  FolderOpen,
  Pin, 
  Lock,
  RotateCcw,
  Trash2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CardContent, CardTitle } from '@/components/ui/card';
import { Note } from '@/types/note';
import { ViewType } from '@/components/notes/ViewSettings';
import { excerptAroundMatch, highlightText } from '@/lib/textHighlight';
import { parseNoteContent } from '@/lib/noteContentRenderer';
import { extractSearchableText } from '@/lib/noteSearchText';
import { renderMarkdownWithHighlight } from '@/lib/markdownRenderer';
import { ItemActionMenu } from '@/components/shared/ItemActionMenu';
import { ColoredCard } from '@/components/shared/ColoredCard';
import { AudioPlayer, MultiAudioPlayer } from '@/components/shared/AudioPlayer';
import { isDefaultColor } from '@/lib/cardColorStyles';
import { getColoredIconClass } from '@/lib/coloredButtonStyles';
import { useIsFiled } from '@/contexts/FolderMembershipContext';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { countedSentence } from '@/lib/countedMessage';
import { ReminderIcon } from './ReminderChip';

interface NoteCardProps {
  note: Note;
  onClick: () => void;
  onEdit: () => void;
  onToggleListItem?: (noteId: string, itemId: string) => void;
  onArchive?: (noteId: string) => void;
  onUnarchive?: (noteId: string) => void;
  onDelete?: (noteId: string) => void;
  onPin?: (noteId: string) => void;
  onUnpin?: (noteId: string) => void;
  onCopy?: (noteId: string) => void;
  onShare?: (noteId: string) => void;
  onMoveToFolder?: (noteId: string) => void;
  onRestore?: (noteId: string) => void;
  onLock?: (noteId: string) => void;
  onUnlock?: (noteId: string) => void;
  compact?: boolean;
  isDeleted?: boolean;
  isArchived?: boolean;
  searchQuery?: string;
  viewType?: ViewType;
  draggable?: boolean;
  isDragged?: boolean;
  isDraggedOver?: boolean;
  isSelected?: boolean;
  onTouchStart?: (e: React.TouchEvent) => void;
  onDragStart?: (event: React.DragEvent<HTMLDivElement>) => void;
  onDragOver?: (event: React.DragEvent<HTMLDivElement>) => void;
  onDrop?: (event: React.DragEvent<HTMLDivElement>) => void;
  onDragEnd?: () => void;
  /** Bulk selection props */
  showBulkCheckbox?: boolean;
  isBulkSelected?: boolean;
  onBulkSelect?: (id: string) => void;
}

export function NoteCard({ 
  note, 
  onClick, 
  onEdit, 
  onToggleListItem, 
  onArchive, 
  onUnarchive, 
  onDelete, 
  onPin, 
  onUnpin, 
  onCopy, 
  onShare, 
  onMoveToFolder, 
  onRestore, 
  onLock, 
  onUnlock, 
  compact = false, 
  isDeleted = false, 
  isArchived = false, 
  searchQuery = '', 
  viewType = 'list', 
  draggable = false, 
  isDragged = false, 
  isDraggedOver = false,
  isSelected = false,
  onTouchStart,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  showBulkCheckbox = false,
  isBulkSelected = false,
  onBulkSelect,
}: NoteCardProps) {
  const { t, language } = useLanguage();
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

  // Use standardized color helpers for consistent styling
  const hasColor = !isDefaultColor(note.color);
  const textColorClass = hasColor ? 'text-[#000000]' : 'text-foreground';
  const mutedTextColorClass = hasColor ? 'text-[#000000]/70' : 'text-muted-foreground';
  const iconColorClass = getColoredIconClass(hasColor);
  // A note filed in a folder says so on its card, on every list it appears in.
  const isFiled = useIsFiled(note.id);

  const getCardHeight = () => {
    switch (viewType) {
      case 'x3':
        return 'h-[11.5rem]';
      case 'x2':
        return 'h-[14rem]';
      case 'list':
      default:
        return 'h-auto';
    }
  };

  /**
   * Whether the card draws a title at all.
   *
   * This used to also treat the literal string "Title" as absent, because new notes were
   * seeded with that word as their name — a real value in the data that had to be hidden
   * or every note appeared to be called "Title". Notes are created with an empty name now,
   * so the app no longer produces that value and the special case is gone. If a note is
   * named "Title" today, someone typed it, and it should be shown like any other title.
   */
  const shouldShowTitle = () => {
    return Boolean(note.name && note.name.trim() !== '');
  };

  const handleListItemToggle = (itemId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (onToggleListItem) {
      onToggleListItem(note.id, itemId);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Helper function to extract only text content (no image or audio markers).
  // Delegates to the shared extractor so the card and the search engine always agree
  // on what counts as the note's text. Case is preserved here: this feeds the preview.
  const extractTextContent = (content: string): string =>
    extractSearchableText({ description: content }, { lowercase: false });

  const renderNoteContent = () => {
    // For locked notes, show a padlock icon instead of content
    if (note.locked) {
      return (
        <div className="flex items-center justify-center h-full min-h-[2rem] text-foreground">
          <Lock size={24} />
        </div>
      );
    }

    const isX3View = viewType === 'x3';
    const textSize = viewType === 'x3' ? 'text-xs' : 'text-sm';
    const hasTitle = shouldShowTitle();
    const isListView = viewType === 'list';
    const audioSize = 'md';
    
    
    // Calculate line clamps based on view type and title presence
    const getTextLineClamp = () => {
      if (viewType === 'x3') {
        return hasTitle ? 'line-clamp-8' : 'line-clamp-9';
      } else if (viewType === 'x2') {
        return hasTitle ? 'line-clamp-15' : 'line-clamp-16';
      } else {
        return 'line-clamp-8';
      }
    };

    const getAudioLineClamp = () => {
      if (viewType === 'x3') {
        return hasTitle ? 'line-clamp-5' : 'line-clamp-6';
      } else if (viewType === 'x2') {
        return hasTitle ? 'line-clamp-5' : 'line-clamp-6';
      } else {
        return 'line-clamp-4';
      }
    };

    const getImageLineClamp = () => {
      if (viewType === 'x3') {
        return hasTitle ? 'line-clamp-3' : 'line-clamp-4';
      } else {
        return 'line-clamp-3';
      }
    };

    const getListItemsToShow = () => {
      if (viewType === 'x3') {
        return hasTitle ? 7 : 8;
      } else if (viewType === 'x2') {
        return hasTitle ? 15 : 16;
      } else {
        return 4;
      }
    };
    
    switch (note.type) {
      case 'text':
      case 'audio':
      case 'image': {
        /*
         * One layout for every non-list note, whatever type it was created as: a thumbnail of
         * the image first, then the audio players, then the text. A note that gained an image
         * after it was created used to show nothing of it on the card, while a note created as
         * an image note did. The type only decides where the first media file is stored.
         */
        const description = note.description || '';
        const embedded = parseNoteContent(description);
        const images: string[] = [
          ...(note.type === 'image' && note.imageUrl ? [note.imageUrl] : []),
          ...embedded.filter(part => part.type === 'image').map(part => part.content),
        ];
        const audios: { url: string; duration: number }[] = [
          ...(note.type === 'audio' && note.audioUrl ? [{ url: note.audioUrl, duration: note.duration || 0 }] : []),
          ...embedded.filter(part => part.type === 'audio').map(part => ({ url: part.content, duration: part.duration || 0 })),
        ];
        /*
         * When searching, show the excerpt around the match rather than the opening of the
         * note. The clamp below can only show a few lines, so a match further down was
         * highlighted but off-screen.
         */
        const bodyText = excerptAroundMatch(extractTextContent(description), searchQuery);
        const hasMedia = images.length > 0 || audios.length > 0;
        const bodyClamp = !hasMedia ? getTextLineClamp() : images.length > 0 ? getImageLineClamp() : getAudioLineClamp();

        return (
          <div className={`${isX3View ? 'flex-1 flex flex-col gap-2' : 'mt-1 flex-1 flex flex-col gap-2'}`}>
            {images.length > 0 && (
              <div className="relative">
                <img
                  src={images[0]}
                  alt={note.name}
                  className={`w-full object-cover rounded-md ${viewType === 'x3' ? 'h-20' : 'h-28'}`}
                />
                {images.length > 1 && (
                  <span className="absolute bottom-1 right-1 rounded-full bg-black/60 px-1.5 text-[10px] font-medium leading-4 text-white">
                    +{images.length - 1}
                  </span>
                )}
              </div>
            )}
            {audios.length > 0 && (
              isListView ? (
                <MultiAudioPlayer hasColor={hasColor} audios={audios} size={audioSize} />
              ) : (
                <div className="flex flex-col gap-1">
                  {audios.map((audio, idx) => (
                    <AudioPlayer
                      hasColor={hasColor}
                      key={idx}
                      audioUrl={audio.url}
                      initialDuration={audio.duration}
                      compact
                      showSeeker={!isX3View}
                      showSpeedControl
                      size={audioSize}
                    />
                  ))}
                </div>
              )
            )}
            {bodyText && (
              <div className={`${textSize} ${textColorClass} ${!hasMedia ? 'flex-1' : ''} break-words hyphens-auto ${bodyClamp} ${isListView && !hasMedia ? 'max-h-32' : ''} overflow-hidden`}>
                {renderMarkdownWithHighlight(bodyText, searchQuery)}
              </div>
            )}
          </div>
        );
      }
      
      case 'list':
        const itemsToShow = getListItemsToShow();
        const uncheckedItems = note.items.filter(item => !item.completed);
        const completedItems = note.items.filter(item => item.completed);
        
        const hasCompletedItems = completedItems.length > 0;
        const maxUncheckedToShow = hasCompletedItems ? itemsToShow - 1 : itemsToShow;
        const itemsToDisplay = uncheckedItems.slice(0, maxUncheckedToShow);
        
        return (
          <div className={`${isX3View ? '' : 'mt-1'} ${viewType === 'x3' ? 'space-y-0.5' : 'space-y-1'} overflow-hidden`}>
            {itemsToDisplay.map((item) => (
              <div key={item.id} className="flex items-center gap-2 min-w-0">
                <div
                  className={`h-4 w-4 rounded-sm border flex-shrink-0 flex items-center justify-center ${
                    item.completed 
                      ? 'bg-primary border-primary text-primary-foreground' 
                      : 'border-primary bg-background'
                  }`}
                >
                  {item.completed && <Check size={8} />}
                </div>
                <span className={`text-xs ${textColorClass} ${item.completed ? 'line-through opacity-70' : ''} flex-1 min-w-0 truncate`}>
                  {highlightText(item.text, searchQuery)}
                </span>
              </div>
            ))}
            {hasCompletedItems && (
              <div className={`text-xs ${mutedTextColorClass}`}>
                +{countedSentence(t, language, 'checkedItems', completedItems.length)}
              </div>
            )}
          </div>
        );
      
      default:
        return null;
    }
  };

  const handleShare = () => {
    if (navigator.share) {
      let shareText = '';
      
      switch (note.type) {
        case 'text':
          shareText = `${note.name}\n\n${note.description}`;
          break;
        case 'list':
          shareText = `${note.name}\n\n${note.items.map(item => `${item.completed ? '✓' : '○'} ${item.text}`).join('\n')}`;
          break;
        case 'audio':
          shareText = `${note.name}\n\nAudio note (${formatDuration(note.duration)})`;
          break;
        case 'image':
          shareText = `${note.name}\n\nImage note`;
          break;
      }
      
      navigator.share({
        title: note.name,
        text: shareText,
      });
    } else {
      let shareText = '';
      
      switch (note.type) {
        case 'text':
          shareText = `${note.name}\n\n${note.description}`;
          break;
        case 'list':
          shareText = `${note.name}\n\n${note.items.map(item => `${item.completed ? '✓' : '○'} ${item.text}`).join('\n')}`;
          break;
        case 'audio':
          shareText = `${note.name}\n\nAudio note (${formatDuration(note.duration)})`;
          break;
        case 'image':
          shareText = `${note.name}\n\nImage note`;
          break;
      }
      
      navigator.clipboard.writeText(shareText);
    }
  };

  // Bulk selection checkbox component - renders inline, replacing the menu
  const BulkCheckbox = () => (
    <div 
      className={shouldAnimateCheckbox ? "animate-in zoom-in-50 duration-300" : ""}
      onClick={(e) => {
        e.stopPropagation();
        onBulkSelect?.(note.id);
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

  const handleCardClick = () => {
    if (showBulkCheckbox) {
      onBulkSelect?.(note.id);
    } else {
      onClick();
    }
  };

  // 3x view is the narrowest, so it uses its own layout
  if (viewType === 'x3') {
    return (
      <ColoredCard 
        color={note.color}
        className={cn(
          "transition-all select-none relative",
          getCardHeight(),
          isDragged && 'opacity-80 scale-105 z-50',
          isDraggedOver && 'border-primary',
          isSelected && 'border-4 border-primary',
          draggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
        )}
        onClick={handleCardClick}
        data-note-id={note.id}
        onTouchStart={draggable ? onTouchStart : undefined}
        draggable={draggable}
        onDragStart={draggable ? onDragStart : undefined}
        onDragOver={draggable ? onDragOver : undefined}
        onDrop={draggable ? onDrop : undefined}
        onDragEnd={draggable ? onDragEnd : undefined}
      >
        <CardContent className="py-2 px-2 h-full flex flex-col">
          {/* 3x: first row holds only the icons and menu; the title goes on the line below. */}
          <div className="flex items-start gap-2 mb-1">
            <div className="flex items-center gap-2 ml-auto flex-shrink-0">
              <div className="flex items-center gap-1">
                {isFiled && <FolderOpen size={20} className={iconColorClass} />}
                {note.pinned && !isArchived && <Pin size={20} className={iconColorClass} />}
                {note.reminder && <ReminderIcon reminder={note.reminder} className={iconColorClass} />}
              </div>
              {showBulkCheckbox ? (
                <BulkCheckbox />
              ) : (isArchived || isDeleted) ? (
                <div className="flex gap-1">
                  <Button aria-label={t('restore')} 
                    size="icon" 
                    variant="outline" 
                  className="rounded-full h-8 w-8" 
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onUnarchive) onUnarchive(note.id);
                    else onRestore?.(note.id);
                  }}
                >
                  <RotateCcw size={20} />
                </Button>
                <Button aria-label={t('delete')} 
                  size="icon" 
                  variant="destructive" 
                  className="rounded-full h-8 w-8" 
                  onClick={(e) => { e.stopPropagation(); onDelete?.(note.id); }}
                >
                  <Trash2 size={20} />
                </Button>
              </div>
            ) : (
              <ItemActionMenu
                isPinned={note.pinned}
                isArchived={isArchived || note.archived}
                isDeleted={isDeleted}
                isLocked={note.locked}
                onPin={onPin ? () => onPin(note.id) : undefined}
                onUnpin={onUnpin ? () => onUnpin(note.id) : undefined}
                onEdit={onEdit}
                onArchive={onArchive && !note.archived ? () => onArchive(note.id) : undefined}
                onDelete={onDelete ? () => onDelete(note.id) : undefined}
                onRestore={isDeleted && onRestore ? () => onRestore(note.id) : (isArchived || note.archived) && (onUnarchive || onRestore) ? () => (onUnarchive ? onUnarchive(note.id) : onRestore!(note.id)) : undefined}
                onLock={onLock ? () => onLock(note.id) : undefined}
                onUnlock={onUnlock ? () => onUnlock(note.id) : undefined}
                onShare={onShare ? handleShare : undefined}
                onCopy={onCopy ? () => onCopy(note.id) : undefined}
                onMoveToFolder={onMoveToFolder ? () => onMoveToFolder(note.id) : undefined}
                size="sm"
                iconColorClass={iconColorClass}
              />
            )}
            </div>
          </div>

          {shouldShowTitle() && (
            <CardTitle className={`font-bold truncate break-words mb-1 ${textColorClass} text-xs`}>
              {highlightText(note.name, searchQuery)}
            </CardTitle>
          )}

          <div className="flex-1 overflow-hidden">
            {renderNoteContent()}
          </div>
        </CardContent>
      </ColoredCard>
    );
  }

  // 2x and list views
  return (
    <ColoredCard 
      color={note.color}
      className={cn(
        "transition-all select-none relative",
        getCardHeight(),
        isDragged && 'opacity-80 scale-105 z-50',
        isDraggedOver && 'border-primary',
        isSelected && 'border-4 border-primary',
        draggable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
      )}
      onClick={handleCardClick}
      data-note-id={note.id}
      onTouchStart={draggable ? onTouchStart : undefined}
      draggable={draggable}
      onDragStart={draggable ? onDragStart : undefined}
      onDragOver={draggable ? onDragOver : undefined}
      onDrop={draggable ? onDrop : undefined}
      onDragEnd={draggable ? onDragEnd : undefined}
    >
      <CardContent className={`px-2 py-2 h-full ${viewType !== 'list' ? 'flex flex-col' : ''}`}>
        {viewType === 'x2' ? (
          <>
            {/* Title and actions share one row, matching list view. They used to be
                stacked, which pushed the title onto its own line below the menu.
                `ml-auto` is what keeps the menu pinned right: with no title there is no
                `flex-1` sibling to push it, so it would otherwise collapse to the left. */}
            <div className="flex items-start gap-2 mb-2">
              {shouldShowTitle() && (
                <CardTitle className={`flex-1 min-w-0 font-bold truncate break-words text-sm leading-7 ${textColorClass}`}>
                  {highlightText(note.name, searchQuery)}
                </CardTitle>
              )}
              <div className="flex items-center gap-2 ml-auto flex-shrink-0">
                <div className="flex items-center gap-1">
                  {isFiled && <FolderOpen size={20} className={iconColorClass} />}
                  {note.pinned && !isArchived && <Pin size={20} className={iconColorClass} />}
                {note.reminder && <ReminderIcon reminder={note.reminder} className={iconColorClass} />}
                </div>
                {showBulkCheckbox ? (
                  <BulkCheckbox />
                ) : (isArchived || isDeleted) ? (
                  <div className="flex gap-1">
                    <Button aria-label={t('restore')} 
                      size="icon" 
                      variant="outline" 
                      className="rounded-full h-8 w-8" 
                      onClick={(e) => {
                      e.stopPropagation();
                      if (onUnarchive) onUnarchive(note.id);
                      else onRestore?.(note.id);
                    }}
                  >
                    <RotateCcw size={20} />
                  </Button>
                  <Button aria-label={t('delete')} 
                    size="icon" 
                    variant="destructive" 
                    className="rounded-full h-8 w-8" 
                    onClick={(e) => { e.stopPropagation(); onDelete?.(note.id); }}
                  >
                    <Trash2 size={20} />
                  </Button>
                </div>
              ) : (
                <ItemActionMenu
                  isPinned={note.pinned}
                  isArchived={isArchived || note.archived}
                  isDeleted={isDeleted}
                  isLocked={note.locked}
                  onPin={onPin ? () => onPin(note.id) : undefined}
                  onUnpin={onUnpin ? () => onUnpin(note.id) : undefined}
                  onEdit={onEdit}
                  onArchive={onArchive && !note.archived ? () => onArchive(note.id) : undefined}
                  onDelete={onDelete ? () => onDelete(note.id) : undefined}
                  onRestore={isDeleted && onRestore ? () => onRestore(note.id) : (isArchived || note.archived) && (onUnarchive || onRestore) ? () => (onUnarchive ? onUnarchive(note.id) : onRestore!(note.id)) : undefined}
                  onLock={onLock ? () => onLock(note.id) : undefined}
                  onUnlock={onUnlock ? () => onUnlock(note.id) : undefined}
                  onShare={onShare ? handleShare : undefined}
                  onCopy={onCopy ? () => onCopy(note.id) : undefined}
                  onMoveToFolder={onMoveToFolder ? () => onMoveToFolder(note.id) : undefined}
                  size="sm"
                  iconColorClass={iconColorClass}
                />
              )}
              </div>
            </div>
            
            <div className="flex-1 overflow-hidden">
              {renderNoteContent()}
            </div>
          </>
        ) : (
          <div className="flex items-start gap-2 flex-1">
            <div className="flex-1 min-w-0 overflow-hidden">
              {shouldShowTitle() && (
                <CardTitle className={`font-bold truncate break-words text-sm leading-7 ${textColorClass}`}>
                  {highlightText(note.name, searchQuery)}
                </CardTitle>
              )}
              <div className={`${viewType !== 'list' ? 'flex-1 overflow-hidden' : ''}`}>
                {renderNoteContent()}
              </div>
            </div>
            <div className="flex items-center gap-2 ml-auto flex-shrink-0">
              {isFiled && <FolderOpen size={20} className={iconColorClass} />}
              {note.pinned && !isArchived && <Pin size={20} className={iconColorClass} />}
                {note.reminder && <ReminderIcon reminder={note.reminder} className={iconColorClass} />}
              {showBulkCheckbox ? (
                <BulkCheckbox />
              ) : (isArchived || isDeleted) ? (
                <div className="flex gap-1">
                  <Button aria-label={t('restore')} 
                    size="icon" 
                    variant="outline" 
                    className="rounded-full h-8 w-8" 
                    onClick={(e) => {
                    e.stopPropagation();
                    if (onUnarchive) onUnarchive(note.id);
                    else onRestore?.(note.id);
                  }}
                  >
                    <RotateCcw size={20} />
                  </Button>
                  <Button aria-label={t('delete')} 
                    size="icon" 
                    variant="destructive" 
                    className="rounded-full h-8 w-8" 
                    onClick={(e) => { e.stopPropagation(); onDelete?.(note.id); }}
                  >
                    <Trash2 size={20} />
                  </Button>
                </div>
              ) : (
                <ItemActionMenu
                  isPinned={note.pinned}
                  isArchived={isArchived || note.archived}
                  isDeleted={isDeleted}
                  isLocked={note.locked}
                  onPin={onPin ? () => onPin(note.id) : undefined}
                  onUnpin={onUnpin ? () => onUnpin(note.id) : undefined}
                  onEdit={onEdit}
                  onArchive={onArchive && !note.archived ? () => onArchive(note.id) : undefined}
                  onDelete={onDelete ? () => onDelete(note.id) : undefined}
                  onRestore={isDeleted && onRestore ? () => onRestore(note.id) : (isArchived || note.archived) && (onUnarchive || onRestore) ? () => (onUnarchive ? onUnarchive(note.id) : onRestore!(note.id)) : undefined}
                  onLock={onLock ? () => onLock(note.id) : undefined}
                  onUnlock={onUnlock ? () => onUnlock(note.id) : undefined}
                  onShare={onShare ? handleShare : undefined}
                  onCopy={onCopy ? () => onCopy(note.id) : undefined}
                  onMoveToFolder={onMoveToFolder ? () => onMoveToFolder(note.id) : undefined}
                  size="sm"
                  iconColorClass={iconColorClass}
                />
              )}
            </div>
          </div>
        )}
      </CardContent>
    </ColoredCard>
  );
}
