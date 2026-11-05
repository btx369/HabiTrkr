export interface Habit {
  id: string;
  name: string;
  description?: string;
  color: string;
  createdAt: string;
  modifiedAt?: string; // Last time the habit definition was edited
  completedDates: string[]; // ISO date strings
  activeDays: boolean[]; // Monday to Sunday (0-6)
  useNumberOfDays?: boolean; // Whether to use number of days per week instead of specific days
  numberOfDaysPerWeek?: number; // Number of days per week (1-999)
  useTimesPerDay?: boolean; // Whether to track multiple times per day
  timesPerDay?: number; // Number of times per day (1-999)
  useUnlimitedTimes?: boolean; // Whether to allow unlimited completions per day
  completionCounts?: Record<string, number>; // Map of date strings to completion counts for unlimited habits
  pinned?: boolean;
  tags?: string[]; // Stored without #, like notes and events
  archived?: boolean;
  originalFolderId?: string; // Track original folder when habit is archived
}

export interface HabitCompletion {
  habitId: string;
  date: string; // ISO date string
  completed: boolean;
}