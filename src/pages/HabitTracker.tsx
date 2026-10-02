import { useState, useCallback } from 'react';
import { Plus, ChevronLeft, ChevronRight, Target, FileStack } from 'lucide-react';
import { format, addWeeks, subWeeks, startOfWeek, addDays, isSameDay, isSameWeek } from 'date-fns';
import { Layout } from '@/components/Layout';
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
import { HabitViewSettings, HabitSortType, HabitSortDirection } from '@/components/habits/HabitViewSettings';
import { HabitFolderViewSettings, HabitFolderSortType, HabitFolderSortDirection } from '@/components/habits/HabitFolderViewSettings';
import { BulkActionBar, BulkActionType, BulkActionContext } from '@/components/shared/BulkActionBar';
import { useToastSettings } from '@/contexts/ToastContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useWeekStart, getJsDayFromVisualIndex } from '@/contexts/WeekStartContext';
import { useScrollDirection } from '@/hooks/useScrollDirection';
import { useBulkSelection } from '@/hooks/useBulkSelection';
import { useSwipeGesture } from '@/hooks/useSwipeGesture';
import { getTodayKey, toDateKey } from '@/lib/dateUtils';
import { cn } from '@/lib/utils';

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
  const { t } = useLanguage();
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
  const [folderToDelete, setFolderToDelete] = useState<string | null>(null);
  const [folderToArchive, setFolderToArchive] = useState<string | null>(null);
  const [folderRestoreDialogOpen, setFolderRestoreDialogOpen] = useState(false);
  const [folderToRestore, setFolderToRestore] = useState<string | null>(null);
  
  // Folder dialogs
  const [isFolderCreatorOpen, setIsFolderCreatorOpen] = useState(false);
  const [isFolderEditorOpen, setIsFolderEditorOpen] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<HabitFolder | null>(null);
  const [isMoveToFolderOpen, setIsMoveToFolderOpen] = useState(false);
  const [habitToMove, setHabitToMove] = useState<string | null>(null);
  
  // Calendar state
  const [currentWeek, setCurrentWeek] = useState(new Date());
  
  // Sort settings for habits tab
  const [habitsSortType, setHabitsSortType] = useLocalStorage<HabitSortType>('habitsSortType', 'name');
  const [habitsSortDirection, setHabitsSortDirection] = useLocalStorage<HabitSortDirection>('habitsSortDirection', 'asc');
  
  // Sort settings for folders tab
  const [habitFoldersSortType, setHabitFoldersSortType] = useLocalStorage<HabitFolderSortType>('habitFoldersSortType', 'name');
  const [habitFoldersSortDirection, setHabitFoldersSortDirection] = useLocalStorage<HabitFolderSortDirection>('habitFoldersSortDirection', 'asc');
  
  // Sort settings for archived tab
  const [archivedHabitsSortType, setArchivedHabitsSortType] = useLocalStorage<HabitSortType>('archivedHabitsSortType', 'name');
  const [archivedHabitsSortDirection, setArchivedHabitsSortDirection] = useLocalStorage<HabitSortDirection>('archivedHabitsSortDirection', 'asc');
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
  
  const scrollDirection = useScrollDirection();

  const weekStart = startOfWeek(currentWeek, { weekStartsOn });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const showTodayButton = !isSameWeek(currentWeek, new Date(), { weekStartsOn });

  // Check if any dialog is open - blocks swipe navigation
  const isAnyDialogOpen = isAddDialogOpen || !!selectedHabit || !!habitToDelete || 
    !!habitToArchive || !!folderToDelete || !!folderToArchive || 
    isFolderCreatorOpen || isFolderEditorOpen || isMoveToFolderOpen || folderRestoreDialogOpen;

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
        return { ...habit, completedDates: newCompletedDates };
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
    toast.success('Habit added successfully!');
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
    toast.success('Habit updated successfully!');
  };

  const deleteHabit = (habitId: string) => {
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
    toast.success('Habit deleted successfully!');
  };

  const confirmDeleteHabit = (habitId: string) => setHabitToDelete(habitId);
  const confirmArchiveHabit = (habitId: string) => setHabitToArchive(habitId);

  const archiveHabit = (habitId: string) => {
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
    toast.success('Habit archived successfully!');
  };

  const pinHabit = (habitId: string) => {
    setHabits((prev: Habit[]) => prev.map(habit => 
      habit.id === habitId ? { ...habit, pinned: !habit.pinned } : habit
    ));
  };

  const unarchiveHabit = (habitId: string) => {
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
    toast.success('Habit restored successfully!');
  };

  const openHabitDetails = (habit: Habit) => setSelectedHabit(habit);

  // Folder CRUD operations
  const handleCreateFolder = (folderData: Omit<HabitFolder, 'id' | 'createdAt' | 'habitIds'>) => {
    const newFolder: HabitFolder = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      habitIds: [],
      ...folderData
    };
    setHabitFolders((prev: HabitFolder[]) => [...prev, newFolder]);
    setIsFolderCreatorOpen(false);
    toast.success('Folder created successfully!');
  };

  const handleUpdateFolder = (folderData: Partial<HabitFolder>) => {
    if (!selectedFolder) return;
    setHabitFolders((prev: HabitFolder[]) => prev.map(folder =>
      folder.id === selectedFolder.id ? { ...folder, ...folderData } : folder
    ));
    setSelectedFolder(null);
    setIsFolderEditorOpen(false);
    toast.success('Folder updated successfully!');
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

  const confirmDeleteFolder = (folderId: string) => setFolderToDelete(folderId);
  const confirmArchiveFolder = (folderId: string) => setFolderToArchive(folderId);

  const deleteFolder = (folderId: string) => {
    // Delete folder and its habits
    const folder = habitFolders.find(f => f.id === folderId) || archivedHabitFolders.find(f => f.id === folderId);
    if (folder) {
      // Remove habits in folder
      setHabits((prev: Habit[]) => prev.filter(h => !folder.habitIds.includes(h.id)));
      setArchivedHabits((prev: Habit[]) => prev.filter(h => !folder.habitIds.includes(h.id)));
    }
    setHabitFolders((prev: HabitFolder[]) => prev.filter(f => f.id !== folderId));
    setArchivedHabitFolders((prev: HabitFolder[]) => prev.filter(f => f.id !== folderId));
    setFolderToDelete(null);
    toast.success('Folder and its habits deleted!');
  };

  const archiveFolder = (folderId: string) => {
    const folderToArchiveData = habitFolders.find(f => f.id === folderId);
    if (folderToArchiveData) {
      // Archive folder (habitIds stay in folder - same as Notes)
      setArchivedHabitFolders((prev: HabitFolder[]) => [...prev, { ...folderToArchiveData, archived: true }]);
      setHabitFolders((prev: HabitFolder[]) => prev.filter(f => f.id !== folderId));
      
      // Archive all habits in the folder - NO originalFolderId (folder has habitIds)
      const habitsInFolder = habits.filter(h => folderToArchiveData.habitIds.includes(h.id));
      if (habitsInFolder.length > 0) {
        setArchivedHabits((prev: Habit[]) => [...prev, ...habitsInFolder.map(h => ({ ...h, archived: true }))]);
        setHabits((prev: Habit[]) => prev.filter(h => !folderToArchiveData.habitIds.includes(h.id)));
      }
      
      toast.success('Folder and its habits archived successfully!');
    }
    setFolderToArchive(null);
  };

  /**
   * Works out how an archived folder should come back, without mutating anything.
   * `restoreHabits` is false for "Folder Only" and true for "Restore All".
   *
   * Returns null when the folder is no longer in the archived list (e.g. a bulk
   * restore already handled it), so callers can bail out safely.
   */
  const planFolderRestore = (
    folderId: string,
    restoreHabits: boolean,
  ): { folder: HabitFolder; habitIds: string[]; habitsToRestore: Habit[] } | null => {
    const folder = archivedHabitFolders.find(f => f.id === folderId);
    if (!folder) return null;

    // A habit already living in a non-archived folder must not be claimed twice.
    const habitIdsAssignedElsewhere = new Set<string>(habitFolders.flatMap(f => f.habitIds));
    const habitIds = folder.habitIds.filter(id => !habitIdsAssignedElsewhere.has(id));
    const habitsToRestore = restoreHabits
      ? archivedHabits.filter(h => habitIds.includes(h.id))
      : [];

    return { folder, habitIds, habitsToRestore };
  };

  const applyFolderRestore = (plan: { folder: HabitFolder; habitIds: string[]; habitsToRestore: Habit[] }) => {
    const { folder, habitIds, habitsToRestore } = plan;
    const restoredIds = habitsToRestore.map(h => h.id);

    setHabitFolders((prev: HabitFolder[]) => {
      // The folder may already have been restored by an earlier call in a bulk run.
      if (prev.some(f => f.id === folder.id)) return prev;
      return [...prev, { ...folder, archived: false, habitIds }];
    });
    setArchivedHabitFolders((prev: HabitFolder[]) => prev.filter(f => f.id !== folder.id));

    if (habitsToRestore.length > 0) {
      setHabits((prev: Habit[]) => {
        const existingIds = new Set(prev.map(h => h.id));
        return [...prev, ...habitsToRestore.filter(h => !existingIds.has(h.id)).map(h => ({ ...h, archived: false }))];
      });
      setArchivedHabits((prev: Habit[]) => prev.filter(h => !restoredIds.includes(h.id)));
    }
  };

  const unarchiveFolder = (folderId: string) => {
    const folderToUnarchiveData = archivedHabitFolders.find(f => f.id === folderId);
    if (!folderToUnarchiveData) return;

    const habitIdsAssignedElsewhere = new Set<string>(habitFolders.flatMap(f => f.habitIds));
    const sanitizedHabitIds = folderToUnarchiveData.habitIds.filter(id => !habitIdsAssignedElsewhere.has(id));
    const archivedHabitsInFolder = archivedHabits.filter(h => sanitizedHabitIds.includes(h.id));

    if (archivedHabitsInFolder.length === 0) {
      restoreHabitFolderOnly(folderId);
    } else {
      setFolderToRestore(folderId);
      setFolderRestoreDialogOpen(true);
    }
  };

  const restoreHabitFolderOnly = (folderId: string) => {
    const plan = planFolderRestore(folderId, false);
    if (!plan) return;
    applyFolderRestore(plan);
    toast.success('Folder restored successfully!');
  };

  const restoreHabitFolderWithHabits = (folderId: string) => {
    const plan = planFolderRestore(folderId, true);
    if (!plan) return;
    applyFolderRestore(plan);
    toast.success('Folder and its habits restored!');
  };

  // Move to folder
  const openMoveToFolder = (habitId: string) => {
    setHabitToMove(habitId);
    setIsMoveToFolderOpen(true);
  };

  const handleMoveToFolder = (folderId: string) => {
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
    toast.success('Habit moved to folder!');
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
          comparison = a.name.localeCompare(b.name);
          break;
        case 'dateCreated':
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case 'dateModified':
          comparison = new Date(a.modifiedAt || a.createdAt).getTime() - new Date(b.modifiedAt || b.createdAt).getTime();
          break;
        case 'completionRate':
          comparison = a.completedDates.length - b.completedDates.length;
          break;
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
          comparison = a.name.localeCompare(b.name);
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
          comparison = a.name.localeCompare(b.name);
          break;
        case 'dateCreated':
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case 'dateModified':
          comparison = new Date(a.modifiedAt || a.createdAt).getTime() - new Date(b.modifiedAt || b.createdAt).getTime();
          break;
        case 'completionRate':
          comparison = a.completedDates.length - b.completedDates.length;
          break;
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
          items.forEach(id => {
            if (habits.find(h => h.id === id)) pinHabit(id);
          });
        } else if (activeTab === 'folders') {
          items.forEach(id => {
            if (habitFolders.find(f => f.id === id)) pinFolder(id);
          });
        }
        exitBulkMode();
        break;
      case 'archive':
        // Tab-aware archive: only archive items of the current tab type
        if (activeTab === 'habits') {
          // Archive only habits, remove them from any folders
          items.forEach(id => {
            if (habits.find(h => h.id === id)) {
              archiveHabit(id);
            }
          });
        } else if (activeTab === 'folders') {
          // Archive only folders (and their contained habits)
          items.forEach(id => {
            if (habitFolders.find(f => f.id === id)) {
              archiveFolder(id);
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
          
          folderIds.forEach(id => unarchiveFolder(id));
          habitIds.forEach(id => {
            // Only restore habits that aren't in a folder being restored (they get restored with folder)
            const isInRestoringFolder = archivedHabitFolders.some(f => 
              folderIds.includes(f.id) && f.habitIds.includes(id)
            );
            if (!isInRestoringFolder) {
              unarchiveHabit(id);
            }
          });
        }
        exitBulkMode();
        break;
      case 'delete':
        // Tab-aware delete
        if (activeTab === 'habits') {
          items.forEach(id => {
            if (habits.find(h => h.id === id)) deleteHabit(id);
          });
        } else if (activeTab === 'folders') {
          items.forEach(id => {
            if (habitFolders.find(f => f.id === id)) deleteFolder(id);
          });
        } else if (activeTab === 'archived') {
          // Delete both habits and folders in archived tab
          items.forEach(id => {
            if (archivedHabits.find(h => h.id === id)) deleteHabit(id);
            if (archivedHabitFolders.find(f => f.id === id)) deleteFolder(id);
          });
        }
        exitBulkMode();
        break;
      case 'color':
        if (color) {
          if (activeTab === 'habits') {
            items.forEach(id => {
              setHabits((prev: Habit[]) => prev.map(h => h.id === id ? { ...h, color } : h));
            });
          } else if (activeTab === 'folders') {
            items.forEach(id => {
              setHabitFolders((prev: HabitFolder[]) => prev.map(f => f.id === id ? { ...f, color } : f));
            });
          }
        }
        exitBulkMode();
        break;
      case 'move':
        if (items.length === 1 && activeTab === 'habits') {
          openMoveToFolder(items[0]);
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

  return (
    <Layout 
      showSearch={true}
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      pageTitle={t('habits')}
      isBulkMode={isBulkMode}
      shieldHeight={activeTab === 'habits' ? '16.5rem' : '7.25rem'}
    >
      <div {...swipeHandlers}>
        <Tabs value={activeTab} onValueChange={(tab) => { setActiveTab(tab); exitBulkMode(); }}>
          <div className="fixed top-16 left-0 right-0 z-40 px-2">
            <div className="flex items-start justify-between py-2">
            <SlidingTabsList activeValue={activeTab} values={['habits', 'folders', 'archived']}>
              <TabsTrigger value="habits">{t('habits')}</TabsTrigger>
              <TabsTrigger value="folders">{t('tabFolders')}</TabsTrigger>
              <TabsTrigger value="archived">{t('tabArchived')}</TabsTrigger>
            </SlidingTabsList>
            <div className="flex items-center gap-1">
              {showTodayButton && activeTab === 'habits' && (
                <span 
                  className="text-sm font-bold text-foreground cursor-pointer" 
                  onClick={() => setCurrentWeek(new Date())}
                >
                  Today
                </span>
              )}
              <Button 
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
                  sortType={archivedHabitsSortType}
                  sortDirection={archivedHabitsSortDirection}
                  onSortTypeChange={setArchivedHabitsSortType}
                  onSortDirectionChange={setArchivedHabitsSortDirection}
                />
              ) : (
                <HabitViewSettings
                  sortType={habitsSortType}
                  sortDirection={habitsSortDirection}
                  onSortTypeChange={setHabitsSortType}
                  onSortDirectionChange={setHabitsSortDirection}
                />
              )}
            </div>
            </div>

            {/* Calendar Navigation - only visible on habits tab */}
            {activeTab === 'habits' && (
              <div className="rounded-[20px] bg-[hsl(var(--surface-card))] backdrop-blur-[12px] border border-[hsl(var(--glass-border))] shadow-[0_8px_32px_rgba(0,0,0,0.1)] px-2 py-2 mb-2">
                <div className="flex items-center justify-between mb-2">
                  <Button variant="ghost" size="icon" className="text-foreground hover:bg-hover hover:text-foreground rounded-full [&_svg]:!size-5" onClick={() => setCurrentWeek(subWeeks(currentWeek, 1))}>
                    <ChevronLeft size={24} />
                  </Button>
                  <h3 className="font-medium">
                    {format(weekStart, 'MMM d')} - {format(addDays(weekStart, 6), 'MMM d, yyyy')}
                  </h3>
                  <Button variant="ghost" size="icon" className="text-foreground hover:bg-hover hover:text-foreground rounded-full [&_svg]:!size-5" onClick={() => setCurrentWeek(addWeeks(currentWeek, 1))}>
                    <ChevronRight size={24} />
                  </Button>
                </div>
                
                <div className="grid grid-cols-7 gap-2 text-center">
                  {orderedDayNames.map((day, index) => {
                    const isToday = isSameDay(weekDays[index], new Date());
                    return (
                      <div key={`${day}-${index}`} className="text-sm font-medium text-muted-foreground p-2">
                        {day}
                        <div className={`text-lg font-bold mt-1 w-9 h-9 flex items-center justify-center mx-auto rounded-full ${isToday ? 'bg-black text-white' : 'text-foreground'}`}>
                          {format(weekDays[index], 'd')}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <TabsContent value="habits" className={activeTab === 'habits' ? 'mt-[13rem]' : 'mt-14'}>
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {filterHabits().map(habit => (
                  <HabitCard
                    key={habit.id}
                    habit={habit}
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
                    habits={habits}
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
                    onArchiveFolder={confirmArchiveFolder}
                    onDeleteFolder={confirmDeleteFolder}
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
                <h3 className="text-lg font-medium">Archived Habits</h3>
                {getArchivedHabitsFiltered().length === 0 ? (
                  <Card>
                    <CardContent className="text-center py-8">
                      <p className="text-muted-foreground">No archived habits</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                    {getArchivedHabitsFiltered().map(habit => (
                      <ArchivedHabitCard
                        key={habit.id}
                        habit={habit}
                        onRestore={unarchiveHabit}
                        onDelete={confirmDeleteHabit}
                        searchQuery={searchQuery}
                        showBulkCheckbox={isBulkMode}
                        isBulkSelected={selectedItems.has(habit.id)}
                        onBulkSelect={toggleItem}
                      />
                    ))}
                  </div>
                )}
              </div>
              
              {/* Archived Folders Section */}
              <div className="space-y-2">
                <h3 className="text-lg font-medium">Archived Folders</h3>
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
                        habits={archivedHabits}
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
                        onArchiveFolder={confirmArchiveFolder}
                        onDeleteFolder={confirmDeleteFolder}
                        onRestoreFolder={unarchiveFolder}
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
        onClick={handleAddButtonClick}
        /* Same hairline as the floating nav capsule; see the note in Notes.tsx. */
        className={cn(
          "fixed bottom-20 right-2 h-14 w-14 rounded-full z-30 px-0 py-0 bg-black text-white border border-nav-border hover:bg-black/90",
          "transition-all duration-300 ease-out",
          scrollDirection === 'down' || activeTab === 'archived'
            ? "opacity-0 translate-y-4 pointer-events-none" 
            : "opacity-100 translate-y-0"
        )}
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
        onClose={() => setIsFolderCreatorOpen(false)}
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
        onClose={() => { setIsMoveToFolderOpen(false); setHabitToMove(null); }}
        folders={habitFolders}
        onSelectFolder={handleMoveToFolder}
        onCreateNewFolder={() => { setIsMoveToFolderOpen(false); setIsFolderCreatorOpen(true); }}
        currentFolderId={habitToMove ? habitFolders.find(f => f.habitIds.includes(habitToMove))?.id : undefined}
        getItemCount={(folder) => folder.habitIds.length}
        itemNoun={t('habits')}
      />

      <ConfirmationDialog
        open={!!habitToDelete}
        onOpenChange={(open) => !open && setHabitToDelete(null)}
        title="Delete Habit"
        description="Are you sure you want to permanently delete this habit? This action cannot be undone."
        action="delete"
        onConfirm={() => habitToDelete && deleteHabit(habitToDelete)}
      />

      <ConfirmationDialog
        open={!!habitToArchive}
        onOpenChange={(open) => !open && setHabitToArchive(null)}
        title="Archive Habit"
        description="Are you sure you want to archive this habit? You can restore it later from the archived tab."
        action="archive"
        onConfirm={() => habitToArchive && archiveHabit(habitToArchive)}
      />

      <ConfirmationDialog
        open={!!folderToDelete}
        onOpenChange={(open) => !open && setFolderToDelete(null)}
        title="Delete Folder"
        description="Are you sure you want to permanently delete this folder and all its habits? This action cannot be undone."
        action="delete"
        onConfirm={() => folderToDelete && deleteFolder(folderToDelete)}
      />

      <ConfirmationDialog
        open={!!folderToArchive}
        onOpenChange={(open) => !open && setFolderToArchive(null)}
        title="Archive Folder"
        description="Are you sure you want to archive this folder and all its habits? You can restore them later from the archived tab."
        action="archive"
        onConfirm={() => folderToArchive && archiveFolder(folderToArchive)}
      />

      {/* Folder Restore Confirmation Dialog */}
      <ConfirmationDialog
        open={folderRestoreDialogOpen}
        onOpenChange={(open) => {
          setFolderRestoreDialogOpen(open);
          if (!open) setFolderToRestore(null);
        }}
        title="Restore Folder"
        description={(() => {
          if (!folderToRestore) return '';
          const folder = archivedHabitFolders.find(f => f.id === folderToRestore);
          if (!folder) return '';
          const habitIdsAssignedElsewhere = new Set<string>(habitFolders.flatMap(f => f.habitIds));
          const sanitizedHabitIds = folder.habitIds.filter(id => !habitIdsAssignedElsewhere.has(id));
          const count = archivedHabits.filter(h => sanitizedHabitIds.includes(h.id)).length;
          return `Do you also want to restore the ${count} habit${count !== 1 ? 's' : ''} inside this folder?`;
        })()}
        action="restore"
        confirmLabel="Restore All"
        onConfirm={() => {
          if (folderToRestore) restoreHabitFolderWithHabits(folderToRestore);
          setFolderToRestore(null);
        }}
        secondaryAction={{
          label: 'Folder Only',
          onClick: () => {
            if (folderToRestore) restoreHabitFolderOnly(folderToRestore);
            setFolderToRestore(null);
          }
        }}
      />
    </Layout>
  );
}
