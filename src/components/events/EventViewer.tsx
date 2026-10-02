import { X, Pencil, Trash2, Calendar, RefreshCw, Clock, MapPin, Bell } from 'lucide-react';
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
import { useWeekStart, getOrderedDayNames, getVisualIndexFromJsDay } from '@/contexts/WeekStartContext';

interface EventViewerProps {
  event: Event | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (event: Event) => void;
  onDelete: (event: Event) => void;
}

/*
 * The short day names `getOrderedDayNames` returns, each mapped to the translation key for
 * that day's full name. Kept as keys because this is module level, where no hook can run;
 * the names are resolved with `t()` at render time.
 */
const DAY_NAME_KEYS: Record<string, string> = {
  Sun: 'daySunday',
  Mon: 'dayMonday',
  Tue: 'dayTuesday',
  Wed: 'dayWednesday',
  Thu: 'dayThursday',
  Fri: 'dayFriday',
  Sat: 'daySaturday',
};

const ALERT_LABELS: Record<AlertType, string> = {
  'none': 'No alert',
  '5min': '5 minutes before',
  '15min': '15 minutes before',
  '30min': '30 minutes before',
  '1hour': '1 hour before',
  '4hours': '4 hours before',
  '12hours': '12 hours before',
  '1day': '1 day before',
  '4weeks': '4 weeks before',
  'custom': 'Custom'
};

export function EventViewer({ event, isOpen, onClose, onEdit, onDelete }: EventViewerProps) {
  const { t } = useLanguage();
  const { weekStartDay } = useWeekStart();

  // Full day names in the order the week starts on, so the recurrence days below read
  // in the same order as the rest of the app.
  const orderedDayNames = getOrderedDayNames(weekStartDay).map(shortName => t(DAY_NAME_KEYS[shortName]));

  if (!event) return null;

  // Use startDate/endDate if available, fallback to legacy date field
  const startDate = event.startDate || event.date;
  const endDate = event.endDate;
  const startTime = event.startTime || event.time;
  const endTime = event.endTime;

  const formattedStartDate = startDate 
    ? format(new Date(startDate), 'EEEE, MMMM d, yyyy')
    : 'No date set';

  const formattedEndDate = endDate 
    ? format(new Date(endDate), 'EEEE, MMMM d, yyyy')
    : null;

  // Check if start and end dates are the same
  const isSameDay = startDate && endDate && startDate === endDate;

  const formatTime = (time?: string) => {
    if (!time) return null;
    return format(new Date(`2000-01-01T${time}`), 'h:mm a');
  };

  const getRecurrenceText = () => {
    if (!event.isRecurrent || !event.recurrenceType) return null;

    const interval = event.recurrenceInterval || 1;
    const typeLabel = {
      daily: interval === 1 ? 'day' : 'days',
      weekly: interval === 1 ? 'week' : 'weeks',
      monthly: interval === 1 ? 'month' : 'months',
      yearly: interval === 1 ? 'year' : 'years',
    }[event.recurrenceType];

    let text = interval === 1 
      ? `Every ${typeLabel}` 
      : `Every ${interval} ${typeLabel}`;

    if (event.recurrenceType === 'weekly' && event.recurrenceDays?.length) {
      const days = event.recurrenceDays
        .sort((a, b) => getVisualIndexFromJsDay(a, weekStartDay) - getVisualIndexFromJsDay(b, weekStartDay))
        .map(d => orderedDayNames[getVisualIndexFromJsDay(d, weekStartDay)])
        .join(', ');
      text += ` on ${days}`;
    }

    return text;
  };

  const getAlertText = () => {
    if (!event.alertType || event.alertType === 'none') return null;
    
    if (event.alertType === 'custom' && event.alertCustomValue && event.alertCustomUnit) {
      return `${event.alertCustomValue} ${event.alertCustomUnit} before`;
    }
    
    return ALERT_LABELS[event.alertType];
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
                <Pencil size={16} className="mr-2" />
                {t('edit')}
              </Button>
              <ResponsiveDialogTitle className={`text-lg font-semibold ${textColorClass} sr-only`}>
                Event Details
              </ResponsiveDialogTitle>
              <div className="flex gap-2">
                <Button
                  variant={iconButtonStyles.variant}
                  size="icon"
                  onClick={() => onDelete(event)}
                  className={`${iconColorClass} ${iconButtonStyles.className} hover:bg-destructive/20 hover:text-destructive`}
                >
                  <Trash2 size={18} />
                </Button>
                <Button
                  variant={iconButtonStyles.variant}
                  size="icon"
                  onClick={onClose}
                  className={`${iconColorClass} ${editCloseButtonStyles}`}
                >
                  <X size={18} />
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
            <Calendar size={18} className="mt-0.5 shrink-0" />
            <div className="flex flex-col">
              {isSameDay ? (
                <span className="text-sm">{formattedStartDate}</span>
              ) : (
                <>
                  <span className="text-sm">
                    <span className="font-medium">Start:</span> {formattedStartDate}
                  </span>
                  {formattedEndDate && (
                    <span className="text-sm">
                      <span className="font-medium">End:</span> {formattedEndDate}
                    </span>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Event Time(s) or All Day badge */}
          {event.isAllDay || (!startTime && !endTime) ? (
            <div className={`flex items-center gap-2 ${mutedTextClass}`}>
              <Clock size={18} />
              <span className="text-sm font-medium">{t('allDay')}</span>
            </div>
          ) : (startTime || endTime) && (
            <div className={`flex items-center gap-2 ${mutedTextClass}`}>
              <Clock size={18} />
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
              <MapPin size={18} className="mt-0.5 shrink-0" />
              <span className="text-sm">{event.location}</span>
            </div>
          )}

          {/* Alert */}
          {alertText && (
            <div className={`flex items-center gap-2 ${mutedTextClass}`}>
              <Bell size={18} />
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
              <RefreshCw size={18} className={iconColorClass} />
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
