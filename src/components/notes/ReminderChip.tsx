import { Bell, BellRing, Repeat, X } from 'lucide-react';
import type { NoteReminder } from '@/types/note';
import { useLanguage } from '@/contexts/LanguageContext';
import { useDateLocale } from '@/lib/dateLocale';
import { formatReminder, isReminderOverdue, nextReminderTime, parseReminder } from '@/lib/noteReminders';
import { cn } from '@/lib/utils';

/** "Tomorrow, 08:00", or the original time for an overdue one-off reminder. */
export function useReminderLabel(reminder: NoteReminder): { text: string; overdue: boolean } {
  const { t } = useLanguage();
  const locale = useDateLocale();
  const now = new Date();
  const overdue = isReminderOverdue(reminder, now);
  const when = nextReminderTime(reminder, now) ?? parseReminder(reminder.at);
  const text = when ? formatReminder(when, locale, { today: t('today'), tomorrow: t('reminderTomorrow') }, now) : '';
  return { text, overdue };
}

/** The small bell on a note card, beside the pin and lock marks. */
export function ReminderIcon({ reminder, className }: { reminder: NoteReminder; className?: string }) {
  const { t } = useLanguage();
  const { text, overdue } = useReminderLabel(reminder);
  const label = `${t('reminder')}: ${text}${overdue ? ` (${t('reminderOverdue')})` : ''}`;
  const Icon = overdue ? Bell : BellRing;
  return (
    <span role="img" aria-label={label} className="inline-flex" data-testid="note-reminder-icon">
      <Icon size={20} className={cn(className, overdue && 'opacity-50')} />
    </span>
  );
}

/**
 * The reminder chip under a note's title, as in Keep: tap to change it, × to remove it.
 * An overdue one-off reminder is struck through until it is changed or removed.
 */
export function ReminderChip({ reminder, onEdit, onRemove, className }: {
  reminder: NoteReminder;
  onEdit?: () => void;
  onRemove?: () => void;
  className?: string;
}) {
  const { t } = useLanguage();
  const { text, overdue } = useReminderLabel(reminder);
  const content = (
    <>
      {overdue ? <Bell size={13} className="shrink-0 opacity-60" /> : <BellRing size={13} className="shrink-0" />}
      <span className={cn('truncate', overdue && 'line-through opacity-70')}>{text}</span>
      {reminder.repeat && <Repeat size={12} className="shrink-0 opacity-70" aria-label={t('reminderRepeat')} />}
    </>
  );
  return (
    <span
      className={cn('inline-flex max-w-full items-center gap-1.5 rounded-full border border-current/20 bg-black/5 py-1 pl-2.5 text-xs dark:bg-white/10', onRemove ? 'pr-1' : 'pr-2.5', className)}
      data-testid="note-reminder-chip"
    >
      {onEdit ? (
        <button type="button" onClick={onEdit} className="inline-flex min-w-0 items-center gap-1.5" aria-label={`${t('reminder')}: ${text}`}>
          {content}
        </button>
      ) : (
        // Read-only (e.g. inside a row that is itself a button): no nested buttons.
        <span className="inline-flex min-w-0 items-center gap-1.5" aria-label={`${t('reminder')}: ${text}`}>{content}</span>
      )}
      {onRemove && (
        <button type="button" onClick={onRemove} aria-label={t('reminderRemove')} className="rounded-full p-0.5 hover:bg-black/10 dark:hover:bg-white/15">
          <X size={12} />
        </button>
      )}
    </span>
  );
}
