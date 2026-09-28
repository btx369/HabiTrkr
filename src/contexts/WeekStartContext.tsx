import { createContext, useContext, useState, ReactNode } from 'react';
import { getLocalStorageString, setLocalStorageString } from '@/lib/localStorageUtils';
import { WEEK_START_KEY } from '@/lib/storageKeys';

export type WeekStartDay = 'monday' | 'saturday' | 'sunday';

interface WeekStartContextType {
  weekStartDay: WeekStartDay;
  setWeekStartDay: (day: WeekStartDay) => void;
  weekStartsOn: 0 | 1 | 6; // For date-fns compatibility (0=Sunday, 1=Monday, 6=Saturday)
}

const WeekStartContext = createContext<WeekStartContextType | undefined>(undefined);

interface WeekStartProviderProps {
  children: ReactNode;
}

export function WeekStartProvider({ children }: WeekStartProviderProps) {
  const [weekStartDay, setWeekStartDayState] = useState<WeekStartDay>(() => {
    const saved = getLocalStorageString(WEEK_START_KEY, 'monday');
    if (saved === 'saturday' || saved === 'sunday') return saved;
    return 'monday';
  });

  const handleSetWeekStartDay = (newDay: WeekStartDay) => {
    setWeekStartDayState(newDay);
    setLocalStorageString(WEEK_START_KEY, newDay);
  };

  // Convert to date-fns weekStartsOn value
  const weekStartsOn: 0 | 1 | 6 = weekStartDay === 'sunday' ? 0 : weekStartDay === 'saturday' ? 6 : 1;

  return (
    <WeekStartContext.Provider value={{ 
      weekStartDay, 
      setWeekStartDay: handleSetWeekStartDay, 
      weekStartsOn 
    }}>
      {children}
    </WeekStartContext.Provider>
  );
}

export function useWeekStart() {
  const context = useContext(WeekStartContext);
  if (context === undefined) {
    throw new Error('useWeekStart must be used within a WeekStartProvider');
  }
  return context;
}

// Helper function to get ordered day names based on week start
export function getOrderedDayNames(weekStartDay: WeekStartDay): string[] {
  const allDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  if (weekStartDay === 'sunday') return allDays;
  if (weekStartDay === 'saturday') return ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
  return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']; // monday
}

// Helper function to get ordered day initials based on week start
export function getOrderedDayInitials(weekStartDay: WeekStartDay): string[] {
  const allInitials = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  if (weekStartDay === 'sunday') return allInitials;
  if (weekStartDay === 'saturday') return ['S', 'S', 'M', 'T', 'W', 'T', 'F'];
  return ['M', 'T', 'W', 'T', 'F', 'S', 'S']; // monday
}

// Helper function to get the JS day value (0-6 where 0=Sunday) for a visual index
export function getJsDayFromVisualIndex(visualIndex: number, weekStartDay: WeekStartDay): number {
  if (weekStartDay === 'sunday') return visualIndex; // 0=Sun, 1=Mon, ..., 6=Sat
  if (weekStartDay === 'saturday') return (visualIndex + 6) % 7; // 0=Sat, 1=Sun, 2=Mon, ...
  return (visualIndex + 1) % 7; // 0=Mon, 1=Tue, ..., 6=Sun → JS day: 1,2,3,4,5,6,0
}

// Helper function to get visual index from JS day value
export function getVisualIndexFromJsDay(jsDay: number, weekStartDay: WeekStartDay): number {
  if (weekStartDay === 'sunday') return jsDay;
  if (weekStartDay === 'saturday') return (jsDay + 1) % 7;
  return jsDay === 0 ? 6 : jsDay - 1; // JS day 0 (Sunday) → visual index 6
}

// For habits: convert between visual index and habit array index (where 0=Monday always)
export function getHabitIndexFromVisualIndex(visualIndex: number, weekStartDay: WeekStartDay): number {
  // Habit array: 0=Mon, 1=Tue, 2=Wed, 3=Thu, 4=Fri, 5=Sat, 6=Sun
  if (weekStartDay === 'monday') return visualIndex;
  if (weekStartDay === 'sunday') return visualIndex === 0 ? 6 : visualIndex - 1;
  // saturday: visual 0=Sat, 1=Sun, 2=Mon...
  return (visualIndex + 5) % 7;
}

export function getVisualIndexFromHabitIndex(habitIndex: number, weekStartDay: WeekStartDay): number {
  if (weekStartDay === 'monday') return habitIndex;
  if (weekStartDay === 'sunday') return (habitIndex + 1) % 7;
  // saturday
  return (habitIndex + 2) % 7;
}
