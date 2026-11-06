import { useState, useRef, useEffect } from 'react';
import { FolderOpen, ChevronDown, ChevronRight, Pin, Check, RotateCcw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { HabitFolder } from '@/types/habitFolder';
import { Habit } from '@/types/habit';
import { HabitCard, ArchivedHabitCard } from '@/components/habits/HabitCard';
import { ItemActionMenu } from '@/components/shared/ItemActionMenu';
import { useLanguage } from '@/contexts/LanguageContext';
import { countedNoun } from '@/lib/countedMessage';
import { highlightText } from '@/lib/textHighlight';
import { ColoredCard } from '@/components/shared/ColoredCard';
import { isDefaultColor } from '@/lib/cardColorStyles';
import { getColoredIconClass } from '@/lib/coloredButtonStyles';
import { cn } from '@/lib/utils';

interface HabitFolderCardProps {
  folder: HabitFolder;
  habits: Habit[];
  weekDays: Date[];
  isCompletedForDate: (habit: Habit, date: Date) => boolean;
  onToggleCompletion: (habitId: string, date: Date) => void;
  onMarkDone: (habitId: string) => void;
  onMarkUnlimitedDone: (habitId: string) => void;
  onUndoCompletion: (habitId: string) => void;
  onEditHabit: (habit: Habit) => void;
  onViewHabit?: (habit: Habit) => void;
  onArchiveHabit: (habitId: string) => void;
  onDeleteHabit: (habitId: string) => void;
  onPinHabit: (habitId: string) => void;
  onCopyHabit?: (habitId: string) => void;
  onShareHabit?: (habitId: string) => void;
  onRestoreHabit?: (habitId: string) => void;
  onPinFolder: (folderId: string) => void;
  onUnpinFolder: (folderId: string) => void;
  onEditFolder: (folderId: string) => void;
  onArchiveFolder: (folderId: string) => void;
  onDeleteFolder: (folderId: string) => void;
  onRestoreFolder?: (folderId: string) => void;
  isDeleted?: boolean;
  searchQuery?: string;
  showBulkCheckbox?: boolean;
  isBulkSelected?: boolean;
  onBulkSelect?: (id: string) => void;
}

export function HabitFolderCard({
  folder,
  habits,
  weekDays,
  isCompletedForDate,
  onToggleCompletion,
  onMarkDone,
  onMarkUnlimitedDone,
  onUndoCompletion,
  onEditHabit,
  onViewHabit,
  onArchiveHabit,
  onDeleteHabit,
  onCopyHabit,
  onShareHabit,
  onPinHabit,
  onRestoreHabit,
  onPinFolder,
  onUnpinFolder,
  onEditFolder,
  onArchiveFolder,
  onDeleteFolder,
  onRestoreFolder,
  isDeleted = false,
  searchQuery = '',
  showBulkCheckbox = false,
  isBulkSelected = false,
  onBulkSelect,
}: HabitFolderCardProps) {
  const { t, language } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const folderHabits = habits.filter(habit => folder.habitIds.includes(habit.id));

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

  // Only animate checkbox on initial bulk mode entry (within 100ms)
  const shouldAnimateCheckbox = bulkModeEntryRef.current !== null && 
    (Date.now() - bulkModeEntryRef.current) < 100;

  // Treat folders rendered with a restore handler as archived
  const isFolderArchived = Boolean(onRestoreFolder) || Boolean(folder.archived);
  
  // Use standardized color helpers for consistent styling
  const hasColor = !isDefaultColor(folder.color);
  const iconColorClass = getColoredIconClass(hasColor);
  const mutedTextColorClass = hasColor ? 'text-[#000000]/70' : 'text-muted-foreground';

  // Bulk selection checkbox component
  const BulkCheckbox = () => (
    <div 
      className={shouldAnimateCheckbox ? "animate-in zoom-in-50 duration-300" : ""}
      onClick={(e) => {
        e.stopPropagation();
        onBulkSelect?.(folder.id);
      }}
    >
      <div className={cn(
        "h-6 w-6 rounded-full border-2 flex items-center justify-center transition-colors cursor-pointer",
        isBulkSelected 
          ? "bg-black border-black" 
          : "border-muted-foreground bg-background/80 backdrop-blur-sm"
      )}>
        {isBulkSelected && <Check size={20} className="text-white" />}
      </div>
    </div>
  );

  return (
    <ColoredCard 
      color={folder.color}
      className="transition-all group relative"
    >
      <Collapsible open={isOpen} onOpenChange={showBulkCheckbox ? undefined : setIsOpen}>
        <CardContent className="px-2 py-2">
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <CollapsibleTrigger asChild>
                <div 
                  className="flex items-center gap-2 cursor-pointer"
                  onClick={(e) => {
                    if (showBulkCheckbox) {
                      e.preventDefault();
                      onBulkSelect?.(folder.id);
                    }
                  }}
                >
                  {isOpen ? (
                    <ChevronDown size={20} className={iconColorClass} />
                  ) : (
                    <ChevronRight size={20} className={iconColorClass} />
                  )}
                  <h4 className="text-sm font-medium truncate flex-1">{highlightText(folder.name, searchQuery)}</h4>
                </div>
              </CollapsibleTrigger>
              {folder.description && (
                <p className={`text-xs ${mutedTextColorClass} mb-1 ml-6`}>{highlightText(folder.description, searchQuery)}</p>
              )}
              <p className={`text-xs ${mutedTextColorClass} ml-6`}>
                {countedNoun(t, language, 'habit', folderHabits.length)}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <FolderOpen size={20} className={iconColorClass} />
              {folder.pinned && !isFolderArchived && <Pin size={20} className={iconColorClass} />}
              {showBulkCheckbox ? (
                <BulkCheckbox />
              ) : (isFolderArchived || isDeleted) ? (
                <div className="flex gap-1">
                  <Button 
                    aria-label={t('restore')}
                    size="icon" 
                    variant="outline" 
                    className="rounded-full h-8 w-8" 
                    onClick={(e) => { e.stopPropagation(); onRestoreFolder?.(folder.id); }}
                  >
                    <RotateCcw size={20} />
                  </Button>
                  <Button 
                    aria-label={t('delete')}
                    size="icon" 
                    variant="destructive" 
                    className="rounded-full h-8 w-8" 
                    onClick={(e) => { e.stopPropagation(); onDeleteFolder(folder.id); }}
                  >
                    <Trash2 size={20} />
                  </Button>
                </div>
              ) : (
                <ItemActionMenu
                  isPinned={folder.pinned}
                  isArchived={isFolderArchived}
                  isDeleted={isDeleted}
                  onPin={!isFolderArchived ? () => onPinFolder(folder.id) : undefined}
                  onUnpin={!isFolderArchived ? () => onUnpinFolder(folder.id) : undefined}
                  onEdit={!isFolderArchived ? () => onEditFolder(folder.id) : undefined}
                  onArchive={!isFolderArchived && onArchiveFolder ? () => onArchiveFolder(folder.id) : undefined}
                  onDelete={() => onDeleteFolder(folder.id)}
                  onRestore={isFolderArchived && onRestoreFolder ? () => onRestoreFolder(folder.id) : undefined}
                />
              )}
            </div>
          </div>
        </CardContent>
        
        <CollapsibleContent>
          <div className="pt-0 pb-2 px-1">
            {folderHabits.length === 0 ? (
              <div className={`text-center py-4 ${mutedTextColorClass} text-sm`}>
                {t('noHabitsInFolder')}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-1">
                {folderHabits.map(habit => (
                  <div key={habit.id} className="scale-95">
                    {isFolderArchived ? (
                      <ArchivedHabitCard
                        habit={habit}
                        onRestore={onRestoreHabit || (() => {})}
                        onDelete={onDeleteHabit}
                        searchQuery={searchQuery}
                      />
                    ) : (
                      <HabitCard
                        habit={habit}
                        weekDays={weekDays}
                        isCompletedForDate={isCompletedForDate}
                        onToggleCompletion={onToggleCompletion}
                        onMarkDone={onMarkDone}
                        onMarkUnlimitedDone={onMarkUnlimitedDone}
                        onUndoCompletion={onUndoCompletion}
                        onEdit={onEditHabit}
                        onView={onViewHabit}
                        onArchive={onArchiveHabit}
                        onDelete={onDeleteHabit}
                        onPin={onPinHabit}
                        onCopy={onCopyHabit}
                        onShare={onShareHabit}
                        searchQuery={searchQuery}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </ColoredCard>
  );
}
