import { LocalNotifications, ScheduleOptions } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import { Event, AlertType } from '@/types/event';
import { addDays, parseISO, subMinutes, subHours, subDays, subWeeks } from 'date-fns';
import { getEventSpanDays, getNextOccurrenceStart } from './eventRecurrence';
import { toDateKey } from './dateUtils';

/**
 * When the reminder for the next occurrence should fire.
 *
 * This used to use the start date only, so a recurring event got one reminder ever. It
 * now walks the occurrences from today and returns the first reminder still ahead.
 * (Only one is scheduled per event; the next is scheduled when the app reopens.)
 */
const getNotificationTime = (event: Event): Date | null => {
  if (!event.alertType || event.alertType === 'none') return null;

  const now = new Date();
  let from = now;
  for (let attempt = 0; attempt < 400; attempt++) {
    const occurrence = getNextOccurrenceStart(event, from);
    if (!occurrence) return null;
    const alertAt = getAlertTimeForOccurrence(event, toDateKey(occurrence));
    if (!alertAt) return null;
    if (alertAt > now) return alertAt;
    if (!event.isRecurrent) return null;
    from = addDays(occurrence, getEventSpanDays(event) + 1);
  }
  return null;
};

const getAlertTimeForOccurrence = (event: Event, eventDate: string): Date | null => {
  // For all-day events, use 9:00 AM as the default time for more practical alerts
  const eventTime = event.startTime || event.time || (event.isAllDay ? '09:00' : '00:00');

  const eventDateTime = parseISO(`${eventDate}T${eventTime}`);
  if (Number.isNaN(eventDateTime.getTime())) return null;

  switch (event.alertType) {
    case '5min':
      return subMinutes(eventDateTime, 5);
    case '15min':
      return subMinutes(eventDateTime, 15);
    case '30min':
      return subMinutes(eventDateTime, 30);
    case '1hour':
      return subHours(eventDateTime, 1);
    case '4hours':
      return subHours(eventDateTime, 4);
    case '12hours':
      return subHours(eventDateTime, 12);
    case '1day':
      return subDays(eventDateTime, 1);
    case '4weeks':
      return subWeeks(eventDateTime, 4);
    case 'custom':
      if (!event.alertCustomValue || !event.alertCustomUnit) return null;
      switch (event.alertCustomUnit) {
        case 'minutes':
          return subMinutes(eventDateTime, event.alertCustomValue);
        case 'hours':
          return subHours(eventDateTime, event.alertCustomValue);
        case 'days':
          return subDays(eventDateTime, event.alertCustomValue);
        case 'weeks':
          return subWeeks(eventDateTime, event.alertCustomValue);
        default:
          return null;
      }
    default:
      return null;
  }
};

