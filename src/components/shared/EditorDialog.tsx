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
  cancelLabel = 'Cancel',
  saveDisabled = false,
  hideCloseButton = true,
  fullScreenOnly = false,
}: EditorDialogProps) {
  const handleCancel = onCancel || onClose;

  const renderFooter = () => {
    if (footer) return footer;
    if (!onSave) return null;
    
    return (
      <div className="flex gap-2 pt-4 w-full">
        <Button 
          variant="outline" 
          onClick={handleCancel} 
          className="flex-1 h-12 text-base border-black dark:border-transparent text-black dark:text-foreground hover:text-black dark:hover:text-foreground"
        >
          {cancelLabel}
        </Button>
        <Button 
          onClick={onSave} 
          disabled={saveDisabled} 
          className="flex-1 h-12 text-base bg-black text-white hover:bg-black/90"
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
          className="w-full max-w-none h-[calc(100vh-7rem)] max-h-none m-0 rounded-none sm:max-w-lg sm:h-auto sm:max-h-[90vh] sm:m-6 sm:rounded-lg flex flex-col"
        >
          <DialogHeader className="text-center">
            <DialogTitle className="text-center">{title}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6 overflow-y-auto flex-1 px-4 sm:px-6">
            {children}
          </div>
          
          {(footer || onSave) && (
            <div className="px-4 sm:px-6 pb-6 sm:pb-0">
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
        className="sm:max-w-lg flex flex-col max-h-[100dvh] sm:max-h-[85vh] sm:h-auto"
      >
        <ResponsiveDialogHeader className="text-center">
          <ResponsiveDialogTitle className="text-center">{title}</ResponsiveDialogTitle>
        </ResponsiveDialogHeader>
        
        <div className="space-y-6 overflow-y-auto px-4 sm:px-6">
          {children}
        </div>
        
        {(footer || onSave) && (
          <ResponsiveDialogFooter className="px-4 sm:px-6 pb-6 sm:pb-0">
            {renderFooter()}
          </ResponsiveDialogFooter>
        )}
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
