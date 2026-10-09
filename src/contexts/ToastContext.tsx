import { createContext, useContext, ReactNode, useMemo, useRef } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { toast as sonnerToast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import { takePendingUndo } from '@/lib/undoManager';

interface ToastContextType {
  toastsEnabled: boolean;
  setToastsEnabled: (enabled: boolean) => void;
  toast: typeof sonnerToast;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toastsEnabled, setToastsEnabled] = useLocalStorage('toasts-enabled', true);
  const { t } = useLanguage();
  const lastUndoToastId = useRef<string | number | undefined>(undefined);

  // Create a wrapped toast object that respects the enabled setting
  // Using useMemo to ensure the toast object is recreated when toastsEnabled changes
  const toast = useMemo(() => {
    const wrappedToast = (message: string | ReactNode, data?: Parameters<typeof sonnerToast>[1]) => {
      if (!toastsEnabled) return;
      return sonnerToast(message, data);
    };

    return Object.assign(wrappedToast, {
      success: (message: string | ReactNode, data?: Parameters<typeof sonnerToast.success>[1]) => {
        const undo = takePendingUndo();
        if (lastUndoToastId.current !== undefined) {
          sonnerToast.dismiss(lastUndoToastId.current);
          lastUndoToastId.current = undefined;
        }
        if (!toastsEnabled) return;

        const options = undo && !data?.action
          ? {
              ...data,
              action: {
                label: t('undo'),
                onClick: () => {
                  undo();
                  lastUndoToastId.current = undefined;
                  sonnerToast.success(t('actionUndone'));
                },
              },
            }
          : data;
        const toastId = sonnerToast.success(message, options);
        if (undo) lastUndoToastId.current = toastId;
        return toastId;
      },
      error: (message: string | ReactNode, data?: Parameters<typeof sonnerToast.error>[1]) => {
        if (!toastsEnabled) return;
        return sonnerToast.error(message, data);
      },
      warning: (message: string | ReactNode, data?: Parameters<typeof sonnerToast.warning>[1]) => {
        if (!toastsEnabled) return;
        return sonnerToast.warning(message, data);
      },
      info: (message: string | ReactNode, data?: Parameters<typeof sonnerToast.info>[1]) => {
        if (!toastsEnabled) return;
        return sonnerToast.info(message, data);
      },
      loading: (message: string | ReactNode, data?: Parameters<typeof sonnerToast.loading>[1]) => {
        if (!toastsEnabled) return;
        return sonnerToast.loading(message, data);
      },
      dismiss: sonnerToast.dismiss,
      promise: sonnerToast.promise,
    }) as typeof sonnerToast;
  }, [toastsEnabled, t]);

  return (
    <ToastContext.Provider value={{ toastsEnabled, setToastsEnabled, toast }}>
      {children}
    </ToastContext.Provider>
  );
}

export function useToastSettings() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToastSettings must be used within a ToastProvider');
  }
  return context;
}