// Generate a unique notification ID from event ID
const getNotificationId = (eventId: string): number => {
  let hash = 0;
  for (let i = 0; i < eventId.length; i++) {
    const char = eventId.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  // Android ids are signed 32-bit; Math.abs(-2^31) is 2^31, one past the maximum.
  return Math.abs(hash) % 2147483647;
};

// Request notification permissions
export const requestNotificationPermission = async (): Promise<boolean> => {
  if (Capacitor.isNativePlatform()) {
    const result = await LocalNotifications.requestPermissions();
    return result.display === 'granted';
  } else {
    // Web Notifications API
    if (!('Notification' in window)) {
      console.log('This browser does not support notifications');
      return false;
    }
    
    if (Notification.permission === 'granted') {
      return true;
    }
    
    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
    
    return false;
  }
};

// Check if notifications are enabled
export const checkNotificationPermission = async (): Promise<boolean> => {
  if (Capacitor.isNativePlatform()) {
    const result = await LocalNotifications.checkPermissions();
    return result.display === 'granted';
  } else {
    return 'Notification' in window && Notification.permission === 'granted';
  }
};

// Schedule a notification for an event
export const scheduleEventNotification = async (event: Event): Promise<void> => {
  const notificationTime = getNotificationTime(event);
  
  if (!notificationTime) {
    console.log('No notification time calculated for event:', event.id);
    return;
  }
  
  // Don't schedule notifications in the past
  if (notificationTime <= new Date()) {
    console.log('Notification time is in the past, skipping:', notificationTime);
    return;
  }
  
  const hasPermission = await checkNotificationPermission();
  if (!hasPermission) {
    console.log('No notification permission');
    return;
  }
  
  const notificationId = getNotificationId(event.id);
  const eventTime = event.startTime || event.time;
  
  const body = eventTime 
    ? `Starts at ${eventTime}${event.location ? ` - ${event.location}` : ''}`
    : event.location || 'Event reminder';
  
  if (Capacitor.isNativePlatform()) {
    const options: ScheduleOptions = {
      notifications: [
        {
          id: notificationId,
          title: event.name,
          body,
          schedule: { at: notificationTime },
          sound: 'default',
          actionTypeId: 'EVENT_REMINDER',
          extra: { eventId: event.id }
        }
      ]
    };
    
    await LocalNotifications.schedule(options);
    console.log('Scheduled native notification for:', event.name, 'at', notificationTime);
  } else {
    // For web, we use setTimeout (only works while page is open)
    const delay = notificationTime.getTime() - Date.now();
    
    if (delay > 0 && delay < 2147483647) { // Max setTimeout delay
      // Each visit to Events schedules everything again; drop the earlier timer first or
      // the same reminder would fire once per visit.
      await cancelEventNotification(event.id);

      // Store the timeout ID for potential cancellation
      const timeoutId = setTimeout(() => {
        new Notification(event.name, {
          body,
          icon: `${import.meta.env.BASE_URL}favicon.ico`,
          tag: event.id,
          requireInteraction: true
        });
        // Arm the next occurrence of a recurring event, from its latest saved version.
        if (event.isRecurrent) {
          const latest = readStoredEvent(event.id);
          if (latest) void scheduleEventNotification(latest);
        }
      }, delay);
      
      // Store timeout ID in sessionStorage for tracking
      const timeouts = JSON.parse(sessionStorage.getItem('notificationTimeouts') || '{}');
      timeouts[event.id] = timeoutId;
      sessionStorage.setItem('notificationTimeouts', JSON.stringify(timeouts));
      
      console.log('Scheduled web notification for:', event.name, 'in', delay, 'ms');
    }
  }
};

// Cancel a scheduled notification
export const cancelEventNotification = async (eventId: string): Promise<void> => {
  const notificationId = getNotificationId(eventId);
  
  if (Capacitor.isNativePlatform()) {
    await LocalNotifications.cancel({ notifications: [{ id: notificationId }] });
    console.log('Cancelled native notification for event:', eventId);
  } else {
    // Cancel web setTimeout
    const timeouts = JSON.parse(sessionStorage.getItem('notificationTimeouts') || '{}');
    if (timeouts[eventId]) {
      clearTimeout(timeouts[eventId]);
      delete timeouts[eventId];
      sessionStorage.setItem('notificationTimeouts', JSON.stringify(timeouts));
      console.log('Cancelled web notification for event:', eventId);
    }
  }
};

// Schedule notifications for all events
export const scheduleAllEventNotifications = async (events: Event[]): Promise<void> => {
  const hasPermission = await checkNotificationPermission();
  if (!hasPermission) {
    console.log('No notification permission, skipping bulk schedule');
    return;
  }
  
  for (const event of events) {
    if (event.alertType && event.alertType !== 'none') {
      await scheduleEventNotification(event);
    }
  }
};

// Cancel all scheduled notifications
export const cancelAllEventNotifications = async (): Promise<void> => {
  if (Capacitor.isNativePlatform()) {
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length > 0) {
      await LocalNotifications.cancel({ notifications: pending.notifications });
    }
  } else {
    const timeouts = JSON.parse(sessionStorage.getItem('notificationTimeouts') || '{}');
    Object.values(timeouts).forEach((timeoutId) => {
      clearTimeout(timeoutId as number);
    });
    sessionStorage.removeItem('notificationTimeouts');
  }
};

const readStoredEvent = (eventId: string): Event | undefined => {
  try {
    return (JSON.parse(localStorage.getItem('events') ?? '[]') as Event[]).find((e) => e.id === eventId);
  } catch {
    return undefined;
  }
};

/**
 * Arms reminders for every saved event, from anywhere in the app.
 *
 * Reminders used to be scheduled only when the Events page opened, so on the web (where a
 * reminder is a timer in the open tab) nothing fired unless that page had been visited.
 * Only runs when permission was already granted: asking is left to the Events page, where
 * the user can tell why.
 */
export async function scheduleStoredEventNotifications(): Promise<void> {
  if (!(await checkNotificationPermission())) return;
  try {
    const events = JSON.parse(localStorage.getItem('events') ?? '[]') as Event[];
    await scheduleAllEventNotifications(events.filter((e) => e.alertType && e.alertType !== 'none'));
  } catch (error) {
    console.error('Could not schedule reminders:', error);
  }
}
