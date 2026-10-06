import { useRef, useEffect } from 'react';
import { Calendar, BellRing, Check, FolderOpen, Pin, RotateCcw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Event } from '@/types/event';
import { highlightText } from '@/lib/textHighlight';
import { ViewType } from '@/components/events/EventViewSettings';
import { ItemActionMenu } from '@/components/shared/ItemActionMenu';
import { ColoredCard } from '@/components/shared/ColoredCard';
import { useWeekStart, getOrderedDayNameKeys, getVisualIndexFromJsDay } from '@/contexts/WeekStartContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { countedSentence } from '@/lib/countedMessage';
import { isDefaultColor } from '@/lib/cardColorStyles';
import { getColoredIconClass, getColoredBorderClass } from '@/lib/coloredButtonStyles';
import { useIsFiled } from '@/contexts/FolderMembershipContext';
import { cn } from '@/lib/utils';


interface EventCardProps {
  event: Event;
  onClick: () => void;
  onEdit?: () => void;
  onArchive?: (eventId: string) => void;
  onUnarchive?: (eventId: string) => void;
  onDelete?: (eventId: string) => void;
  onCopy?: (eventId: string) => void;
  onShare?: (eventId: string) => void;
  onMoveToFolder?: (eventId: string) => void;
  onRestore?: (eventId: string) => void;
  onPin?: (eventId: string) => void;
  onUnpin?: (eventId: string) => void;
  isDeleted?: boolean;
  isArchived?: boolean;
  searchQuery?: string;
  viewType?: ViewType;
  /** Bulk selection props */
  showBulkCheckbox?: boolean;
  isBulkSelected?: boolean;
  onBulkSelect?: (id: string) => void;
}

