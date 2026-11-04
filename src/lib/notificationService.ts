import { LocalNotifications, ScheduleOptions } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import { Event, AlertType } from '@/types/event';
import { addDays, parseISO, subMinutes, subHours, subDays, subWeeks } from 'date-fns';
import { getEventSpanDays, getNextOccurrenceStart } from './eventRecurrence';
import { toDateKey } from './dateUtils';
import { nextReminderTime } from './noteReminders';
import type { Note } from '@/types/note';

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

/* ---------------------------------------------------------------------------------------
 * Note reminders
 *
 * Synced from the list of notes rather than called from every place a note is saved,
 * deleted or archived: syncNoteReminders(notes) schedules what has a reminder, reschedules
 * what changed and cancels the rest. Only active notes ring; archived ones do not.
 * ------------------------------------------------------------------------------------- */

const noteKey = (noteId: string) => `note:${noteId}`;
/** What is armed now, by note id, so an unchanged reminder is not rescheduled on each edit. */
const armedNotes = new Map<string, string>();

const noteSignature = (note: Note) =>
  JSON.stringify([note.reminder?.at, note.reminder?.repeat, note.reminder?.interval, note.name, note.locked]);

/** A short, plain-text preview of an unlocked note for the notification body. */
function notePreview(note: Note): string {
  if (note.locked) return '';
  const text = note.type === 'list'
    ? (note.items ?? []).filter((i) => !i.completed).map((i) => i.text).join(', ')
    : (note.description ?? '');
  return text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);
}

async function cancelNoteReminder(noteId: string): Promise<void> {
  armedNotes.delete(noteId);
  const key = noteKey(noteId);
  if (Capacitor.isNativePlatform()) {
    await LocalNotifications.cancel({ notifications: [{ id: getNotificationId(key) }] });
  } else {
    const timeouts = JSON.parse(sessionStorage.getItem('notificationTimeouts') || '{}');
    if (timeouts[key]) {
      clearTimeout(timeouts[key]);
      delete timeouts[key];
      sessionStorage.setItem('notificationTimeouts', JSON.stringify(timeouts));
    }
  }
}

async function scheduleNoteReminder(note: Note, fallbackTitle: string): Promise<void> {
  await cancelNoteReminder(note.id);
  if (!note.reminder) return;
  const at = nextReminderTime(note.reminder);
  if (!at) return;
  armedNotes.set(note.id, noteSignature(note));

  const key = noteKey(note.id);
  const title = note.name?.trim() || fallbackTitle;
  // A locked note's content stays out of the notification shade.
  const body = notePreview(note) || fallbackTitle;

  if (Capacitor.isNativePlatform()) {
    await LocalNotifications.schedule({
      notifications: [{
        id: getNotificationId(key),
        title,
        body,
        schedule: { at, allowWhileIdle: true },
        sound: 'default',
        extra: { noteId: note.id },
      }],
    });
    return;
  }

  const delay = at.getTime() - Date.now();
  if (delay <= 0 || delay >= 2147483647) return;
  const timeoutId = setTimeout(() => {
    new Notification(title, { body, icon: `${import.meta.env.BASE_URL}favicon.ico`, tag: key });
    armedNotes.delete(note.id);
    // Arm the next one of a repeating reminder, from the note as it is saved now.
    if (note.reminder?.repeat) {
      const latest = readStoredNote(note.id);
      if (latest?.reminder) void scheduleNoteReminder(latest, fallbackTitle);
    }
  }, delay);
  const timeouts = JSON.parse(sessionStorage.getItem('notificationTimeouts') || '{}');
  timeouts[key] = timeoutId;
  sessionStorage.setItem('notificationTimeouts', JSON.stringify(timeouts));
}

const readStoredNote = (noteId: string): Note | undefined => {
  try {
    return (JSON.parse(localStorage.getItem('notes') ?? '[]') as Note[]).find((n) => n.id === noteId);
  } catch {
    return undefined;
  }
};

/**
 * Brings the armed reminders in line with `notes`. Safe to call on every change: only
 * reminders that were added, changed or removed touch the scheduler.
 */
export async function syncNoteReminders(notes: Note[], fallbackTitle: string): Promise<void> {
  const wanted = new Map(notes.filter((n) => n.reminder).map((n) => [n.id, n]));

  for (const id of [...armedNotes.keys()]) {
    if (!wanted.has(id)) await cancelNoteReminder(id);
  }
  if (Capacitor.isNativePlatform()) {
    // After a restart the map is empty, but the system still holds what was scheduled.
    const pending = await LocalNotifications.getPending();
    const stale = pending.notifications.filter((p) => p.extra?.noteId && !wanted.has(p.extra.noteId));
    if (stale.length > 0) await LocalNotifications.cancel({ notifications: stale.map((p) => ({ id: p.id })) });
  }

  if (wanted.size === 0 || !(await checkNotificationPermission())) return;
  for (const note of wanted.values()) {
    if (armedNotes.get(note.id) !== noteSignature(note)) await scheduleNoteReminder(note, fallbackTitle);
  }
}

/** Arms note reminders from storage when the app opens. */
export async function scheduleStoredNoteReminders(fallbackTitle: string): Promise<void> {
  try {
    await syncNoteReminders(JSON.parse(localStorage.getItem('notes') ?? '[]') as Note[], fallbackTitle);
  } catch (error) {
    console.error('Could not schedule note reminders:', error);
  }
}
