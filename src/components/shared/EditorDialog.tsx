import React from 'react';
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogFooter,
} from '@/components/ui/responsive-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';

interface EditorDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  // Standard footer props (used when footer is not provided)
  onSave?: () => void;
  onCancel?: () => void;
  saveLabel?: string;
  cancelLabel?: string;
  saveDisabled?: boolean;
  hideCloseButton?: boolean;
  // Force full-screen dialog mode (no drawer on mobile)
  fullScreenOnly?: boolean;
  /**
   * Extra classes for the scrolling middle region — the area between the title and the footer.
   *
   * It exists for `scroll-thin`, which puts a visible scrollbar on a list whose length is not
   * otherwise apparent. Off by default, so every other dialog keeps the clean edge.
   */
  scrollClassName?: string;
}

export function EditorDialog({
  isOpen,
  onClose,
  title,
  children,
  footer,
  onSave,
  onCancel,
  saveLabel = 'Save',
  cancelLabel,
  saveDisabled = false,
  hideCloseButton = true,
  fullScreenOnly = false,
  scrollClassName,
}: EditorDialogProps) {
  const { t } = useLanguage();
  const handleCancel = onCancel || onClose;
  const resolvedScrollClassName = scrollClassName ?? 'scroll-thin';

  const renderFooter = () => {
    if (footer) return footer;
    if (!onSave) return null;
    
    return (
      <div className="flex w-full justify-end gap-2 pt-3">
        {/*
         * Cancel reads the theme tokens rather than hardcoding `border-black` in light and a
         * transparent border in dark, which is what it did before — the border vanished in
         * dark and the button lost its edge. `border-input` and `text-foreground` are the
         * values the outline variant uses everywhere else, so this now matches the other
         * secondary buttons in the app.
         *
         * No extra background classes here. The fill belongs to the `outline` variant, which
         * pairs `bg-background dark:bg-muted` with `dark:hover:bg-hover` — see the note there
         * about why a `dark:` fill without a `dark:hover:` counterpart silently kills the
         * hover in dark mode.
         */}
        <Button 
          variant="outline" 
          onClick={handleCancel} 
          className="h-10 flex-1 text-sm text-foreground md:w-[88px] md:flex-none"
        >
          {/*
            * `cancelLabel` is optional so the default can be translated: a default
            * parameter cannot read `t`, which only exists once the hook has run inside
            * the component. Callers that pass their own label still win, including an
            * empty one.
            */}
          {cancelLabel ?? t('cancel')}
        </Button>
        {/*
          * The filled action, using the same tokens as every other primary control so it
          * inverts with the theme: near-black with a white label in light mode, near-white
          * with a dark label in dark. It was `bg-black hover:bg-black/90`, which on a 7%
          * lightness dialog is black on black — the hover lightened 10% of nothing, so the
          * button appeared to have no hover in dark mode at all.
          */}
        <Button 
          onClick={onSave} 
          disabled={saveDisabled} 
          className="h-10 flex-1 text-sm bg-primary text-primary-foreground hover:bg-primary/90 md:w-[80px] md:flex-none"
        >
          {saveLabel}
        </Button>
      </div>
    );
  };

  // Full-screen mode uses regular Dialog without responsive switching
  if (fullScreenOnly) {
    return (
      <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
        <DialogContent 
          hideCloseButton={hideCloseButton} 
          className="w-full max-w-none h-[calc(100vh-7rem)] max-h-none m-0 rounded-none sm:w-[calc(100vw-12px)] sm:max-w-2xl sm:h-auto sm:max-h-[90vh] sm:m-6 sm:rounded-lg flex flex-col"
        >
          <DialogHeader className="text-center">
            <DialogTitle className="text-center">{title}</DialogTitle>
          </DialogHeader>
          
          {/*
            * `min-h-0` is what lets this region actually scroll: a flex item's default minimum
            * height is its content, so without it the middle grows past the dialog and the
            * footer is pushed off the bottom instead of staying put.
            */}
          <div className={`space-y-6 overflow-x-hidden overflow-y-auto flex-1 min-h-0 px-4 sm:px-6 ${resolvedScrollClassName}`}>
            {children}
          </div>
          
          {(footer || onSave) && (
            <div className="px-4 sm:px-6 pb-4 sm:pb-0">
              {renderFooter()}
            </div>
          )}
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <ResponsiveDialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <ResponsiveDialogContent 
        hideCloseButton={hideCloseButton}
        className="flex w-full flex-col max-h-[100dvh] md:w-[calc(100vw-12px)] md:max-w-[384px] md:max-h-[85vh] md:h-auto md:p-4"
      >
        <ResponsiveDialogHeader className="text-center">
          <ResponsiveDialogTitle className="text-center">{title}</ResponsiveDialogTitle>
        </ResponsiveDialogHeader>
        
        {/*
          * `min-h-0` for the same reason as in the full-screen branch: the middle region has to
          * be allowed to shrink, or a long list pushes the footer out of the dialog instead of
          * scrolling inside it.
          */}
        <div className={`space-y-6 overflow-x-hidden overflow-y-auto flex-1 min-h-0 px-4 sm:px-6 md:px-0 ${resolvedScrollClassName}`}>
          {children}
        </div>
        
        {(footer || onSave) && (
          <ResponsiveDialogFooter className="px-4 sm:px-6 pt-0 pb-3 sm:pb-0 md:px-0 md:pb-0">
            {renderFooter()}
          </ResponsiveDialogFooter>
        )}
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
