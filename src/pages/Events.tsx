import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, FolderOpen, Calendar, FileStack } from 'lucide-react';
import { EventViewSettings, ViewType, EventSortType, EventSortDirection } from '@/components/events/EventViewSettings';
import { EventFolderViewSettings, EventFolderSortType, EventFolderSortDirection } from '@/components/events/EventFolderViewSettings';
import { Layout } from '@/components/Layout';
import { FolderMembershipProvider, collectFiledIds } from '@/contexts/FolderMembershipContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, SlidingTabsList, TabsTrigger } from '@/components/ui/tabs';
import { ConfirmationDialog } from '@/components/shared/ConfirmationDialog';
import { FolderActionDialog } from '@/components/shared/FolderActionDialog';
import { useFolderActions } from '@/hooks/useFolderActions';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { Event } from '@/types/event';
import { EventFolder } from '@/types/eventFolder';
import { useToastSettings } from '@/contexts/ToastContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { nextCopyName } from '@/lib/copyName';
import { countedSentence, itemDisplayName, namedSentence } from '@/lib/countedMessage';
import { EventCard } from '@/components/events/EventCard';
import { EventFolderCard } from '@/components/events/EventFolderCard';
import { EventFolderCreator } from '@/components/events/EventFolderCreator';
import { EventFolderEditor } from '@/components/events/EventFolderEditor';
import { EventEditor } from '@/components/events/EventEditor';
import { MoveToFolderDialog } from '@/components/shared/MoveToFolderDialog';
import { parseSearchExpression, matchesSearchExpression } from '@/lib/tagParser';
import { updateTagUsage } from '@/lib/tagStorage';
import { autoImportEventToFolders } from '@/lib/folderAutoImport';
import { useSwipeGesture } from '@/hooks/useSwipeGesture';
import { useBulkSelection } from '@/hooks/useBulkSelection';
import { BulkActionBar, BulkActionType, BulkActionContext } from '@/components/shared/BulkActionBar';
import { useScrollDirection } from '@/hooks/useScrollDirection';
import { cn } from '@/lib/utils';
import { 
  scheduleEventNotification, 
  cancelEventNotification, 
  scheduleAllEventNotifications,
  requestNotificationPermission 
} from '@/lib/notificationService';

// Tab order for swipe navigation. Module-level so its identity is stable across
// renders; declared inside the component it was rebuilt every render, which made it
// unsafe to list as a useCallback dependency.
const EVENT_TABS = ['all-events', 'folders', 'archived'];

