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
import { useLanguage } from '@/contexts/LanguageContext';

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
  cancelLabel,
  hideOverlay = false,
  secondaryAction,
}: ConfirmationDialogProps) {
  const { t } = useLanguage();
  const isDelete = action === 'delete';
  const isArchive = action === 'archive';
  const isImport = action === 'import';
  const isModeChange = action === 'mode-change';
  const isRestore = action === 'restore';
  const defaultConfirmLabel = isDelete ? t('delete')
    : isImport ? t('import')
    : isModeChange ? t('confirm')
    : isRestore ? t('restoreAll')
    : t('archive');

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
          {/*
            * Cancel is a plain secondary button, identically in every dialog.
            *
            * It used to take the destructive colours whenever the action was delete or
            * archive, which painted the safe way out in red — the one button on the screen
            * that cannot do any harm was the one that looked dangerous. The destructive
            * styling belongs on the confirm button, which already carries it.
            */}
          <AlertDialogCancel
            onClick={handleCancel}
            className="flex-1 mt-0"
          >
            {cancelLabel ?? t('cancel')}
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
