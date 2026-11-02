import { Hash, KeyRound } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useLanguage } from '@/contexts/LanguageContext';

interface LockChoiceDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onChoose: (type: 'pin' | 'password') => void;
}

/**
 * PIN or password? The two protect very differently, so each option says what it does:
 * a PIN only hides the note, a password encrypts it.
 */
export function LockChoiceDialog({ isOpen, onClose, onChoose }: LockChoiceDialogProps) {
  const { t } = useLanguage();

  const option = (type: 'pin' | 'password', Icon: typeof Hash, title: string, body: string) => (
    <button
      type="button"
      onClick={() => onChoose(type)}
      className="flex w-full items-start gap-3 rounded-2xl border border-border bg-muted p-4 text-left transition-colors hover:bg-hover"
    >
      <Icon size={20} className="mt-0.5 shrink-0" />
      <span>
        <span className="block font-medium">{title}</span>
        <span className="block text-sm text-muted-foreground">{body}</span>
      </span>
    </button>
  );

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[calc(100vw-12px)] max-w-[380px] gap-0 rounded-[28px] border-border/70 bg-popover p-6 shadow-xl">
        <DialogHeader className="pt-1">
          <DialogTitle className="text-center text-lg font-semibold tracking-tight">{t('lockChoiceTitle')}</DialogTitle>
          <DialogDescription className="sr-only">{t('lockChoiceTitle')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 pt-5">
          {option('pin', Hash, t('lockWithPin'), t('lockWithPinBody'))}
          {option('password', KeyRound, t('lockWithPassword'), t('lockWithPasswordBody'))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
