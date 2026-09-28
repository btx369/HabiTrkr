import { LocalNotifications, ScheduleOptions } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import { Event, AlertType } from '@/types/event';
import { parseISO, subMinutes, subHours, subDays, subWeeks } from 'date-fns';

// Calculate notification time based on alert settings
const getNotificationTime = (event: Event): Date | null => {
  if (!event.alertType || event.alertType === 'none') return null;
  
  const eventDate = event.startDate || event.date;
  // For all-day events, use 9:00 AM as the default time for more practical alerts
  const eventTime = event.startTime || event.time || (event.isAllDay ? '09:00' : '00:00');
  
  if (!eventDate) return null;
  
  const eventDateTime = parseISO(`${eventDate}T${eventTime}`);
  
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
  return Math.abs(hash);
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
  const eventDate = event.startDate || event.date;
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
      // Store the timeout ID for potential cancellation
      const timeoutId = setTimeout(() => {
        new Notification(event.name, {
          body,
          icon: '/favicon.ico',
          tag: event.id,
          requireInteraction: true
        });
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
