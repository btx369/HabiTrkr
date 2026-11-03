import { Calendar as CalendarIcon, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Event } from '@/types/event';
import { highlightText } from '@/lib/textHighlight';
import { getCardColorStylesWithFallback, isDefaultColor } from '@/lib/cardColorStyles';
import { getColoredBorderClass } from '@/lib/coloredButtonStyles';
import { format } from 'date-fns';
import { useLanguage } from '@/contexts/LanguageContext';
import { useDateLocale } from '@/lib/dateLocale';
import { describeRecurrence } from '@/lib/recurrenceLabel';

interface CalendarEventItemProps {
  event: Event;
  searchQuery?: string;
  /** Compact mode for weekly view (smaller padding, no description) */
  compact?: boolean;
  /** Click handler for viewing event details */
  onClick?: () => void;
}

/**
 * Shared component for displaying event items in calendar weekly/monthly views.
 * Uses consistent color styling from the card color system.
 * On mobile, badges display below text. On desktop, they display inline.
 */
export function CalendarEventItem({ 
  event, 
  searchQuery = '', 
  compact = false,
  onClick
}: CalendarEventItemProps) {
  const { t, language } = useLanguage();
  const dateLocale = useDateLocale();
  // Short form here ("Every 2 weeks"); the event viewer adds the weekdays.
  const recurrenceLabel = event.recurrenceType
    ? describeRecurrence({ ...event, recurrenceDays: undefined }, t, language, () => '') ?? ''
    : '';

  // The locale's own short time: 18:30 in Portugal, 6:30 PM in the US.
  const formatTime = (time: string) => format(new Date(`2000-01-01T${time}`), 'p', { locale: dateLocale });

  const hasTime = event.startTime && !event.isAllDay;
  const isAllDay = event.isAllDay;

  // Use standardized color helpers for consistent styling
  const hasColor = !isDefaultColor(event.color);
  const eventBorderClass = hasColor ? 'border-black/10 dark:border-black/10' : 'border-border';
  const badgeBorderClass = getColoredBorderClass(hasColor, 100);
  const textColorClass = hasColor ? 'text-[#000000]' : 'text-foreground';
  const mutedTextClass = hasColor ? 'text-[#000000]/70' : 'text-muted-foreground';

  return (
    <div 
      className={`flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 px-2.5 py-2 rounded-md border ${eventBorderClass} shadow-[var(--surface-shadow)] ${onClick ? 'cursor-pointer hover:opacity-90 transition-opacity' : ''}`}
      style={getCardColorStylesWithFallback(event.color)}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => e.key === 'Enter' && onClick() : undefined}
    >
      <div className="flex-1 min-w-0">
        <p className={`${compact ? 'text-sm' : ''} font-medium truncate ${textColorClass}`}>
          {highlightText(event.name, searchQuery)}
        </p>
        {!compact && event.description && (
          <p className={`text-sm truncate ${mutedTextClass}`}>
            {highlightText(event.description, searchQuery)}
          </p>
        )}
      </div>
      {(isAllDay || hasTime || event.isRecurrent) && (
        <div className="flex flex-wrap gap-1">
          {isAllDay && (
            <Badge variant="outline" className={`text-xs shrink-0 w-fit ${badgeBorderClass} ${hasColor ? 'text-[#000000]' : ''}`}>
              <Clock size={12} className="mr-1" />
              {t('allDay')}
            </Badge>
          )}
          {hasTime && (
            <Badge variant="outline" className={`text-xs shrink-0 w-fit ${badgeBorderClass} ${hasColor ? 'text-[#000000]' : ''}`}>
              <Clock size={12} className="mr-1" />
              {formatTime(event.startTime!)}
            </Badge>
          )}
          {event.isRecurrent && (
            <Badge variant="outline" className={`text-xs shrink-0 w-fit ${badgeBorderClass} ${hasColor ? 'text-[#000000]' : ''}`}>
              <CalendarIcon size={12} className="mr-1" />
              {recurrenceLabel}
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
