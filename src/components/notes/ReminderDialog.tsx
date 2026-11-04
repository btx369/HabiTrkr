import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { BellOff, CalendarDays, Clock, Repeat, Sun, Sunrise, CalendarRange } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePickerInput } from '@/components/ui/date-scroll-picker';
import { TimePickerDialog } from '@/components/ui/time-picker-dialog';
import { useLanguage } from '@/contexts/LanguageContext';
import { useWeekStart } from '@/contexts/WeekStartContext';
import { useDateLocale } from '@/lib/dateLocale';
import { formatReminder, nextReminderTime, parseReminder, reminderPresets, toReminderString, type ReminderPreset } from '@/lib/noteReminders';
import type { NoteReminder } from '@/types/note';

type RepeatChoice = NonNullable<NoteReminder['repeat']> | 'none';

const PRESET_ICONS: Record<ReminderPreset, typeof Sun> = { laterToday: Sun, tomorrow: Sunrise, nextWeek: CalendarRange };
const PRESET_KEYS: Record<ReminderPreset, string> = {
  laterToday: 'reminderLaterToday',
  tomorrow: 'reminderTomorrow',
  nextWeek: 'reminderNextWeek',
};
const REPEAT_OPTIONS: Array<{ value: RepeatChoice; label: string; unit?: string }> = [
  { value: 'none', label: 'reminderNoRepeat' },
  { value: 'daily', label: 'reminderDaily', unit: 'repeatDays' },
  { value: 'weekly', label: 'reminderWeekly', unit: 'repeatWeeks' },
  { value: 'monthly', label: 'reminderMonthly', unit: 'repeatMonths' },
  { value: 'yearly', label: 'reminderYearly', unit: 'repeatYears' },
];

interface ReminderDialogProps {
  isOpen: boolean;
  onClose: () => void;
  reminder?: NoteReminder;
  /** `undefined` removes the reminder. */
  onSave: (reminder: NoteReminder | undefined) => void;
}

/**
 * The reminder picker, modelled on Google Keep: one tap on a quick choice, or a date and
 * time of your own with an optional repeat. The quick choices keep the repeat chosen below
 * them, so "Tomorrow, every week" is two taps.
 */
export function ReminderDialog({ isOpen, onClose, reminder, onSave }: ReminderDialogProps) {
  const { t } = useLanguage();
  const { weekStartsOn } = useWeekStart();
  const dateLocale = useDateLocale();
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [repeat, setRepeat] = useState<RepeatChoice>('none');
  const [everyN, setRepeatInterval] = useState<number | ''>(1);
  const [timePickerOpen, setTimePickerOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (!isOpen) return;
    const current = new Date();
    setNow(current);
    // Start from the saved reminder, or from the first quick choice.
    const start = (reminder && parseReminder(reminder.at)) || reminderPresets(current, weekStartsOn)[0].date;
    setDate(format(start, 'yyyy-MM-dd'));
    setTime(format(start, 'HH:mm'));
    setRepeat(reminder?.repeat ?? 'none');
    setRepeatInterval(reminder?.interval ?? 1);
  }, [isOpen, reminder, weekStartsOn]);

  const presets = useMemo(() => reminderPresets(now, weekStartsOn), [now, weekStartsOn]);
  const words = { today: t('today'), tomorrow: t('reminderTomorrow') };

  const build = (at: Date): NoteReminder => {
    const out: NoteReminder = { at: toReminderString(at) };
    if (repeat !== 'none') {
      out.repeat = repeat;
      const n = typeof everyN === 'number' ? Math.min(99, Math.max(1, everyN)) : 1;
      if (n > 1) out.interval = n;
    }
    return out;
  };

  const chosen = parseReminder(`${date}T${time}`);
  // A one-off reminder in the past would never ring. A repeating one simply starts there.
  const inPast = !!chosen && repeat === 'none' && chosen.getTime() <= Date.now();

  const save = (at: Date) => {
    onSave(build(at));
    onClose();
  };

  const unitKey = REPEAT_OPTIONS.find((o) => o.value === repeat)?.unit;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-sm" data-testid="reminder-dialog">
          <DialogHeader>
            <DialogTitle>{t('reminder')}</DialogTitle>
            <DialogDescription className="sr-only">{t('reminderDescription')}</DialogDescription>
          </DialogHeader>

          <div className="space-y-1">
            {presets.map(({ preset, date: at }) => {
              const Icon = PRESET_ICONS[preset];
              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => save(at)}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm hover:bg-hover active:bg-hover"
                >
                  <Icon size={20} className="shrink-0 text-muted-foreground" />
                  <span className="flex-1">{t(PRESET_KEYS[preset])}</span>
                  <span className="text-muted-foreground">
                    {preset === 'nextWeek' ? format(at, 'EEE, p', { locale: dateLocale }) : format(at, 'p', { locale: dateLocale })}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="space-y-3 border-t border-border pt-4">
            <Label className="text-sm">{t('reminderPickDateTime')}</Label>
            <div className="grid grid-cols-2 gap-3">
              <DatePickerInput id="reminder-date" value={date} onChange={setDate} icon={CalendarDays} iconColor="currentColor" iconPosition="left" />
              <Button
                type="button"
                variant="outline"
                onClick={() => setTimePickerOpen(true)}
                className="h-10 w-full justify-start gap-2 rounded-md bg-muted text-sm"
              >
                <Clock size={20} />
                {time || t('setTime')}
              </Button>
            </div>

            <div className="flex items-center gap-3">
              <Repeat size={20} className="shrink-0 text-muted-foreground" aria-hidden />
              <Select value={repeat} onValueChange={(v) => setRepeat(v as RepeatChoice)}>
                <SelectTrigger className="h-10 flex-1 bg-muted text-sm" aria-label={t('reminderRepeat')}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REPEAT_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{t(o.label)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {repeat !== 'none' && unitKey && (
              <div className="flex items-center gap-3 pl-7 text-sm">
                <span>{t('repeatEvery')}</span>
                <Input
                  type="number"
                  min={1}
                  max={99}
                  value={everyN}
                  aria-label={t('repeatEvery')}
                  onChange={(e) => setRepeatInterval(e.target.value === '' ? '' : parseInt(e.target.value) || 1)}
                  onBlur={(e) => setRepeatInterval(Math.min(99, Math.max(1, parseInt(e.target.value) || 1)))}
                  className="h-10 w-16 bg-muted text-center text-sm"
                />
                <span>{t(unitKey)}</span>
              </div>
            )}

            {chosen && (
              <p className={`text-xs ${inPast ? 'text-destructive' : 'text-muted-foreground'}`} role={inPast ? 'alert' : undefined}>
                {/* For a repeating reminder that started in the past, the next time it rings. */}
                {inPast ? t('reminderInPast') : formatReminder(nextReminderTime(build(chosen), now) ?? chosen, dateLocale, words, now)}
              </p>
            )}
          </div>

          <div className="flex gap-3">
            {reminder ? (
              <Button
                variant="outline"
                className="flex-1 gap-2"
                onClick={() => {
                  onSave(undefined);
                  onClose();
                }}
              >
                <BellOff size={20} />
                {t('reminderRemove')}
              </Button>
            ) : (
              <Button variant="outline" onClick={onClose} className="flex-1">
                {t('cancel')}
              </Button>
            )}
            <Button className="flex-1" disabled={!chosen || inPast} onClick={() => chosen && save(chosen)}>
              {t('save')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <TimePickerDialog isOpen={timePickerOpen} onClose={() => setTimePickerOpen(false)} onSave={setTime} initialTime={time} />
    </>
  );
}
