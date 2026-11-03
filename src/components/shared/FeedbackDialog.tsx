import { useEffect, useState } from 'react';
import { MessageSquare } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useLanguage } from '@/contexts/LanguageContext';
import { feedbackMailto } from '@/lib/appInfo';
import { cn } from '@/lib/utils';

const CATEGORIES = ['feedbackProblem', 'feedbackIdea', 'feedbackOther'] as const;
const MAX_LENGTH = 2000;

interface FeedbackDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * "Feedback": the user picks a kind, writes a message, and their own email app opens with
 * it filled in. Nothing leaves the device unless they press send there.
 */
export function FeedbackDialog({ isOpen, onClose }: FeedbackDialogProps) {
  const { t } = useLanguage();
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('feedbackProblem');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setCategory('feedbackProblem');
      setMessage('');
    }
  }, [isOpen]);

  const handleSend = () => {
    window.location.href = feedbackMailto(t(category), message.trim());
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[calc(100vw-12px)] max-w-[420px] gap-0 rounded-[28px] border-border/70 bg-popover p-6 shadow-xl">
        <DialogHeader className="items-center space-y-3 pt-1">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-muted text-foreground">
            <MessageSquare size={20} strokeWidth={2} />
          </div>
          <DialogTitle className="text-center text-lg font-semibold tracking-tight">{t('feedback')}</DialogTitle>
          <DialogDescription className="text-center text-sm text-muted-foreground">{t('feedbackIntro')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 pt-5">
          <div className="flex gap-2" role="radiogroup" aria-label={t('feedbackKind')}>
            {CATEGORIES.map((key) => (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={category === key}
                onClick={() => setCategory(key)}
                className={cn(
                  'flex-1 rounded-full border px-3 py-2 text-sm transition-colors',
                  category === key ? 'border-foreground bg-foreground text-background' : 'border-border hover:bg-hover'
                )}
              >
                {t(key)}
              </button>
            ))}
          </div>

          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value.slice(0, MAX_LENGTH))}
            placeholder={t('feedbackPlaceholder')}
            aria-label={t('feedbackPlaceholder')}
            className="min-h-[140px]"
            autoFocus
          />
          <p className="text-right text-xs text-muted-foreground">{message.length}/{MAX_LENGTH}</p>

          <div className="flex gap-3">
            <Button type="button" variant="outline" className="h-11 flex-1 border-border text-foreground hover:bg-hover" onClick={onClose}>
              {t('cancel')}
            </Button>
            <Button
              type="button"
              className="h-11 flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={!message.trim()}
              onClick={handleSend}
            >
              {t('feedbackSend')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
