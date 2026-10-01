import { useRef, useEffect } from 'react';
import { 
  Check, 
  Pin, 
  Lock,
  RotateCcw,
  Trash2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CardContent, CardTitle } from '@/components/ui/card';
import { Note } from '@/types/note';
import { ViewType } from '@/components/notes/ViewSettings';
import { highlightText } from '@/lib/textHighlight';
import { parseNoteContent } from '@/lib/noteContentRenderer';
import { renderMarkdownWithHighlight } from '@/lib/markdownRenderer';
import { ItemActionMenu } from '@/components/shared/ItemActionMenu';
import { ColoredCard } from '@/components/shared/ColoredCard';
import { AudioPlayer, MultiAudioPlayer } from '@/components/shared/AudioPlayer';
import { isDefaultColor } from '@/lib/cardColorStyles';
import { getColoredIconClass } from '@/lib/coloredButtonStyles';
import { cn } from '@/lib/utils';

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
  /** Force background even for default colors (useful when rendered inside colored folders) */
  forceBackground?: boolean;
  onMouseDown?: (e: React.MouseEvent) => void;
  onTouchStart?: (e: React.TouchEvent) => void;
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
  forceBackground = false,
  onMouseDown,
  onTouchStart,
  showBulkCheckbox = false,
  isBulkSelected = false,
  onBulkSelect,
}: NoteCardProps) {
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

  const shouldShowTitle = () => {
    return note.name && note.name.trim() !== '' && note.name !== 'Title';
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

  // Helper function to extract only text content (no image or audio markers)
  const extractTextContent = (content: string): string => {
    const parts = parseNoteContent(content);
    return parts
      .filter(part => part.type === 'text')
      .map(part => part.content)
      .join('')
      .trim();
  };

  // Helper function to extract embedded audio from content
  const extractEmbeddedAudio = (content: string): { url: string; duration: number }[] => {
    const parts = parseNoteContent(content);
    return parts
      .filter(part => part.type === 'audio')
      .map(part => ({ url: part.content, duration: part.duration || 0 }));
  };

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
        const textContent = extractTextContent(note.description);
        const embeddedAudios = extractEmbeddedAudio(note.description);
        
        return (
          <div className={`${isX3View ? 'flex-1 flex flex-col gap-2' : 'mt-1 flex-1 flex flex-col gap-2'}`}>
            {embeddedAudios.length > 0 && (
              <>
                {isListView ? (
                  <MultiAudioPlayer audios={embeddedAudios} size={audioSize} />
                ) : (
                  <div className="flex flex-col gap-1">
                    {embeddedAudios.map((audio, idx) => (
                      <AudioPlayer
                        key={idx}
                        audioUrl={audio.url}
                        initialDuration={audio.duration}
                        compact
                        showSeeker
                        showSpeedControl
                        size={audioSize}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
            <div className={`${textSize} ${textColorClass} flex-1 break-words hyphens-auto ${getTextLineClamp()} ${isListView ? 'max-h-32 overflow-hidden' : ''} overflow-hidden`}>
              {renderMarkdownWithHighlight(textContent, searchQuery)}
            </div>
          </div>
        );
      
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
                +{completedItems.length} ticked items
              </div>
            )}
          </div>
        );
      
      case 'audio':
        const audioTextContent = extractTextContent(note.description || '');
        return (
          <div className={`${isX3View ? '' : 'mt-2'} space-y-2`}>
            <AudioPlayer
              audioUrl={note.audioUrl!}
              initialDuration={note.duration}
              compact={!isListView}
              showSeeker
              showSpeedControl
              size={audioSize}
            />
            {audioTextContent && (
              <div className={`${textSize} ${textColorClass} break-words hyphens-auto ${getAudioLineClamp()}`}>
                {renderMarkdownWithHighlight(audioTextContent, searchQuery)}
              </div>
            )}
          </div>
        );
      
      case 'image':
        const imageTextContent = extractTextContent(note.description || '');
        const imageEmbeddedAudios = extractEmbeddedAudio(note.description || '');
        
        return (
          <div className={`${isX3View ? '' : 'mt-2'} space-y-2`}>
            <img
              src={note.imageUrl}
              alt={note.name}
              className={`w-full object-cover rounded-md ${
                viewType === 'x3' ? 'h-20' : 
                viewType === 'x2' ? 'h-28' : 'h-28'
              }`}
            />
            {imageEmbeddedAudios.length > 0 && (
              <>
                {isListView ? (
                  <MultiAudioPlayer audios={imageEmbeddedAudios} size={audioSize} />
                ) : (
                  <div className="flex flex-col gap-1">
                    {imageEmbeddedAudios.map((audio, idx) => (
                      <AudioPlayer
                        key={idx}
                        audioUrl={audio.url}
                        initialDuration={audio.duration}
                        compact
                        showSeeker
                        showSpeedControl
                        size={audioSize}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
            {imageTextContent && (
              <div className={`${textSize} ${textColorClass} break-words hyphens-auto ${getImageLineClamp()}`}>
                {renderMarkdownWithHighlight(imageTextContent, searchQuery)}
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
        {isBulkSelected && <Check size={14} className="text-white" />}
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
        forceBackground={forceBackground}
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
        onMouseDown={draggable ? onMouseDown : undefined}
        onTouchStart={draggable ? onTouchStart : undefined}
      >
        <CardContent className="py-2 px-2 h-full flex flex-col">
          {/* Title and actions share one row, matching list view. They used to be
              stacked, which put the title on its own line below the menu in 3x.
              `ml-auto` is what keeps the menu pinned right: with no title there is no
              `flex-1` sibling to push it, so it would otherwise collapse to the left. */}
          <div className="flex items-start gap-2 mb-1">
            {shouldShowTitle() && (
              <CardTitle className={`flex-1 min-w-0 font-bold truncate break-words ${textColorClass} text-xs`}>
                {highlightText(note.name, searchQuery)}
              </CardTitle>
            )}
            <div className="flex items-center gap-2 ml-auto flex-shrink-0">
              <div className="flex items-center gap-1">
                {note.pinned && <Pin size={14} className={iconColorClass} />}
                {note.locked && <Lock size={14} className={iconColorClass} />}
              </div>
              {showBulkCheckbox ? (
                <BulkCheckbox />
              ) : (isArchived || isDeleted) ? (
                <div className="flex gap-1">
                  <Button 
                    size="icon" 
                    variant="outline" 
                  className="rounded-full h-8 w-8" 
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onUnarchive) onUnarchive(note.id);
                    else onRestore?.(note.id);
                  }}
                >
                  <RotateCcw size={14} />
                </Button>
                <Button 
                  size="icon" 
                  variant="destructive" 
                  className="rounded-full h-8 w-8" 
                  onClick={(e) => { e.stopPropagation(); onDelete?.(note.id); }}
                >
                  <Trash2 size={14} />
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
        </CardContent>
      </ColoredCard>
    );
  }

  // 2x and list views
  return (
    <ColoredCard 
      color={note.color}
      forceBackground={forceBackground}
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
      onMouseDown={draggable ? onMouseDown : undefined}
      onTouchStart={draggable ? onTouchStart : undefined}
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
                <CardTitle className={`flex-1 min-w-0 font-bold truncate break-words text-sm ${textColorClass}`}>
                  {highlightText(note.name, searchQuery)}
                </CardTitle>
              )}
              <div className="flex items-center gap-2 ml-auto flex-shrink-0">
                <div className="flex items-center gap-1">
                  {note.pinned && <Pin size={14} className={iconColorClass} />}
                  {note.locked && <Lock size={14} className={iconColorClass} />}
                </div>
                {showBulkCheckbox ? (
                  <BulkCheckbox />
                ) : (isArchived || isDeleted) ? (
                  <div className="flex gap-1">
                    <Button 
                      size="icon" 
                      variant="outline" 
                      className="rounded-full h-8 w-8" 
                      onClick={(e) => {
                      e.stopPropagation();
                      if (onUnarchive) onUnarchive(note.id);
                      else onRestore?.(note.id);
                    }}
                  >
                    <RotateCcw size={14} />
                  </Button>
                  <Button 
                    size="icon" 
                    variant="destructive" 
                    className="rounded-full h-8 w-8" 
                    onClick={(e) => { e.stopPropagation(); onDelete?.(note.id); }}
                  >
                    <Trash2 size={14} />
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
                <CardTitle className={`font-bold mb-1 truncate break-words text-sm ${textColorClass}`}>
                  {highlightText(note.name, searchQuery)}
                </CardTitle>
              )}
              <div className={`${viewType !== 'list' ? 'flex-1 overflow-hidden' : ''}`}>
                {renderNoteContent()}
              </div>
            </div>
            <div className="flex items-center gap-2 ml-auto flex-shrink-0">
              {note.pinned && <Pin size={14} className={iconColorClass} />}
              {note.locked && <Lock size={14} className={iconColorClass} />}
              {showBulkCheckbox ? (
                <BulkCheckbox />
              ) : (isArchived || isDeleted) ? (
                <div className="flex gap-1">
                  <Button 
                    size="icon" 
                    variant="outline" 
                    className="rounded-full h-8 w-8" 
                    onClick={(e) => {
                    e.stopPropagation();
                    if (onUnarchive) onUnarchive(note.id);
                    else onRestore?.(note.id);
                  }}
                  >
                    <RotateCcw size={14} />
                  </Button>
                  <Button 
                    size="icon" 
                    variant="destructive" 
                    className="rounded-full h-8 w-8" 
                    onClick={(e) => { e.stopPropagation(); onDelete?.(note.id); }}
                  >
                    <Trash2 size={14} />
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
