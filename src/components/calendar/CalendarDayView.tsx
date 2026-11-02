import { useMemo, useEffect, useRef, useState } from 'react';
import { format, isToday, getHours, getMinutes } from 'date-fns';
import { Clock } from 'lucide-react';
import { Event } from '@/types/event';
import { cn } from '@/lib/utils';
import { getCardColorStylesWithFallback } from '@/lib/cardColorStyles';
import { useLanguage } from '@/contexts/LanguageContext';

interface CalendarDayViewProps {
  currentDate: Date;
  events: Event[];
  searchQuery?: string;
  onViewEvent: (event: Event) => void;
}

const HOUR_HEIGHT = 60; // px per hour slot
const HOURS = Array.from({ length: 24 }, (_, i) => i);

// Helper to convert time string to minutes since midnight
const timeToMinutes = (timeStr: string): number => {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
};

// Helper to check if two events overlap in time
const eventsOverlap = (eventA: Event, eventB: Event): boolean => {
  const startA = timeToMinutes(eventA.startTime || eventA.time || '00:00');
  const endA = eventA.endTime ? timeToMinutes(eventA.endTime) : startA + 60;
  const startB = timeToMinutes(eventB.startTime || eventB.time || '00:00');
  const endB = eventB.endTime ? timeToMinutes(eventB.endTime) : startB + 60;
  
  return startA < endB && endA > startB;
};

