import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import { useWeekStart, getJsDayFromVisualIndex, getHabitIndexFromVisualIndex, getVisualIndexFromHabitIndex } from "@/contexts/WeekStartContext";
import { useLanguage } from "@/contexts/LanguageContext";

/**
 * Short weekday names as translation keys, indexed by JS day (0 = Sunday).
 *
 * Kept as keys rather than text so the array can stay at module level; `t()` is called at
 * the render site. Slicing the full names would not do: German needs "Di/Mi/Do" where the
 * first three letters give "Die/Mit/Don".
 */
const DAY_SHORT_KEYS = [
  'dayShortSunday', 'dayShortMonday', 'dayShortTuesday', 'dayShortWednesday',
  'dayShortThursday', 'dayShortFriday', 'dayShortSaturday',
] as const;

/** Full weekday names, same indexing, for the buttons' accessible names. */
const DAY_KEYS = [
  'daySunday', 'dayMonday', 'dayTuesday', 'dayWednesday', 'dayThursday', 'dayFriday', 'daySaturday',
] as const;

interface DaySelectorProps {
  selectedDays: boolean[] | number[];
  onDaysChange: (days: boolean[] | number[]) => void;
  className?: string;
  variant?: 'toggle' | 'multi-select';
}

export function DaySelector({ 
  selectedDays, 
  onDaysChange, 
  className,
  variant = 'toggle'
}: DaySelectorProps) {
  const { weekStartDay } = useWeekStart();
  const { t } = useLanguage();
  // The grid is always seven cells, one per visual column, starting at the user's week start.
  const dayInitials = Array.from({ length: 7 }, (_, visualIndex) =>
    t(DAY_SHORT_KEYS[getJsDayFromVisualIndex(visualIndex, weekStartDay)]),
  );

  const handleDayClick = (visualIndex: number) => {
    if (variant === 'toggle') {
      // For boolean array (habits) - array is always [Mon, Tue, Wed, Thu, Fri, Sat, Sun]
      const booleanDays = selectedDays as boolean[];
      const habitIndex = getHabitIndexFromVisualIndex(visualIndex, weekStartDay);
      const newDays = booleanDays.map((selected, i) => i === habitIndex ? !selected : selected);
      onDaysChange(newDays);
    } else {
      // For number array (events) - stored as JS day values (0=Sunday, 6=Saturday)
      const numberDays = selectedDays as number[];
      const jsDay = getJsDayFromVisualIndex(visualIndex, weekStartDay);
      const newDays = numberDays.includes(jsDay)
        ? numberDays.filter(d => d !== jsDay)
        : [...numberDays, jsDay];
      onDaysChange(newDays);
    }
  };

  const isDaySelected = (visualIndex: number) => {
    if (variant === 'toggle') {
      // For boolean array (habits)
      const habitIndex = getHabitIndexFromVisualIndex(visualIndex, weekStartDay);
      return (selectedDays as boolean[])[habitIndex];
    }
    // For number array (events) - check if JS day is in the array
    const jsDay = getJsDayFromVisualIndex(visualIndex, weekStartDay);
    return (selectedDays as number[]).includes(jsDay);
  };

  return (
    <div className={cn("flex justify-center gap-1 sm:gap-2 mt-3", className)}>
      {dayInitials.map((day, visualIndex) => (
        <button
          key={visualIndex}
          type="button"
          // An unselected day shows only a cross, so the name has to come from here.
          aria-label={t(DAY_KEYS[getJsDayFromVisualIndex(visualIndex, weekStartDay)])}
          aria-pressed={isDaySelected(visualIndex)}
          onClick={() => handleDayClick(visualIndex)}
          className={cn(
            "w-9 h-9 sm:w-12 sm:h-10 rounded-full text-sm sm:text-sm touch-manipulation transition-colors flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background",
            isDaySelected(visualIndex) 
              ? "bg-black text-white hover:bg-black/90" 
              : "bg-muted-foreground/35 hover:bg-muted-foreground/45"
          )}
        >
          {isDaySelected(visualIndex) ? day : (
            <div className="flex items-center justify-center">
              <X className="size-3.5 sm:size-4 text-muted-foreground" />
            </div>
          )}
        </button>
      ))}
    </div>
  );
}