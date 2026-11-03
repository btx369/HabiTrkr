import { MoreVertical, Pin, PinOff, Edit3, Archive, Trash2, ArchiveRestore, Lock, Copy, Share2, FolderInput } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useLanguage } from '@/contexts/LanguageContext';
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
  const { t } = useLanguage();

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
          /*
           * The trigger carries `hover:text-current` on purpose. The ghost variant sets
           * `hover:text-foreground`, which is right on a plain card but wrong on a card
           * with a custom colour: it would flip the dots to an unrelated colour on hover
           * while the card itself keeps its own text colour. Inheriting keeps the icon
           * consistent with its card in both cases.
           *
           * Both paths need an `open` treatment, and neither had one: Radix sets
           * data-state="open" on this trigger, but no rule keyed off it, so opening the menu
           * gave no feedback at all on the button you had just pressed. The plain path tints
           * with the shared veil; the coloured path holds its full opacity, since its
           * resting look already comes from --card-hover-color.
           */
          className={`group ${buttonSize} p-0 hover:text-current ${
            hoverClass
              ? `transition-colors duration-200 data-[state=open]:bg-[var(--card-hover-color)] ${hoverClass}`
              : 'transition-colors hover:bg-hover data-[state=open]:bg-hover'
          }`}
          onClick={(e) => e.stopPropagation()}
          aria-label={t('moreOptions')}
        >
          <MoreVertical size={iconSize} className={iconColorClass} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-max min-w-0 bg-background border border-border">
        {isDeleted ? (
          <>
            {onRestore && (
              <DropdownMenuItem onClick={(e) => handleAction(onRestore, e)}>
                <ArchiveRestore size={14} className="mr-2" />
                {t('restore')}
              </DropdownMenuItem>
            )}
            {onDelete && (
              <DropdownMenuItem 
                onClick={(e) => handleAction(onDelete, e)}
                destructive
              >
                <Trash2 size={14} className="mr-2" />
                {t('delete')}
              </DropdownMenuItem>
            )}
          </>
        ) : isArchived ? (
          <>
            {onRestore && (
              <DropdownMenuItem onClick={(e) => handleAction(onRestore, e)}>
                <ArchiveRestore size={14} className="mr-2" />
                {t('restore')}
              </DropdownMenuItem>
            )}
            {onDelete && (
              <DropdownMenuItem 
                onClick={(e) => handleAction(onDelete, e)}
                destructive
              >
                <Trash2 size={14} className="mr-2" />
                {t('delete')}
              </DropdownMenuItem>
            )}
          </>
        ) : (
          <>
            {isPinned ? (
              onUnpin && (
                <DropdownMenuItem onClick={(e) => handleAction(onUnpin, e)}>
                  <PinOff size={14} className="mr-2" />
                  {t('unpin')}
                </DropdownMenuItem>
              )
            ) : (
              onPin && (
                <DropdownMenuItem onClick={(e) => handleAction(onPin, e)}>
                  <Pin size={14} className="mr-2" />
                  {t('pin')}
                </DropdownMenuItem>
              )
            )}
            {onEdit && (
              <DropdownMenuItem onClick={(e) => handleAction(onEdit, e)}>
                <Edit3 size={14} className="mr-2" />
                {t('edit')}
              </DropdownMenuItem>
            )}
            {onLock && !isLocked && (
              <DropdownMenuItem onClick={(e) => handleAction(onLock, e)}>
                <Lock size={14} className="mr-2" />
                {t('lock')}
              </DropdownMenuItem>
            )}
            {onUnlock && isLocked && (
              <DropdownMenuItem onClick={(e) => handleAction(onUnlock, e)}>
                <Lock size={14} className="mr-2" />
                {t('unlock')}
              </DropdownMenuItem>
            )}
            {onShare && (
              <DropdownMenuItem onClick={(e) => handleAction(onShare, e)}>
                <Share2 size={14} className="mr-2" />
                {t('share')}
              </DropdownMenuItem>
            )}
            {onCopy && (
              <DropdownMenuItem onClick={(e) => handleAction(onCopy, e)}>
                <Copy size={14} className="mr-2" />
                {t('copy')}
              </DropdownMenuItem>
            )}
            {onMoveToFolder && (
              <DropdownMenuItem onClick={(e) => handleAction(onMoveToFolder, e)}>
                <FolderInput size={14} className="mr-2" />
                {t('move')}
              </DropdownMenuItem>
            )}
            {onArchive && (
              <DropdownMenuItem onClick={(e) => handleAction(onArchive, e)}>
                <Archive size={14} className="mr-2" />
                {t('archive')}
              </DropdownMenuItem>
            )}
            {onDelete && (
              <DropdownMenuItem 
                onClick={(e) => handleAction(onDelete, e)}
                destructive
              >
                <Trash2 size={14} className="mr-2" />
                {t('delete')}
              </DropdownMenuItem>
            )}
            {children}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
