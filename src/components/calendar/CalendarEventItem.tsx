import { Calendar as CalendarIcon, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Event } from '@/types/event';
import { highlightText } from '@/lib/textHighlight';
import { getCardColorStylesWithFallback, isDefaultColor } from '@/lib/cardColorStyles';
import { getColoredBorderClass } from '@/lib/coloredButtonStyles';

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
  const recurrenceLabel = event.recurrenceType 
    ? event.recurrenceType.charAt(0).toUpperCase() + event.recurrenceType.slice(1)
    : '';

  // Format time for display (convert 24h to 12h format)
  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  const hasTime = event.startTime && !event.isAllDay;
  const isAllDay = event.isAllDay;

  // Use standardized color helpers for consistent styling
  const hasColor = !isDefaultColor(event.color);
  const badgeBorderClass = getColoredBorderClass(hasColor, 100);
  const textColorClass = hasColor ? 'text-[#000000]' : 'text-foreground';
  const mutedTextClass = hasColor ? 'text-[#000000]/70' : 'text-muted-foreground';

  return (
    <div 
      className={`flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 px-2.5 py-2 rounded-md ${onClick ? 'cursor-pointer hover:opacity-90 transition-opacity' : ''}`}
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
              All-Day
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
