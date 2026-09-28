import { MoreVertical, Pin, PinOff, Edit3, Archive, Trash2, ArchiveRestore, Lock, Copy, Share2, FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ReactNode } from 'react';

export type ItemActionType = 'pin' | 'unpin' | 'edit' | 'archive' | 'delete' | 'restore' | 'lock' | 'unlock' | 'copy' | 'share' | 'moveToFolder';

interface ItemActionMenuProps {
  isPinned?: boolean;
  isArchived?: boolean;
  isDeleted?: boolean;
  isLocked?: boolean;
  onPin?: () => void;
  onUnpin?: () => void;
  onEdit?: () => void;
  onArchive?: () => void;
  onDelete?: () => void;
  onRestore?: () => void;
  onLock?: () => void;
  onUnlock?: () => void;
  onCopy?: () => void;
  onShare?: () => void;
  onMoveToFolder?: () => void;
  size?: 'sm' | 'md';
  /** Custom icon color class for the 3-dot menu icon */
  iconColorClass?: string;
  /** Custom hover class for the 3-dot menu button */
  hoverClass?: string;
  children?: ReactNode;
}

export function ItemActionMenu({
  isPinned = false,
  isArchived = false,
  isDeleted = false,
  isLocked = false,
  onPin,
  onUnpin,
  onEdit,
  onArchive,
  onDelete,
  onRestore,
  onLock,
  onUnlock,
  onCopy,
  onShare,
  onMoveToFolder,
  size = 'sm',
  iconColorClass = 'text-foreground',
  hoverClass,
  children,
}: ItemActionMenuProps) {
  const handleAction = (action: () => void, e: React.MouseEvent) => {
    e.stopPropagation();
    action();
  };

  const iconSize = size === 'sm' ? 12 : 14;
  const buttonSize = size === 'sm' ? 'h-6 w-6' : 'h-7 w-7';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={`group ${buttonSize} p-0 ${hoverClass ? `transition-transform duration-200 hover:scale-105 ${hoverClass}` : 'transition-opacity hover:bg-[var(--card-hover-color)]'}`}
          onClick={(e) => e.stopPropagation()}
        >
          <MoreVertical size={iconSize} className={iconColorClass} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-background border border-border">
        {isDeleted ? (
          <>
            {onRestore && (
              <DropdownMenuItem onClick={(e) => handleAction(onRestore, e)}>
                <ArchiveRestore size={14} className="mr-2" />
                Restore
              </DropdownMenuItem>
            )}
            {onDelete && (
              <DropdownMenuItem 
                onClick={(e) => handleAction(onDelete, e)}
                destructive
              >
                <Trash2 size={14} className="mr-2" />
                Delete
              </DropdownMenuItem>
            )}
          </>
        ) : isArchived ? (
          <>
            {onRestore && (
              <DropdownMenuItem onClick={(e) => handleAction(onRestore, e)}>
                <ArchiveRestore size={14} className="mr-2" />
                Restore
              </DropdownMenuItem>
            )}
            {onDelete && (
              <DropdownMenuItem 
                onClick={(e) => handleAction(onDelete, e)}
                destructive
              >
                <Trash2 size={14} className="mr-2" />
                Delete
              </DropdownMenuItem>
            )}
          </>
        ) : (
          <>
            {isPinned ? (
              onUnpin && (
                <DropdownMenuItem onClick={(e) => handleAction(onUnpin, e)}>
                  <PinOff size={14} className="mr-2" />
                  Unpin
                </DropdownMenuItem>
              )
            ) : (
              onPin && (
                <DropdownMenuItem onClick={(e) => handleAction(onPin, e)}>
                  <Pin size={14} className="mr-2" />
                  Pin
                </DropdownMenuItem>
              )
            )}
            {onEdit && (
              <DropdownMenuItem onClick={(e) => handleAction(onEdit, e)}>
                <Edit3 size={14} className="mr-2" />
                Edit
              </DropdownMenuItem>
            )}
            {onLock && !isLocked && (
              <DropdownMenuItem onClick={(e) => handleAction(onLock, e)}>
                <Lock size={14} className="mr-2" />
                Lock
              </DropdownMenuItem>
            )}
            {onUnlock && isLocked && (
              <DropdownMenuItem onClick={(e) => handleAction(onUnlock, e)}>
                <Lock size={14} className="mr-2" />
                Unlock
              </DropdownMenuItem>
            )}
            {onShare && (
              <DropdownMenuItem onClick={(e) => handleAction(onShare, e)}>
                <Share2 size={14} className="mr-2" />
                Share
              </DropdownMenuItem>
            )}
            {onCopy && (
              <DropdownMenuItem onClick={(e) => handleAction(onCopy, e)}>
                <Copy size={14} className="mr-2" />
                Make a Copy
              </DropdownMenuItem>
            )}
            {onMoveToFolder && (
              <DropdownMenuItem onClick={(e) => handleAction(onMoveToFolder, e)}>
                <FolderOpen size={14} className="mr-2" />
                Move to Folder
              </DropdownMenuItem>
            )}
            {onArchive && (
              <DropdownMenuItem onClick={(e) => handleAction(onArchive, e)}>
                <Archive size={14} className="mr-2" />
                Archive
              </DropdownMenuItem>
            )}
            {onDelete && (
              <DropdownMenuItem 
                onClick={(e) => handleAction(onDelete, e)}
                destructive
              >
                <Trash2 size={14} className="mr-2" />
                Delete
              </DropdownMenuItem>
            )}
            {children}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
