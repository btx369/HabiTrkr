import { useState, useCallback, useRef } from 'react';
import { Plus, ChevronLeft, ChevronRight, Target, FileStack } from 'lucide-react';
import { format, addWeeks, subWeeks, startOfWeek, addDays, isSameDay, isSameWeek } from 'date-fns';
import { Layout } from '@/components/Layout';
import { FolderMembershipProvider, collectFiledIds } from '@/contexts/FolderMembershipContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, SlidingTabsList, TabsTrigger } from '@/components/ui/tabs';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { Habit } from '@/types/habit';
import { HabitFolder } from '@/types/habitFolder';
import { ConfirmationDialog } from '@/components/shared/ConfirmationDialog';
import { HabitEditor } from '@/components/habits/HabitEditor';
import { HabitCard, ArchivedHabitCard } from '@/components/habits/HabitCard';
import { HabitFolderCard } from '@/components/habits/HabitFolderCard';
import { HabitFolderCreator } from '@/components/habits/HabitFolderCreator';
import { HabitFolderEditor } from '@/components/habits/HabitFolderEditor';
import { MoveToFolderDialog } from '@/components/shared/MoveToFolderDialog';
import { FolderActionDialog } from '@/components/shared/FolderActionDialog';
import { useFolderActions } from '@/hooks/useFolderActions';
import { HabitViewSettings, HabitSortType, HabitSortDirection } from '@/components/habits/HabitViewSettings';
import type { ViewType } from '@/types/view';
import { HabitFolderViewSettings, HabitFolderSortType, HabitFolderSortDirection } from '@/components/habits/HabitFolderViewSettings';
import { BulkActionBar, BulkActionType, BulkActionContext } from '@/components/shared/BulkActionBar';
import { useToastSettings } from '@/contexts/ToastContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { countedSentence, itemDisplayName, namedSentence } from '@/lib/countedMessage';
import { useDateLocale } from '@/lib/dateLocale';
import { useWeekStart, getJsDayFromVisualIndex } from '@/contexts/WeekStartContext';
import { FLOATING_ADD_CLASS, FLOATING_ADD_STYLE } from '@/lib/floatingAdd';
import { useBulkSelection } from '@/hooks/useBulkSelection';
import { useSwipeGesture } from '@/hooks/useSwipeGesture';
import { getTodayKey, toDateKey } from '@/lib/dateUtils';
import { cn } from '@/lib/utils';
import { entitySentence } from '@/lib/entityToast';

// Tab order for swipe navigation. Module-level so its identity is stable across
// renders: declared inside the component it was rebuilt every render, which made it
// unsafe to list as a useCallback dependency (the callback would be recreated each
// time) and left the callbacks reading a value the linter could not verify.
const HABIT_TABS = ['habits', 'folders', 'archived'];

// Short weekday translation keys, indexed by JS day value (0 = Sunday). Kept as KEYS
// rather than text because this is module level, where no hook can run; the header below
// resolves them with `t()` at render time.
//
// These are the dedicated short-name keys, not the full names cut to three characters.
// Slicing looks fine in English and Portuguese and is wrong in German, which needs
// "Di/Mi/Do" where the first three letters give "Die/Mit/Don".
const DAY_SHORT_KEYS = [
  'dayShortSunday',
  'dayShortMonday',
  'dayShortTuesday',
  'dayShortWednesday',
  'dayShortThursday',
  'dayShortFriday',
  'dayShortSaturday',
] as const;

