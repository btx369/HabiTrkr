import { useRef, useEffect } from 'react';
import { format, isAfter, startOfDay } from 'date-fns';
import { RotateCcw, Trash2, Check, FolderOpen, GripVertical } from 'lucide-react';
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
import type { ViewType } from '@/types/view';

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
  viewType?: ViewType;
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
  isDragEnabled?: boolean;
  isDragged?: boolean;
  onDragStart?: (id: string, event: React.DragEvent<HTMLDivElement>) => void;
  onDragOver?: (id: string, event: React.DragEvent<HTMLDivElement>) => void;
  onDrop?: (event: React.DragEvent<HTMLDivElement>) => void;
  onDragEnd?: () => void;
}

export function HabitCard({
  habit,
  viewType = 'list',
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
  isDragEnabled = false,
  isDragged = false,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
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

  const handleCardAction = (event: React.MouseEvent, action: () => void) => {
    event.stopPropagation();
    if (showBulkCheckbox) {
      onBulkSelect?.(habit.id);
      return;
    }
    action();
  };

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

  const dayButtonSize = viewType === 'x3' ? 'h-5 w-5 text-[9px]' : 'h-7 w-7 text-xs';
  const today = startOfDay(new Date());

  return (
    <ColoredCard
      color={habit.color}
      data-habit-id={habit.id}
      draggable={isDragEnabled && !showBulkCheckbox}
      onDragStart={(event) => onDragStart?.(habit.id, event)}
      onDragOver={(event) => onDragOver?.(habit.id, event)}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={cn('rounded-2xl', showBulkCheckbox && 'cursor-pointer', isDragEnabled && !showBulkCheckbox && 'cursor-grab active:cursor-grabbing', isDragged && 'opacity-50')}
      onClick={() => showBulkCheckbox && onBulkSelect?.(habit.id)}
    >
      <CardContent className="px-3 py-2">
        <div className={cn('flex min-w-0 items-center', viewType === 'x3' ? 'gap-1' : 'gap-2')}>
          {isDragEnabled && !showBulkCheckbox && (
            <GripVertical data-habit-drag-handle className="h-4 w-4 shrink-0 cursor-grab touch-none text-muted-foreground active:cursor-grabbing" aria-label="Reorder habit" />
          )}
          <button
            type="button"
            className={cn('min-w-0 flex-1 truncate text-left text-sm font-medium', textColorClass)}
            onClick={(event) => handleCardAction(event, () => onEdit(habit))}
            title={habit.name}
          >
            {highlightText(habit.name, searchQuery)}
          </button>

          <div className={cn('flex min-w-0 shrink items-center', viewType === 'x3' ? 'gap-0.5' : 'gap-1.5')}>
            {habit.useUnlimitedTimes && (
              <>
                <Badge
                  variant="outline"
                  title={t('timesToday').replace('{count}', String(todayCount))}
                  className={cn('whitespace-nowrap', viewType === 'x3' ? 'h-5 px-1 text-[9px]' : 'h-6 px-2 text-[10px]', badgeBorderClass, hasColor && 'text-[#000000]')}
                >
                  {todayCount}x{viewType !== 'x3' && ` ${t('today')}`}
                </Badge>
                {todayCount > 0 && (
                  <Button
                    size="icon"
                    variant="outline"
                    aria-label={t('undo')}
                    className={cn('shrink-0 rounded-full', viewType === 'x3' ? 'h-5 w-5' : 'h-6 w-6', coloredButtonClass)}
                    style={coloredButtonStyle}
                    onClick={(event) => handleCardAction(event, () => onUndoCompletion(habit.id))}
                  >
                    <RotateCcw size={viewType === 'x3' ? 10 : 12} />
                  </Button>
                )}
                <Button
                  size="icon"
                  variant="outline"
                  aria-label="+1"
                  className={cn('shrink-0 rounded-full text-[9px]', viewType === 'x3' ? 'h-5 w-5' : 'h-6 w-6', coloredButtonClass)}
                  style={coloredButtonStyle}
                  onClick={(event) => handleCardAction(event, () => onMarkUnlimitedDone(habit.id))}
                >
                  +1
                </Button>
              </>
            )}

            {habit.useNumberOfDays && (
              <Badge
                variant="outline"
                title={t('daysThisWeek').replace('{done}', String(weeklyCompletions)).replace('{total}', String(habit.numberOfDaysPerWeek || 1))}
                className={cn('h-6 whitespace-nowrap px-2 text-[10px]', viewType === 'x3' && 'h-5 px-1 text-[9px]', badgeBorderClass, hasColor && 'text-[#000000]')}
              >
                {viewType === 'x3'
                  ? `${weeklyCompletions}/${habit.numberOfDaysPerWeek || 1}`
                  : t('daysThisWeek').replace('{done}', String(weeklyCompletions)).replace('{total}', String(habit.numberOfDaysPerWeek || 1))}
              </Badge>
            )}

            {habit.useTimesPerDay && !habit.useUnlimitedTimes && (
              <>
                <Badge
                  variant="outline"
                  title={t('timesTodayOf').replace('{done}', String(todayCount)).replace('{total}', String(timesPerDay))}
                  className={cn('whitespace-nowrap', viewType === 'x3' ? 'h-5 px-1 text-[9px]' : 'h-6 px-2 text-[10px]', badgeBorderClass, hasColor && 'text-[#000000]')}
                >
                  {viewType === 'x3' ? `${todayCount}/${timesPerDay}` : t('timesTodayOf').replace('{done}', String(todayCount)).replace('{total}', String(timesPerDay))}
                </Badge>
                {todayCount > 0 && (
                  <Button
                    size="icon"
                    variant="outline"
                    aria-label={t('undo')}
                    className={cn('shrink-0 rounded-full', viewType === 'x3' ? 'h-5 w-5' : 'h-6 w-6', coloredButtonClass)}
                    style={coloredButtonStyle}
                    onClick={(event) => handleCardAction(event, () => onUndoCompletion(habit.id))}
                  >
                    <RotateCcw size={viewType === 'x3' ? 10 : 12} />
                  </Button>
                )}
              </>
            )}
          </div>

          {isFiled && <FolderOpen size={14} className={cn('shrink-0', iconColorClass)} />}
          <div className={cn('flex shrink-0 items-center', viewType === 'x3' ? 'gap-0.5' : 'gap-1')}>
            {weekDays.map((date, visualIndex) => {
              const dateKey = toDateKey(date);
              const isToday = startOfDay(date).getTime() === today.getTime();
              const isFuture = isAfter(startOfDay(date), today);
              const isCompleted = isCompletedForDate(habit, date);
              const count = habit.completionCounts?.[dateKey] || 0;
              const habitIndex = getHabitIndexFromVisualIndex(visualIndex, weekStartDay);
              const isActive = habit.useNumberOfDays || habit.useTimesPerDay || habit.useUnlimitedTimes
                ? true
                : habit.activeDays?.[habitIndex] ?? true;
              const isDisabled = !showBulkCheckbox && (!isActive || isFuture || (habit.useTimesPerDay && isToday && hasReachedDailyLimit));
              const isCounted = habit.useUnlimitedTimes ? count > 0 : isCompleted;
              const dayStyle: React.CSSProperties = hasColor ? {
                backgroundColor: !isActive
                  ? 'hsl(var(--muted))'
                  : hexToRgba(habit.color, isCounted ? 0.9 : 0.5),
                color: !isActive ? 'hsl(var(--muted-foreground))' : '#000000',
                border: '1px solid rgba(0, 0, 0, 0.3)',
              } : {};

              const dayLabel = habit.useUnlimitedTimes
                ? (count > 0 ? String(count) : format(date, 'd'))
                : isCompleted
                  ? (habit.useTimesPerDay && count > 0 ? String(count) : '✓')
                  : format(date, 'd');

              return (
                <button
                  key={date.toISOString()}
                  type="button"
                  disabled={isDisabled}
                  aria-label={format(date, 'EEEE, MMMM d') + (isCompleted ? ', ' + t('done') : '')}
                  aria-pressed={isCompleted}
                  onClick={(event) => {
                    event.stopPropagation();
                    if (showBulkCheckbox) {
                      onBulkSelect?.(habit.id);
                      return;
                    }
                    if (!isActive || isFuture || (habit.useTimesPerDay && isToday && hasReachedDailyLimit)) return;
                    if (habit.useUnlimitedTimes) {
                      if (isToday) onMarkUnlimitedDone(habit.id);
                    } else if (habit.useTimesPerDay && isToday) {
                      onMarkDone(habit.id);
                    } else {
                      onToggleCompletion(habit.id, date);
                    }
                  }}
                  style={dayStyle}
                  className={cn(
                    'flex shrink-0 items-center justify-center rounded-full border transition-colors',
                    dayButtonSize,
                    hasColor
                      ? (!isActive ? 'cursor-not-allowed opacity-50' : 'hover:opacity-80')
                      : isCounted
                        ? 'border-[#2f80e7] bg-[#2f80e7] text-white hover:bg-[#2875d3]'
                        : 'border-border bg-background text-foreground hover:bg-hover',
                    isDisabled && 'cursor-not-allowed opacity-50'
                  )}
                >
                  {dayLabel}
                </button>
              );
            })}
          </div>

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
  isDragEnabled?: boolean;
  isDragged?: boolean;
  onDragStart?: (id: string, event: React.DragEvent<HTMLDivElement>) => void;
  onDragOver?: (id: string, event: React.DragEvent<HTMLDivElement>) => void;
  onDrop?: (event: React.DragEvent<HTMLDivElement>) => void;
  onDragEnd?: () => void;
}

export function ArchivedHabitCard({
  habit,
  onRestore,
  onDelete,
  searchQuery = '',
  showBulkCheckbox,
  isBulkSelected,
  onBulkSelect,
  isDragEnabled = false,
  isDragged = false,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
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
    <ColoredCard
      color={habit.color}
      data-habit-id={habit.id}
      draggable={isDragEnabled && !showBulkCheckbox}
      onDragStart={(event) => onDragStart?.(habit.id, event)}
      onDragOver={(event) => onDragOver?.(habit.id, event)}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={cn(showBulkCheckbox && 'cursor-pointer', isDragEnabled && !showBulkCheckbox && 'cursor-grab active:cursor-grabbing', isDragged && 'opacity-50')}
      onClick={() => showBulkCheckbox && onBulkSelect?.(habit.id)}
    >
      <CardContent className="px-2 py-2">
        <div className="flex items-start justify-between">
          <div className="flex min-w-0 items-start gap-2">
            {isDragEnabled && !showBulkCheckbox && (
              <GripVertical data-habit-drag-handle className="mt-0.5 h-5 w-5 shrink-0 cursor-grab touch-none text-muted-foreground active:cursor-grabbing" aria-label="Reorder habit" />
            )}
            <h3 className="text-sm font-medium text-foreground">{highlightText(habit.name, searchQuery)}</h3>
          </div>
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
