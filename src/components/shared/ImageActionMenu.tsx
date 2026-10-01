import { MoreVertical, Copy, Share2, Trash2, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface ImageActionMenuProps {
  onCopy?: () => void;
  onShare?: () => void;
  onDelete?: () => void;
  onDownload?: () => void;
  /** Custom trigger button. Defaults to a ghost icon button with MoreVertical icon */
  trigger?: React.ReactNode;
  /** Additional class names for the trigger button */
  triggerClassName?: string;
  /** Alignment of the dropdown menu */
  align?: 'start' | 'center' | 'end';
}

/**
 * Shared dropdown menu for image actions (copy, share, delete, download).
 * Provides consistent styling and behavior across image-related components.
 */
export function ImageActionMenu({
  onCopy,
  onShare,
  onDelete,
  onDownload,
  trigger,
  triggerClassName = '',
  align = 'end',
}: ImageActionMenuProps) {
  const handleAction = (action: () => void, e: React.MouseEvent) => {
    e.stopPropagation();
    action();
  };

  const hasActions = onCopy || onShare || onDelete || onDownload;

  if (!hasActions) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {trigger || (
          <Button
            variant="ghostStatic"
            size="sm"
            className={`h-8 w-8 p-0 text-white hover:bg-white/20 data-[state=open]:bg-white/20 ${triggerClassName}`}
            onClick={(e) => e.stopPropagation()}
            aria-label="Image options"
          >
            <MoreVertical size={20} />
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="bg-background border border-border">
        {onCopy && (
          <DropdownMenuItem onClick={(e) => handleAction(onCopy, e)}>
            <Copy size={14} className="mr-2" />
            Copy
          </DropdownMenuItem>
        )}
        {onDownload && (
          <DropdownMenuItem onClick={(e) => handleAction(onDownload, e)}>
            <Download size={14} className="mr-2" />
            Download
          </DropdownMenuItem>
        )}
        {onShare && (
          <DropdownMenuItem onClick={(e) => handleAction(onShare, e)}>
            <Share2 size={14} className="mr-2" />
            Share
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
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
