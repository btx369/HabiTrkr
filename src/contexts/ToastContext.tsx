import { createContext, useContext, ReactNode, useMemo } from 'react';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { toast as sonnerToast } from 'sonner';

interface ToastContextType {
  toastsEnabled: boolean;
  setToastsEnabled: (enabled: boolean) => void;
  toast: typeof sonnerToast;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toastsEnabled, setToastsEnabled] = useLocalStorage('toasts-enabled', true);

  // Create a wrapped toast object that respects the enabled setting
  // Using useMemo to ensure the toast object is recreated when toastsEnabled changes
  const toast = useMemo(() => {
    const wrappedToast = (message: string | ReactNode, data?: Parameters<typeof sonnerToast>[1]) => {
      if (!toastsEnabled) return;
      return sonnerToast(message, data);
    };

    return Object.assign(wrappedToast, {
      success: (message: string | ReactNode, data?: Parameters<typeof sonnerToast.success>[1]) => {
        if (!toastsEnabled) return;
        return sonnerToast.success(message, data);
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
  }, [toastsEnabled]);

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
