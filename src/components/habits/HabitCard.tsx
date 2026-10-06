import { useRef, useEffect } from 'react';
import { format, isAfter, startOfDay } from 'date-fns';
import { Pin, RotateCcw, Trash2, Check, FolderOpen } from 'lucide-react';
import { CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ColoredCard } from '@/components/shared/ColoredCard';
import { ItemActionMenu } from '@/components/shared/ItemActionMenu';
import { highlightText } from '@/lib/textHighlight';
import { getTodayKey, toDateKey } from '@/lib/dateUtils';
import { Habit } from '@/types/habit';
import { useWeekStart, getHabitIndexFromVisualIndex } from '@/contexts/WeekStartContext';
import { isDefaultColor } from '@/lib/cardColorStyles';
import { useLanguage } from '@/contexts/LanguageContext';
import { getColoredIconClass, getColoredBorderClass } from '@/lib/coloredButtonStyles';
import { useIsFiled } from '@/contexts/FolderMembershipContext';
import { cn } from '@/lib/utils';

// Helper to convert hex to rgba for glass effect (matching ColoredCard)
const hexToRgba = (hexColor: string, alpha: number): string => {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

interface HabitCardProps {
  habit: Habit;
  weekDays: Date[];
  isCompletedForDate: (habit: Habit, date: Date) => boolean;
  onToggleCompletion: (habitId: string, date: Date) => void;
  onMarkDone: (habitId: string) => void;
  onMarkUnlimitedDone: (habitId: string) => void;
  onUndoCompletion: (habitId: string) => void;
  onEdit: (habit: Habit) => void;
  onArchive: (habitId: string) => void;
  onDelete: (habitId: string) => void;
  onPin: (habitId: string) => void;
  onMoveToFolder?: (habitId: string) => void;
  searchQuery?: string;
  showBulkCheckbox?: boolean;
  isBulkSelected?: boolean;
  onBulkSelect?: (id: string) => void;
}

export function HabitCard({
  habit,
  weekDays,
  isCompletedForDate,
  onToggleCompletion,
  onMarkDone,
  onMarkUnlimitedDone,
  onUndoCompletion,
  onEdit,
  onArchive,
  onDelete,
  onPin,
  onMoveToFolder,
  searchQuery = '',
  showBulkCheckbox,
  isBulkSelected,
  onBulkSelect,
}: HabitCardProps) {
  const { weekStartDay } = useWeekStart();
  const isCompletedToday = isCompletedForDate(habit, new Date());

  // Track when bulk mode was enabled for animation control
  const bulkModeEntryRef = useRef<number | null>(null);

  useEffect(() => {
    if (showBulkCheckbox) {
      if (bulkModeEntryRef.current === null) {
        bulkModeEntryRef.current = Date.now();
      }
    } else {
      bulkModeEntryRef.current = null;
    }
  }, [showBulkCheckbox]);

  const shouldAnimateCheckbox = bulkModeEntryRef.current !== null && 
    (Date.now() - bulkModeEntryRef.current) < 100;

  // Bulk selection checkbox component
  const BulkCheckbox = () => (
    <div 
      className={shouldAnimateCheckbox ? "animate-in zoom-in-50 duration-300" : ""}
      onClick={(e) => {
        e.stopPropagation();
        onBulkSelect?.(habit.id);
      }}
    >
      <div className={cn(
        "h-6 w-6 rounded-full border-2 flex items-center justify-center transition-colors cursor-pointer",
        isBulkSelected 
          ? "bg-black border-black" 
          : "border-muted-foreground bg-background/80 backdrop-blur-sm"
      )}>
        {isBulkSelected && <Check size={14} className="text-white" />}
      </div>
    </div>
  );
  
  const getWeeklyCompletions = () => {
    return weekDays.filter(date => isCompletedForDate(habit, date)).length;
  };

  const getTodayCompletionCount = () => {
    return habit.completionCounts?.[getTodayKey()] || 0;
  };

  const weeklyCompletions = getWeeklyCompletions();
  const todayCount = getTodayCompletionCount();
  const timesPerDay = habit.timesPerDay || 1;
  const hasReachedDailyLimit = habit.useTimesPerDay ? todayCount >= timesPerDay : isCompletedToday;

  // Use standardized color helpers
  const { t } = useLanguage();
  const hasColor = !isDefaultColor(habit.color);
  const iconColorClass = getColoredIconClass(hasColor);
  const badgeBorderClass = getColoredBorderClass(hasColor, 100);
  const textColorClass = hasColor ? 'text-[#000000]' : 'text-foreground';
  // A habit filed in a folder says so on its card, on every list it appears in.
  const isFiled = useIsFiled(habit.id);
  
  // Button styling: habit color background with black border/text when custom color exists
  const coloredButtonStyle: React.CSSProperties = hasColor ? {
    backgroundColor: habit.color,
    borderColor: '#000000',
    color: '#000000',
  } : {};
  const coloredButtonClass = hasColor ? 'border hover:opacity-80' : 'border-foreground text-foreground';

  return (
    <ColoredCard color={habit.color} data-habit-id={habit.id}>
      <CardContent className="px-2 py-2">
        <div className="flex items-start gap-3">
          <div 
            className="flex-1 cursor-pointer"
            onClick={() => onEdit(habit)}
          >
            <h3 className={`text-left text-sm font-medium leading-tight line-clamp-2 ${textColorClass}`}>
              {highlightText(habit.name, searchQuery)}
            </h3>
          </div>
          <div className="flex items-center gap-1">
            {isFiled && <FolderOpen size={14} className={iconColorClass} />}
            {habit.pinned && <Pin size={14} className={iconColorClass} />}
            {showBulkCheckbox ? (
              <BulkCheckbox />
            ) : (
              <ItemActionMenu
                isPinned={habit.pinned}
                onPin={() => onPin(habit.id)}
                onUnpin={() => onPin(habit.id)}
                onEdit={() => onEdit(habit)}
                onMoveToFolder={() => onMoveToFolder?.(habit.id)}
                onArchive={() => onArchive(habit.id)}
                onDelete={() => onDelete(habit.id)}
              />
            )}
          </div>
        </div>

        {habit.useUnlimitedTimes ? (
          <>
            <div className="mt-3 flex items-center justify-between">
              <Badge variant="outline" className={`${badgeBorderClass} ${hasColor ? 'text-[#000000]' : ''}`}>{t('timesToday').replace('{count}', String(todayCount))}</Badge>
              <div className="flex gap-2">
                {todayCount > 0 && (
                <Button size="icon" variant="outline" className={`rounded-full h-8 w-8 ${coloredButtonClass}`} style={coloredButtonStyle} onClick={() => onUndoCompletion(habit.id)}>
                    <RotateCcw size={14} />
                  </Button>
                )}
                <Button size="icon" variant="outline" className={`rounded-full h-8 w-8 ${coloredButtonClass}`} style={coloredButtonStyle} onClick={() => onMarkUnlimitedDone(habit.id)}>
                  +1
                </Button>
              </div>
            </div>
            {/* Weekly completion counts grid */}
            <div className="grid grid-cols-7 gap-1 mt-3">
              {weekDays.map((date) => {
                const dateStr = toDateKey(date);
                const count = habit.completionCounts?.[dateStr] || 0;
                
                // Glass effect matching the card - same opacity, black border
                const dayStyle: React.CSSProperties = hasColor ? {
                  backgroundColor: hexToRgba(habit.color, count > 0 ? 0.9 : 0.5),
                  color: '#000000',
                  border: '1.5px solid #000000',
                } : {
                  border: '1.5px solid #000000',
                };
                
                return (
                  <div
                    key={date.toISOString()}
                    className={`w-full aspect-square rounded-full text-xs flex items-center justify-center backdrop-blur-sm ${
                      hasColor 
                        ? ''
                        : (count > 0 
                            ? 'bg-black text-white' 
                            : 'bg-background/60 text-foreground')
                    }`}
                    style={dayStyle}
                  >
                    {/* Show the count, or the day number when there is nothing to count,
                        matching the other tracking modes. Rendering a bare 0 here read as
                        "zero completions" rather than "this is the 26th". */}
                    {count > 0 ? count : format(date, 'd')}
                  </div>
                );
              })}
            </div>
          </>
        ) : habit.useNumberOfDays ? (
          <>
            <div className="mt-3 flex items-center justify-between">
              <div className="flex flex-col gap-1">
                <Badge variant={weeklyCompletions >= (habit.numberOfDaysPerWeek || 1) ? "default" : "outline"} className={weeklyCompletions >= (habit.numberOfDaysPerWeek || 1) ? '' : `${badgeBorderClass} ${hasColor ? 'text-[#000000]' : ''}`}>
                  {t('daysThisWeek').replace('{done}', String(weeklyCompletions)).replace('{total}', String(habit.numberOfDaysPerWeek || 1))}
                </Badge>
                {habit.useTimesPerDay && (
                  <Badge variant={hasReachedDailyLimit ? "default" : "outline"} className={`text-xs ${hasReachedDailyLimit ? '' : `${badgeBorderClass} ${hasColor ? 'text-[#000000]' : ''}`}`}>
                    {t('timesTodayOf').replace('{done}', String(todayCount)).replace('{total}', String(timesPerDay))}
                  </Badge>
                )}
              </div>
              <div className="flex gap-2">
                {(habit.useTimesPerDay ? todayCount > 0 : isCompletedToday) && (
                <Button size="icon" variant="outline" className={`rounded-full h-8 w-8 ${coloredButtonClass}`} style={coloredButtonStyle} onClick={() => onUndoCompletion(habit.id)}>
                    <RotateCcw size={14} />
                  </Button>
                )}
                <Button 
                  size="sm" 
                  variant={hasReachedDailyLimit ? "default" : "outline"}
                  className={`rounded-full ${hasReachedDailyLimit ? '' : coloredButtonClass}`}
                  style={hasReachedDailyLimit ? {} : coloredButtonStyle}
                  onClick={() => onMarkDone(habit.id)}
                  disabled={hasReachedDailyLimit}
                >
                  {hasReachedDailyLimit ? t('done') : habit.useTimesPerDay ? `+1` : t('markDone')}
                </Button>
              </div>
            </div>
            {/* Weekly completion grid */}
            <div className="grid grid-cols-7 gap-1 mt-3">
              {weekDays.map((date) => {
                const isCompleted = isCompletedForDate(habit, date);
                const dayDateStr = format(date, 'yyyy-MM-dd');
                const dayCount = habit.completionCounts?.[dayDateStr] || 0;
                
                // Glass effect matching the card - same opacity, black border
                const dayStyle: React.CSSProperties = hasColor ? {
                  backgroundColor: hexToRgba(habit.color, isCompleted ? 0.9 : 0.5),
                  color: '#000000',
                  border: '1.5px solid #000000',
                } : {
                  border: '1.5px solid #000000',
                };
                
                return (
                  <div
                    key={date.toISOString()}
                    className={`w-full aspect-square rounded-full text-xs flex items-center justify-center backdrop-blur-sm ${
                      hasColor 
                        ? ''
                        : (isCompleted 
                            ? 'bg-black text-white' 
                            : 'bg-background/60 text-foreground')
                    }`}
                    style={dayStyle}
                  >
                    {isCompleted 
                      ? (habit.useTimesPerDay ? dayCount : '✓') 
                      : format(date, 'd')}
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="grid grid-cols-7 gap-1 mt-3">
            {weekDays.map((date, visualIndex) => {
              // Map visual index to habit array index (where 0=Monday always)
              const habitIndex = getHabitIndexFromVisualIndex(visualIndex, weekStartDay);
              const isActive = habit.activeDays?.[habitIndex] ?? true;
              const isCompleted = isCompletedForDate(habit, date);
              
              // Glass effect matching the card - same opacity, black border
              const dayStyle: React.CSSProperties = hasColor ? {
                backgroundColor: !isActive 
                  ? 'hsl(var(--muted))' 
                  : hexToRgba(habit.color, isCompleted ? 0.9 : 0.5),
                color: !isActive ? 'hsl(var(--muted-foreground))' : '#000000',
                border: '1.5px solid #000000',
              } : {
                border: '1.5px solid #000000',
              };
              
              return (
                <button
                  key={date.toISOString()}
                onClick={() => {
                  if (!isActive) return;
                  // Prevent marking future days as complete
                  const today = startOfDay(new Date());
                  if (isAfter(startOfDay(date), today)) return;
                  onToggleCompletion(habit.id, date);
                }}
                  disabled={!isActive}
                  style={dayStyle}
                  className={`w-full aspect-square rounded-full text-xs flex items-center justify-center transition-colors backdrop-blur-sm ${
                    hasColor 
                      ? (!isActive ? 'cursor-not-allowed' : 'hover:opacity-80')
                      : (!isActive 
                          ? 'bg-muted text-muted-foreground cursor-not-allowed' 
                          : isCompleted 
                            ? 'bg-black text-white' 
                            : 'bg-muted/60 text-foreground hover:bg-hover')
                  }`}
                >
                  {isCompleted ? '✓' : format(date, 'd')}
                </button>
              );
            })}
          </div>
        )}
      </CardContent>
    </ColoredCard>
  );
}

interface ArchivedHabitCardProps {
  habit: Habit;
  onRestore: (habitId: string) => void;
  onDelete: (habitId: string) => void;
  searchQuery?: string;
  showBulkCheckbox?: boolean;
  isBulkSelected?: boolean;
  onBulkSelect?: (id: string) => void;
}

export function ArchivedHabitCard({
  habit,
  onRestore,
  onDelete,
  searchQuery = '',
  showBulkCheckbox,
  isBulkSelected,
  onBulkSelect,
}: ArchivedHabitCardProps) {
  // This card has no icon row of its own, so the folder glyph is placed where the other
  // cards put their icons: immediately before the actions.
  const hasColor = !isDefaultColor(habit.color);
  const iconColorClass = getColoredIconClass(hasColor);
  const isFiled = useIsFiled(habit.id);

  // Bulk selection checkbox component
  const BulkCheckbox = () => (
    <div 
      onClick={(e) => {
        e.stopPropagation();
        onBulkSelect?.(habit.id);
      }}
    >
      <div className={cn(
        "h-6 w-6 rounded-full border-2 flex items-center justify-center transition-colors cursor-pointer",
        isBulkSelected 
          ? "bg-black border-black" 
          : "border-muted-foreground bg-background/80 backdrop-blur-sm"
      )}>
        {isBulkSelected && <Check size={14} className="text-white" />}
      </div>
    </div>
  );

  return (
    <ColoredCard color={habit.color} data-habit-id={habit.id}>
      <CardContent className="px-2 py-2">
        <div className="flex items-start justify-between">
          <h3 className="text-sm font-medium text-foreground">{highlightText(habit.name, searchQuery)}</h3>
          <div className="flex items-center gap-2">
            {isFiled && <FolderOpen size={14} className={iconColorClass} />}
            {showBulkCheckbox ? (
              <BulkCheckbox />
            ) : (
              <>
                <Button size="icon" variant="outline" className="rounded-full h-8 w-8" onClick={() => onRestore(habit.id)}>
                  <RotateCcw size={14} />
                </Button>
                <Button size="icon" variant="destructive" className="rounded-full h-8 w-8" onClick={() => onDelete(habit.id)}>
                  <Trash2 size={14} />
                </Button>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </ColoredCard>
  );
}