export function EventCard({ 
  event, 
  onClick, 
  onEdit,
  onArchive, 
  onUnarchive, 
  onDelete, 
  onCopy, 
  onShare, 
  onMoveToFolder, 
  onRestore,
  onPin,
  onUnpin,
  isDeleted = false, 
  isArchived = false, 
  searchQuery = '',
  viewType = 'list',
  showBulkCheckbox = false,
  isBulkSelected = false,
  onBulkSelect,
}: EventCardProps) {
  const { weekStartDay } = useWeekStart();
  const { t, language } = useLanguage();
  // Short translated day names in week-start order: the function returns translation KEYS,
  // because a hook cannot run in the provider.
  const orderedDayNames = getOrderedDayNameKeys(weekStartDay).map((key) => t(key));

  // Track when bulk mode was enabled for animation control
  const bulkModeEntryRef = useRef<number | null>(null);

  useEffect(() => {
    if (showBulkCheckbox) {
      if (bulkModeEntryRef.current === null) {
        bulkModeEntryRef.current = Date.now();
      }
    } else {
      bulkModeEntryRef.current = null;
    }
  }, [showBulkCheckbox]);

  // Only animate checkbox on initial bulk mode entry (within 100ms)
  const shouldAnimateCheckbox = bulkModeEntryRef.current !== null && 
    (Date.now() - bulkModeEntryRef.current) < 100;
  
  // Use standardized color helpers
  // Text and icon colors: black when the event has its own color, theme-aware colors otherwise
  const hasColor = !isDefaultColor(event.color);
  const textColorClass = hasColor ? 'text-[#000000]' : 'text-foreground';
  const mutedTextColorClass = hasColor ? 'text-[#000000]' : 'text-muted-foreground';
  const iconColorClass = getColoredIconClass(hasColor);
  const badgeBorderClass = getColoredBorderClass(hasColor, 100);
  /*
   * The outline of the days badge.
   *
   * `getColoredBorderClass(hasColor, 100)` asks for `border-[#000000]/100`, and Tailwind
   * does not generate that class — its `/30` sibling exists in the built stylesheet and the
   * `/100` one does not. The badge therefore fell back to the shared border, which on a
   * coloured card is rgb(234, 232, 230): a line that reads as white on a pastel background.
   * `border-black` is a plain utility and does generate.
   *
   * The dark theme keeps the shared border. There the same line is rgb(57, 54, 50) and was
   * reported as looking right, so only the light theme changes.
   */
  const daysBadgeBorderClass = hasColor ? 'border-black dark:border-border' : badgeBorderClass;
  // An event filed in a folder says so on its card, on every list it appears in.
  const isFiled = useIsFiled(event.id);
  
  // Recurrence badge styling: use event color if set
  const recurrenceBadgeStyle = hasColor && event.color 
    ? { backgroundColor: event.color, color: '#000000' } 
    : undefined;

  // Helper to get day names in order based on recurrenceDays (JS days: 0=Sun, 6=Sat)
  const getRecurrenceDayNames = (recurrenceDays: number[]) => {
    // Sort by visual index order for display
    const sortedDays = [...recurrenceDays].sort((a, b) => {
      const visualA = getVisualIndexFromJsDay(a, weekStartDay);
      const visualB = getVisualIndexFromJsDay(b, weekStartDay);
      return visualA - visualB;
    });
    return sortedDays.map(jsDay => orderedDayNames[getVisualIndexFromJsDay(jsDay, weekStartDay)]).join(', ');
  };

  const getCardHeight = () => {
    switch (viewType) {
      case 'x3':
        return 'h-40 overflow-hidden';
      case 'x2':
        return 'h-48 overflow-hidden';
      case 'list':
      default:
        return 'h-auto';
    }
  };

  const getDescriptionLength = () => {
    switch (viewType) {
      case 'x3':
        return 60;
      case 'x2':
        return 100;
      case 'list':
      default:
        return null;
    }
  };

  const truncateText = (text: string, maxLength: number | null) => {
    if (!maxLength || text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  const calculateTimeRemaining = (event: Event) => {
    // The editor writes startDate; `date` is the legacy field kept for old records.
    // Reading only `date` here left every modern event with no countdown at all.
    const eventDateStr = event.startDate || event.date;
    if (!eventDateStr) return null;
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const eventDate = new Date(eventDateStr);
    if (isNaN(eventDate.getTime())) return null;
    const eventDateOnly = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());
    
    if (event.isRecurrent) {
      const nextOccurrence = new Date(eventDateOnly);
      const interval = event.recurrenceInterval || 1;
      
      if (nextOccurrence.getTime() === today.getTime()) {
        return 0;
      }
      
      switch (event.recurrenceType) {
        case 'daily':
          while (nextOccurrence <= today) {
            nextOccurrence.setDate(nextOccurrence.getDate() + interval);
          }
          break;
          
        case 'weekly':
          while (nextOccurrence <= today) {
            nextOccurrence.setDate(nextOccurrence.getDate() + (7 * interval));
          }
          break;
          
        case 'monthly':
          while (nextOccurrence <= today) {
            nextOccurrence.setMonth(nextOccurrence.getMonth() + interval);
          }
          break;
          
        case 'yearly':
        default:
          while (nextOccurrence <= today) {
            nextOccurrence.setFullYear(nextOccurrence.getFullYear() + interval);
          }
          break;
      }
      
      const timeDiff = nextOccurrence.getTime() - today.getTime();
      const daysRemaining = Math.round(timeDiff / (1000 * 3600 * 24));
      
      return daysRemaining;
    } else {
      const timeDiff = eventDateOnly.getTime() - today.getTime();
      const daysRemaining = Math.round(timeDiff / (1000 * 3600 * 24));
      
      return daysRemaining;
    }
  };

  const handleShare = () => {
    const eventDateStr = event.startDate || event.date;
    const shareText = `${event.name}${event.description ? '\n\n' + event.description : ''}${eventDateStr ? '\n\nDate: ' + new Date(eventDateStr).toLocaleDateString() : ''}`;
    
    if (navigator.share) {
      navigator.share({
        title: event.name,
        text: shareText,
      });
    } else {
      navigator.clipboard.writeText(shareText);
    }
  };

  const daysRemaining = calculateTimeRemaining(event);

  // Bulk selection checkbox component - renders inline, replacing the menu
  const BulkCheckbox = () => (
    <div 
      className={shouldAnimateCheckbox ? "animate-in zoom-in-50 duration-300" : ""}
      onClick={(e) => {
        e.stopPropagation();
        onBulkSelect?.(event.id);
      }}
    >
      <div className={cn(
        "h-6 w-6 rounded-full border-2 flex items-center justify-center transition-colors cursor-pointer",
        isBulkSelected 
          ? "bg-black border-black" 
          : "border-muted-foreground bg-background/80 backdrop-blur-sm"
      )}>
        {isBulkSelected && <Check size={14} className="text-white" />}
      </div>
    </div>
  );

  const handleCardClick = () => {
    if (showBulkCheckbox) {
      onBulkSelect?.(event.id);
    } else {
      onClick();
    }
  };

  return (
    <ColoredCard 
      color={event.color}
      className={cn(
        "transition-all cursor-pointer relative",
        getCardHeight()
      )}
      onClick={handleCardClick}
      data-event-id={event.id}
    >
      <CardHeader className="px-2 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <CardTitle className={`text-lg ${textColorClass} ${viewType !== 'list' ? 'truncate' : ''}`}>
              {highlightText(event.name, searchQuery)}
            </CardTitle>
          </div>
          <div className="flex items-center gap-1">
            {isFiled && (
              <FolderOpen size={14} className={`flex-shrink-0 ${iconColorClass}`} />
            )}
            {event.pinned && (
              <Pin size={14} className={`flex-shrink-0 ${iconColorClass}`} />
            )}
            {event.alertType && event.alertType !== 'none' && (
              <BellRing size={14} className={`flex-shrink-0 ${iconColorClass}`} />
            )}
            {showBulkCheckbox ? (
              <BulkCheckbox />
            ) : (isArchived || isDeleted) ? (
              <div className="flex gap-1">
                <Button 
                  size="icon" 
                  variant="outline" 
                  className="rounded-full h-8 w-8" 
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onUnarchive) onUnarchive(event.id);
                    else onRestore?.(event.id);
                  }}
                >
                  <RotateCcw size={14} />
                </Button>
                <Button 
                  size="icon" 
                  variant="destructive" 
                  className="rounded-full h-8 w-8" 
                  onClick={(e) => { e.stopPropagation(); onDelete?.(event.id); }}
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            ) : (
              <ItemActionMenu
                isArchived={isArchived}
                isDeleted={isDeleted}
                isPinned={event.pinned}
                onEdit={onEdit}
                onArchive={onArchive ? () => onArchive(event.id) : undefined}
                onRestore={isArchived && onUnarchive ? () => onUnarchive(event.id) : (isDeleted && onRestore ? () => onRestore(event.id) : undefined)}
                onDelete={onDelete ? () => onDelete(event.id) : undefined}
                onCopy={onCopy ? () => onCopy(event.id) : undefined}
                onShare={onShare ? handleShare : undefined}
                onMoveToFolder={onMoveToFolder ? () => onMoveToFolder(event.id) : undefined}
                onPin={onPin ? () => onPin(event.id) : undefined}
                onUnpin={onUnpin ? () => onUnpin(event.id) : undefined}
                size="sm"
                iconColorClass={iconColorClass}
              />
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className={`px-2 pb-2 pt-0 ${viewType !== 'list' ? 'py-2' : ''}`}>
        <div className="space-y-2">
          {event.description && (
            <p className={`${mutedTextColorClass} text-sm ${viewType !== 'list' ? 'line-clamp-2' : ''}`}>
              {highlightText(truncateText(event.description, getDescriptionLength()), searchQuery)}
            </p>
          )}
          <div className="flex items-center justify-between gap-2">
            <div className={`flex items-center gap-2 text-sm ${textColorClass}`}>
              <Calendar size={14} className={iconColorClass} />
              <span className={viewType !== 'list' ? 'truncate' : ''}>
                {(() => {
                  const eventDateStr = event.startDate || event.date;
                  return eventDateStr ? new Date(eventDateStr).toLocaleDateString() : 'No date set';
                })()}
              </span>
              {/* Desktop/Tablet: show recurrence inline */}
              {event.isRecurrent && event.recurrenceType && (
                <Badge 
                  variant="outline" 
                  className={`text-xs flex-shrink-0 hidden md:inline-flex ${badgeBorderClass} ${hasColor ? 'text-[#000000]' : ''}`}
                  style={recurrenceBadgeStyle}
                >
                  {event.recurrenceType === 'weekly' && event.recurrenceDays && event.recurrenceDays.length > 0
                    ? `Every ${getRecurrenceDayNames(event.recurrenceDays)}`
                    : `Every ${event.recurrenceInterval || 1} ${event.recurrenceType === 'daily' ? 'day' : event.recurrenceType === 'weekly' ? 'week' : event.recurrenceType === 'monthly' ? 'month' : 'year'}${(event.recurrenceInterval || 1) !== 1 ? 's' : ''}`
                  }
                </Badge>
              )}
            </div>
            {daysRemaining !== null && (
              <div className="flex-shrink-0">
                {daysRemaining > 0 ? (
                  /*
                   * `{count} days`, not `{count} days remaining`. The badge is already the
                   * one that shows a countdown, so the word adds nothing on screen, and it
                   * is the word that has to be translated and pluralised in every language:
                   * one noun per language instead of a phrase.
                   */
                  <Badge variant="outline" className={`text-xs ${daysBadgeBorderClass} ${hasColor ? 'text-[#000000]' : ''}`}>
                    {countedSentence(t, language, 'daysCount', daysRemaining)}
                  </Badge>
                ) : daysRemaining === 0 ? (
                  <Badge className="text-xs bg-green-500 text-white">
                    {t('todayExclaim')}
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-xs">
                    {countedSentence(t, language, 'daysAgoBadge', Math.abs(daysRemaining))}
                  </Badge>
                )}
              </div>
            )}
          </div>
          {/* Mobile: show recurrence on separate line */}
          {event.isRecurrent && event.recurrenceType && (
            <div className="md:hidden">
              <Badge 
                variant="outline" 
                className={`text-xs ${badgeBorderClass} ${hasColor ? 'text-[#000000]' : ''}`}
                style={recurrenceBadgeStyle}
              >
                {event.recurrenceType === 'weekly' && event.recurrenceDays && event.recurrenceDays.length > 0
                  ? `Every ${getRecurrenceDayNames(event.recurrenceDays)}`
                  : `Every ${event.recurrenceInterval || 1} ${event.recurrenceType === 'daily' ? 'day' : event.recurrenceType === 'weekly' ? 'week' : event.recurrenceType === 'monthly' ? 'month' : 'year'}${(event.recurrenceInterval || 1) !== 1 ? 's' : ''}`
                }
              </Badge>
            </div>
          )}
        </div>
      </CardContent>
    </ColoredCard>
  );
}
