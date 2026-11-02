import { useEffect, useState } from 'react';
import { KeyRound } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useLanguage } from '@/contexts/LanguageContext';
import { MIN_PASSWORD_LENGTH } from '@/lib/noteVault';

export type NotePasswordMode = 'create' | 'unlock' | 'change';

export interface NotePasswordValues {
  password: string;
  currentPassword?: string;
}

interface NotePasswordDialogProps {
  isOpen: boolean;
  mode: NotePasswordMode;
  onClose: () => void;
  /** Resolves to an error message to show, or null when it worked (the dialog then closes). */
  onSubmit: (values: NotePasswordValues) => Promise<string | null>;
}

/**
 * Asks for the note password: to create it, to open a protected note, or to change it.
 * Creating and changing ask twice and say plainly that a forgotten password cannot be
 * recovered, since that is the one way to lose protected notes for good.
 */
export function NotePasswordDialog({ isOpen, mode, onClose, onSubmit }: NotePasswordDialogProps) {
  const { t } = useLanguage();
  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setCurrentPassword('');
      setPassword('');
      setConfirmation('');
      setError(null);
      setIsBusy(false);
    }
  }, [isOpen]);

  const choosingNew = mode !== 'unlock';

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (isBusy) return;
    if (choosingNew && password.length < MIN_PASSWORD_LENGTH) {
      setError(t('notePasswordTooShort').replace('{count}', String(MIN_PASSWORD_LENGTH)));
      return;
    }
    if (choosingNew && password !== confirmation) {
      setError(t('notePasswordMismatch'));
      return;
    }
    setIsBusy(true);
    setError(null);
    const result = await onSubmit({ password, currentPassword: mode === 'change' ? currentPassword : undefined });
    setIsBusy(false);
    if (result) {
      setError(result);
      if (mode === 'unlock') setPassword('');
    } else {
      onClose();
    }
  };

  const title = mode === 'create' ? t('notePasswordCreateTitle') : mode === 'change' ? t('notePasswordChangeTitle') : t('notePasswordEnterTitle');

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[calc(100vw-12px)] max-w-[380px] gap-0 rounded-[28px] border-border/70 bg-popover p-6 shadow-xl">
        <DialogHeader className="items-center space-y-3 pt-1">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-muted text-foreground">
            <KeyRound size={20} strokeWidth={2} />
          </div>
          <DialogTitle className="text-center text-lg font-semibold tracking-tight">{title}</DialogTitle>
          {choosingNew && (
            <DialogDescription className="text-center text-sm text-muted-foreground">
              {t('notePasswordWarning')}
            </DialogDescription>
          )}
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3 pt-5">
          {mode === 'change' && (
            <Input
              type="password"
              autoComplete="current-password"
              placeholder={t('notePasswordCurrent')}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoFocus
            />
          )}
          <Input
            type="password"
            autoComplete={choosingNew ? 'new-password' : 'current-password'}
            placeholder={mode === 'unlock' ? t('notePasswordPlaceholder') : t('notePasswordNew')}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus={mode !== 'change'}
          />
          {choosingNew && (
            <Input
              type="password"
              autoComplete="new-password"
              placeholder={t('notePasswordConfirm')}
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
            />
          )}

          {error && <p className="text-center text-sm font-medium text-destructive">{error}</p>}

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="h-11 flex-1 border-border text-foreground hover:bg-hover" onClick={onClose}>
              {t('cancel')}
            </Button>
            <Button
              type="submit"
              className="h-11 flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={isBusy || password.length === 0}
            >
              {mode === 'unlock' ? t('unlock') : t('save')}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
