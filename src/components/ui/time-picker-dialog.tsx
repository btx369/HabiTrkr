import { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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

type Field = 'hours' | 'minutes';

/**
 * Type-in time picker. Opens with the hours already selected, so the first digits typed
 * replace them; after two digits (or one that can only be a leading digit of a bigger
 * number, like 5 for hours) it moves on to the minutes by itself. Tapping either number
 * selects its whole content, so there is nothing to delete first.
 */
export function TimePickerDialog({ isOpen, onClose, onSave, initialTime }: TimePickerDialogProps) {
  const { t } = useLanguage();
  const [hours, setHours] = useState('00');
  const [minutes, setMinutes] = useState('00');
  const [selectedField, setSelectedField] = useState<Field>('hours');
  const hoursRef = useRef<HTMLInputElement>(null);
  const minutesRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const [h, m] = (initialTime ?? '').split(':');
    setHours((h || '00').padStart(2, '0'));
    setMinutes((m || '00').padStart(2, '0'));
    setSelectedField('hours');
  }, [isOpen, initialTime]);

  const selectAll = (input: HTMLInputElement | null) => {
    if (!input) return;
    input.focus();
    // Deferred: on touch screens the tap that focused the field places the caret after
    // this handler runs and would undo a synchronous select().
    setTimeout(() => input.select(), 0);
  };

  const handleChange = (field: Field, raw: string) => {
    const max = field === 'hours' ? 23 : 59;
    const lead = field === 'hours' ? 2 : 5; // a first digit above this can only be the 2nd digit
    const set = field === 'hours' ? setHours : setMinutes;
    const digits = raw.replace(/\D/g, '');
    if (digits === '') { set(''); return; }
    const typed = digits.slice(-2);
    let done = false;
    let value = typed;
    if (typed.length === 1) {
      if (Number(typed) > lead) { value = `0${typed}`; done = true; }
    } else {
      value = String(Math.min(Number(typed), max)).padStart(2, '0');
      done = true;
    }
    set(value);
    if (done && field === 'hours') selectAll(minutesRef.current);
  };

  const pad = (field: Field) => {
    // Functional update: this runs from blur right after a change, when the closed-over
    // value is already stale.
    (field === 'hours' ? setHours : setMinutes)((value) => value.padStart(2, '0'));
  };

  const handleSave = () => {
    onSave(`${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}`);
    onClose();
  };

  const renderField = (field: Field, value: string, ref: React.RefObject<HTMLInputElement>, label: string) => {
    const active = selectedField === field;
    return (
      <div className="flex flex-col items-center gap-2">
        <input
          ref={ref}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          aria-label={label}
          value={value}
          maxLength={3}
          onChange={(e) => handleChange(field, e.target.value)}
          onFocus={(e) => { setSelectedField(field); const el = e.target; setTimeout(() => el.select(), 0); }}
          onClick={(e) => e.currentTarget.select()}
          onBlur={() => pad(field)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSave(); } }}
          className={cn(
            'h-20 w-24 rounded-2xl border text-center text-5xl font-light tabular-nums caret-transparent outline-none transition-colors',
            active
              ? 'border-black bg-black text-white'
              : 'border-border bg-muted text-foreground',
          )}
        />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-w-sm"
        // Start ready to type: hours focused and selected.
        onOpenAutoFocus={(e) => { e.preventDefault(); selectAll(hoursRef.current); }}
      >
        <DialogHeader>
          <DialogTitle>{t('selectTime')}</DialogTitle>
          <DialogDescription className="sr-only">{t('selectTime')}</DialogDescription>
        </DialogHeader>

        <div className="flex items-start justify-center gap-3 py-4">
          {renderField('hours', hours, hoursRef, t('hour'))}
          <span className="mt-4 text-5xl font-light text-foreground">:</span>
          {renderField('minutes', minutes, minutesRef, t('minute'))}
        </div>

        <div className="flex gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1">
            {t('cancel')}
          </Button>
          <Button onClick={handleSave} className="flex-1">
            {t('save')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
