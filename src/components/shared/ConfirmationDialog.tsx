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
  const compactDestructive = isDelete || isArchive;
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
      <AlertDialogContent
        hideOverlay={hideOverlay}
        className={compactDestructive
          ? 'w-[calc(100vw-2rem)] max-w-[320px] gap-0 rounded-3xl bg-popover p-0 shadow-xl'
          : undefined}
      >
        <AlertDialogHeader className={compactDestructive ? 'px-6 pt-6 pb-5' : undefined}>
          <AlertDialogTitle className="break-words">{title}</AlertDialogTitle>
          <AlertDialogDescription className={compactDestructive ? 'whitespace-pre-line break-words' : 'break-words'}>
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {/*
          * Three buttons do not fit side by side in a 320px dialog (the third one spilled
          * out of it), so with a secondary action they stack full-width: the action on top,
          * the safe way out at the bottom.
          */}
        <AlertDialogFooter className={`${secondaryAction ? 'flex-col-reverse gap-2' : 'flex-row gap-2'} ${
          compactDestructive ? 'border-t border-border px-4 py-3' : ''
        }`}>
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
            className={`mt-0 h-10 min-w-0 rounded-full ${secondaryAction ? 'w-full' : 'flex-1'}`}
          >
            {cancelLabel ?? t('cancel')}
          </AlertDialogCancel>
          {secondaryAction && (
            <AlertDialogAction
              onClick={handleSecondaryAction}
              className="mt-0 h-10 w-full min-w-0 rounded-full border border-border bg-secondary text-secondary-foreground hover:bg-secondary/80"
            >
              {secondaryAction.label}
            </AlertDialogAction>
          )}
          <AlertDialogAction
            onClick={handleConfirm}
            // Long labels in some languages wrap inside the pill instead of spilling out of it.
            className={`h-auto min-h-10 min-w-0 ${secondaryAction ? 'w-full' : 'flex-1'} whitespace-normal rounded-full py-2 leading-tight ${
              isImport || isModeChange || isRestore
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'bg-destructive text-destructive-foreground transition-none hover:bg-destructive active:bg-destructive focus:bg-destructive focus-visible:bg-destructive hover:shadow-none active:shadow-none'
            }`}
          >
            {confirmLabel || defaultConfirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
