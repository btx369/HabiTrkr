export type AlertType = 'none' | '5min' | '15min' | '30min' | '1hour' | '4hours' | '12hours' | '1day' | '4weeks' | 'custom';
export type AlertCustomUnit = 'minutes' | 'hours' | 'days' | 'weeks';

export interface Event {
  id: string;
  name: string;
  description?: string;
  color: string;
  createdAt: string;
  isRecurrent: boolean;
  // Legacy fields for backwards compatibility
  date?: string; // ISO date string for the event date
  time?: string; // Time string (e.g., "14:30")
  // New start/end fields
  startDate?: string; // ISO date string for start date
  startTime?: string; // Time string for start (e.g., "14:30")
  endDate?: string; // ISO date string for end date
  endTime?: string; // Time string for end (e.g., "16:00")
  isAllDay?: boolean; // Whether the event is an all-day event
  location?: string; // Event location
  recurrenceType?: 'daily' | 'weekly' | 'monthly' | 'yearly';
  recurrenceInterval?: number; // Every X days/weeks/months/years
  recurrenceDays?: number[]; // Days of week (0-6) for weekly recurrence
  tags?: string[]; // Tags for categorization (stored without #)
  pinned?: boolean; // Whether the event is pinned
  // Alert/reminder fields
  alertType?: AlertType;
  alertCustomValue?: number; // For custom alerts
  alertCustomUnit?: AlertCustomUnit; // For custom alerts
  originalFolderId?: string; // Stores the folder ID when archived (temporary, stripped on restore)
}
