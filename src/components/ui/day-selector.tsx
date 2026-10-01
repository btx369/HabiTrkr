import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import { useWeekStart, getOrderedDayInitials, getJsDayFromVisualIndex, getVisualIndexFromJsDay, getHabitIndexFromVisualIndex, getVisualIndexFromHabitIndex } from "@/contexts/WeekStartContext";

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
  const dayInitials = getOrderedDayInitials(weekStartDay);

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