export function CalendarDayView({ 
  currentDate, 
  events, 
  searchQuery = '',
  onViewEvent 
}: CalendarDayViewProps) {
  const { t } = useLanguage();
  const gridRef = useRef<HTMLDivElement>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Separate all-day/untimed events from timed events
  const { allDayEvents, timedEvents } = useMemo(() => {
    const allDay: Event[] = [];
    const timed: Event[] = [];

    events.forEach(event => {
      // Events go to top section if all-day OR if they have no time set
      const hasTime = event.startTime || event.time;
      if (event.isAllDay || !hasTime) {
        allDay.push(event);
      } else {
        timed.push(event);
      }
    });

    return { allDayEvents: allDay, timedEvents: timed };
  }, [events]);

  // Calculate column positions for overlapping events
  const eventColumns = useMemo(() => {
    const columns = new Map<string, { column: number; totalColumns: number }>();
    
    if (timedEvents.length === 0) return columns;

    // Sort events by start time, then by duration (longer first)
    const sortedEvents = [...timedEvents].sort((a, b) => {
      const startA = timeToMinutes(a.startTime || a.time || '00:00');
      const startB = timeToMinutes(b.startTime || b.time || '00:00');
      if (startA !== startB) return startA - startB;
      
      const endA = a.endTime ? timeToMinutes(a.endTime) : startA + 60;
      const endB = b.endTime ? timeToMinutes(b.endTime) : startB + 60;
      return (endB - startB) - (endA - startA);
    });

    // Group overlapping events
    const groups: Event[][] = [];
    
    for (const event of sortedEvents) {
      let addedToGroup = false;
      
      for (const group of groups) {
        if (group.some(e => eventsOverlap(e, event))) {
          group.push(event);
          addedToGroup = true;
          break;
        }
      }
      
      if (!addedToGroup) {
        groups.push([event]);
      }
    }

    // Merge groups that share events through transitivity
    let merged = true;
    while (merged) {
      merged = false;
      for (let i = 0; i < groups.length; i++) {
        for (let j = i + 1; j < groups.length; j++) {
          const groupI = groups[i];
          const groupJ = groups[j];
          
          const hasOverlap = groupI.some(eventI => 
            groupJ.some(eventJ => eventsOverlap(eventI, eventJ))
          );
          
          if (hasOverlap) {
            groups[i] = [...groupI, ...groupJ];
            groups.splice(j, 1);
            merged = true;
            break;
          }
        }
        if (merged) break;
      }
    }

    // Assign columns within each group
    for (const group of groups) {
      const eventColumns_: { event: Event; column: number }[] = [];
      
      for (const event of group) {
        let column = 0;
        while (eventColumns_.some(ec => 
          ec.column === column && eventsOverlap(ec.event, event)
        )) {
          column++;
        }
        eventColumns_.push({ event, column });
      }
      
      const totalColumns = Math.max(...eventColumns_.map(ec => ec.column)) + 1;
      
      for (const { event, column } of eventColumns_) {
        columns.set(event.id, { column, totalColumns });
      }
    }

    return columns;
  }, [timedEvents]);

  // Update current time every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Scroll page to current time on mount (or 8 AM if not today)
  useEffect(() => {
    if (gridRef.current) {
      const scrollToHour = isToday(currentDate) ? Math.max(getHours(new Date()) - 1, 0) : 8;
      const offsetTop = gridRef.current.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({ top: offsetTop + scrollToHour * HOUR_HEIGHT, behavior: 'smooth' });
    }
  }, [currentDate]);

  // Calculate current time position
  const currentTimePosition = useMemo(() => {
    if (!isToday(currentDate)) return null;
    const hours = getHours(currentTime);
    const minutes = getMinutes(currentTime);
    return (hours + minutes / 60) * HOUR_HEIGHT;
  }, [currentDate, currentTime]);

  // Get event position based on time
  const getEventPosition = (event: Event) => {
    const timeStr = event.startTime || event.time;
    if (!timeStr) return null;

    const [hours, minutes] = timeStr.split(':').map(Number);
    const top = (hours + minutes / 60) * HOUR_HEIGHT;

    // Calculate height based on duration
    let height = HOUR_HEIGHT; // Default 1 hour
    if (event.endTime) {
      const [endHours, endMinutes] = event.endTime.split(':').map(Number);
      const endPosition = (endHours + endMinutes / 60) * HOUR_HEIGHT;
      height = Math.max(endPosition - top, 30); // Minimum 30px height
    }

    return { top, height };
  };

  const dayOfWeek = format(currentDate, 'EEE');
  const dayNumber = format(currentDate, 'd');

  return (
    <div className="flex flex-col bg-[hsl(var(--surface-card))] backdrop-blur-[12px] rounded-[20px] border border-border shadow-[var(--surface-shadow)]">
      {/* Header with day info and all-day events */}
      <div className="sticky top-[11.5rem] z-30 flex rounded-t-[20px] bg-[hsl(var(--item-card-surface))] border-b-2 border-black dark:border-white">
        {/* Day label */}
        <div className="w-16 flex-shrink-0 p-2 text-center border-r border-border">
          <span className="text-sm text-muted-foreground">{dayOfWeek}</span>
          <div className={cn(
            "w-10 h-10 mx-auto rounded-full flex items-center justify-center text-lg font-bold mt-1",
            isToday(currentDate) ? "bg-black text-white" : "text-foreground"
          )}>
            {dayNumber}
          </div>
        </div>

        {/* All-day events section */}
        <div className="flex-1 p-2 min-h-[60px]">
          {allDayEvents.length > 0 ? (
            <div className="space-y-1">
              {allDayEvents.map(event => {
                const hasColor = event.color && event.color !== '#FFFFFF';
                return (
                  <div
                    key={event.id}
                    className={`rounded-md border ${hasColor ? 'border-black/10 dark:border-black/10' : 'border-border'} shadow-[var(--surface-shadow)] px-3 py-1.5 text-sm font-medium cursor-pointer hover:opacity-90 transition-opacity flex items-center gap-2`}
                    style={getCardColorStylesWithFallback(event.color)}
                    onClick={() => onViewEvent(event)}
                  >
                    {event.isAllDay && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                        <Clock size={12} />
                        All-Day
                      </span>
                    )}
                    <span className="truncate">{event.name}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">{t('noAllDayEvents')}</div>
          )}
        </div>
      </div>

      {/* Time grid - fully visible, scrolls with page */}
      <div ref={gridRef}>
        <div className="relative" style={{ height: 24 * HOUR_HEIGHT }}>
          {/* Hour rows */}
          {HOURS.map(hour => (
            <div
              key={hour}
              className="absolute left-0 right-0 flex border-b border-border/50"
              style={{ top: hour * HOUR_HEIGHT, height: HOUR_HEIGHT }}
            >
              {/* Hour label - skip 00:00 as it would be cut off */}
              <div className="relative w-16 flex-shrink-0 border-r border-border bg-muted/30 pr-2 text-right text-sm text-muted-foreground">
                {hour > 0 && (
                  <span className="block -translate-y-1/2 leading-5">
                    {format(new Date().setHours(hour, 0, 0, 0), 'HH:mm')}
                  </span>
                )}
              </div>
              {/* Empty cell for events */}
              <div className="flex-1" />
            </div>
          ))}

          {/* Current time indicator */}
          {currentTimePosition !== null && (
            <div 
              className="absolute left-0 right-0 z-10 pointer-events-none"
              style={{ top: currentTimePosition }}
            >
              <div className="flex items-center">
                <div className="w-16 flex-shrink-0 flex justify-end pr-1">
                  <div className="w-3 h-3 rounded-full bg-destructive" />
                </div>
                <div className="flex-1 h-0.5 bg-destructive" />
              </div>
            </div>
          )}

          {/* Timed events overlay */}
          <div className="absolute left-16 right-0 top-0 bottom-0">
            {timedEvents.map(event => {
              const position = getEventPosition(event);
              if (!position) return null;

              const columnInfo = eventColumns.get(event.id) || { column: 0, totalColumns: 1 };
              const widthPercent = 100 / columnInfo.totalColumns;
              const leftPercent = (columnInfo.column / columnInfo.totalColumns) * 100;
              const hasColor = event.color && event.color !== '#FFFFFF';

              return (
                <div
                  key={event.id}
                  className={`absolute rounded-md border ${hasColor ? 'border-black/10 dark:border-black/10' : 'border-border'} shadow-[var(--surface-shadow)] px-2 py-1 cursor-pointer hover:opacity-90 transition-opacity overflow-hidden`}
                  style={{
                    top: position.top,
                    height: position.height,
                    left: `calc(${leftPercent}% + 2px)`,
                    width: `calc(${widthPercent}% - 4px)`,
                    ...getCardColorStylesWithFallback(event.color)
                  }}
                  onClick={() => onViewEvent(event)}
                >
                  <p className="text-sm font-medium truncate">{event.name}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
