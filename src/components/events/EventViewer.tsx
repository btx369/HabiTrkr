import { X, Pencil, Trash2, Calendar, RefreshCw, Clock, MapPin, Bell } from 'lucide-react';
import { longDate } from '@/lib/dateFormats';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Event, AlertType, AlertCustomUnit } from '@/types/event';
import { format } from 'date-fns';
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from '@/components/ui/responsive-dialog';
import { isDefaultColor } from '@/lib/cardColorStyles';
import { getColoredIconButtonStyles, getColoredIconClass, getColoredBorderClass } from '@/lib/coloredButtonStyles';
import { useLanguage } from '@/contexts/LanguageContext';
import { parseStoredDate } from '@/lib/dateUtils';
import { useDateLocale } from '@/lib/dateLocale';
import { useWeekStart, getOrderedDayNameKeys, getVisualIndexFromJsDay } from '@/contexts/WeekStartContext';
import { describeRecurrence } from '@/lib/recurrenceLabel';

interface EventViewerProps {
  event: Event | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (event: Event) => void;
  onDelete: (event: Event) => void;
}

/*
 * Full weekday translation keys, indexed by JS day value (0 = Sunday).
 *
 * Kept as keys because this is module level, where no hook can run; the names are resolved
 * with `t()` at render time. The order comes from `getOrderedDayNameKeys`, which returns the
 * short-name keys already ordered by the user's week start.
 */
const DAY_NAME_KEYS = [
  'daySunday',
  'dayMonday',
  'dayTuesday',
  'dayWednesday',
  'dayThursday',
  'dayFriday',
  'daySaturday',
] as const;

/** The full-name key for each short-name key, so ordering can come from either list. */
const DAY_FULL_BY_SHORT: Record<string, string> = {
  dayShortSunday: 'daySunday',
  dayShortMonday: 'dayMonday',
  dayShortTuesday: 'dayTuesday',
  dayShortWednesday: 'dayWednesday',
  dayShortThursday: 'dayThursday',
  dayShortFriday: 'dayFriday',
  dayShortSaturday: 'daySaturday',
};

/*
 * Alert intervals, as translation KEYS composed at render time.
 *
 * The labels used to be English text in this table. A bare key cannot express "30 minutes
 * before", so each entry names a unit key and the render site joins it with `t('before')`.
 * `value` discriminants are untouched.
 */
const ALERT_UNIT_KEYS: Record<AlertType, { count?: number; unit?: string } | 'none' | 'custom'> = {
  'none': 'none',
  '5min': { count: 5, unit: 'unitMinutes' },
  '15min': { count: 15, unit: 'unitMinutes' },
  '30min': { count: 30, unit: 'unitMinutes' },
  '1hour': { count: 1, unit: 'unitHour' },
  '4hours': { count: 4, unit: 'unitHours' },
  '12hours': { count: 12, unit: 'unitHours' },
  '1day': { count: 1, unit: 'unitDays' },
  '4weeks': { count: 4, unit: 'unitWeeks' },
  'custom': 'custom',
};

/** The unit key for each stored custom-alert unit. */
const CUSTOM_ALERT_UNIT_KEYS: Record<string, string> = {
  minutes: 'unitMinutes',
  hours: 'unitHours',
  days: 'unitDays',
  weeks: 'unitWeeks',
};

