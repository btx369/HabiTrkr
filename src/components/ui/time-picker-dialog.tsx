import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

interface TimePickerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (time: string) => void;
  initialTime?: string;
}

export function TimePickerDialog({ isOpen, onClose, onSave, initialTime }: TimePickerDialogProps) {
  const { t } = useLanguage();
  const [hours, setHours] = useState('00');
  const [minutes, setMinutes] = useState('00');
  const [selectedField, setSelectedField] = useState<'hours' | 'minutes'>('hours');

  useEffect(() => {
    if (isOpen && initialTime) {
      const [h, m] = initialTime.split(':');
      setHours(h || '00');
      setMinutes(m || '00');
    } else if (isOpen) {
      setHours('00');
      setMinutes('00');
    }
    setSelectedField('hours');
  }, [isOpen, initialTime]);

  const handleHoursChange = (value: string) => {
    // Allow empty or numeric input only
    const cleanValue = value.replace(/\D/g, '');
    if (cleanValue === '') {
      setHours('');
      return;
    }
    const num = parseInt(cleanValue);
    if (num >= 0 && num <= 23) {
      setHours(cleanValue.slice(-2));
    }
  };

  const handleMinutesChange = (value: string) => {
    // Allow empty or numeric input only
    const cleanValue = value.replace(/\D/g, '');
    if (cleanValue === '') {
      setMinutes('');
      return;
    }
    const num = parseInt(cleanValue);
    if (num >= 0 && num <= 59) {
      setMinutes(cleanValue.slice(-2));
    }
  };

  const handleHoursBlur = () => {
    if (hours === '' || hours.length === 1) {
      setHours(hours.padStart(2, '0') || '00');
    }
  };

  const handleMinutesBlur = () => {
    if (minutes === '' || minutes.length === 1) {
      setMinutes(minutes.padStart(2, '0') || '00');
    }
  };

  const handleSave = () => {
    onSave(`${hours}:${minutes}`);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[320px]">
        <DialogHeader>
          <DialogTitle>{t('selectTime')}</DialogTitle>
        </DialogHeader>
        
        <div className="flex items-center justify-center gap-2 py-6">
          {/* Hours */}
          <div className="flex flex-col items-center">
            <div
              onClick={() => setSelectedField('hours')}
              className={cn(
                "w-24 h-24 rounded-lg flex items-center justify-center cursor-pointer transition-colors",
                selectedField === 'hours' 
                  ? "bg-primary text-primary-foreground" 
                  : "bg-muted text-foreground"
              )}
            >
              <input
                type="text"
                inputMode="numeric"
                value={hours}
                onChange={(e) => handleHoursChange(e.target.value)}
                onFocus={() => setSelectedField('hours')}
                onBlur={handleHoursBlur}
                className={cn(
                  "w-full h-full text-center text-5xl font-light bg-transparent border-none outline-none",
                  selectedField === 'hours' 
                    ? "text-primary-foreground" 
                    : "text-foreground"
                )}
                maxLength={2}
              />
            </div>
            <span className="text-sm text-muted-foreground mt-2">{t('hour')}</span>
          </div>

          <span className="text-5xl font-light text-foreground mb-6">:</span>

          {/* Minutes */}
          <div className="flex flex-col items-center">
            <div
              onClick={() => setSelectedField('minutes')}
              className={cn(
                "w-24 h-24 rounded-lg flex items-center justify-center cursor-pointer transition-colors",
                selectedField === 'minutes' 
                  ? "bg-primary text-primary-foreground" 
                  : "bg-muted text-foreground"
              )}
            >
              <input
                type="text"
                inputMode="numeric"
                value={minutes}
                onChange={(e) => handleMinutesChange(e.target.value)}
                onFocus={() => setSelectedField('minutes')}
                onBlur={handleMinutesBlur}
                className={cn(
                  "w-full h-full text-center text-5xl font-light bg-transparent border-none outline-none",
                  selectedField === 'minutes' 
                    ? "text-primary-foreground" 
                    : "text-foreground"
                )}
                maxLength={2}
              />
            </div>
            <span className="text-sm text-muted-foreground mt-2">{t('minute')}</span>
          </div>
        </div>

        <div className="flex justify-end gap-4 pt-2">
          <Button variant="ghost" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button variant="ghost" onClick={handleSave} className="text-primary">
            OK
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
