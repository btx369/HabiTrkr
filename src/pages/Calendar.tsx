import { useState, useMemo, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, SlidingTabsList, TabsTrigger } from '@/components/ui/tabs';
import { CalendarEventItem } from '@/components/calendar/CalendarEventItem';
import { CalendarDayView } from '@/components/calendar/CalendarDayView';
import { EventViewer } from '@/components/events/EventViewer';
import { EventEditor } from '@/components/events/EventEditor';
import { ConfirmationDialog } from '@/components/shared/ConfirmationDialog';
import { Badge } from '@/components/ui/badge';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { Event } from '@/types/event';
import { EventFolder } from '@/types/eventFolder';
import { cn } from '@/lib/utils';
import { highlightText } from '@/lib/textHighlight';
import { occursOn } from '@/lib/eventRecurrence';
import { updateTagUsage } from '@/lib/tagStorage';
import { cancelEventNotification, scheduleEventNotification } from '@/lib/notificationService';
import { useSwipeGesture } from '@/hooks/useSwipeGesture';
import { useToastSettings } from '@/contexts/ToastContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useDateLocale } from '@/lib/dateLocale';
import { useWeekStart, getJsDayFromVisualIndex } from '@/contexts/WeekStartContext';
import { 
  startOfWeek, 
  endOfWeek, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  format, 
  isSameDay, 
  addDays, 
  addWeeks, 
  addMonths,
  subDays,
  subWeeks,
  subMonths,
  isToday,
  isSameMonth,
  isSameWeek
} from 'date-fns';
import { entitySentence } from '@/lib/entityToast';

type ViewMode = 'daily' | 'weekly' | 'monthly';

// Swipe order for the view modes. Module-level so its identity is stable across
// renders; declared inside the component it was rebuilt every render, which made it
// unsafe to list as a useCallback dependency.
const VIEW_MODES: ViewMode[] = ['daily', 'weekly', 'monthly'];

