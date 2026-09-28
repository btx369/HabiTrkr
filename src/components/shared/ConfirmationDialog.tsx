import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export type ConfirmationAction = 'delete' | 'archive' | 'import' | 'mode-change' | 'restore';

interface SecondaryAction {
  label: string;
  onClick: () => void;
}

interface ConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  onConfirm: () => void;
  onCancel?: () => void;
  action?: ConfirmationAction;
  confirmLabel?: string;
  cancelLabel?: string;
  hideOverlay?: boolean;
  secondaryAction?: SecondaryAction;
}

/**
 * Reusable confirmation dialog for destructive actions like delete and archive.
 * Uses consistent styling with side-by-side buttons on all screen sizes.
 */
export function ConfirmationDialog({
  open,
  onOpenChange,
  title,
  description,
  onConfirm,
  onCancel,
  action = 'delete',
  confirmLabel,
  cancelLabel = 'Cancel',
  hideOverlay = false,
  secondaryAction,
}: ConfirmationDialogProps) {
  const isDelete = action === 'delete';
  const isArchive = action === 'archive';
  const isImport = action === 'import';
  const isModeChange = action === 'mode-change';
  const isRestore = action === 'restore';
  const isDestructiveAction = isDelete || isArchive;
  const defaultConfirmLabel = isDelete ? 'Delete' : isImport ? 'Import' : isModeChange ? 'Confirm' : isRestore ? 'Restore All' : 'Archive';

  const handleCancel = () => {
    onCancel?.();
    onOpenChange(false);
  };

  const handleConfirm = () => {
    onConfirm();
    onOpenChange(false);
  };

  const handleSecondaryAction = () => {
    secondaryAction?.onClick();
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent hideOverlay={hideOverlay}>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-row gap-2">
          <AlertDialogCancel 
            onClick={handleCancel} 
            className={`flex-1 mt-0 ${
              isDestructiveAction 
                ? 'border-destructive text-destructive hover:text-destructive dark:border-border dark:text-foreground dark:hover:text-accent-foreground' 
                : 'border-primary text-primary hover:text-primary'
            }`}
          >
            {cancelLabel}
          </AlertDialogCancel>
          {secondaryAction && (
            <AlertDialogAction
              onClick={handleSecondaryAction}
              className="flex-1 bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border"
            >
              {secondaryAction.label}
            </AlertDialogAction>
          )}
          <AlertDialogAction
            onClick={handleConfirm}
            className={`flex-1 ${
              isImport || isModeChange || isRestore
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
            }`}
          >
            {confirmLabel || defaultConfirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