export function EventViewer({ event, isOpen, onClose, onEdit, onDelete }: EventViewerProps) {
  const { t, language } = useLanguage();
  const dateLocale = useDateLocale();
  const { weekStartDay } = useWeekStart();

  // Full day names in the order the week starts on. The short-name keys come back ordered
  // by the week start, and both lists are indexed by JS day, so the position carries over.
  const orderedDayNames = getOrderedDayNameKeys(weekStartDay)
    .map((key) => t(DAY_FULL_BY_SHORT[key] ?? 'daySunday'));

  if (!event) return null;

  // Use startDate/endDate if available, fallback to legacy date field
  const startDate = event.startDate || event.date;
  const endDate = event.endDate;
  const startTime = event.startTime || event.time;
  const endTime = event.endTime;

  const formattedStartDate = startDate 
    ? longDate(parseStoredDate(startDate) ?? new Date(), language)
    : t('noDateSet');

  const formattedEndDate = endDate 
    ? longDate(parseStoredDate(endDate) ?? new Date(), language)
    : null;

  // Check if start and end dates are the same
  const isSameDay = startDate && endDate && startDate === endDate;

  const formatTime = (time?: string) => {
    if (!time) return null;
    // 'p' is the locale's own short time: 18:30 in Portugal, 6:30 PM in the US.
    return format(new Date(`2000-01-01T${time}`), 'p', { locale: dateLocale });
  };

  const getRecurrenceText = () =>
    describeRecurrence(
      event,
      t,
      language,
      (jsDay) => orderedDayNames[getVisualIndexFromJsDay(jsDay, weekStartDay)],
      (jsDay) => getVisualIndexFromJsDay(jsDay, weekStartDay),
    );

  const getAlertText = () => {
    if (!event.alertType || event.alertType === 'none') return null;

    if (event.alertType === 'custom' && event.alertCustomValue && event.alertCustomUnit) {
      // The stored unit is a value like 'minutes', so it maps through the same unit keys the
      // preset intervals use rather than being printed raw.
      const unitKey = CUSTOM_ALERT_UNIT_KEYS[event.alertCustomUnit];
      return `${event.alertCustomValue} ${t(unitKey)} ${t('before')}`;
    }

    const entry = ALERT_UNIT_KEYS[event.alertType];
    if (entry === 'none' || entry === 'custom') return null;
    return `${entry.count} ${t(entry.unit as string)} ${t('before')}`;
  };

  const recurrenceText = getRecurrenceText();
  const alertText = getAlertText();

  // Use the standardized color helpers
  const hasColor = !isDefaultColor(event.color);
  const iconButtonStyles = getColoredIconButtonStyles(hasColor);
  const iconColorClass = getColoredIconClass(hasColor);
  const borderClass = getColoredBorderClass(hasColor, 100);

  /*
   * An uncoloured event reads the page background, not `--card`. `--card` is pure white,
   * so the viewer opened as a bright cold sheet while the note viewer next to it used the
   * warm surface. Same token in both places now.
   */
  const getBackgroundStyle = (): React.CSSProperties => {
    if (!hasColor) {
      return { backgroundColor: 'hsl(var(--background))' };
    }
    return { backgroundColor: event.color };
  };

  const editCloseButtonStyles = hasColor 
    ? iconButtonStyles.className 
    : 'hover:bg-hover';

  // Text color classes using the standard pattern
  const textColorClass = hasColor ? 'text-[#000000]' : 'text-foreground';
  const mutedTextClass = hasColor ? 'text-[#000000]' : 'text-foreground';

  return (
    <ResponsiveDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <ResponsiveDialogContent 
        className="max-w-md overflow-hidden p-0"
        hideCloseButton
        style={getBackgroundStyle()}
      >
        <div className="p-6 space-y-4">
          {/* Header with Edit and Close buttons */}
          <ResponsiveDialogHeader className="p-0">
            <div className="flex items-center justify-between">
              <Button
                variant={iconButtonStyles.variant}
                size="sm"
                onClick={() => onEdit(event)}
                className={`${iconColorClass} ${editCloseButtonStyles}`}
              >
                <Pencil size={20} className="mr-2" />
                {t('edit')}
              </Button>
              <ResponsiveDialogTitle className={`text-lg font-semibold ${textColorClass} sr-only`}>
                {t('eventDetails')}
              </ResponsiveDialogTitle>
              <div className="flex gap-2">
                <Button
                  aria-label={t('delete')}
                  variant={iconButtonStyles.variant}
                  size="icon"
                  onClick={() => onDelete(event)}
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

          {/* Event Title */}
          <h2 className={`text-2xl font-bold ${textColorClass}`}>
            {event.name}
          </h2>

          {/* Event Date(s) */}
          <div className={`flex items-start gap-2 ${mutedTextClass}`}>
            <Calendar size={20} className="mt-0.5 shrink-0" />
            <div className="flex flex-col">
              {isSameDay ? (
                <span className="text-sm">{formattedStartDate}</span>
              ) : (
                <>
                  <span className="text-sm">
                    <span className="font-medium">{t('start')}:</span> {formattedStartDate}
                  </span>
                  {formattedEndDate && (
                    <span className="text-sm">
                      <span className="font-medium">{t('end')}:</span> {formattedEndDate}
                    </span>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Event Time(s) or All Day badge */}
          {event.isAllDay || (!startTime && !endTime) ? (
            <div className={`flex items-center gap-2 ${mutedTextClass}`}>
              <Clock size={20} />
              <span className="text-sm font-medium">{t('allDay')}</span>
            </div>
          ) : (startTime || endTime) && (
            <div className={`flex items-center gap-2 ${mutedTextClass}`}>
              <Clock size={20} />
              <span className="text-sm">
                {startTime && formatTime(startTime)}
                {startTime && endTime && ' - '}
                {endTime && formatTime(endTime)}
              </span>
            </div>
          )}

          {/* Event Location */}
          {event.location && (
            <div className={`flex items-start gap-2 ${mutedTextClass}`}>
              <MapPin size={20} className="mt-0.5 shrink-0" />
              <span className="text-sm">{event.location}</span>
            </div>
          )}

          {/* Alert */}
          {alertText && (
            <div className={`flex items-center gap-2 ${mutedTextClass}`}>
              <Bell size={20} />
              <span className="text-sm">{alertText}</span>
            </div>
          )}

          {/* Description */}
          {event.description && (
            <p className={`text-sm ${mutedTextClass}`}>
              {event.description}
            </p>
          )}

          {/* Tags */}
          {event.tags && event.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {event.tags.map((tag, index) => (
                <Badge 
                  key={index} 
                  variant="outline"
                  className={borderClass}
                >
                  #{tag}
                </Badge>
              ))}
            </div>
          )}

          {/* Recurrence Info */}
          {event.isRecurrent && recurrenceText && (
            <div className={`flex items-center gap-2 p-3 rounded-lg ${hasColor ? 'bg-[#000000]/10' : 'bg-muted'}`}>
              <RefreshCw size={20} className={iconColorClass} />
              <span className={`text-sm ${textColorClass}`}>
                {recurrenceText}
              </span>
            </div>
          )}
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
