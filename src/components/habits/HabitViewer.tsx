import { X, Pencil, Trash2, CalendarDays, Repeat, Flame, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { Habit } from '@/types/habit';
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from '@/components/ui/responsive-dialog';
import { isDefaultColor } from '@/lib/cardColorStyles';
import { getColoredIconButtonStyles, getColoredIconClass, getColoredBorderClass } from '@/lib/coloredButtonStyles';
import { useLanguage } from '@/contexts/LanguageContext';
import { useWeekStart, getOrderedDayNameKeys } from '@/contexts/WeekStartContext';
import { countedSentence } from '@/lib/countedMessage';
import { habitKind, habitShareSummary, streakOf } from '@/lib/reportStats';

interface HabitViewerProps {
  habit: Habit | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (habit: Habit) => void;
  onDelete: (habit: Habit) => void;
}

/** `activeDays` is indexed Monday = 0 … Sunday = 6. */
const MONDAY_INDEX: Record<string, number> = {
  dayShortMonday: 0, dayShortTuesday: 1, dayShortWednesday: 2, dayShortThursday: 3,
  dayShortFriday: 4, dayShortSaturday: 5, dayShortSunday: 6,
};

/**
 * What a tap on a habit opens: a read-only view, like the event and note viewers. Editing
 * is one step away, through the Edit button here or Edit in the card's menu.
 */
export function HabitViewer({ habit, isOpen, onClose, onEdit, onDelete }: HabitViewerProps) {
  const { t, language } = useLanguage();
  const { weekStartDay, weekStartsOn } = useWeekStart();

  if (!habit) return null;

  const now = new Date();
  const kind = habitKind(habit);
  const dayKeys = getOrderedDayNameKeys(weekStartDay);
  const activeDays = dayKeys.filter((key) => habit.activeDays?.[MONDAY_INDEX[key]] ?? true);

  const scheduleText = habit.useNumberOfDays
    ? `${habit.numberOfDaysPerWeek ?? 1} ${t('daysPerWeekInline')}`
    : activeDays.length === 7
      ? t('recurDailyOne')
      : activeDays.map((key) => t(key)).join(', ');

  const frequencyText = habit.useUnlimitedTimes
    ? t('unlimitedTimes')
    : habit.useTimesPerDay && (habit.timesPerDay ?? 1) > 1
      ? `${habit.timesPerDay} ${t('timesPerDayInline')}`
      : null;

  const summary = habitShareSummary(habit, now, weekStartsOn);
  const last30 = summary.kind === 'count'
    ? t('habitShareOpen').replace('{count}', String(summary.count))
    : t('habitShareRate')
        .replace('{done}', String(summary.done))
        .replace('{expected}', String(summary.expected))
        .replace('{rate}', String(summary.expected ? Math.round((summary.done / summary.expected) * 100) : 0));
  const streak = kind === 'open' ? null : streakOf(habit, now, weekStartsOn);

  const hasColor = !isDefaultColor(habit.color);
  const iconButtonStyles = getColoredIconButtonStyles(hasColor);
  const iconColorClass = getColoredIconClass(hasColor);
  const borderClass = getColoredBorderClass(hasColor, 100);
  const editCloseButtonStyles = hasColor ? iconButtonStyles.className : 'hover:bg-hover';
  const textColorClass = hasColor ? 'text-[#000000]' : 'text-foreground';

  return (
    <ResponsiveDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <ResponsiveDialogContent
        className="max-w-md overflow-hidden p-0"
        hideCloseButton
        style={{ backgroundColor: hasColor ? habit.color : 'hsl(var(--background))' }}
      >
        <div className="space-y-4 p-6" data-habit-viewer>
          <ResponsiveDialogHeader className="p-0">
            <div className="flex items-center justify-between">
              <Button
                variant={iconButtonStyles.variant}
                size="sm"
                onClick={() => onEdit(habit)}
                className={`${iconColorClass} ${editCloseButtonStyles}`}
              >
                <Pencil size={20} className="mr-2" />
                {t('edit')}
              </Button>
              <div className="flex gap-2">
                <Button
                  aria-label={t('delete')}
                  variant={iconButtonStyles.variant}
                  size="icon"
                  onClick={() => onDelete(habit)}
                  className={`${iconColorClass} ${iconButtonStyles.className} hover:bg-destructive/20 hover:text-destructive`}
                >
                  <Trash2 size={20} />
                </Button>
                <Button
                  variant={iconButtonStyles.variant}
                  size="icon"
                  aria-label={t('close')}
                  onClick={onClose}
                  className={`${iconColorClass} ${editCloseButtonStyles}`}
                >
                  <X size={20} />
                </Button>
              </div>
            </div>
          </ResponsiveDialogHeader>

          <ResponsiveDialogTitle className={`break-words text-left text-2xl font-bold ${textColorClass}`}>{habit.name}</ResponsiveDialogTitle>

          {habit.description && (
            <p className={`whitespace-pre-line break-words text-sm ${textColorClass}`}>{habit.description}</p>
          )}

          <div className={`flex items-start gap-2 ${textColorClass}`}>
            <CalendarDays size={20} className="mt-0.5 shrink-0" />
            <span className="text-sm">{scheduleText}</span>
          </div>

          {frequencyText && (
            <div className={`flex items-center gap-2 ${textColorClass}`}>
              <Repeat size={20} className="shrink-0" />
              <span className="text-sm">{frequencyText}</span>
            </div>
          )}

          {habit.tags && habit.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {habit.tags.map((tag) => (
                <Badge key={tag} variant="outline" className={borderClass}>#{tag}</Badge>
              ))}
            </div>
          )}

          <div className={`space-y-2 rounded-lg p-3 ${hasColor ? 'bg-[#000000]/10' : 'bg-muted'}`}>
            <div className={`flex items-center gap-2 ${textColorClass}`}>
              <BarChart3 size={20} className={`shrink-0 ${iconColorClass}`} />
              <span className="text-sm">{last30}</span>
            </div>
            {streak && (
              <div className={`flex flex-wrap items-center gap-x-4 gap-y-1 ${textColorClass}`}>
                <span className="flex items-center gap-2 text-sm">
                  <Flame size={20} className={`shrink-0 ${iconColorClass}`} />
                  {t('habitCurrentStreak').replace('{value}', countedSentence(t, language, streak.unit === 'weeks' ? 'weeksCount' : 'daysCount', streak.current))}
                </span>
                <span className="text-sm opacity-80">{t('reportsBest').replace('{count}', String(streak.best))}</span>
              </div>
            )}
          </div>
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