export default function Events() {
  const { toast } = useToastSettings();
  const [events, setEvents] = useLocalStorage<Event[]>('events', []);
  const [archivedEvents, setArchivedEvents] = useLocalStorage<Event[]>('archivedEvents', []);
  const [eventFolders, setEventFolders] = useLocalStorage<EventFolder[]>('eventFolders', []);
  const [archivedEventFolders, setArchivedEventFolders] = useLocalStorage<EventFolder[]>('archivedEventFolders', []);

  // Latest eventFolders for the auto-archive effect, which must read them without
  // depending on them (it writes to the same state, so a dependency would loop).
  const eventFoldersRef = useRef(eventFolders);
  eventFoldersRef.current = eventFolders;
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [selectedEventFolder, setSelectedEventFolder] = useState<EventFolder | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all-events');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{type: 'event' | 'eventFolder', id: string} | null>(null);
  const [itemToArchive, setItemToArchive] = useState<{type: 'event' | 'eventFolder', id: string} | null>(null);

  /*
   * Archiving, deleting and restoring a folder is shared with the notes and habits pages — see
   * `useFolderActions`. This page had drifted furthest: deleting a folder here deleted the
   * folder alone and left its events in place, without saying so, while the notes page deleted
   * the events' equivalents with it.
   */
  const folderActions = useFolderActions<Event, EventFolder>({
    itemKind: 'event',
    itemIdsOf: (folder) => folder.eventIds,
    withItemIds: (folder, eventIds) => ({ ...folder, eventIds }),
    items: events,
    setItems: setEvents,
    archivedItems: archivedEvents,
    setArchivedItems: setArchivedEvents,
    folders: eventFolders,
    setFolders: setEventFolders,
    archivedFolders: archivedEventFolders,
    setArchivedFolders: setArchivedEventFolders,
    // An event archived on its own remembers the folder it came from; once it is back in the
    // list that memory is what the archived folder's own ids are for, so it is dropped.
    markItem: (event, archived) => {
      if (archived) return event;
      const { originalFolderId, ...restored } = event;
      return restored;
    },
  });

  const [isEventFolderCreatorOpen, setIsEventFolderCreatorOpen] = useState(false);
  const [isEventFolderEditorOpen, setIsEventFolderEditorOpen] = useState(false);
  const [isMoveToEventFolderOpen, setIsMoveToEventFolderOpen] = useState(false);
  const [selectedEventForMove, setSelectedEventForMove] = useState<string | null>(null);
  const [selectedEventsForMove, setSelectedEventsForMove] = useState<string[] | null>(null);
  const [allEventsViewType, setAllEventsViewType] = useLocalStorage<ViewType>('eventsAllViewType', 'list');
  const [archivedEventsViewType, setArchivedEventsViewType] = useLocalStorage<ViewType>('eventsArchivedViewType', 'list');
  
  // Computed viewType based on active tab for backward compatibility
  const viewType = activeTab === 'archived' ? archivedEventsViewType : allEventsViewType;
  const setViewType = activeTab === 'archived' ? setArchivedEventsViewType : setAllEventsViewType;
  const [allEventsSortType, setAllEventsSortType] = useLocalStorage<EventSortType>('eventsAllSortType', 'daysRemaining');
  const [allEventsSortDirection, setAllEventsSortDirection] = useLocalStorage<EventSortDirection>('eventsAllSortDirection', 'asc');
  const [archivedEventsSortType, setArchivedEventsSortType] = useLocalStorage<EventSortType>('eventsArchivedSortType', 'daysRemaining');
  const [archivedEventsSortDirection, setArchivedEventsSortDirection] = useLocalStorage<EventSortDirection>('eventsArchivedSortDirection', 'asc');
  
  // Computed sort values based on active tab
  const sortType = activeTab === 'archived' ? archivedEventsSortType : allEventsSortType;
  const setSortType = activeTab === 'archived' ? setArchivedEventsSortType : setAllEventsSortType;
  const sortDirection = activeTab === 'archived' ? archivedEventsSortDirection : allEventsSortDirection;
  const setSortDirection = activeTab === 'archived' ? setArchivedEventsSortDirection : setAllEventsSortDirection;
  const [folderSortType, setFolderSortType] = useLocalStorage<EventFolderSortType>('eventFoldersSortType', 'title');
  const [folderSortDirection, setFolderSortDirection] = useLocalStorage<EventFolderSortDirection>('eventFoldersSortDirection', 'asc');
  
  // Bulk selection state
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [bulkArchiveDialogOpen, setBulkArchiveDialogOpen] = useState(false);
  const [pendingBulkAction, setPendingBulkAction] = useState<{ ids: string[], action: 'archive' | 'delete' } | null>(null);
  const [pendingBulkFolderAction, setPendingBulkFolderAction] = useState<{
    kind: 'archive' | 'delete';
    folderIds: string[];
    selectedItemIds: string[];
  } | null>(null);

  // Bulk selection hook
  const {
    isBulkMode,
    selectedItems,
    toggleBulkMode,
    toggleItem,
    toggleAll,
    clearSelection,
    isAllSelected,
    exitBulkMode,
  } = useBulkSelection();

  // Scroll direction for hiding Add button
  const scrollDirection = useScrollDirection();

  // Check if any dialog/editor is open - blocks swipe navigation
  const isAnyDialogOpen = isAddDialogOpen || !!selectedEvent || isEventFolderCreatorOpen || 
    isEventFolderEditorOpen || isMoveToEventFolderOpen || deleteDialogOpen || archiveDialogOpen ||
    bulkDeleteDialogOpen || bulkArchiveDialogOpen || folderActions.dialog.open;

  // Tab swipe navigation
  const handleSwipeLeft = useCallback(() => {
    if (isAnyDialogOpen) return;
    const currentIndex = EVENT_TABS.indexOf(activeTab);
    if (currentIndex < EVENT_TABS.length - 1) {
      setActiveTab(EVENT_TABS[currentIndex + 1]);
    }
  }, [activeTab, isAnyDialogOpen]);

  const handleSwipeRight = useCallback(() => {
    if (isAnyDialogOpen) return;
    const currentIndex = EVENT_TABS.indexOf(activeTab);
    if (currentIndex > 0) {
      setActiveTab(EVENT_TABS[currentIndex - 1]);
    }
  }, [activeTab, isAnyDialogOpen]);

  const swipeHandlers = useSwipeGesture({
    onSwipeLeft: handleSwipeLeft,
    onSwipeRight: handleSwipeRight,
    threshold: 50,
  });

  // Auto-archive past events on component mount and when events change.
  // `eventFolders` is read through a ref: the effect also WRITES to eventFolders via
  // setEventFolders, so listing it as a dependency would make the effect retrigger
  // itself. The ref keeps the read current without creating that loop, and `toast` is
  // memoised on toastsEnabled so it is safe to depend on.
  useEffect(() => {
    const autoArchivePastEvents = () => {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      const pastEvents = events.filter(event => {
        if (event.isRecurrent) return false; // Don't auto-archive recurring events
        const eventDateStr = event.startDate || event.date;
        if (!eventDateStr) return false;
        const eventDate = new Date(eventDateStr);
        const eventDateOnly = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());
        return eventDateOnly < today; // Events before today
      });

      if (pastEvents.length > 0) {
        // Store originalFolderId for each auto-archived event
        const currentFolders = eventFoldersRef.current;
        const eventsWithFolderIds = pastEvents.map(event => {
          const originalFolder = currentFolders.find(folder => folder.eventIds.includes(event.id));
          return {
            ...event,
            originalFolderId: originalFolder?.id
          };
        });
        // Move past events to archived with folder associations preserved
        setArchivedEvents((prev: Event[]) => [...prev, ...eventsWithFolderIds]);
        setEvents((prev: Event[]) => prev.filter(event => !pastEvents.some(pastEvent => pastEvent.id === event.id)));
        
        // Remove from all folders
        setEventFolders((prev: EventFolder[]) => 
          prev.map(folder => ({
            ...folder,
            eventIds: folder.eventIds.filter(id => !pastEvents.some(pastEvent => pastEvent.id === id))
          }))
        );

        toast.success(say('toastArchived', 'events'));
      }
    };

    autoArchivePastEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `say` closes over the language context and is rebuilt every render, so listing it would re-run this effect on every pass
  }, [events, setEvents, setArchivedEvents, setEventFolders, toast]);

  // Request notification permission and schedule notifications on mount.
  // Intentionally mount-only: re-running whenever `events` changes would re-request
  // permission and re-schedule every notification on each edit, which can duplicate
  // pending notifications. New and edited events are scheduled by their own handlers.
  useEffect(() => {
    const initNotifications = async () => {
      await requestNotificationPermission();
      // Schedule notifications for all events with alerts
      const eventsWithAlerts = events.filter(e => e.alertType && e.alertType !== 'none');
      if (eventsWithAlerts.length > 0) {
        await scheduleAllEventNotifications(eventsWithAlerts);
      }
    };
    initNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only by design, see note above
  }, []);


  const calculateTimeRemaining = (event: Event) => {
    const eventDateStr = event.startDate || event.date;
    if (!eventDateStr) return 999999;
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const eventDate = new Date(eventDateStr);
    const eventDateOnly = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());
    
    if (event.isRecurrent) {
      const nextOccurrence = new Date(eventDateOnly);
      const interval = event.recurrenceInterval || 1;
      
      if (nextOccurrence.getTime() === today.getTime()) return 0;
      
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
      return Math.round((nextOccurrence.getTime() - today.getTime()) / (1000 * 3600 * 24));
    } else {
      return Math.round((eventDateOnly.getTime() - today.getTime()) / (1000 * 3600 * 24));
    }
  };

  const handleCreateEvent = (eventData: Omit<Event, 'id' | 'createdAt'>) => {
    const tags = eventData.tags || [];
    
    const newEvent: Event = {
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      ...eventData
    };

    // Check if the event is for a past date (and not recurring)
    const eventDateStr = eventData.startDate || eventData.date;
    if (!eventData.isRecurrent && eventDateStr) {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const eventDate = new Date(eventDateStr);
      const eventDateOnly = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());
      
      if (eventDateOnly < today) {
        setArchivedEvents((prev: Event[]) => [...prev, newEvent]);
        setIsAddDialogOpen(false);
        toast.success(say('toastAddedToArchive', 'events'));
        return;
      }
    }

    // Add to active events for current/future dates or recurring events
    setEvents((prev: Event[]) => {
      const newEvents = [...prev, newEvent];
      return newEvents.sort((a, b) => calculateTimeRemaining(a) - calculateTimeRemaining(b));
    });

    // Update tag usage tracking
    if (tags.length > 0) {
      updateTagUsage([], tags);
    }

    // Auto-import into matching folders
    setEventFolders((prev: EventFolder[]) => autoImportEventToFolders(newEvent, prev));

    // Schedule notification if alert is set
    if (newEvent.alertType && newEvent.alertType !== 'none') {
      scheduleEventNotification(newEvent);
    }

    setIsAddDialogOpen(false);
    toast.success(say('toastAdded', 'events'));
  };

  const handleUpdateEvent = (eventData: Omit<Event, 'id' | 'createdAt'>) => {
    if (!selectedEvent) return;
    
    const tags = eventData.tags || [];
    const oldTags = selectedEvent.tags || [];
    
    const updatedEvent: Event = {
      ...selectedEvent,
      ...eventData
    };

    // Update tag usage tracking
    updateTagUsage(oldTags, tags);

    // Auto-import into matching folders if tags changed
    if (JSON.stringify(oldTags.sort()) !== JSON.stringify(tags.sort())) {
      setEventFolders((prev: EventFolder[]) => autoImportEventToFolders(updatedEvent, prev));
    }

    // Check if event exists in active events
    const eventInActive = events.find(event => event.id === selectedEvent.id);
    
    if (eventInActive) {
      setEvents((prev: Event[]) => prev.map(event => 
        event.id === selectedEvent.id ? updatedEvent : event
      ));
    } else {
      const eventInArchived = archivedEvents.find(event => event.id === selectedEvent.id);
      
      if (eventInArchived) {
        if (eventData.isRecurrent) {
          setArchivedEvents((prev: Event[]) => prev.filter(event => event.id !== selectedEvent.id));
          setEvents((prev: Event[]) => {
            const newEvents = [...prev, updatedEvent];
            return newEvents.sort((a, b) => calculateTimeRemaining(a) - calculateTimeRemaining(b));
          });
        } else {
          setArchivedEvents((prev: Event[]) => prev.map(event => 
            event.id === selectedEvent.id ? updatedEvent : event
          ));
        }
      }
    }

    // Update notification scheduling
    // Cancel existing notification and reschedule if alert settings changed
    cancelEventNotification(selectedEvent.id);
    if (updatedEvent.alertType && updatedEvent.alertType !== 'none') {
      scheduleEventNotification(updatedEvent);
    }

    setSelectedEvent(null);
    toast.success(say('toastUpdated', 'events'));
  };


  const deleteEvent = (eventId: string) => {
    setItemToDelete({ type: 'event', id: eventId });
    setDeleteDialogOpen(true);
  };

  const confirmDeleteEvent = (eventId: string) => {
    // Get event tags for cleanup
    const eventToDelete = [...events, ...archivedEvents].find(e => e.id === eventId);
    if (eventToDelete?.tags) {
      updateTagUsage(eventToDelete.tags, []);
    }

    // Remove event from all folders when deleted
    setEventFolders((prev: EventFolder[]) => 
      prev.map(folder => ({
        ...folder,
        eventIds: folder.eventIds.filter(id => id !== eventId)
      }))
    );
    setArchivedEventFolders((prev: EventFolder[]) => 
      prev.map(folder => ({
        ...folder,
        eventIds: folder.eventIds.filter(id => id !== eventId)
      }))
    );
    // Cancel any scheduled notification
    cancelEventNotification(eventId);
    
    // Permanently delete from all lists
    setEvents((prev: Event[]) => prev.filter(event => event.id !== eventId));
    setArchivedEvents((prev: Event[]) => prev.filter(event => event.id !== eventId));
    setSelectedEvent(null);
    toast.success(say('toastDeleted', 'events'));
  };


  const unarchiveEvent = (eventId: string) => {
    const eventToUnarchive = archivedEvents.find(event => event.id === eventId);
    if (eventToUnarchive) {
      // Remove originalFolderId before restoring to events
      const { originalFolderId, ...restoredEvent } = eventToUnarchive;
      
      setEvents((prev: Event[]) => {
        const newEvents = [...prev, restoredEvent];
        // Sort by time remaining (closest events first)
        return newEvents.sort((a, b) => {
          const calculateTimeRemaining = (event: Event) => {
            const eventDateStr = event.startDate || event.date;
            if (!eventDateStr) return 999999;
            
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const eventDate = new Date(eventDateStr);
            const eventDateOnly = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());
            
            if (event.isRecurrent) {
              // For recurring events, find the next occurrence based on recurrence type
              const nextOccurrence = new Date(eventDateOnly);
              const interval = event.recurrenceInterval || 1;
              
              // If today is the event date, return 0
              if (nextOccurrence.getTime() === today.getTime()) {
                return 0;
              }
              
              // Calculate next occurrence based on recurrence type
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
              return Math.round(timeDiff / (1000 * 3600 * 24));
            } else {
              const timeDiff = eventDateOnly.getTime() - today.getTime();
              return Math.round(timeDiff / (1000 * 3600 * 24));
            }
          };
          
          const timeRemainingA = calculateTimeRemaining(a);
          const timeRemainingB = calculateTimeRemaining(b);
          
          return timeRemainingA - timeRemainingB;
        });
      });
      setArchivedEvents((prev: Event[]) => prev.filter(event => event.id !== eventId));
      
      // If the event had an original folder, restore association
      if (originalFolderId) {
        const originalFolderInActive = eventFolders.some(folder => folder.id === originalFolderId);
        const originalFolderInArchived = archivedEventFolders.some(folder => folder.id === originalFolderId);
        
        if (originalFolderInActive) {
          // Folder is active - add event to it
          setEventFolders((prev: EventFolder[]) => prev.map(folder =>
            folder.id === originalFolderId 
              ? { ...folder, eventIds: [...folder.eventIds, eventId] }
              : folder
          ));
        } else if (originalFolderInArchived) {
          // Folder is archived - update archived folder's eventIds
          // so connection is preserved when folder is later restored
          setArchivedEventFolders((prev: EventFolder[]) => prev.map(folder =>
            folder.id === originalFolderId 
              ? { ...folder, eventIds: [...folder.eventIds, eventId] }
              : folder
          ));
        }
      }
    }
    setSelectedEvent(null);
    toast.success(say('toastRestored', 'events'));
  };


  const copyEvent = (eventId: string) => {
    const eventToCopy = events.find(event => event.id === eventId) || archivedEvents.find(event => event.id === eventId);
    if (eventToCopy) {
      const copiedEvent: Event = {
        ...eventToCopy,
        id: Date.now().toString(),
        name: nextCopyName(eventToCopy.name, [...events, ...archivedEvents].map(e => e.name)),
        createdAt: new Date().toISOString()
      };
      setEvents((prev: Event[]) => {
        const newEvents = [...prev, copiedEvent];
        // Sort by time remaining (closest events first)
        return newEvents.sort((a, b) => {
          const calculateTimeRemaining = (event: Event) => {
            const eventDateStr = event.startDate || event.date;
            if (!eventDateStr) return 999999;
            
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const eventDate = new Date(eventDateStr);
            const eventDateOnly = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());
            
            if (event.isRecurrent) {
              // For recurring events, find the next occurrence based on recurrence type
              const nextOccurrence = new Date(eventDateOnly);
              const interval = event.recurrenceInterval || 1;
              
              // If today is the event date, return 0
              if (nextOccurrence.getTime() === today.getTime()) {
                return 0;
              }
              
              // Calculate next occurrence based on recurrence type
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
              return Math.round(timeDiff / (1000 * 3600 * 24));
            } else {
              const timeDiff = eventDateOnly.getTime() - today.getTime();
              return Math.round(timeDiff / (1000 * 3600 * 24));
            }
          };
          
          const timeRemainingA = calculateTimeRemaining(a);
          const timeRemainingB = calculateTimeRemaining(b);
          
          return timeRemainingA - timeRemainingB;
        });
      });
      toast.success(say('toastCopied', 'events'));
    }
  };

  // Event folder management functions
  const addEventFolder = (folderData: Omit<EventFolder, 'id' | 'createdAt' | 'eventIds'>, eventIdsToMove?: string[]) => {
    const newFolder: EventFolder = {
      ...folderData,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      eventIds: eventIdsToMove || []
    };
    setEventFolders((prev: EventFolder[]) => {
      const idsToMove = new Set(eventIdsToMove || []);
      const cleaned = idsToMove.size > 0
        ? prev.map(f => ({ ...f, eventIds: f.eventIds.filter(id => !idsToMove.has(id)) }))
        : prev;
      return [...cleaned, newFolder];
    });
    toast.success(say('toastAdded', 'tabFolders'));
  };

  const updateEventFolder = (folderData: Omit<EventFolder, 'id' | 'createdAt' | 'eventIds'>) => {
    if (!selectedEventFolder) return;
    setEventFolders((prev: EventFolder[]) => prev.map(folder => 
      folder.id === selectedEventFolder.id 
        ? { 
            ...folder, 
            name: folderData.name,
            description: folderData.description,
            color: folderData.color,
            pinned: folderData.pinned,
            archived: folderData.archived
          }
        : folder
    ));
    setSelectedEventFolder(null);
    setIsEventFolderEditorOpen(false);
    toast.success(say('toastUpdated', 'tabFolders'));
  };

  const pinEventFolder = (folderId: string) => {
    setEventFolders((prev: EventFolder[]) => prev.map(folder => 
      folder.id === folderId ? { ...folder, pinned: true } : folder
    ));
    toast.success(say('toastPinned', 'tabFolders'));
  };

  const unpinEventFolder = (folderId: string) => {
    setEventFolders((prev: EventFolder[]) => prev.map(folder => 
      folder.id === folderId ? { ...folder, pinned: false } : folder
    ));
    toast.success(say('toastUnpinned', 'tabFolders'));
  };

  const editEventFolder = (folderId: string) => {
    const folder = eventFolders.find(f => f.id === folderId);
    if (folder) {
      setSelectedEventFolder(folder);
      setIsEventFolderEditorOpen(true);
    }
  };



  const copyEventFolder = (folderId: string) => {
    const folderToCopy = eventFolders.find(folder => folder.id === folderId);
    if (folderToCopy) {
      const copiedFolder: EventFolder = {
        ...folderToCopy,
        id: Date.now().toString(),
        name: nextCopyName(folderToCopy.name, eventFolders.map(f => f.name)),
        createdAt: new Date().toISOString(),
        eventIds: [], // Don't copy the events
        pinned: false
      };
      setEventFolders((prev: EventFolder[]) => [...prev, copiedFolder]);
      toast.success(say('toastCopied', 'tabFolders'));
    }
  };

  const moveEventToFolder = (eventId: string, folderId: string) => {
    // Remove event from all folders and add to selected folder in a single update
    setEventFolders((prev: EventFolder[]) => 
      prev.map(folder => {
        if (folder.id === folderId) {
          // Add event to target folder (avoid duplicates)
          return {
            ...folder,
            eventIds: folder.eventIds.includes(eventId) ? folder.eventIds : [...folder.eventIds, eventId]
          };
        } else {
          // Remove event from all other folders
          return {
            ...folder,
            eventIds: folder.eventIds.filter(id => id !== eventId)
          };
        }
      })
    );

    toast.success(say('toastUpdated', 'events'));
  };

  const handleMoveToEventFolder = (eventId: string) => {
    setSelectedEventForMove(eventId);
    setIsMoveToEventFolderOpen(true);
  };

  const handleEventFolderSelect = (folderId: string) => {
    // Handle bulk move
    if (selectedEventsForMove && selectedEventsForMove.length > 0) {
      const idsSet = new Set(selectedEventsForMove);
      setEventFolders((prev: EventFolder[]) => 
        prev.map(folder => {
          if (folder.id === folderId) {
            const existingIds = new Set(folder.eventIds);
            const newEventIds = [...folder.eventIds, ...selectedEventsForMove.filter(id => !existingIds.has(id))];
            return { ...folder, eventIds: newEventIds };
          } else {
            return { ...folder, eventIds: folder.eventIds.filter(id => !idsSet.has(id)) };
          }
        })
      );
      toast.success(say('toastUpdated', 'events'));
      setSelectedEventsForMove(null);
      setIsMoveToEventFolderOpen(false);
      return;
    }
    
    // Handle single move
    if (selectedEventForMove) {
      moveEventToFolder(selectedEventForMove, folderId);
      setSelectedEventForMove(null);
      setIsMoveToEventFolderOpen(false);
    }
  };

  const handleCreateEventFolderFromDialog = () => {
    setIsMoveToEventFolderOpen(false);
    setIsEventFolderCreatorOpen(true);
  };

  const handleSaveEventFolder = (folderData: Omit<EventFolder, 'id' | 'createdAt' | 'eventIds'>, eventIdsToMove?: string[]) => {
    addEventFolder(folderData, eventIdsToMove);
    if (eventIdsToMove?.length) {
      clearSelection();
      exitBulkMode();
    }
    setSelectedEventForMove(null);
    setSelectedEventsForMove(null);
  };


  const confirmArchiveEvent = (eventId: string) => {
    setItemToArchive({ type: 'event', id: eventId });
    setArchiveDialogOpen(true);
  };

  const performArchiveEvent = (eventId: string) => {
    const eventToArchive = events.find(event => event.id === eventId);
    if (eventToArchive) {
      // Find which folder this event belongs to (if any)
      const originalFolder = eventFolders.find(folder => folder.eventIds.includes(eventId));
      const originalFolderId = originalFolder?.id;
      
      // Archive the event with original folder ID stored
      const archivedEvent = {
        ...eventToArchive,
        originalFolderId: originalFolderId
      };
      
      // Remove event from all folders when archived
      setEventFolders((prev: EventFolder[]) => 
        prev.map(folder => ({
          ...folder,
          eventIds: folder.eventIds.filter(id => id !== eventId)
        }))
      );
      setArchivedEvents((prev: Event[]) => [...prev, archivedEvent]);
      setEvents((prev: Event[]) => prev.filter(event => event.id !== eventId));
    }
    setSelectedEvent(null);
    toast.success(say('toastArchived', 'events'));
  };

  const openEventDetails = (event: Event) => {
    setSelectedEvent(event);
  };

  // Search functionality
  //
  // Same shared evaluator as Notes, so `and`/`or` behave identically on both pages.
  // Events only search their own name and description.
  const searchInEvent = (event: Event, query: string): boolean => {
    const expression = parseSearchExpression(query);

    const matchesText = (term: string): boolean =>
      event.name.toLowerCase().includes(term) ||
      (event.description?.toLowerCase().includes(term) || false);

    return matchesSearchExpression(expression, event.tags, matchesText);
  };

  const filterEvents = (eventList: Event[]): Event[] => {
    if (!searchQuery.trim()) return eventList;
    return eventList.filter(event => searchInEvent(event, searchQuery));
  };

  /**
   * A folder answers a search when its own text does, or when anything filed in it does.
   *
   * The Folders tab had no folder search at all, so it kept every folder on screen while the
   * matching text was merely highlighted. The rule here is the one the notes page already
   * uses, extended to the archived events as well: a folder in the archive holds archived
   * events, and those are what a search of it has to reach.
   */
  const searchInEventFolder = (folder: EventFolder, query: string): boolean => {
    const searchTerm = query.toLowerCase();
    if (folder.name.toLowerCase().includes(searchTerm) ||
        (folder.description?.toLowerCase().includes(searchTerm) || false)) {
      return true;
    }

    const folderEvents = [...events, ...archivedEvents].filter(event => folder.eventIds.includes(event.id));
    return folderEvents.some(event => searchInEvent(event, query));
  };

  const filterEventFolders = (folderList: EventFolder[]): EventFolder[] => {
    if (!searchQuery.trim()) return folderList;
    return folderList.filter(folder => searchInEventFolder(folder, searchQuery));
  };

  // Pin/unpin events
  const pinEvent = (eventId: string) => {
    setEvents((prev: Event[]) => prev.map(event => 
      event.id === eventId ? { ...event, pinned: true } : event
    ));
    toast.success(say('toastPinned', 'events'));
  };

  const unpinEvent = (eventId: string) => {
    setEvents((prev: Event[]) => prev.map(event => 
      event.id === eventId ? { ...event, pinned: false } : event
    ));
    toast.success(say('toastUnpinned', 'events'));
  };

  // Filter events by category
  const getAllEvents = () => {
    // Show all events regardless of folder membership
    const filteredEvents = filterEvents(events);
    
    // Sort events based on sortType
    const sortedEvents = [...filteredEvents].sort((a, b) => {
      // Pinned events always come first
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      
      switch (sortType) {
        case 'title': {
          const result = a.name.localeCompare(b.name);
          return sortDirection === 'asc' ? result : -result;
        }
        case 'dateCreated': {
          const result = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          return sortDirection === 'asc' ? result : -result;
        }
        case 'dateModified': {
          // For now, use createdAt since we don't have modifiedAt field
          const result = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          return sortDirection === 'asc' ? result : -result;
        }
        case 'daysRemaining':
        default:
          const calculateTimeRemaining = (event: Event) => {
            const eventDateStr = event.startDate || event.date;
            if (!eventDateStr) return 999999;
            
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const eventDate = new Date(eventDateStr);
            const eventDateOnly = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());
            
            if (event.isRecurrent) {
              // For recurring events, find the next occurrence based on recurrence type
              const nextOccurrence = new Date(eventDateOnly);
              const interval = event.recurrenceInterval || 1;
              
              // If today is the event date, return 0
              if (nextOccurrence.getTime() === today.getTime()) {
                return 0;
              }
              
              // Calculate next occurrence based on recurrence type
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
              return Math.round(timeDiff / (1000 * 3600 * 24));
            } else {
              const timeDiff = eventDateOnly.getTime() - today.getTime();
              return Math.round(timeDiff / (1000 * 3600 * 24));
            }
          };
          
          const timeRemainingA = calculateTimeRemaining(a);
          const timeRemainingB = calculateTimeRemaining(b);
          
          const result = timeRemainingA - timeRemainingB;
          return sortDirection === 'asc' ? result : -result;
      }
    });
    
    return sortedEvents;
  };

  const getEventFolders = () => {
    return eventFolders
      .filter(folder => !folder.archived)
      .sort((a, b) => {
        // Pinned folders first
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        
        // Then sort by selected sort type
        switch (folderSortType) {
          case 'title': {
            const result = a.name.localeCompare(b.name);
            return folderSortDirection === 'asc' ? result : -result;
          }
          case 'dateCreated': {
            const result = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
            return folderSortDirection === 'asc' ? result : -result;
          }
          case 'dateModified': {
            // For now, use createdAt since we don't have modifiedAt field
            const result = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
            return folderSortDirection === 'asc' ? result : -result;
          }
          case 'daysRemaining': {
            // Sort by closest event in folder
            const aEvents = events.filter(event => a.eventIds.includes(event.id));
            const bEvents = events.filter(event => b.eventIds.includes(event.id));
            
            const getClosestEventTime = (folderEvents: Event[]) => {
              if (folderEvents.length === 0) return 999999;
              return Math.min(...folderEvents.map(event => {
                const eventDateStr = event.startDate || event.date;
                if (!eventDateStr) return 999999;
                const now = new Date();
                const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                const eventDate = new Date(eventDateStr);
                const eventDateOnly = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());
                const timeDiff = eventDateOnly.getTime() - today.getTime();
                return Math.round(timeDiff / (1000 * 3600 * 24));
              }));
            };
            
            const aTime = getClosestEventTime(aEvents);
            const bTime = getClosestEventTime(bEvents);
            const result = aTime - bTime;
            return folderSortDirection === 'asc' ? result : -result;
          }
          default:
            return a.name.localeCompare(b.name);
        }
      });
  };

  const handleAddButtonClick = () => {
    if (activeTab === 'folders') {
      setIsEventFolderCreatorOpen(true);
    } else {
      setSelectedEvent(null);
      setIsAddDialogOpen(true);
    }
  };

  const getEventsInFolder = (folderId: string) => {
    const folder = eventFolders.find(f => f.id === folderId);
    if (!folder) return [];
    
    const folderEvents = events.filter(event => folder.eventIds.includes(event.id));
    
    // Sort by time remaining (closest events first)
    const sortedEvents = folderEvents.sort((a, b) => {
      const calculateTimeRemaining = (event: Event) => {
        const eventDateStr = event.startDate || event.date;
        if (!eventDateStr) return 999999;
        
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const eventDate = new Date(eventDateStr);
        const eventDateOnly = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());
        
        if (event.isRecurrent) {
          // For recurring events, find the next occurrence based on recurrence type
          const nextOccurrence = new Date(eventDateOnly);
          const interval = event.recurrenceInterval || 1;
          
          // If today is the event date, return 0
          if (nextOccurrence.getTime() === today.getTime()) {
            return 0;
          }
          
          // Calculate next occurrence based on recurrence type
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
          return Math.round(timeDiff / (1000 * 3600 * 24));
        } else {
          const timeDiff = eventDateOnly.getTime() - today.getTime();
          return Math.round(timeDiff / (1000 * 3600 * 24));
        }
      };
      
      const timeRemainingA = calculateTimeRemaining(a);
      const timeRemainingB = calculateTimeRemaining(b);
      
      return timeRemainingA - timeRemainingB;
    });
    
    return filterEvents(sortedEvents);
  };

  const getPastEvents = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // Show archived events that were past events (non-recurring events that occurred before today)
    const filteredEvents = archivedEvents.filter(event => {
      if (event.isRecurrent) return false;
      const eventDateStr = event.startDate || event.date;
      if (!eventDateStr) return false;
      const eventDate = new Date(eventDateStr);
      const eventDateOnly = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate());
      return eventDateOnly < today;
    });
    
    return filterEvents(filteredEvents);
  };

  // Get current bulk context based on active tab
  const getBulkContext = (): BulkActionContext => {
    if (activeTab === 'archived') return 'archivedEvents';
    if (activeTab === 'folders') return 'eventFolders';
    return 'events';
  };

  // Helper functions for archived selection
  const getArchivedEventIds = (): string[] => archivedEvents.map(e => e.id);
  const getArchivedEventFolderIds = (): string[] => archivedEventFolders.map(f => f.id);

  // Computed selection states for archived tab
  const isAllArchivedEventsSelected = archivedEvents.length > 0 && 
    archivedEvents.every(e => selectedItems.has(e.id));
  const isAllArchivedEventFoldersSelected = archivedEventFolders.length > 0 && 
    archivedEventFolders.every(f => selectedItems.has(f.id));

  // Get all item IDs for current view
  const getAllItemIds = (): string[] => {
    if (activeTab === 'archived') {
      return [...archivedEvents.map(e => e.id), ...archivedEventFolders.map(f => f.id)];
    }
    if (activeTab === 'folders') {
      return eventFolders.map(f => f.id);
    }
    return filterEvents(events).map(e => e.id);
  };

  /**
   * What to call an item in a confirmation dialog.
   *
   * The dialog state holds only a type and an id, so the item is looked up here. Archived
   * collections are searched too, because the same dialogs are reached from the Archived
   * tab. `itemDisplayName` supplies the opening words of the body when there is no title.
   */
  const displayNameOf = (item: { type: 'event' | 'eventFolder'; id: string } | null): string => {
    if (!item) return t('untitledItem');
    if (item.type === 'event') {
      const found = events.find(e => e.id === item.id) ?? archivedEvents.find(e => e.id === item.id);
      return itemDisplayName(t, found ?? {});
    }
    const found = eventFolders.find(f => f.id === item.id) ?? archivedEventFolders.find(f => f.id === item.id);
    return itemDisplayName(t, found ?? {});
  };

  const finishBulkFolderAction = (
    pending: NonNullable<typeof pendingBulkFolderAction>,
    scope: 'folderOnly' | 'withItems',
  ) => {
    folderActions.applyBulkFolderAction(pending.kind, scope, pending.folderIds);
    if (pending.kind === 'delete' && pending.selectedItemIds.length > 0 && activeTab === 'archived') {
      const selectedIds = new Set(pending.selectedItemIds);
      setArchivedEvents(prev => prev.filter(event => !selectedIds.has(event.id)));
    }
    clearSelection();
    exitBulkMode();
    setPendingBulkFolderAction(null);
  };

  const requestBulkFolderAction = (kind: 'archive' | 'delete', ids: string[]): boolean => {
    if (activeTab !== 'folders' && activeTab !== 'archived') return false;
    const folderCollection = activeTab === 'archived' ? archivedEventFolders : eventFolders;
    const folderIds = ids.filter(id => folderCollection.some(folder => folder.id === id));
    if (folderIds.length === 0) return false;

    const folderIdSet = new Set(folderIds);
    const selectedItemIds = ids.filter(id => !folderIdSet.has(id));
    const selectedFolders = folderCollection.filter(folder => folderIdSet.has(folder.id));
    const itemCount = new Set(selectedFolders.flatMap(folder => folder.eventIds)).size;
    const pending = { kind, folderIds, selectedItemIds };
    if (itemCount === 0) {
      finishBulkFolderAction(pending, 'withItems');
    } else {
      setPendingBulkFolderAction(pending);
    }
    return true;
  };

  // Handle bulk actions
  const handleBulkAction = (action: BulkActionType, color?: string) => {
    const ids = Array.from(selectedItems);
    const idSet = new Set(ids);
    
    switch (action) {
      case 'all':
        toggleAll(getAllItemIds());
        break;
      case 'allItems': {
        // Toggle selection of archived events only
        const eventIds = getArchivedEventIds();
        const allEventsSelected = eventIds.every(id => selectedItems.has(id));
        if (allEventsSelected) {
          // Deselect all events (keep folders selected)
          const folderIds = getArchivedEventFolderIds();
          const currentFolderSelections = Array.from(selectedItems).filter(id => folderIds.includes(id));
          if (currentFolderSelections.length > 0) {
            toggleAll(currentFolderSelections);
          } else {
            clearSelection();
          }
        } else {
          // Select all events (keep existing folder selections)
          const currentFolderSelections = Array.from(selectedItems).filter(id => 
            archivedEventFolders.some(f => f.id === id));
          toggleAll([...currentFolderSelections, ...eventIds]);
        }
        break;
      }
      case 'allFolders': {
        // Toggle selection of archived folders only
        const folderIds = getArchivedEventFolderIds();
        const allFoldersSelected = folderIds.every(id => selectedItems.has(id));
        if (allFoldersSelected) {
          // Deselect all folders (keep events selected)
          const eventIds = getArchivedEventIds();
          const currentEventSelections = Array.from(selectedItems).filter(id => eventIds.includes(id));
          if (currentEventSelections.length > 0) {
            toggleAll(currentEventSelections);
          } else {
            clearSelection();
          }
        } else {
          // Select all folders (keep existing event selections)
          const currentEventSelections = Array.from(selectedItems).filter(id => 
            archivedEvents.some(e => e.id === id));
          toggleAll([...currentEventSelections, ...folderIds]);
        }
        break;
      }
      case 'pin':
        // Batch update events - toggle pin state
        setEvents(prev => prev.map(event => 
          idSet.has(event.id) ? { ...event, pinned: !event.pinned } : event
        ));
        // Batch update folders
        setEventFolders(prev => prev.map(folder => 
          idSet.has(folder.id) ? { ...folder, pinned: !folder.pinned } : folder
        ));
        clearSelection();
        exitBulkMode();
        toast.success(countedSentence(t, language, 'bulkUpdated', ids.length));
        break;
      case 'share':
        // Copy event names to clipboard
        const eventsToShare = events.filter(e => idSet.has(e.id));
        const shareText = eventsToShare.map(e => `${e.name}${e.description ? `: ${e.description}` : ''}`).join('\n');
        navigator.clipboard.writeText(shareText).then(() => {
          toast.success(t('toastContentCopied'));
        }).catch(() => {
          toast.error(t('toastCopyFailed'));
        });
        clearSelection();
        exitBulkMode();
        break;
      case 'copy':
        // Batch copy events
        const takenNames = [...events, ...archivedEvents].map(e => e.name);
        const copiedEvents = events.filter(e => idSet.has(e.id)).map(event => {
          const copyName = nextCopyName(event.name, takenNames);
          takenNames.push(copyName);
          return {
            ...event,
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            name: copyName,
            createdAt: new Date().toISOString(),
            pinned: false,
          };
        });
        setEvents(prev => [...prev, ...copiedEvents]);
        clearSelection();
        exitBulkMode();
        toast.success(countedSentence(t, language, 'bulkCopied', copiedEvents.length));
        break;
      case 'move':
        if (ids.length > 0) {
          setSelectedEventsForMove(ids);
          setIsMoveToEventFolderOpen(true);
        }
        break;
      case 'color':
        if (color) {
          // Batch update colors
          setEvents(prev => prev.map(e => idSet.has(e.id) ? { ...e, color } : e));
          setEventFolders(prev => prev.map(f => idSet.has(f.id) ? { ...f, color } : f));
          clearSelection();
          exitBulkMode();
          toast.success(t('toastColorApplied').replace('{count}', String(ids.length)));
        }
        break;
      case 'archive':
        if (requestBulkFolderAction('archive', ids)) break;
        // Show confirmation dialog for bulk archive
        setPendingBulkAction({ ids, action: 'archive' });
        setBulkArchiveDialogOpen(true);
        break;
      case 'delete':
        if (requestBulkFolderAction('delete', ids)) break;
        // Show confirmation dialog for bulk delete
        setPendingBulkAction({ ids, action: 'delete' });
        setBulkDeleteDialogOpen(true);
        break;
      case 'restore': {
        const appendUniqueById = <T extends { id: string }>(prev: T[], items: T[]) => {
          const existing = new Set(prev.map(i => i.id));
          const next = [...prev];
          for (const item of items) {
            if (!existing.has(item.id)) {
              existing.add(item.id);
              next.push(item);
            }
          }
          return next;
        };

        const foldersToRestore = archivedEventFolders.filter(f => idSet.has(f.id));
        const eventsToRestoreAll = archivedEvents.filter(e => idSet.has(e.id));
        const eventIdsRestoredViaFolders = new Set<string>();

        // Restore folders (and their still-archived events)
        if (foldersToRestore.length > 0) {
          const eventIdsAssignedElsewhere = new Set<string>(eventFolders.flatMap(f => f.eventIds));

          const sanitizedFolders = foldersToRestore.map(f => ({
            ...f,
            archived: false,
            eventIds: f.eventIds.filter(id => !eventIdsAssignedElsewhere.has(id)),
          }));

          sanitizedFolders.forEach(f => f.eventIds.forEach(id => eventIdsRestoredViaFolders.add(id)));

          const eventsFromFoldersToRestore = archivedEvents.filter(e => eventIdsRestoredViaFolders.has(e.id));
          // Strip originalFolderId from restored events
          const cleanedEventsFromFolders = eventsFromFoldersToRestore.map(e => {
            const { originalFolderId, ...restored } = e;
            return restored;
          });

          setEventFolders(prev => [...prev, ...sanitizedFolders]);
          setArchivedEventFolders(prev => prev.filter(f => !idSet.has(f.id)));

          if (cleanedEventsFromFolders.length > 0) {
            setEvents(prev => appendUniqueById(prev, cleanedEventsFromFolders));
            setArchivedEvents(prev => prev.filter(e => !eventIdsRestoredViaFolders.has(e.id)));
          }
        }

        // Restore individually-selected events (with folder re-association)
        const eventsToRestore = eventsToRestoreAll.filter(e => !eventIdsRestoredViaFolders.has(e.id));
        if (eventsToRestore.length > 0) {
          // Strip originalFolderId and collect re-associations
          const restoredEvents = eventsToRestore.map(e => {
            const { originalFolderId, ...restored } = e;
            return restored;
          });
          
          setEvents(prev => appendUniqueById(prev, restoredEvents));
          setArchivedEvents(prev => prev.filter(e => !(idSet.has(e.id) && !eventIdsRestoredViaFolders.has(e.id))));
          
          // Re-associate events with their original folders if they still exist
          setEventFolders(prev => {
            const updated = [...prev];
            eventsToRestore.forEach(event => {
              const originalFolderId = event.originalFolderId;
              if (originalFolderId) {
                const folderIndex = updated.findIndex(f => f.id === originalFolderId);
                if (folderIndex !== -1 && !updated[folderIndex].eventIds.includes(event.id)) {
                  updated[folderIndex] = {
                    ...updated[folderIndex],
                    eventIds: [...updated[folderIndex].eventIds, event.id]
                  };
                }
              }
            });
            return updated;
          });
        }

        clearSelection();
        exitBulkMode();
        toast.success(countedSentence(t, language, 'bulkRestored', ids.length));
        break;
      }
    }
  };

  // Render event list based on view type
  const renderEventList = (eventList: Event[], emptyMessage: string, isArchived = false) => {
    /*
     * Filtering happens here, not at the call sites, so every list that goes through this
     * renderer answers the search: the Events tab, the archived events, and any list added
     * later. The notes page is built the same way, which is why all of its tabs filter.
     */
    const filteredList = filterEvents(eventList);

    if (filteredList.length === 0) {
      return (
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-muted-foreground">
              {searchQuery.trim() ? t('noMatchingEvents') : emptyMessage}
            </p>
          </CardContent>
        </Card>
      );
    }

    const gridClass = viewType === 'list' ? 'grid grid-cols-1 gap-2' : 
                     viewType === 'x3' ? 'grid grid-cols-3 gap-2' :
                     'grid grid-cols-2 gap-2'; // x2

    return (
      <div className={gridClass}>
        {filteredList.map(event => (
          <EventCard
            key={event.id}
            event={event}
            onClick={() => isBulkMode ? toggleItem(event.id) : (isArchived ? null : openEventDetails(event))}
            onEdit={() => openEventDetails(event)}
            onArchive={!isArchived ? confirmArchiveEvent : undefined}
            onUnarchive={isArchived ? unarchiveEvent : undefined}
            onDelete={deleteEvent}
            onCopy={copyEvent}
            onShare={() => {}}
            onMoveToFolder={!isArchived ? handleMoveToEventFolder : undefined}
            onPin={!isArchived ? pinEvent : undefined}
            onUnpin={!isArchived ? unpinEvent : undefined}
            isDeleted={false}
            isArchived={isArchived}
            searchQuery={searchQuery}
            viewType={viewType}
            showBulkCheckbox={isBulkMode}
            isBulkSelected={selectedItems.has(event.id)}
            onBulkSelect={toggleItem}
          />
        ))}
      </div>
    );
  };

  const renderEventFolderList = (folderList: EventFolder[], emptyMessage: string, isArchived = false) => {
    // Filtered here for the same reason as the event list above.
    const filteredFolders = filterEventFolders(folderList);

    if (filteredFolders.length === 0) {
      return (
        <Card>
          <CardContent className="text-center py-8">
            {!isArchived ? (
              <Button 
                onClick={() => setIsEventFolderCreatorOpen(true)}
                className="h-10 px-8 text-sm font-medium rounded-full bg-black text-white hover:bg-black/90"
              >
                {t('createFolder')}
                <FolderOpen className="ml-2" size={20} />
              </Button>
            ) : (
              <p className="text-muted-foreground">{emptyMessage}</p>
            )}
          </CardContent>
        </Card>
      );
    }

    return (
      /*
       * `items-start` keeps a folder's height its own. A grid stretches its cells to the
       * tallest item in the row by default, so opening one folder made every neighbour
       * beside it just as tall, and they read as if they had all opened together.
       */
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 items-start">
        {filteredFolders.map(folder => (
          <EventFolderCard
            key={folder.id}
            folder={folder}
            /*
             * Archiving an event moves it out of `events`, so an archived folder holds archived
             * events. `getAllEvents()` is already narrowed by the search; the archived list had
             * to be narrowed here, or a matching archived folder listed everything inside it.
             */
            events={isArchived ? filterEvents(archivedEvents) : getAllEvents()}
            onEdit={!isArchived ? editEventFolder : undefined}
            onArchive={!isArchived ? folderActions.requestArchive : undefined}
            onUnarchive={isArchived ? folderActions.requestRestore : undefined}
            // Restoring an event from inside an archived folder. Without it the nested card's
            // restore button was drawn but did nothing.
            onRestoreEvent={isArchived ? unarchiveEvent : undefined}
            onDelete={folderActions.requestDelete}
            onPin={!isArchived ? pinEventFolder : undefined}
            onUnpin={!isArchived ? unpinEventFolder : undefined}
            isArchived={isArchived}
            isDeleted={false}
            searchQuery={searchQuery}
            onEditEvent={openEventDetails}
            onArchiveEvent={confirmArchiveEvent}
            onDeleteEvent={deleteEvent}
            onCopyEvent={copyEvent}
            onMoveEventToFolder={(eventId) => {
              setSelectedEventForMove(eventId);
              setIsMoveToEventFolderOpen(true);
            }}
            showBulkCheckbox={isBulkMode}
            isBulkSelected={selectedItems.has(folder.id)}
            onBulkSelect={toggleItem}
          />
        ))}
      </div>
    );
  };

  const { t, language } = useLanguage();
  // Toast copy is a translated sentence plus a translated entity noun. Both halves are
  // resolved here so the `{entity}` substitution is written once instead of at every toast.
  const say = (key: string, entity: string) => t(key).replace('{entity}', t(entity));
  // Folder toasts name the items a folder contains rather than the folder itself.

  return (
    <FolderMembershipProvider ids={collectFiledIds(
      eventFolders.map((folder) => ({ id: folder.id, itemIds: folder.eventIds })),
      archivedEvents,
    )}>
    <Layout 
      showSearch={true}
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      isBulkMode={isBulkMode}
      pageTitle={t('events')}
    >
      <div {...swipeHandlers} className="space-y-2">
        {/* Floating Add Button */}
        {!isBulkMode && activeTab !== 'archived' && (
          <Button 
            variant="ghostStatic" 
            size="icon" 
            onClick={handleAddButtonClick} 
            /* Same hairline as the floating nav capsule; see the note in Notes.tsx. */
            className={cn(
              "fixed bottom-20 right-2 h-14 w-14 rounded-full z-30 bg-black text-white border border-nav-border hover:bg-black/90",
              "transition-all duration-300 ease-out",
              scrollDirection === 'down' 
                ? "opacity-0 translate-y-4 pointer-events-none" 
                : "opacity-100 translate-y-0"
            )}
          >
            <Plus size={24} />
          </Button>
        )}

        {/* Add Event Dialog */}
        <EventEditor
          isOpen={isAddDialogOpen}
          onClose={() => setIsAddDialogOpen(false)}
          onSave={handleCreateEvent}
          mode="create"
        />

        {/* Edit Event Dialog */}
        <EventEditor
          isOpen={!!selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onSave={handleUpdateEvent}
          initialEvent={selectedEvent}
          mode="edit"
        />

        {/* Events Tabs */}
        <Tabs value={activeTab} onValueChange={(tab) => { setActiveTab(tab); exitBulkMode(); }} className="w-full">
          <div className="fixed top-16 left-0 right-0 z-40 px-2">
            <div className="flex items-center justify-between py-2">
            <SlidingTabsList 
              activeValue={activeTab} 
              values={['all-events', 'folders', 'archived']}
            >
              <TabsTrigger value="all-events">{t('events')}</TabsTrigger>
              <TabsTrigger value="folders">{t('tabFolders')}</TabsTrigger>
              <TabsTrigger value="archived">{t('tabArchived')}</TabsTrigger>
            </SlidingTabsList>
            <div className="flex items-center gap-1">
              <Button 
                variant="ghostStatic" 
                size="icon"
                className="rounded-full hover:bg-hover hover:text-foreground focus-visible:ring-0 focus-visible:ring-offset-0 [&_svg]:!size-5 data-[state=open]:bg-hover data-[state=open]:text-foreground"
                data-state={isBulkMode ? "open" : "closed"}
                onClick={(e) => { toggleBulkMode(); e.currentTarget.blur(); }}
                onMouseDown={(e) => e.preventDefault()}
              >
                <FileStack className="h-6 w-6" />
              </Button>
              {activeTab === 'folders' ? (
                <EventFolderViewSettings
                  sortType={folderSortType}
                  sortDirection={folderSortDirection}
                  onSortTypeChange={setFolderSortType}
                  onSortDirectionChange={setFolderSortDirection}
                />
              ) : (
                <EventViewSettings
                  viewType={viewType}
                  sortType={sortType}
                  sortDirection={sortDirection}
                  onViewTypeChange={setViewType}
                  onSortTypeChange={setSortType}
                  onSortDirectionChange={setSortDirection}
                />
              )}
            </div>
            </div>
          </div>
          
          <TabsContent value="all-events" className="mt-14 space-y-2">
            {/*
              * Guarded on the events themselves, not on the searched list: `getAllEvents()`
              * is already narrowed by the query, so guarding on it showed the "Create event"
              * card whenever a search matched nothing, instead of saying that nothing matched.
              */}
            {events.length === 0 ? (
              <Card>
                <CardContent className="text-center py-8">
                  <Button 
                    onClick={handleAddButtonClick}
                    className="h-10 px-8 text-sm font-medium rounded-full bg-black text-white hover:bg-black/90"
                  >
                    {t('createEvent')}
                    <Calendar className="ml-2" size={20} />
                  </Button>
                </CardContent>
              </Card>
            ) : (
              renderEventList(getAllEvents(), "No events yet")
            )}
          </TabsContent>
          
          <TabsContent value="folders" className="mt-14 space-y-2">
            {getEventFolders().length === 0 ? (
              <Card>
                <CardContent className="text-center py-8">
                  <Button 
                    onClick={handleAddButtonClick}
                    className="h-10 px-8 text-sm font-medium rounded-full bg-black text-white hover:bg-black/90"
                  >
                    {t('createFolder')}
                    <FolderOpen className="ml-2" size={20} />
                  </Button>
                </CardContent>
              </Card>
            ) : (
              renderEventFolderList(getEventFolders(), "No folders yet.")
            )}
          </TabsContent>
          
          <TabsContent value="archived" className="mt-14 space-y-2">
            <div className="space-y-4">
              <div className="space-y-2">
                <h3 className="text-lg font-medium">{t('archivedEvents')}</h3>
                {renderEventList(archivedEvents, t('noArchivedEvents'), true)}
              </div>
              
              <div className="space-y-2">
                <h3 className="text-lg font-medium">{t('archivedFolders')}</h3>
                {renderEventFolderList(archivedEventFolders, t('noArchivedFolders'), true)}
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Delete Confirmation Dialog */}
        {/*
          * The title names the item. "Delete this item?" gave no clue which one, and this
          * dialog offers no other: the heading reads the same whether one event is being
          * deleted or a folder with a dozen inside it. `itemDisplayName` falls back to the
          * opening words of the body, which is what a nameless note needs.
          */}
        <ConfirmationDialog
          open={deleteDialogOpen}
          onOpenChange={setDeleteDialogOpen}
          title={namedSentence(t, 'confirmDeleteNamed', displayNameOf(itemToDelete))}
          description={namedSentence(t, 'confirmDeleteNamedBody', displayNameOf(itemToDelete))}
          action="delete"
          onConfirm={() => {
            if (itemToDelete) confirmDeleteEvent(itemToDelete.id);
            setItemToDelete(null);
          }}
        />

        {/* Archive Confirmation Dialog */}
        <ConfirmationDialog
          open={archiveDialogOpen}
          onOpenChange={setArchiveDialogOpen}
          title={namedSentence(t, 'confirmArchiveNamed', displayNameOf(itemToArchive))}
          description={namedSentence(t, 'confirmArchiveNamedBody', displayNameOf(itemToArchive))}
          action="archive"
          onConfirm={() => {
            if (itemToArchive) performArchiveEvent(itemToArchive.id);
            setItemToArchive(null);
          }}
        />
        <EventFolderCreator
          isOpen={isEventFolderCreatorOpen}
          onClose={() => {
            setIsEventFolderCreatorOpen(false);
            setSelectedEventForMove(null);
            setSelectedEventsForMove(null);
          }}
          onSave={handleSaveEventFolder}
          eventIdsToMove={selectedEventsForMove ?? (selectedEventForMove ? [selectedEventForMove] : undefined)}
        />

        <EventFolderEditor
          isOpen={isEventFolderEditorOpen}
          onClose={() => setIsEventFolderEditorOpen(false)}
          onSave={updateEventFolder}
          folder={selectedEventFolder}
        />

        <MoveToFolderDialog
          isOpen={isMoveToEventFolderOpen}
          onClose={() => {
            setIsMoveToEventFolderOpen(false);
            setSelectedEventForMove(null);
            setSelectedEventsForMove(null);
          }}
          folders={eventFolders}
          onSelectFolder={handleEventFolderSelect}
          onMoveComplete={() => { clearSelection(); exitBulkMode(); }}
          onCreateNewFolder={handleCreateEventFolderFromDialog}
          itemIdsToMove={selectedEventsForMove ?? (selectedEventForMove ? [selectedEventForMove] : [])}
          getFolderItemIds={(folder) => folder.eventIds}
          getItemCount={(folder) => folder.eventIds.length}
          itemNoun={t('events')}
        />

        {/* Bulk Archive Confirmation Dialog */}
        <ConfirmationDialog
          open={bulkArchiveDialogOpen}
          onOpenChange={setBulkArchiveDialogOpen}
          title={t('archiveSelectedItems')}
          description={t('confirmArchiveTitle')}
          action="archive"
          onConfirm={() => {
            if (pendingBulkAction) {
              const { ids } = pendingBulkAction;
              const idSet = new Set(ids);
              
              if (activeTab === 'folders') {
                // Batch archive folders
                const foldersToArchive = eventFolders.filter(f => idSet.has(f.id)).map(f => ({ ...f, archived: true }));

                // Archive all events inside those folders
                const eventIdsToArchive = new Set<string>(foldersToArchive.flatMap(f => f.eventIds));
                const eventsToArchive = events.filter(e => eventIdsToArchive.has(e.id));

                setArchivedEventFolders(prev => [...prev, ...foldersToArchive]);
                setArchivedEvents(prev => [...prev, ...eventsToArchive]);

                // Remove folders and their events from active lists
                setEventFolders(prev => prev
                  .filter(f => !idSet.has(f.id))
                  .map(f => ({ ...f, eventIds: f.eventIds.filter(id => !eventIdsToArchive.has(id)) }))
                );
                setEvents(prev => prev.filter(e => !eventIdsToArchive.has(e.id)));
              } else {
                // Batch archive events
                const eventsToArchive = events.filter(e => idSet.has(e.id));
                setArchivedEvents(prev => [...prev, ...eventsToArchive]);
                setEvents(prev => prev.filter(e => !idSet.has(e.id)));
                // Remove from folders
                setEventFolders(prev => prev.map(folder => ({
                  ...folder,
                  eventIds: folder.eventIds.filter(id => !idSet.has(id))
                })));
              }
              clearSelection();
              exitBulkMode();
              toast.success(countedSentence(t, language, 'bulkArchived', ids.length));
            }
            setPendingBulkAction(null);
          }}
          onCancel={() => setPendingBulkAction(null)}
        />

        {/* Bulk Delete Confirmation Dialog */}
        <ConfirmationDialog
          open={bulkDeleteDialogOpen}
          onOpenChange={setBulkDeleteDialogOpen}
          title={t('deleteSelectedItems')}
          description={t('confirmDeleteBody')}
          action="delete"
          onConfirm={() => {
            if (pendingBulkAction) {
              const { ids } = pendingBulkAction;
              const idSet = new Set(ids);
              
              if (activeTab === 'archived') {
                // Batch delete both events AND folders in archived tab
                setArchivedEvents(prev => prev.filter(e => !idSet.has(e.id)));
                setArchivedEventFolders(prev => prev.filter(f => !idSet.has(f.id)));
              } else if (activeTab === 'folders') {
                // Batch delete folders
                setEventFolders(prev => prev.filter(f => !idSet.has(f.id)));
                setArchivedEventFolders(prev => prev.filter(f => !idSet.has(f.id)));
              } else {
                // Batch delete events
                setEvents(prev => prev.filter(e => !idSet.has(e.id)));
                setArchivedEvents(prev => prev.filter(e => !idSet.has(e.id)));
                // Remove from folders
                setEventFolders(prev => prev.map(folder => ({
                  ...folder,
                  eventIds: folder.eventIds.filter(id => !idSet.has(id))
                })));
                setArchivedEventFolders(prev => prev.map(folder => ({
                  ...folder,
                  eventIds: folder.eventIds.filter(id => !idSet.has(id))
                })));
              }
              clearSelection();
              exitBulkMode();
              toast.success(countedSentence(t, language, 'bulkDeleted', ids.length));
            }
            setPendingBulkAction(null);
          }}
          onCancel={() => setPendingBulkAction(null)}
        />

        {/* The folder dialog, shared with the notes and habits pages. */}
        <FolderActionDialog {...folderActions.dialog} itemKind="event" />
        <FolderActionDialog
          open={Boolean(pendingBulkFolderAction)}
          kind={pendingBulkFolderAction?.kind ?? 'archive'}
          folderName=""
          itemCount={pendingBulkFolderAction
            ? new Set([...eventFolders, ...archivedEventFolders]
                .filter(folder => pendingBulkFolderAction.folderIds.includes(folder.id))
                .flatMap(folder => folder.eventIds)).size
            : 0}
          itemKind="event"
          bulk
          onFolderOnly={() => pendingBulkFolderAction && finishBulkFolderAction(pendingBulkFolderAction, 'folderOnly')}
          onAll={() => pendingBulkFolderAction && finishBulkFolderAction(pendingBulkFolderAction, 'withItems')}
          onOpenChange={(open) => !open && setPendingBulkFolderAction(null)}
        />

        <BulkActionBar
          context={getBulkContext()}
          isVisible={isBulkMode}
          isAllSelected={isAllSelected(getAllItemIds())}
          isAllItemsSelected={isAllArchivedEventsSelected}
          isAllFoldersSelected={isAllArchivedEventFoldersSelected}
          selectedCount={selectedItems.size}
          onAction={handleBulkAction}
          onClearSelection={clearSelection}
        />
      </div>
    </Layout>
    </FolderMembershipProvider>
  );
}