/*
 * Full weekday translation keys, indexed by JS day value (0 = Sunday), and their short
 * counterparts for the month grid.
 *
 * Kept as keys because this is module level, where no hook can run; the labels are
 * resolved with `t()` at render time. The short ones are dedicated keys rather than the
 * full names cut to three characters: German needs "Di/Mi/Do" where slicing gives
 * "Die/Mit/Don".
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

const DAY_SHORT_KEYS = [
  'dayShortSunday',
  'dayShortMonday',
  'dayShortTuesday',
  'dayShortWednesday',
  'dayShortThursday',
  'dayShortFriday',
  'dayShortSaturday',
] as const;

export default function Calendar() {
  const [events, setEvents] = useLocalStorage<Event[]>('events', []);
  const [archivedEvents, setArchivedEvents] = useLocalStorage<Event[]>('archivedEvents', []);
  const [eventFolders, setEventFolders] = useLocalStorage<EventFolder[]>('eventFolders', []);
  const [, setArchivedEventFolders] = useLocalStorage<EventFolder[]>('archivedEventFolders', []);
  const [viewMode, setViewMode] = useState<ViewMode>('weekly');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [searchQuery, setSearchQuery] = useState('');
  
  // Event viewer/editor state
  const [viewingEvent, setViewingEvent] = useState<Event | null>(null);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [deletingEvent, setDeletingEvent] = useState<Event | null>(null);
  
  const { toast } = useToastSettings();
  const { t, language } = useLanguage();
  // Toast copy is a translated sentence plus a translated entity noun. Both halves are
  // resolved here so the `{entity}` substitution is written once instead of at every toast.
  const say = (key: string, entity: string) => entitySentence(t, language, key, entity);
  const dateLocale = useDateLocale();
  const { weekStartsOn, weekStartDay } = useWeekStart();
  // Seven short labels in the user's week-start order; `t()` runs here because the keys
  // themselves have to live at module level.
  const orderedDayNames = Array.from({ length: 7 }, (_, index) =>
    t(DAY_SHORT_KEYS[getJsDayFromVisualIndex(index, weekStartDay)])
  );

  // View mode swipe navigation
  const handleSwipeLeft = useCallback(() => {
    const currentIndex = VIEW_MODES.indexOf(viewMode);
    if (currentIndex < VIEW_MODES.length - 1) {
      setViewMode(VIEW_MODES[currentIndex + 1]);
    }
  }, [viewMode]);

  const handleSwipeRight = useCallback(() => {
    const currentIndex = VIEW_MODES.indexOf(viewMode);
    if (currentIndex > 0) {
      setViewMode(VIEW_MODES[currentIndex - 1]);
    }
  }, [viewMode]);

  const swipeHandlers = useSwipeGesture({
    onSwipeLeft: handleSwipeLeft,
    onSwipeRight: handleSwipeRight,
    threshold: 50,
  });

  // Helper function to get events for a specific date
  const getEventsForDate = (date: Date) => {
    // Past one-off events are auto-archived by the Events page; they still happened, so
    // the calendar keeps showing them on their days.
    return [...events, ...archivedEvents].filter(event => occursOn(event, date));
  };

  // Filter events based on search query
  const filterEvents = (eventList: Event[]) => {
    if (!searchQuery.trim()) return eventList;
    return eventList.filter(event => 
      event.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (event.description && event.description.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  };

  // Navigation functions
  const goToPrevious = () => {
    if (viewMode === 'daily') {
      setCurrentDate(subDays(currentDate, 1));
    } else if (viewMode === 'weekly') {
      setCurrentDate(subWeeks(currentDate, 1));
    } else {
      setCurrentDate(subMonths(currentDate, 1));
    }
  };

  const goToNext = () => {
    if (viewMode === 'daily') {
      setCurrentDate(addDays(currentDate, 1));
    } else if (viewMode === 'weekly') {
      setCurrentDate(addWeeks(currentDate, 1));
    } else {
      setCurrentDate(addMonths(currentDate, 1));
    }
  };

  const goToToday = () => {
    setCurrentDate(new Date());
    setSelectedDate(new Date());
  };

  // Event action handlers
  const handleViewEvent = (event: Event) => {
    setViewingEvent(event);
  };

  const handleEditEvent = (event: Event) => {
    setViewingEvent(null);
    setEditingEvent(event);
  };

  const handleDeleteEvent = (event: Event) => {
    setViewingEvent(null);
    setDeletingEvent(event);
  };

  const confirmDeleteEvent = () => {
    if (!deletingEvent) return;

    // Remove from events (the calendar also shows archived ones)
    setEvents(prev => prev.filter(e => e.id !== deletingEvent.id));
    setArchivedEvents(prev => prev.filter(e => e.id !== deletingEvent.id));

    // Remove from any folders
    const withoutEvent = (prev: EventFolder[]) =>
      prev.map(folder => ({
        ...folder,
        eventIds: folder.eventIds.filter(id => id !== deletingEvent.id)
      }));
    setEventFolders(withoutEvent);
    setArchivedEventFolders(withoutEvent);

    if (deletingEvent.tags?.length) updateTagUsage(deletingEvent.tags, []);
    cancelEventNotification(deletingEvent.id);

    toast.success(say('toastDeleted', 'events'));

    setDeletingEvent(null);
  };

  const handleSaveEvent = (eventData: Omit<Event, 'id' | 'createdAt'>) => {
    if (!editingEvent) return;
    
    const updatedEvent: Event = { ...editingEvent, ...eventData };
    const replace = (prev: Event[]) => prev.map(e => e.id === editingEvent.id ? updatedEvent : e);
    setEvents(replace);
    setArchivedEvents(replace);

    updateTagUsage(editingEvent.tags || [], updatedEvent.tags || []);
    cancelEventNotification(editingEvent.id);
    if (updatedEvent.alertType && updatedEvent.alertType !== 'none') {
      scheduleEventNotification(updatedEvent);
    }

    toast.success(say('toastUpdated', 'events'));
    
    setEditingEvent(null);
  };

  // Get current period based on view mode
  const currentPeriod = useMemo(() => {
    if (viewMode === 'daily') {
      return format(currentDate, 'EEEE, MMM d, yyyy', { locale: dateLocale });
    } else if (viewMode === 'weekly') {
      const start = startOfWeek(currentDate, { weekStartsOn });
      const end = endOfWeek(currentDate, { weekStartsOn });
      return `${format(start, 'MMM d', { locale: dateLocale })} - ${format(end, 'MMM d, yyyy', { locale: dateLocale })}`;
    } else {
      return format(currentDate, 'MMMM yyyy', { locale: dateLocale });
    }
  }, [currentDate, viewMode, weekStartsOn, dateLocale]);

  // Weekly view data
  const weekStart = startOfWeek(currentDate, { weekStartsOn });
  const weekDays = eachDayOfInterval({ start: weekStart, end: addDays(weekStart, 6) });
  const filteredWeekDays = weekDays.filter(day => {
    if (!searchQuery.trim()) return true;
    const dayEvents = filterEvents(getEventsForDate(day));
    return dayEvents.length > 0;
  });

  // Monthly view data
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  const selectedDayEvents = selectedDate ? filterEvents(getEventsForDate(selectedDate)) : [];

  // Determine if we need to show the Today button
  const showTodayButton = useMemo(() => {
    const today = new Date();
    if (viewMode === 'daily') {
      return !isSameDay(currentDate, today);
    } else if (viewMode === 'weekly') {
      return !isSameWeek(currentDate, today, { weekStartsOn });
    } else {
      return !isSameMonth(currentDate, today);
    }
  }, [currentDate, viewMode, weekStartsOn]);

  return (    <Layout swipeHandlers={swipeHandlers} 
      showSearch={true}
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      pageTitle={t('calendar')}
      shieldHeight="11.5rem"
    >
      <div>
        {/* Tab navigation - matches Notes/Events layout */}
        <div className="fixed top-16 left-0 right-0 z-40 px-2">
          <div className="flex items-center justify-between py-2">
          <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as ViewMode)}>
            <SlidingTabsList 
              activeValue={viewMode} 
              values={['daily', 'weekly', 'monthly']}
            >
              <TabsTrigger value="daily">{t('dayView')}</TabsTrigger>
              <TabsTrigger value="weekly">{t('weekView')}</TabsTrigger>
              <TabsTrigger value="monthly">{t('monthView')}</TabsTrigger>
            </SlidingTabsList>
          </Tabs>
          
          {showTodayButton && (
            /*
             * A Button, not a span with `cursor-pointer`. As a span it was not focusable
             * from the keyboard and had no hover feedback at all, so nothing marked it as
             * clickable. `hover:bg-hover` is the same veil every other control uses.
             */
            <Button
              variant="ghostStatic"
              size="sm"
              onClick={goToToday}
              className="h-8 px-3 text-sm font-bold text-foreground rounded-full hover:bg-hover hover:text-foreground"
            >
              {t('today')}
            </Button>
          )}
          </div>

          {/* Navigation Card - fixed as part of static section */}
          <Card>
            <CardContent className="px-2 py-2">
              <div className="flex items-center justify-between">
                <Button aria-label={t('previous')} variant="ghost" size="icon" className="text-foreground hover:bg-hover hover:text-foreground rounded-full [&_svg]:!size-5" onClick={goToPrevious} onMouseDown={(e) => e.currentTarget.blur()}>
                  <ChevronLeft size={24} />
                </Button>
                
                <div className="text-center">
                  <h2 className="text-lg font-semibold">{currentPeriod}</h2>
                </div>
                
                <Button aria-label={t('next')} variant="ghost" size="icon" className="text-foreground hover:bg-hover hover:text-foreground rounded-full [&_svg]:!size-5" onClick={goToNext} onMouseDown={(e) => e.currentTarget.blur()}>
                  <ChevronRight size={24} />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="h-[7.5rem]"></div>

        {/* Calendar content - Daily view */}
        {viewMode === 'daily' && (
          <div className="mt-2">
          <CalendarDayView
            currentDate={currentDate}
            events={filterEvents(getEventsForDate(currentDate))}
            searchQuery={searchQuery}
            onViewEvent={handleViewEvent}
          />
          </div>
        )}

        {/* Calendar content - Weekly view */}
        {viewMode === 'weekly' && (
          <div className="space-y-2 mt-2">
            {filteredWeekDays.map(day => {
              const dayEvents = filterEvents(getEventsForDate(day));
              // The full day name here, not the abbreviation: this is a per-day heading with
              // room for it. The month grid uses the short keys.
              const dayOfWeek = t(DAY_NAME_KEYS[day.getDay()]);
              const dayOfMonth = format(day, 'd');
              
              return (
                <Card key={day.toISOString()} className={cn(
                  "transition-all",
                  isToday(day) && "ring-2 ring-primary"
                )}>
                  <CardHeader className="px-2 py-2">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-lg">{dayOfWeek}</h3>
                      <span className={cn(
                        "text-2xl font-bold",
                        isToday(day) ? "text-primary" : "text-muted-foreground"
                      )}>
                        {dayOfMonth}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="px-2 pb-2 pt-0">
                    {dayEvents.length === 0 ? (
                      <p className="text-sm text-muted-foreground">{t('noEvents')}</p>
                    ) : (
                      <div className="space-y-2">
                        {[...dayEvents].sort((a, b) => {
                          // All-day events first
                          if (a.isAllDay && !b.isAllDay) return -1;
                          if (!a.isAllDay && b.isAllDay) return 1;
                          // Events without time second
                          const aHasTime = a.startTime && !a.isAllDay;
                          const bHasTime = b.startTime && !b.isAllDay;
                          if (!aHasTime && bHasTime) return -1;
                          if (aHasTime && !bHasTime) return 1;
                          // If both have time, sort by time
                          if (aHasTime && bHasTime) {
                            return (a.startTime || '').localeCompare(b.startTime || '');
                          }
                          return 0;
                        }).map(event => (
                          <CalendarEventItem 
                            key={event.id} 
                            event={event} 
                            searchQuery={searchQuery}
                            compact
                            onClick={() => handleViewEvent(event)}
                          />
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Calendar content - Monthly view */}
        {viewMode === 'monthly' && (
          <div className="space-y-2 mt-2">
            {/* Calendar Grid */}
            <Card className="overflow-hidden">
              <CardContent className="p-0">
                {/* Week day headers */}
                <div className="grid grid-cols-7 border-b">
                  {orderedDayNames.map((day, index) => (
                    <div key={index} className="border-r last:border-r-0 py-2 text-center text-sm font-medium text-muted-foreground">
                      {day}
                    </div>
                  ))}
                </div>
                
                {/* Calendar days */}
                <div
                  className="grid grid-cols-7"
                  style={{
                    gridTemplateRows: `repeat(${calendarDays.length / 7}, minmax(0, 1fr))`,
                    height: 'calc(100dvh - 19rem)',
                    minHeight: '18rem',
                  }}
                >
                  {calendarDays.map(day => {
                    const dayEvents = filterEvents(getEventsForDate(day));
                    const hasEvents = dayEvents.length > 0;
                    const isCurrentMonth = isSameMonth(day, currentDate);
                    const isSelected = selectedDate && isSameDay(day, selectedDate);
                    
                    return (
                      <button
                        key={day.toISOString()}
                        onClick={() => setSelectedDate(day)}
                        onMouseDown={(e) => e.currentTarget.blur()}
                        className={cn(
                          "relative flex min-h-0 items-start justify-start border-b border-r p-2 text-sm text-left transition-colors last:border-r-0",
                          "focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary",
                          isCurrentMonth ? "text-foreground" : "text-muted-foreground",
                          isToday(day) && "font-bold",
                          isSelected && !isToday(day) && "bg-muted",
                          
                        )}
                      >
                        <span className={cn(
                          "flex size-7 shrink-0 items-center justify-center rounded-full",
                          isToday(day) && "bg-black text-white",
                          isSelected && !isToday(day) && "ring-2 ring-primary",
                        )}>{format(day, 'd')}</span>
                        {hasEvents && (
                          <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2 flex gap-0.5">
                            {dayEvents.slice(0, 3).map((event, idx) => {
                              const hasColor = event.color && event.color !== '#FFFFFF';
                              return (
                                <div 
                                  key={idx}
                                  className={cn("w-1.5 h-1.5 rounded-full", !hasColor && "bg-primary")}
                                  style={hasColor ? { backgroundColor: event.color } : undefined}
                                />
                              );
                            })}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
            
            {/* Selected day events */}
            {selectedDate && (
              <Card>
                <CardHeader className="px-2 py-2">
                  <CardTitle className="text-lg">
                    {format(selectedDate, 'EEEE, MMMM d, yyyy', { locale: dateLocale })}
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-2 pb-2 pt-0">
                  {selectedDayEvents.length === 0 ? (
                    <p className="text-muted-foreground">{t('noEventsThisDay')}</p>
                  ) : (
                    <div className="space-y-2">
                      {[...selectedDayEvents].sort((a, b) => {
                        // All-day events first
                        if (a.isAllDay && !b.isAllDay) return -1;
                        if (!a.isAllDay && b.isAllDay) return 1;
                        // Events without time second
                        const aHasTime = a.startTime && !a.isAllDay;
                        const bHasTime = b.startTime && !b.isAllDay;
                        if (!aHasTime && bHasTime) return -1;
                        if (aHasTime && !bHasTime) return 1;
                        // If both have time, sort by time
                        if (aHasTime && bHasTime) {
                          return (a.startTime || '').localeCompare(b.startTime || '');
                        }
                        return 0;
                      }).map(event => (
                        <CalendarEventItem 
                          key={event.id} 
                          event={event} 
                          searchQuery={searchQuery}
                          onClick={() => handleViewEvent(event)}
                        />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>

      {/* Event Viewer Popup */}
      <EventViewer
        event={viewingEvent}
        isOpen={!!viewingEvent}
        onClose={() => setViewingEvent(null)}
        onEdit={handleEditEvent}
        onDelete={handleDeleteEvent}
      />

      {/* Event Editor Dialog */}
      <EventEditor
        isOpen={!!editingEvent}
        onClose={() => setEditingEvent(null)}
        onSave={handleSaveEvent}
        initialEvent={editingEvent}
        mode="edit"
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmationDialog
        open={!!deletingEvent}
        onOpenChange={(open) => !open && setDeletingEvent(null)}
        title={t('deleteEventTitle')}
        description={t('confirmDeleteBody')}
        onConfirm={confirmDeleteEvent}
        onCancel={() => setDeletingEvent(null)}
        action="delete"
      />
    </Layout>
  );
}