export default function HabitTracker() {
  const { toast } = useToastSettings();
  const { t, language } = useLanguage();
  // Toast copy is a translated sentence plus a translated entity noun. Both halves are
  // resolved here so the `{entity}` substitution is written once instead of at every toast.
  const say = (key: string, entity: string) => entitySentence(t, language, key, entity);
  // Folder toasts name the items a folder contains rather than the folder itself.
  const dateLocale = useDateLocale();
  const { weekStartsOn, weekStartDay } = useWeekStart();
  // Weekday labels follow the configured week start.
  const orderedDayNames = Array.from({ length: 7 }, (_, index) =>
    t(DAY_SHORT_KEYS[getJsDayFromVisualIndex(index, weekStartDay)])
  );
  
  // Tab navigation
  const [activeTab, setActiveTab] = useState('habits');
  
  // Habit state
  const [habits, setHabits] = useLocalStorage<Habit[]>('habits', []);
  const [archivedHabits, setArchivedHabits] = useLocalStorage<Habit[]>('archivedHabits', []);
  
  // Folder state
  const [habitFolders, setHabitFolders] = useLocalStorage<HabitFolder[]>('habitFolders', []);
  const [archivedHabitFolders, setArchivedHabitFolders] = useLocalStorage<HabitFolder[]>('archivedHabitFolders', []);
  
  // Dialog state
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedHabit, setSelectedHabit] = useState<Habit | null>(null);
  const [habitToDelete, setHabitToDelete] = useState<string | null>(null);
  const [habitToArchive, setHabitToArchive] = useState<string | null>(null);
  
  // Folder dialogs
  const [isFolderCreatorOpen, setIsFolderCreatorOpen] = useState(false);
  const [isFolderEditorOpen, setIsFolderEditorOpen] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<HabitFolder | null>(null);
  const [isMoveToFolderOpen, setIsMoveToFolderOpen] = useState(false);
  const [habitToMove, setHabitToMove] = useState<string | null>(null);
  const [habitsToMove, setHabitsToMove] = useState<string[] | null>(null);
  const [pendingBulkFolderAction, setPendingBulkFolderAction] = useState<{
    kind: 'archive' | 'delete';
    folderIds: string[];
    selectedItemIds: string[];
  } | null>(null);
  
  // Calendar state
  const [currentWeek, setCurrentWeek] = useState(new Date());
  
  // Sort settings for habits tab
  const [storedAllHabitsViewType, setAllHabitsViewType] = useLocalStorage<ViewType>('habitsAllViewType', 'list');
  const [storedArchivedHabitsViewType, setArchivedHabitsViewType] = useLocalStorage<ViewType>('habitsArchivedViewType', 'list');
  // Habits have no 3-per-row view: a saved `x3` is treated as `x2`.
  const allHabitsViewType: ViewType = storedAllHabitsViewType === 'x3' ? 'x2' : storedAllHabitsViewType;
  const archivedHabitsViewType: ViewType = storedArchivedHabitsViewType === 'x3' ? 'x2' : storedArchivedHabitsViewType;
  const [habitsSortType, setHabitsSortType] = useLocalStorage<HabitSortType>('habitsSortType', 'name');
  const [habitsSortDirection, setHabitsSortDirection] = useLocalStorage<HabitSortDirection>('habitsSortDirection', 'asc');
  const [habitsCustomOrder, setHabitsCustomOrder] = useLocalStorage<string[]>('habitsCustomOrder', []);
  const [habitsReorderingEnabled, setHabitsReorderingEnabled] = useState(false);
  
  // Sort settings for folders tab
  const [habitFoldersSortType, setHabitFoldersSortType] = useLocalStorage<HabitFolderSortType>('habitFoldersSortType', 'name');
  const [habitFoldersSortDirection, setHabitFoldersSortDirection] = useLocalStorage<HabitFolderSortDirection>('habitFoldersSortDirection', 'asc');
  
  // Sort settings for archived tab
  const [archivedHabitsSortType, setArchivedHabitsSortType] = useLocalStorage<HabitSortType>('archivedHabitsSortType', 'name');
  const [archivedHabitsSortDirection, setArchivedHabitsSortDirection] = useLocalStorage<HabitSortDirection>('archivedHabitsSortDirection', 'asc');
  const [archivedHabitsCustomOrder, setArchivedHabitsCustomOrder] = useLocalStorage<string[]>('archivedHabitsCustomOrder', []);
  const [archivedHabitsReorderingEnabled, setArchivedHabitsReorderingEnabled] = useState(false);
  const [draggedHabitId, setDraggedHabitId] = useState<string | null>(null);
  const [habitDragPreviewOrder, setHabitDragPreviewOrder] = useState<string[]>([]);
  const draggedHabitIdRef = useRef<string | null>(null);
  const habitDragPreviewRef = useRef<string[]>([]);
  const touchDragSessionRef = useRef<{
    habitId: string;
    startX: number;
    startY: number;
    items: string[];
    timer: ReturnType<typeof setTimeout>;
    active: boolean;
  } | null>(null);
  const suppressHabitClickRef = useRef(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Bulk selection
  const {
    isBulkMode,
    selectedItems,
    toggleBulkMode,
    toggleItem,
    toggleAll,
    clearSelection,
    isAllSelected,
    exitBulkMode,
  } = useBulkSelection();
  

  const weekStart = startOfWeek(currentWeek, { weekStartsOn });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const showTodayButton = !isSameWeek(currentWeek, new Date(), { weekStartsOn });

  /*
   * Archiving, deleting and restoring a folder is shared with the notes and events pages — see
   * `useFolderActions`. This page had the part the others were missing (a folder that asked
   * what to do with its habits), and the same code is now the one all three use.
   */
  const folderActions = useFolderActions<Habit, HabitFolder>({
    itemKind: 'habit',
    itemIdsOf: (folder) => folder.habitIds,
    withItemIds: (folder, habitIds) => ({ ...folder, habitIds }),
    items: habits,
    setItems: setHabits,
    archivedItems: archivedHabits,
    setArchivedItems: setArchivedHabits,
    folders: habitFolders,
    setFolders: setHabitFolders,
    archivedFolders: archivedHabitFolders,
    setArchivedFolders: setArchivedHabitFolders,
    // Habits carry the flag themselves; the notes and events pages move items between two
    // lists and leave it alone.
    markItem: (habit, archived) => ({ ...habit, archived }),
  });

  // Check if any dialog is open - blocks swipe navigation
  const isAnyDialogOpen = isAddDialogOpen || !!selectedHabit || !!habitToDelete || 
    !!habitToArchive || folderActions.dialog.open ||
    isFolderCreatorOpen || isFolderEditorOpen || isMoveToFolderOpen;

  // Tab swipe navigation
  const handleSwipeLeft = useCallback(() => {
    if (isAnyDialogOpen) return;
    const currentIndex = HABIT_TABS.indexOf(activeTab);
    if (currentIndex < HABIT_TABS.length - 1) {
      setActiveTab(HABIT_TABS[currentIndex + 1]);
    }
  }, [activeTab, isAnyDialogOpen]);

  const handleSwipeRight = useCallback(() => {
    if (isAnyDialogOpen) return;
    const currentIndex = HABIT_TABS.indexOf(activeTab);
    if (currentIndex > 0) {
      setActiveTab(HABIT_TABS[currentIndex - 1]);
    }
  }, [activeTab, isAnyDialogOpen]);

  const swipeHandlers = useSwipeGesture({
    onSwipeLeft: handleSwipeLeft,
    onSwipeRight: handleSwipeRight,
    threshold: 50,
  });

  // Habit completion logic
  const isHabitCompletedForDate = (habit: Habit, date: Date) => {
    const dateStr = toDateKey(date);
    return habit.completedDates.includes(dateStr);
  };

  const toggleHabitCompletion = (habitId: string, date: Date) => {
    const dateStr = toDateKey(date);
    setHabits((prev: Habit[]) => prev.map(habit => {
      if (habit.id === habitId) {
        const isCompleted = habit.completedDates.includes(dateStr);
        const newCompletedDates = isCompleted
          ? habit.completedDates.filter(d => d !== dateStr)
          : [...habit.completedDates, dateStr];
        if (!habit.useTimesPerDay) return { ...habit, completedDates: newCompletedDates };

        // A "times per day" habit keeps a counter beside the tick. Toggling a past day
        // used to change only the tick, leaving "✓" with a count of 0, or an unticked
        // day still counting 3. Keep the two in step: done means the full target.
        const { [dateStr]: _previous, ...otherCounts } = habit.completionCounts ?? {};
        return {
          ...habit,
          completedDates: newCompletedDates,
          completionCounts: isCompleted ? otherCounts : { ...otherCounts, [dateStr]: habit.timesPerDay || 1 },
        };
      }
      return habit;
    }));
  };

  const markHabitDoneToday = (habitId: string) => {
    const dateStr = getTodayKey();
    setHabits((prev: Habit[]) => prev.map(habit => {
      if (habit.id === habitId) {
        if (habit.useTimesPerDay) {
          const currentCount = habit.completionCounts?.[dateStr] || 0;
          const timesPerDay = habit.timesPerDay || 1;
          const newCount = currentCount + 1;
          const shouldMarkCompleted = newCount >= timesPerDay && !habit.completedDates.includes(dateStr);
          
          return {
            ...habit,
            completionCounts: { ...habit.completionCounts, [dateStr]: newCount },
            completedDates: shouldMarkCompleted 
              ? [...habit.completedDates, dateStr] 
              : habit.completedDates
          };
        }
        
        const isCompleted = habit.completedDates.includes(dateStr);
        if (!isCompleted) {
          return { ...habit, completedDates: [...habit.completedDates, dateStr] };
        }
      }
      return habit;
    }));
  };

  const markUnlimitedHabitDone = (habitId: string) => {
    const dateStr = getTodayKey();
    setHabits((prev: Habit[]) => prev.map(habit => {
      if (habit.id === habitId) {
        const currentCount = habit.completionCounts?.[dateStr] || 0;
        return {
          ...habit,
          completionCounts: { ...habit.completionCounts, [dateStr]: currentCount + 1 }
        };
      }
      return habit;
    }));
  };

  const undoHabitCompletion = (habitId: string) => {
    const dateStr = getTodayKey();
    setHabits((prev: Habit[]) => prev.map(habit => {
      if (habit.id === habitId) {
        const currentCount = habit.completionCounts?.[dateStr] || 0;
        
        if (currentCount > 0) {
          const newCount = currentCount - 1;
          const timesPerDay = habit.timesPerDay || 1;
          const shouldRemoveCompleted = habit.useTimesPerDay && newCount < timesPerDay && habit.completedDates.includes(dateStr);
          
          return {
            ...habit,
            completionCounts: { ...habit.completionCounts, [dateStr]: newCount },
            completedDates: shouldRemoveCompleted 
              ? habit.completedDates.filter(d => d !== dateStr)
              : habit.completedDates
          };
        }
        
        if (!habit.useTimesPerDay && !habit.useUnlimitedTimes && habit.completedDates.includes(dateStr)) {
          return {
            ...habit,
            completedDates: habit.completedDates.filter(d => d !== dateStr)
          };
        }
      }
      return habit;
    }));
  };

  // Habit CRUD operations
  // Helper to append items without duplicates (by id)
  const appendUniqueById = <T extends { id: string }>(existing: T[], toAdd: T[]): T[] => {
    const existingIds = new Set(existing.map(item => item.id));
    const unique = toAdd.filter(item => !existingIds.has(item.id));
    return [...existing, ...unique];
  };

  const handleCreateHabit = (habitData: Omit<Habit, 'id' | 'createdAt' | 'completedDates' | 'completionCounts'>) => {
    const newHabit: Habit = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      completedDates: [],
      completionCounts: {},
      ...habitData
    };
    setHabits((prev: Habit[]) => [...prev, newHabit]);
    setIsAddDialogOpen(false);
    toast.success(say('toastAdded', 'habits'));
  };

  const handleUpdateHabit = (habitData: Omit<Habit, 'id' | 'createdAt' | 'completedDates' | 'completionCounts'>) => {
    if (!selectedHabit) return;
    const dateStr = getTodayKey();
    
    setHabits((prev: Habit[]) => prev.map(habit => {
      if (habit.id !== selectedHabit.id) return habit;
      
      const updatedHabit = { ...habit, ...habitData, modifiedAt: new Date().toISOString() };
      
      if (habitData.useTimesPerDay && habitData.timesPerDay) {
        const todayCount = habit.completionCounts?.[dateStr] || 0;
        const shouldMarkComplete = todayCount >= habitData.timesPerDay && !habit.completedDates.includes(dateStr);
        
        if (shouldMarkComplete) {
          updatedHabit.completedDates = [...habit.completedDates, dateStr];
        }
      }
      
      if (habitData.useUnlimitedTimes && habit.completedDates.includes(dateStr)) {
        updatedHabit.completedDates = habit.completedDates.filter(d => d !== dateStr);
      }
      
      return updatedHabit;
    }));
    setSelectedHabit(null);
    toast.success(say('toastUpdated', 'habits'));
  };

  const deleteHabit = (habitId: string, showToast = true) => {
    setHabits((prev: Habit[]) => prev.filter(habit => habit.id !== habitId));
    setArchivedHabits((prev: Habit[]) => prev.filter(habit => habit.id !== habitId));
    // Remove from any folders
    setHabitFolders((prev: HabitFolder[]) => prev.map(folder => ({
      ...folder,
      habitIds: folder.habitIds.filter(id => id !== habitId)
    })));
    setArchivedHabitFolders((prev: HabitFolder[]) => prev.map(folder => ({
      ...folder,
      habitIds: folder.habitIds.filter(id => id !== habitId)
    })));
    setSelectedHabit(null);
    setHabitToDelete(null);
    if (showToast) toast.success(say('toastDeleted', 'habits'));
  };

  const confirmDeleteHabit = (habitId: string) => setHabitToDelete(habitId);
  const confirmArchiveHabit = (habitId: string) => setHabitToArchive(habitId);

  const archiveHabit = (habitId: string, showToast = true) => {
    const habitToArchiveData = habits.find(h => h.id === habitId);
    if (habitToArchiveData) {
      // Store original folder ID before archiving
      const originalFolder = habitFolders.find(folder => folder.habitIds.includes(habitId));
      const archivedHabit = {
        ...habitToArchiveData,
        archived: true,
        originalFolderId: originalFolder?.id
      };
      
      setArchivedHabits((prev: Habit[]) => [...prev, archivedHabit]);
      setHabits((prev: Habit[]) => prev.filter(h => h.id !== habitId));
      
      // Remove from folder
      if (originalFolder) {
        setHabitFolders((prev: HabitFolder[]) => prev.map(folder =>
          folder.id === originalFolder.id
            ? { ...folder, habitIds: folder.habitIds.filter(id => id !== habitId) }
            : folder
        ));
      }
    }
    setSelectedHabit(null);
    setHabitToArchive(null);
    if (showToast) toast.success(say('toastArchived', 'habits'));
  };

  const pinHabit = (habitId: string) => {
    setHabits((prev: Habit[]) => prev.map(habit => 
      habit.id === habitId ? { ...habit, pinned: !habit.pinned } : habit
    ));
  };

  const unarchiveHabit = (habitId: string, showToast = true) => {
    const habitToUnarchive = archivedHabits.find(h => h.id === habitId);
    if (habitToUnarchive) {
      const { originalFolderId, ...restoredHabit } = habitToUnarchive;
      
      setHabits((prev: Habit[]) => [...prev, { ...restoredHabit, archived: false }]);
      setArchivedHabits((prev: Habit[]) => prev.filter(h => h.id !== habitId));
      
      // Check both active and archived folders
      if (originalFolderId) {
        const folderInActive = habitFolders.some(f => f.id === originalFolderId);
        const folderInArchived = archivedHabitFolders.some(f => f.id === originalFolderId);
        
        if (folderInActive) {
          setHabitFolders((prev: HabitFolder[]) => prev.map(folder =>
            folder.id === originalFolderId
              ? { ...folder, habitIds: [...folder.habitIds, habitId] }
              : folder
          ));
        } else if (folderInArchived) {
          setArchivedHabitFolders((prev: HabitFolder[]) => prev.map(folder =>
            folder.id === originalFolderId
              ? { ...folder, habitIds: [...folder.habitIds, habitId] }
              : folder
          ));
        }
      }
    }
    if (showToast) toast.success(say('toastRestored', 'habits'));
  };

  const openHabitDetails = (habit: Habit) => setSelectedHabit(habit);

  // Folder CRUD operations
  const handleCreateFolder = (folderData: Omit<HabitFolder, 'id' | 'createdAt' | 'habitIds'>) => {
    const idsToMove = habitsToMove ?? (habitToMove ? [habitToMove] : []);
    const idsSet = new Set(idsToMove);
    const newFolder: HabitFolder = {
      ...folderData,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      habitIds: idsToMove
    };
    setHabitFolders((prev: HabitFolder[]) => {
      const cleaned = idsSet.size > 0
        ? prev.map(folder => ({ ...folder, habitIds: folder.habitIds.filter(id => !idsSet.has(id)) }))
        : prev;
      return [...cleaned, newFolder];
    });
    setIsFolderCreatorOpen(false);
    setHabitToMove(null);
    setHabitsToMove(null);
    if (idsToMove.length > 0) {
      clearSelection();
      exitBulkMode();
    }
    toast.success(say('toastAdded', 'tabFolders'));
  };

  const handleUpdateFolder = (folderData: Partial<HabitFolder>) => {
    if (!selectedFolder) return;
    setHabitFolders((prev: HabitFolder[]) => prev.map(folder =>
      folder.id === selectedFolder.id ? { ...folder, ...folderData } : folder
    ));
    setSelectedFolder(null);
    setIsFolderEditorOpen(false);
    toast.success(say('toastUpdated', 'tabFolders'));
  };

  const pinFolder = (folderId: string) => {
    setHabitFolders((prev: HabitFolder[]) => prev.map(folder =>
      folder.id === folderId ? { ...folder, pinned: true } : folder
    ));
  };

  const unpinFolder = (folderId: string) => {
    setHabitFolders((prev: HabitFolder[]) => prev.map(folder =>
      folder.id === folderId ? { ...folder, pinned: false } : folder
    ));
  };

  const editFolder = (folderId: string) => {
    const folder = habitFolders.find(f => f.id === folderId);
    if (folder) {
      setSelectedFolder(folder);
      setIsFolderEditorOpen(true);
    }
  };


  // Move to folder
  const openMoveToFolder = (habitId: string) => {
    setHabitToMove(habitId);
    setIsMoveToFolderOpen(true);
  };

  const handleMoveToFolder = (folderId: string) => {
    if (habitsToMove?.length) {
      const idsSet = new Set(habitsToMove);
      setHabitFolders((prev: HabitFolder[]) => prev.map(folder => ({
        ...folder,
        habitIds: folder.id === folderId
          ? [...folder.habitIds.filter(id => !idsSet.has(id)), ...habitsToMove]
          : folder.habitIds.filter(id => !idsSet.has(id)),
      })));
      setIsMoveToFolderOpen(false);
      setHabitsToMove(null);
      toast.success(say('toastUpdated', 'habits'));
      return;
    }

    if (!habitToMove) return;
    
    // Remove from any existing folder
    setHabitFolders((prev: HabitFolder[]) => prev.map(folder => ({
      ...folder,
      habitIds: folder.habitIds.filter(id => id !== habitToMove)
    })));
    
    // Add to new folder
    setHabitFolders((prev: HabitFolder[]) => prev.map(folder =>
      folder.id === folderId
        ? { ...folder, habitIds: [...folder.habitIds, habitToMove] }
        : folder
    ));
    
    setIsMoveToFolderOpen(false);
    setHabitToMove(null);
        setHabitsToMove(null);
    toast.success(say('toastUpdated', 'habits'));
  };

  // Search and filter
  const searchInHabit = (habit: Habit, query: string): boolean => {
    const searchTerm = query.toLowerCase();
    return habit.name.toLowerCase().includes(searchTerm) || 
           (habit.description?.toLowerCase().includes(searchTerm) || false);
  };

  const filterHabits = (): Habit[] => {
    // Show ALL active habits regardless of folder membership
    let filtered = habits.filter(habit => !habit.archived);
    
    if (searchQuery.trim()) {
      filtered = filtered.filter(habit => searchInHabit(habit, searchQuery));
    }
    
    // Apply sorting
    const sorted = [...filtered].sort((a, b) => {
      let comparison = 0;
      switch (habitsSortType) {
        case 'name':
          comparison = a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true });
          break;
        case 'dateCreated':
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case 'dateModified':
          comparison = new Date(a.modifiedAt || a.createdAt).getTime() - new Date(b.modifiedAt || b.createdAt).getTime();
          break;
        case 'custom': {
          const aIndex = habitsCustomOrder.indexOf(a.id);
          const bIndex = habitsCustomOrder.indexOf(b.id);
          comparison = aIndex === -1 && bIndex === -1 ? 0
            : aIndex === -1 ? 1
            : bIndex === -1 ? -1
            : aIndex - bIndex;
          break;
        }
      }
      return habitsSortDirection === 'asc' ? comparison : -comparison;    });
    
    // Pinned items always first
    return sorted.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return 0;
    });
  };

  const filterFolders = (): HabitFolder[] => {
    let filtered = habitFolders.filter(f => !f.archived);
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(f => 
        f.name.toLowerCase().includes(query) || 
        f.description?.toLowerCase().includes(query) ||
        habits.filter(h => f.habitIds.includes(h.id)).some(h => searchInHabit(h, searchQuery))
      );
    }
    
    // Apply sorting
    const sorted = [...filtered].sort((a, b) => {
      let comparison = 0;
      switch (habitFoldersSortType) {
        case 'name':
          comparison = a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true });
          break;
        case 'dateCreated':
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case 'dateModified': {
          const aDate = a.modifiedAt || a.createdAt;
          const bDate = b.modifiedAt || b.createdAt;
          comparison = new Date(aDate).getTime() - new Date(bDate).getTime();
          break;
        }
        case 'habitCount':
          comparison = a.habitIds.length - b.habitIds.length;
          break;
      }
      return habitFoldersSortDirection === 'asc' ? comparison : -comparison;
    });
    
    // Pinned items always first
    return sorted.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return 0;
    });
  };

  const getArchivedHabits = (): Habit[] => {
    let archived = archivedHabits;
    if (searchQuery.trim()) {
      archived = archived.filter(habit => searchInHabit(habit, searchQuery));
    }
    return archived;
  };

  // Show ALL archived habits (matching Notes/Events pattern - habits appear both in list and inside folder cards)
  const getArchivedHabitsFiltered = (): Habit[] => {
    let archived = archivedHabits;
    if (searchQuery.trim()) {
      archived = archived.filter(habit => searchInHabit(habit, searchQuery));
    }
    
    // Apply sorting
    return [...archived].sort((a, b) => {
      let comparison = 0;
      switch (archivedHabitsSortType) {
        case 'name':
          comparison = a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true });
          break;
        case 'dateCreated':
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case 'dateModified':
          comparison = new Date(a.modifiedAt || a.createdAt).getTime() - new Date(b.modifiedAt || b.createdAt).getTime();
          break;
        case 'custom': {
          const aIndex = archivedHabitsCustomOrder.indexOf(a.id);
          const bIndex = archivedHabitsCustomOrder.indexOf(b.id);
          comparison = aIndex === -1 && bIndex === -1 ? 0
            : aIndex === -1 ? 1
            : bIndex === -1 ? -1
            : aIndex - bIndex;
          break;
        }
      }
      return archivedHabitsSortDirection === 'asc' ? comparison : -comparison;
    });
  };

  const getArchivedFolders = (): HabitFolder[] => {
    let archived = archivedHabitFolders;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      archived = archived.filter(f => 
        f.name.toLowerCase().includes(query) || 
        f.description?.toLowerCase().includes(query)
      );
    }
    return archived;
  };

  const mergeVisibleHabitOrder = (storedOrder: string[], visibleOrder: string[], allIds: string[]) => {
    const fullOrder = [...new Set([...storedOrder, ...allIds])];
    const visibleIds = new Set(visibleOrder);
    let nextVisibleIndex = 0;
    return fullOrder.map((id) => visibleIds.has(id) ? visibleOrder[nextVisibleIndex++] : id);
  };

  const handleHabitsSortTypeChange = (sortType: HabitSortType) => {
    if (sortType === 'custom' && habitsSortType !== 'custom') {
      const visibleOrder = filterHabits().map((habit) => habit.id);
      setHabitsCustomOrder((stored) => mergeVisibleHabitOrder(stored, visibleOrder, habits.map((habit) => habit.id)));
      setHabitsReorderingEnabled(true);
    } else if (sortType === 'custom') {
      setHabitsReorderingEnabled(enabled => !enabled);
      return;
    } else {
      setHabitsReorderingEnabled(false);
    }
    setHabitsSortType(sortType);
  };

  const handleArchivedHabitsSortTypeChange = (sortType: HabitSortType) => {
    if (sortType === 'custom' && archivedHabitsSortType !== 'custom') {
      const visibleOrder = getArchivedHabitsFiltered().map((habit) => habit.id);
      setArchivedHabitsCustomOrder((stored) => mergeVisibleHabitOrder(stored, visibleOrder, archivedHabits.map((habit) => habit.id)));
      setArchivedHabitsReorderingEnabled(true);
    } else if (sortType === 'custom') {
      setArchivedHabitsReorderingEnabled(enabled => !enabled);
      return;
    } else {
      setArchivedHabitsReorderingEnabled(false);
    }
    setArchivedHabitsSortType(sortType);
  };

  const persistHabitDragOrder = (order: string[]) => {
    if (activeTab === 'archived') {
      setArchivedHabitsCustomOrder((stored) => mergeVisibleHabitOrder(stored, order, archivedHabits.map((habit) => habit.id)));
    } else {
      setHabitsCustomOrder((stored) => mergeVisibleHabitOrder(stored, order, habits.map((habit) => habit.id)));
    }
    setDraggedHabitId(null);
    setHabitDragPreviewOrder([]);
    draggedHabitIdRef.current = null;
    habitDragPreviewRef.current = [];
  };

  const handleHabitDragStart = (habitId: string, event: React.DragEvent<HTMLDivElement>) => {
    const visibleItems = activeTab === 'archived' ? getArchivedHabitsFiltered() : filterHabits();
    setDraggedHabitId(habitId);
    draggedHabitIdRef.current = habitId;
    const order = visibleItems.map((habit) => habit.id);
    setHabitDragPreviewOrder(order);
    habitDragPreviewRef.current = order;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', habitId);
  };

  const handleHabitDragOver = (targetId: string, event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    const draggedId = draggedHabitIdRef.current;
    if (!draggedId || draggedId === targetId) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const beforeTarget = event.clientY < rect.top + rect.height / 2 || (
      Math.abs(event.clientY - (rect.top + rect.height / 2)) < rect.height * 0.2 &&
      event.clientX < rect.left + rect.width / 2
    );
    updateHabitDragPreview(draggedId, targetId, beforeTarget);
  };

  const handleHabitDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (habitDragPreviewRef.current.length > 0) persistHabitDragOrder(habitDragPreviewRef.current);
  };

  const handleHabitDragEnd = () => {
    if (draggedHabitIdRef.current && habitDragPreviewRef.current.length > 0) {
      persistHabitDragOrder(habitDragPreviewRef.current);
    } else {
      setDraggedHabitId(null);
      setHabitDragPreviewOrder([]);
      draggedHabitIdRef.current = null;
      habitDragPreviewRef.current = [];
    }
  };

  const moveHabitInOrder = (order: string[], draggedId: string, targetId: string, beforeTarget: boolean) => {
    // Pinned habits always stay above the others: they reorder among themselves, and an
    // unpinned habit cannot take a place above them.
    const pinnedIds = new Set(habits.filter((h) => h.pinned).map((h) => h.id));
    const fromIndex = order.indexOf(draggedId);
    const targetIndex = order.indexOf(targetId);
    if (fromIndex < 0 || targetIndex < 0) return order;

    const next = [...order];
    next.splice(fromIndex, 1);
    let insertIndex = targetIndex + (beforeTarget ? 0 : 1);
    if (fromIndex < insertIndex) insertIndex -= 1;
    next.splice(insertIndex, 0, draggedId);
    const settled = [...next.filter((id) => pinnedIds.has(id)), ...next.filter((id) => !pinnedIds.has(id))];
    if (settled.every((id, index) => id === order[index])) return order;
    return settled;
  };

  const updateHabitDragPreview = (draggedId: string, targetId: string, beforeTarget: boolean) => {
    const currentOrder = habitDragPreviewRef.current;
    const nextOrder = moveHabitInOrder(currentOrder, draggedId, targetId, beforeTarget);
    if (nextOrder === currentOrder) return;
    habitDragPreviewRef.current = nextOrder;
    setHabitDragPreviewOrder(nextOrder);
  };

  const reorderForDragPreview = (items: Habit[]) => {
    if (!draggedHabitId || habitDragPreviewOrder.length === 0) return items;
    const orderIndex = new Map(habitDragPreviewOrder.map((id, index) => [id, index]));
    return [...items].sort((a, b) => (orderIndex.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (orderIndex.get(b.id) ?? Number.MAX_SAFE_INTEGER));
  };

  const handleHabitPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' || isBulkMode || draggedHabitId) return;
    const target = event.target as HTMLElement;
    if (!target.closest('[data-habit-drag-handle]')) return;
    const card = target.closest('[data-habit-id]');
    const habitId = card?.getAttribute('data-habit-id');
    if (!habitId) return;

    const visibleItems = activeTab === 'archived' ? getArchivedHabitsFiltered() : filterHabits();
    const visibleIds = visibleItems.map((habit) => habit.id);
    if (!visibleIds.includes(habitId)) return;

    const timer = setTimeout(() => {
      const session = touchDragSessionRef.current;
      if (!session) return;
      session.active = true;
      setDraggedHabitId(session.habitId);
      draggedHabitIdRef.current = session.habitId;
      setHabitDragPreviewOrder(session.items);
      habitDragPreviewRef.current = session.items;
      document.body.style.overflow = 'hidden';
      document.body.style.overscrollBehavior = 'none';
    }, 350);

    touchDragSessionRef.current = {
      habitId,
      startX: event.clientX,
      startY: event.clientY,
      items: visibleIds,
      timer,
      active: false,
    };
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture is not available in every embedded browser.
    }
  };

  const handleHabitPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const session = touchDragSessionRef.current;
    if (!session) return;

    if (!session.active) {
      const movedX = Math.abs(event.clientX - session.startX);
      const movedY = Math.abs(event.clientY - session.startY);
      if (movedX > 12 || movedY > 12) {
        clearTimeout(session.timer);
        touchDragSessionRef.current = null;
      }
      return;
    }

    event.preventDefault();
    const hoveredCard = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-habit-id]');
    const targetId = hoveredCard?.getAttribute('data-habit-id');
    if (!targetId || targetId === session.habitId) return;
    const targetRect = hoveredCard?.getBoundingClientRect();
    if (!targetRect) return;
    const beforeTarget = event.clientY < targetRect.top + targetRect.height / 2 || (
      Math.abs(event.clientY - (targetRect.top + targetRect.height / 2)) < targetRect.height * 0.2 &&
      event.clientX < targetRect.left + targetRect.width / 2
    );
    updateHabitDragPreview(session.habitId, targetId, beforeTarget);
  };

  const finishHabitPointerDrag = (commit: boolean) => {
    const session = touchDragSessionRef.current;
    if (!session) return;
    clearTimeout(session.timer);
    touchDragSessionRef.current = null;
    document.body.style.overflow = '';
    document.body.style.overscrollBehavior = '';

    if (session.active && commit && habitDragPreviewRef.current.length > 0) {
      persistHabitDragOrder(habitDragPreviewRef.current);
      suppressHabitClickRef.current = true;
      setTimeout(() => { suppressHabitClickRef.current = false; }, 0);
    } else {
      setDraggedHabitId(null);
      setHabitDragPreviewOrder([]);
      draggedHabitIdRef.current = null;
      habitDragPreviewRef.current = [];
    }
  };

  const handleHabitPointerUp = () => finishHabitPointerDrag(true);
  const handleHabitPointerCancel = () => finishHabitPointerDrag(false);
  const handleHabitGridClickCapture = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!suppressHabitClickRef.current) return;
    event.preventDefault();
    event.stopPropagation();
  };

  // Bulk actions
  const getBulkContext = (): BulkActionContext => {
    switch (activeTab) {
      case 'habits': return 'habits';
      case 'folders': return 'habitFolders';
      case 'archived': return 'archivedHabits';
      default: return 'habits';
    }
  };

  const getSelectableItems = (): string[] => {
    switch (activeTab) {
      case 'habits':
        // Only return habit IDs on the habits tab (not folder IDs)
        return filterHabits().map(h => h.id);
      case 'folders':
        return filterFolders().map(f => f.id);
      case 'archived':
        return [...getArchivedHabitsFiltered().map(h => h.id), ...getArchivedFolders().map(f => f.id)];
      default:
        return [];
    }
  };

  const finishBulkFolderAction = (
    pending: NonNullable<typeof pendingBulkFolderAction>,
    scope: 'folderOnly' | 'withItems',
  ) => {
    folderActions.applyBulkFolderAction(pending.kind, scope, pending.folderIds);
    if (pending.kind === 'delete' && pending.selectedItemIds.length > 0 && activeTab === 'archived') {
      const selectedIds = new Set(pending.selectedItemIds);
      setArchivedHabits(prev => prev.filter(habit => !selectedIds.has(habit.id)));
    }
    clearSelection();
    exitBulkMode();
    setPendingBulkFolderAction(null);
  };

  const requestBulkFolderAction = (kind: 'archive' | 'delete', ids: string[]): boolean => {
    if (activeTab !== 'folders' && activeTab !== 'archived') return false;
    const folderCollection = activeTab === 'archived' ? archivedHabitFolders : habitFolders;
    const folderIds = ids.filter(id => folderCollection.some(folder => folder.id === id));
    if (folderIds.length === 0) return false;

    const folderIdSet = new Set(folderIds);
    const selectedItemIds = ids.filter(id => !folderIdSet.has(id));
    const selectedFolders = folderCollection.filter(folder => folderIdSet.has(folder.id));
    const itemCount = new Set(selectedFolders.flatMap(folder => folder.habitIds)).size;
    const pending = { kind, folderIds, selectedItemIds };
    if (itemCount === 0) {
      finishBulkFolderAction(pending, 'withItems');
    } else {
      setPendingBulkFolderAction(pending);
    }
    return true;
  };

  const handleBulkAction = (action: BulkActionType, color?: string) => {
    const items = Array.from(selectedItems);
    
    switch (action) {
      case 'all':
      case 'allItems':
      case 'allFolders':
        if (action === 'allItems') {
          const habitIds = getArchivedHabitsFiltered().map(h => h.id);
          toggleAll(habitIds);
        } else if (action === 'allFolders') {
          const folderIds = getArchivedFolders().map(f => f.id);
          toggleAll(folderIds);
        } else {
          toggleAll(getSelectableItems());
        }
        break;
      case 'pin':
        // Tab-aware: pin based on current tab
        if (activeTab === 'habits') {
          const habitIds = items.filter(id => habits.some(habit => habit.id === id));
          if (habitIds.length > 0) {
            const habitIdSet = new Set(habitIds);
            setHabits(prev => prev.map(habit =>
              habitIdSet.has(habit.id) ? { ...habit, pinned: !habit.pinned } : habit
            ));
            toast.success(countedSentence(t, language, 'bulkUpdated', habitIds.length));
          }
        } else if (activeTab === 'folders') {
          const folderIds = items.filter(id => habitFolders.some(folder => folder.id === id));
          const folderIdSet = new Set(folderIds);
          setHabitFolders(prev => prev.map(folder =>
            folderIdSet.has(folder.id) ? { ...folder, pinned: !folder.pinned } : folder
          ));
          if (folderIds.length > 0) {
            toast.success(countedSentence(t, language, 'bulkUpdated', folderIds.length));
          }
        }
        exitBulkMode();
        break;
      case 'archive':
        if (requestBulkFolderAction('archive', items)) break;
        // Tab-aware archive: only archive items of the current tab type
        if (activeTab === 'habits') {
          // Archive only habits, remove them from any folders
          const habitIds = items.filter(id => habits.some(h => h.id === id));
          habitIds.forEach(id => archiveHabit(id, false));
          if (habitIds.length > 0) {
            toast.success(countedSentence(t, language, 'bulkArchived', habitIds.length));
          }
        } else if (activeTab === 'folders') {
          // Archive only folders (and their contained habits)
          items.forEach(id => {
            if (habitFolders.find(f => f.id === id)) {
              folderActions.applyFolderAction('archive', 'withItems', id);
            }
          });
        }
        // archived tab: no archive action needed
        exitBulkMode();
        break;
      case 'restore':
        // Tab-aware restore: only applicable on archived tab
        if (activeTab === 'archived') {
          // Restore folders first to properly re-attach habits
          const folderIds = items.filter(id => archivedHabitFolders.find(f => f.id === id));
          const habitIds = items.filter(id => archivedHabits.find(h => h.id === id));
          
          folderIds.forEach(id => folderActions.applyFolderAction('restore', 'withItems', id));
          const standaloneHabitIds = habitIds.filter(id => {
            // Only restore habits that aren't in a folder being restored (they get restored with folder)
            return !archivedHabitFolders.some(f =>
              folderIds.includes(f.id) && f.habitIds.includes(id)
            );
          });
          standaloneHabitIds.forEach(id => unarchiveHabit(id, false));
          if (standaloneHabitIds.length > 0) {
            toast.success(countedSentence(t, language, 'bulkRestored', standaloneHabitIds.length));
          }
        }
        exitBulkMode();
        break;
      case 'delete':
        if (requestBulkFolderAction('delete', items)) break;
        // Tab-aware delete
        if (activeTab === 'habits') {
          const habitIds = items.filter(id => habits.some(h => h.id === id));
          habitIds.forEach(id => deleteHabit(id, false));
          if (habitIds.length > 0) {
            toast.success(countedSentence(t, language, 'bulkDeleted', habitIds.length));
          }
        } else if (activeTab === 'folders') {
          items.forEach(id => {
            if (habitFolders.find(f => f.id === id)) folderActions.applyFolderAction('delete', 'withItems', id);
          });
        } else if (activeTab === 'archived') {
          // Delete both habits and folders in archived tab
          const habitIds = items.filter(id => archivedHabits.some(h => h.id === id));
          habitIds.forEach(id => deleteHabit(id, false));
          if (habitIds.length > 0) {
            toast.success(countedSentence(t, language, 'bulkDeleted', habitIds.length));
          }
          items.forEach(id => {
            if (archivedHabitFolders.find(f => f.id === id)) folderActions.applyFolderAction('delete', 'withItems', id);
          });
        }
        exitBulkMode();
        break;
      case 'color':
        if (color) {
          if (activeTab === 'habits') {
            const habitIds = items.filter(id => habits.some(habit => habit.id === id));
            if (habitIds.length > 0) {
              const habitIdSet = new Set(habitIds);
              setHabits(prev => prev.map(habit =>
                habitIdSet.has(habit.id) ? { ...habit, color } : habit
              ));
              toast.success(t('toastColorApplied').replace('{count}', String(habitIds.length)));
            }
          } else if (activeTab === 'folders') {
            const folderIds = items.filter(id => habitFolders.some(folder => folder.id === id));
            const folderIdSet = new Set(folderIds);
            setHabitFolders(prev => prev.map(folder =>
              folderIdSet.has(folder.id) ? { ...folder, color } : folder
            ));
            if (folderIds.length > 0) {
              toast.success(t('toastColorApplied').replace('{count}', String(folderIds.length)));
            }
          }
        }
        exitBulkMode();
        break;
      case 'move':
        if (items.length > 0 && activeTab === 'habits') {
          setHabitsToMove(items);
          setHabitToMove(null);
          setIsMoveToFolderOpen(true);
        }
        break;
    }
  };

  const handleAddButtonClick = () => {
    if (activeTab === 'folders') {
      setIsFolderCreatorOpen(true);
    } else {
      setIsAddDialogOpen(true);
    }
  };

  /**
   * What to call an item in a confirmation dialog.
   *
   * The dialog state holds only an id, so the item is looked up here; the archived
   * collections are searched too because the same dialogs are reached from the Archived tab.
   * Habits always have a name, so `itemDisplayName` only has to fall back for the case where
   * the id no longer resolves.
   */
  const displayNameOf = (id: string | null): string => {
    if (!id) return t('untitledItem');
    const habit = habits.find(h => h.id === id) ?? archivedHabits.find(h => h.id === id);
    if (habit) return itemDisplayName(t, habit);
    const folder = habitFolders.find(f => f.id === id) ?? archivedHabitFolders.find(f => f.id === id);
    return itemDisplayName(t, folder ?? {});
  };

  /*
   * The habits a folder card lists, already narrowed by the search.
   *
   * The folder cards used to be handed the raw arrays, so a search narrowed which folders were
   * shown but not what was inside them: opening a matching folder listed every habit it holds,
   * including the ones the search had just excluded from the Habits tab.
   */
  const habitsForFolders = filterHabits();
  const archivedHabitsForFolders = getArchivedHabitsFiltered();

  return (
    <FolderMembershipProvider ids={collectFiledIds(
      habitFolders.map((folder) => ({ id: folder.id, itemIds: folder.habitIds })),
      archivedHabits,
    )}>
    <Layout swipeHandlers={swipeHandlers} 
      showSearch={true}
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      pageTitle={t('habits')}
      isBulkMode={isBulkMode}
      shieldHeight={activeTab === 'habits' ? '14rem' : '7.25rem'}
      swipeZone="7.25rem"
    >
      <div>
        <Tabs value={activeTab} onValueChange={(tab) => { finishHabitPointerDrag(false); setActiveTab(tab); exitBulkMode(); setDraggedHabitId(null); setHabitDragPreviewOrder([]); habitDragPreviewRef.current = []; }}>
          <div className="fixed top-16 left-0 right-0 z-40 px-2">
            <div className="flex items-start justify-between py-2">
            <SlidingTabsList activeValue={activeTab} values={['habits', 'folders', 'archived']}>
              <TabsTrigger value="habits">{t('habits')}</TabsTrigger>
              <TabsTrigger value="folders">{t('tabFolders')}</TabsTrigger>
              <TabsTrigger value="archived">{t('tabArchived')}</TabsTrigger>
            </SlidingTabsList>
            <div className="flex items-center gap-1">
              {showTodayButton && activeTab === 'habits' && (
                /* A Button rather than a span: the span was not keyboard focusable and had
                   no hover feedback, so nothing marked it as clickable. */
                <Button
                  variant="ghostStatic"
                  size="sm"
                  onClick={() => setCurrentWeek(new Date())}
                  className="h-8 px-3 text-sm font-bold text-foreground rounded-full hover:bg-hover hover:text-foreground"
                >
                  {t('today')}
                </Button>
              )}
              <Button
                aria-label={t('selectItems')} 
                variant="ghostStatic" 
                size="icon"
                className="rounded-full hover:bg-hover hover:text-foreground focus-visible:ring-0 focus-visible:ring-offset-0 [&_svg]:!size-5 data-[state=open]:bg-hover data-[state=open]:text-foreground"
                data-state={isBulkMode ? "open" : "closed"}
                onClick={(e) => { toggleBulkMode(); e.currentTarget.blur(); }}
                onMouseDown={(e) => e.preventDefault()}
              >
                <FileStack className="h-6 w-6" />
              </Button>
              {activeTab === 'folders' ? (
                <HabitFolderViewSettings
                  sortType={habitFoldersSortType}
                  sortDirection={habitFoldersSortDirection}
                  onSortTypeChange={setHabitFoldersSortType}
                  onSortDirectionChange={setHabitFoldersSortDirection}
                />
              ) : activeTab === 'archived' ? (
                <HabitViewSettings
                  viewType={archivedHabitsViewType}
                  sortType={archivedHabitsSortType}
                  sortDirection={archivedHabitsSortDirection}
                  customReorderingEnabled={archivedHabitsReorderingEnabled}
                  onViewTypeChange={setArchivedHabitsViewType}
                  onSortTypeChange={handleArchivedHabitsSortTypeChange}
                  onSortDirectionChange={setArchivedHabitsSortDirection}
                />
              ) : (
                <HabitViewSettings
                  viewType={allHabitsViewType}
                  sortType={habitsSortType}
                  sortDirection={habitsSortDirection}
                  customReorderingEnabled={habitsReorderingEnabled}
                  onViewTypeChange={setAllHabitsViewType}
                  onSortTypeChange={handleHabitsSortTypeChange}
                  onSortDirectionChange={setHabitsSortDirection}
                />
              )}
            </div>
            </div>

            {/* Calendar Navigation - only visible on habits tab */}
            {activeTab === 'habits' && (
              <div className="rounded-2xl bg-[hsl(var(--surface-card))] backdrop-blur-[12px] border border-foreground/10 shadow-[0_8px_32px_rgba(0,0,0,0.1)] px-1.5 py-1 mb-1">
                <div className="flex items-center justify-between mb-0.5">
                  <Button aria-label={t('previous')} variant="ghost" size="icon" className="h-8 w-8 text-foreground hover:bg-hover hover:text-foreground rounded-full [&_svg]:!size-4" onClick={() => setCurrentWeek(subWeeks(currentWeek, 1))}>
                    <ChevronLeft size={24} />
                  </Button>
                  <h3 className="text-sm font-medium">
                    {format(weekStart, 'MMM d', { locale: dateLocale })} - {format(addDays(weekStart, 6), 'MMM d, yyyy', { locale: dateLocale })}
                  </h3>
                  <Button aria-label={t('next')} variant="ghost" size="icon" className="h-8 w-8 text-foreground hover:bg-hover hover:text-foreground rounded-full [&_svg]:!size-4" onClick={() => setCurrentWeek(addWeeks(currentWeek, 1))}>
                    <ChevronRight size={24} />
                  </Button>
                </div>
                
                <div className="grid grid-cols-7 gap-1 text-center">
                  {orderedDayNames.map((day, index) => {
                    const isToday = isSameDay(weekDays[index], new Date());
                    return (
                      <div key={`${day}-${index}`} className="text-xs font-medium text-muted-foreground p-1">
                        {day}
                        <div className={`text-base font-bold mt-0.5 w-7 h-7 flex items-center justify-center mx-auto rounded-full ${isToday ? 'bg-black text-white' : 'text-foreground'}`}>
                          {format(weekDays[index], 'd')}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <TabsContent value="habits" className={activeTab === 'habits' ? 'mt-[11rem]' : 'mt-14'}>
            {habits.length === 0 && habitFolders.length === 0 ? (
              <Card>
                <CardContent className="text-center py-8">
                  <Button 
                    onClick={() => setIsAddDialogOpen(true)}
                    className="h-10 px-8 text-sm font-medium rounded-full bg-black text-white hover:bg-black/90"
                  >
                    {t('createHabit')}
                    <Target className="ml-2" size={20} />
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div
                className={`${allHabitsViewType === 'x2' ? 'grid grid-cols-1 md:grid-cols-2' : 'grid grid-cols-1'} gap-2`}
                onPointerDown={handleHabitPointerDown}
                onPointerMove={handleHabitPointerMove}
                onPointerUp={handleHabitPointerUp}
                onPointerCancel={handleHabitPointerCancel}
                onClickCapture={handleHabitGridClickCapture}
              >
                {reorderForDragPreview(filterHabits()).map(habit => (
                  <HabitCard
                    key={habit.id}
                    habit={habit}
                    viewType={allHabitsViewType}
                    weekDays={weekDays}
                    isCompletedForDate={isHabitCompletedForDate}
                    onToggleCompletion={toggleHabitCompletion}
                    onMarkDone={markHabitDoneToday}
                    onMarkUnlimitedDone={markUnlimitedHabitDone}
                    onUndoCompletion={undoHabitCompletion}
                    onEdit={openHabitDetails}
                    onArchive={confirmArchiveHabit}
                    onDelete={confirmDeleteHabit}
                    onPin={pinHabit}
                    onMoveToFolder={openMoveToFolder}
                    searchQuery={searchQuery}
                    showBulkCheckbox={isBulkMode}
                    isBulkSelected={selectedItems.has(habit.id)}
                    onBulkSelect={toggleItem}
                    isDragEnabled={habitsReorderingEnabled && !isBulkMode}
                    isDragged={draggedHabitId === habit.id}
                    onDragStart={handleHabitDragStart}
                    onDragOver={handleHabitDragOver}
                    onDrop={handleHabitDrop}
                    onDragEnd={handleHabitDragEnd}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="folders" className="mt-14">
            {habitFolders.length === 0 ? (
              <Card>
                <CardContent className="text-center py-8">
                  <Button 
                    onClick={() => setIsFolderCreatorOpen(true)}
                    className="h-10 px-8 text-sm font-medium rounded-full bg-black text-white hover:bg-black/90"
                  >
                    {t('createFolder')}
                    <Target className="ml-2" size={20} />
                  </Button>
                </CardContent>
              </Card>
            ) : (
              /* `items-start`: see the note about stretching in the archived-folder grid. */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 items-start">
                {filterFolders().map(folder => (
                  <HabitFolderCard
                    key={folder.id}
                    folder={folder}
                    habits={habitsForFolders}
                    weekDays={weekDays}
                    isCompletedForDate={isHabitCompletedForDate}
                    onToggleCompletion={toggleHabitCompletion}
                    onMarkDone={markHabitDoneToday}
                    onMarkUnlimitedDone={markUnlimitedHabitDone}
                    onUndoCompletion={undoHabitCompletion}
                    onEditHabit={openHabitDetails}
                    onArchiveHabit={confirmArchiveHabit}
                    onDeleteHabit={confirmDeleteHabit}
                    onPinHabit={pinHabit}
                    onPinFolder={pinFolder}
                    onUnpinFolder={unpinFolder}
                    onEditFolder={editFolder}
                    onArchiveFolder={folderActions.requestArchive}
                    onDeleteFolder={folderActions.requestDelete}
                    searchQuery={searchQuery}
                    showBulkCheckbox={isBulkMode}
                    isBulkSelected={selectedItems.has(folder.id)}
                    onBulkSelect={toggleItem}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="archived" className="mt-14">
            <div className="space-y-4">
              {/* Archived Habits Section - filtered to exclude habits in archived folders */}
              <div className="space-y-2">
                <h3 className="text-lg font-medium">{t('archivedHabits')}</h3>
                {getArchivedHabitsFiltered().length === 0 ? (
                  <Card>
                    <CardContent className="text-center py-8">
                      <p className="text-muted-foreground">{t('noArchivedHabits')}</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div
                    className={`${archivedHabitsViewType === 'x2' ? 'grid grid-cols-2' : 'grid grid-cols-1'} gap-2`}
                    onPointerDown={handleHabitPointerDown}
                    onPointerMove={handleHabitPointerMove}
                    onPointerUp={handleHabitPointerUp}
                    onPointerCancel={handleHabitPointerCancel}
                    onClickCapture={handleHabitGridClickCapture}
                  >
                    {reorderForDragPreview(getArchivedHabitsFiltered()).map(habit => (
                      <ArchivedHabitCard
                        key={habit.id}
                        habit={habit}
                        onRestore={unarchiveHabit}
                        onDelete={confirmDeleteHabit}
                        searchQuery={searchQuery}
                        showBulkCheckbox={isBulkMode}
                        isBulkSelected={selectedItems.has(habit.id)}
                        onBulkSelect={toggleItem}
                        isDragEnabled={archivedHabitsReorderingEnabled && !isBulkMode}
                        isDragged={draggedHabitId === habit.id}
                        onDragStart={handleHabitDragStart}
                        onDragOver={handleHabitDragOver}
                        onDrop={handleHabitDrop}
                        onDragEnd={handleHabitDragEnd}
                      />
                    ))}
                  </div>
                )}
              </div>
              
              {/* Archived Folders Section */}
              <div className="space-y-2">
                <h3 className="text-lg font-medium">{t('archivedFolders')}</h3>
                {getArchivedFolders().length === 0 ? (
                  <Card>
                    <CardContent className="text-center py-8">
                      <p className="text-muted-foreground">{t('noArchivedFolders')}</p>
                    </CardContent>
                  </Card>
                ) : (
                  /*
                   * `items-start` keeps a folder's height its own. A grid stretches its
                   * cells to the tallest item in the row by default, so opening one folder
                   * made every neighbour beside it just as tall and they read as if they
                   * had all opened together.
                   */
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 items-start">
                    {getArchivedFolders().map(folder => (
                      <HabitFolderCard
                        key={folder.id}
                        folder={folder}
                        habits={archivedHabitsForFolders}
                        weekDays={weekDays}
                        isCompletedForDate={isHabitCompletedForDate}
                        onToggleCompletion={toggleHabitCompletion}
                        onMarkDone={markHabitDoneToday}
                        onMarkUnlimitedDone={markUnlimitedHabitDone}
                        onUndoCompletion={undoHabitCompletion}
                        onEditHabit={openHabitDetails}
                        onArchiveHabit={confirmArchiveHabit}
                        onDeleteHabit={confirmDeleteHabit}
                        onPinHabit={pinHabit}
                        onRestoreHabit={unarchiveHabit}
                        onPinFolder={pinFolder}
                        onUnpinFolder={unpinFolder}
                        onEditFolder={editFolder}
                        onArchiveFolder={folderActions.requestArchive}
                        onDeleteFolder={folderActions.requestDelete}
                        onRestoreFolder={folderActions.requestRestore}
                        searchQuery={searchQuery}
                        showBulkCheckbox={isBulkMode}
                        isBulkSelected={selectedItems.has(folder.id)}
                        onBulkSelect={toggleItem}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Floating Add Button */}
      <Button 
        variant="ghostStatic" 
        size="icon" 
        aria-label={t('add')}
        onClick={handleAddButtonClick}
        /* Same hairline as the floating nav capsule; see the note in Notes.tsx. */
        style={FLOATING_ADD_STYLE}
            className={cn(FLOATING_ADD_CLASS, activeTab === 'archived' && 'hidden')}
      >
        <Plus size={24} />
      </Button>

      {/* Bulk Action Bar */}
      <BulkActionBar
        context={getBulkContext()}
        isVisible={isBulkMode}
        isAllSelected={isAllSelected(getSelectableItems())}
        isAllItemsSelected={activeTab === 'archived' ? isAllSelected(getArchivedHabitsFiltered().map(h => h.id)) : false}
        isAllFoldersSelected={activeTab === 'archived' ? isAllSelected(getArchivedFolders().map(f => f.id)) : false}
        selectedCount={selectedItems.size}
        onAction={handleBulkAction}
        onClearSelection={clearSelection}
      />

      {/* Dialogs */}
      <HabitEditor
        isOpen={isAddDialogOpen}
        onClose={() => setIsAddDialogOpen(false)}
        onSave={handleCreateHabit}
        mode="create"
      />

      <HabitEditor
        isOpen={!!selectedHabit}
        onClose={() => setSelectedHabit(null)}
        onSave={handleUpdateHabit}
        initialHabit={selectedHabit}
        mode="edit"
      />

      <HabitFolderCreator
        isOpen={isFolderCreatorOpen}
        // Closing without saving drops the pending move as well: otherwise the habit stays
        // queued and the next folder created from the Folders tab, for no reason, swallows it.
        onClose={() => { setIsFolderCreatorOpen(false); setHabitToMove(null); setHabitsToMove(null); }}
        onSave={handleCreateFolder}
      />

      <HabitFolderEditor
        isOpen={isFolderEditorOpen}
        onClose={() => { setIsFolderEditorOpen(false); setSelectedFolder(null); }}
        onSave={handleUpdateFolder}
        folder={selectedFolder}
      />

      <MoveToFolderDialog
        isOpen={isMoveToFolderOpen}
        onClose={() => { setIsMoveToFolderOpen(false); setHabitToMove(null); setHabitsToMove(null); }}
        folders={habitFolders}
        onSelectFolder={handleMoveToFolder}
        onMoveComplete={() => { clearSelection(); exitBulkMode(); }}
        onCreateNewFolder={() => { setIsMoveToFolderOpen(false); setIsFolderCreatorOpen(true); }}
        itemIdsToMove={habitsToMove ?? (habitToMove ? [habitToMove] : [])}
        getFolderItemIds={(folder) => folder.habitIds}
        getItemCount={(folder) => folder.habitIds.length}
        itemNoun={t('habits')}
      />

      <ConfirmationDialog
        open={!!habitToDelete}
        onOpenChange={(open) => !open && setHabitToDelete(null)}
        title={namedSentence(t, 'confirmDeleteNamed', displayNameOf(habitToDelete))}
        description={namedSentence(t, 'confirmDeleteNamedBody', displayNameOf(habitToDelete))}
        action="delete"
        onConfirm={() => habitToDelete && deleteHabit(habitToDelete)}
      />

      <ConfirmationDialog
        open={!!habitToArchive}
        onOpenChange={(open) => !open && setHabitToArchive(null)}
        title={namedSentence(t, 'confirmArchiveNamed', displayNameOf(habitToArchive))}
        description={namedSentence(t, 'confirmArchiveNamedBody', displayNameOf(habitToArchive))}
        action="archive"
        onConfirm={() => habitToArchive && archiveHabit(habitToArchive)}
      />

      {/* One dialog for archiving, deleting and restoring a folder, shared with the other pages. */}
      <FolderActionDialog {...folderActions.dialog} itemKind="habit" />
      <FolderActionDialog
        open={Boolean(pendingBulkFolderAction)}
        kind={pendingBulkFolderAction?.kind ?? 'archive'}
        folderName=""
        itemCount={pendingBulkFolderAction
          ? new Set([...habitFolders, ...archivedHabitFolders]
              .filter(folder => pendingBulkFolderAction.folderIds.includes(folder.id))
              .flatMap(folder => folder.habitIds)).size
          : 0}
        itemKind="habit"
        bulk
        onFolderOnly={() => pendingBulkFolderAction && finishBulkFolderAction(pendingBulkFolderAction, 'folderOnly')}
        onAll={() => pendingBulkFolderAction && finishBulkFolderAction(pendingBulkFolderAction, 'withItems')}
        onOpenChange={(open) => !open && setPendingBulkFolderAction(null)}
      />
    </Layout>
    </FolderMembershipProvider>
  );
}
