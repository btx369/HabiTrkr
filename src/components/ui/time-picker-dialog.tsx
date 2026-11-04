import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollColumn } from '@/components/ui/date-scroll-picker';
import { useLanguage } from '@/contexts/LanguageContext';

interface TimePickerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (time: string) => void;
  initialTime?: string;
}

const two = (n: number) => String(n).padStart(2, '0');

/**
 * Roulette time picker, built from the same scroll columns as the date picker: spin the
 * hours and the minutes to the wanted time. Nothing is typed, so the keyboard never opens.
 */
export function TimePickerDialog({ isOpen, onClose, onSave, initialTime }: TimePickerDialogProps) {
  const { t } = useLanguage();
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(0);

  const hourItems = useMemo(() => Array.from({ length: 24 }, (_, i) => two(i)), []);
  const minuteItems = useMemo(() => Array.from({ length: 60 }, (_, i) => two(i)), []);

  useEffect(() => {
    if (!isOpen) return;
    const [h, m] = (initialTime ?? '').split(':').map((part) => parseInt(part, 10));
    setHours(Number.isFinite(h) ? Math.min(23, Math.max(0, h)) : 0);
    setMinutes(Number.isFinite(m) ? Math.min(59, Math.max(0, m)) : 0);
  }, [isOpen, initialTime]);

  const handleSave = () => {
    onSave(`${two(hours)}:${two(minutes)}`);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-full max-w-md mx-auto p-0">
        <div className="p-6">
          <DialogTitle className="mb-4 text-lg font-semibold">{t('selectTime')}</DialogTitle>
          <DialogDescription className="sr-only">{t('selectTime')}</DialogDescription>

          <div className="mb-6 flex gap-4">
            <div className="flex-1">
              <div className="mb-2 text-center text-sm font-medium text-muted-foreground">{t('hour')}</div>
              <ScrollColumn items={hourItems} selectedIndex={hours} onSelectionChange={setHours} />
            </div>
            <div className="flex-1">
              <div className="mb-2 text-center text-sm font-medium text-muted-foreground">{t('minute')}</div>
              <ScrollColumn items={minuteItems} selectedIndex={minutes} onSelectionChange={setMinutes} />
            </div>
          </div>

          <div className="flex justify-between gap-3">
            <Button variant="outline" onClick={onClose} className="flex-1">
              {t('cancel')}
            </Button>
            <Button onClick={handleSave} className="flex-1">
              OK
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
