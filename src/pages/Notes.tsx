import { useState, useEffect, useRef, useCallback } from 'react';
import { Plus, X, FolderOpen, Notebook, FileStack } from 'lucide-react';
import { ViewSettings, ViewType, SortType, SortDirection } from '@/components/notes/ViewSettings';
import { NoteFolderViewSettings, NoteFolderSortType, NoteFolderSortDirection } from '@/components/noteFolders/NoteFolderViewSettings';
import { Layout } from '@/components/Layout';
import { FolderMembershipProvider, collectFiledIds } from '@/contexts/FolderMembershipContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, SlidingTabsList, TabsTrigger } from '@/components/ui/tabs';
import { ConfirmationDialog } from '@/components/shared/ConfirmationDialog';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { Note, NoteType, TextNote, ListNote, AudioNote, ImageNote } from '@/types/note';
import { NoteFolder } from '@/types/noteFolder';
import { useToastSettings } from '@/contexts/ToastContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { NoteTypePopup } from '@/components/notes/NoteTypePopup';
import { ImageCapturePopup } from '@/components/notes/ImageCapturePopup';
import { AudioRecorderPopup } from '@/components/notes/AudioRecorderPopup';
import { NoteCard } from '@/components/notes/NoteCard';
import { NoteViewer } from '@/components/notes/NoteViewer';
import { NoteFolderCreator } from '@/components/noteFolders/NoteFolderCreator';
import { NoteFolderCard } from '@/components/noteFolders/NoteFolderCard';
import { NoteFolderEditor } from '@/components/noteFolders/NoteFolderEditor';
import { MoveToFolderDialog } from '@/components/shared/MoveToFolderDialog';
import { PinPadDialog } from '@/components/notes/PinPadDialog';
import { NoteEditor } from '@/components/notes/NoteEditor';
import { highlightText } from '@/lib/textHighlight';
import { updateTagUsage } from '@/lib/tagStorage';
import { autoImportNoteToFolders } from '@/lib/folderAutoImport';
import { parseSearchExpression, matchesSearchExpression } from '@/lib/tagParser';
import { extractSearchableText } from '@/lib/noteSearchText';
import { nextCopyName } from '@/lib/copyName';
import { countedSentence, folderAndCount, itemDisplayName, namedSentence } from '@/lib/countedMessage';
import { useSwipeGesture } from '@/hooks/useSwipeGesture';
import { useBulkSelection } from '@/hooks/useBulkSelection';
import { BulkActionBar, BulkActionType, BulkActionContext } from '@/components/shared/BulkActionBar';
import { useScrollDirection } from '@/hooks/useScrollDirection';
import { cn } from '@/lib/utils';

// Tab order for swipe navigation. Module-level so its identity is stable across
// renders; declared inside the component it was rebuilt every render, which made it
// unsafe to list as a useCallback dependency.
const NOTE_TABS = ['all-notes', 'folders', 'archived'];

export default function Notes() {
  const { toast } = useToastSettings();
  const [notes, setNotes] = useLocalStorage<Note[]>('notes', []);
  const [archivedNotes, setArchivedNotes] = useLocalStorage<Note[]>('archivedNotes', []);
  const [folders, setFolders] = useLocalStorage<NoteFolder[]>('folders', []);
  const [archivedFolders, setArchivedFolders] = useLocalStorage<NoteFolder[]>('archivedFolders', []);
  const [activeTab, setActiveTab] = useState('all-notes');
  const [showArchivedItems, setShowArchivedItems] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showNoteTypePopup, setShowNoteTypePopup] = useState(false);
  const [showImageCapturePopup, setShowImageCapturePopup] = useState(false);
  const [showAudioRecorderPopup, setShowAudioRecorderPopup] = useState(false);
  const [isFolderCreatorOpen, setIsFolderCreatorOpen] = useState(false);
  const [isFolderEditorOpen, setIsFolderEditorOpen] = useState(false);
  const [isMoveToFolderOpen, setIsMoveToFolderOpen] = useState(false);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<NoteFolder | null>(null);
  const [selectedNoteForMove, setSelectedNoteForMove] = useState<string[] | null>(null);
  const [isNoteViewerOpen, setIsNoteViewerOpen] = useState<boolean>(false);
  const [noteToView, setNoteToView] = useState<Note | null>(null);
  const [isNewNote, setIsNewNote] = useState<boolean>(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{type: 'note' | 'folder', id: string} | null>(null);
  const [itemToArchive, setItemToArchive] = useState<{type: 'note' | 'folder', id: string} | null>(null);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [bulkArchiveDialogOpen, setBulkArchiveDialogOpen] = useState(false);
  const [pendingBulkAction, setPendingBulkAction] = useState<{ ids: string[], action: 'archive' | 'delete' } | null>(null);
  const [folderRestoreDialogOpen, setFolderRestoreDialogOpen] = useState(false);
  const [folderToRestore, setFolderToRestore] = useState<string | null>(null);
  const [isNoteColorEditorOpen, setIsNoteColorEditorOpen] = useState(false);
  const [noteToEditColor, setNoteToEditColor] = useState<Note | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: '#FFFFFF'
  });
  const [allNotesViewType, setAllNotesViewType] = useLocalStorage<ViewType>('notesAllViewType', 'list');
  const [archivedNotesViewType, setArchivedNotesViewType] = useLocalStorage<ViewType>('notesArchivedViewType', 'list');
  
  // Computed viewType based on active tab for backward compatibility
  const viewType = activeTab === 'archived' ? archivedNotesViewType : allNotesViewType;
  const setViewType = activeTab === 'archived' ? setArchivedNotesViewType : setAllNotesViewType;

  /**
   * `?view=list|x2|x3` forces a view for this visit without saving it, so a
   * specific layout can be opened and checked directly. Useful for verifying the grid
   * views, which are otherwise two clicks deep in the settings menu.
   */
  const forcedViewType = (() => {
    if (typeof window === 'undefined') return null;
    const raw = new URLSearchParams(window.location.search).get('view');
    return raw === 'list' || raw === 'x2' || raw === 'x3' ? (raw as ViewType) : null;
  })();
  const effectiveViewType = forcedViewType ?? viewType;
  const [allNotesSortType, setAllNotesSortType] = useLocalStorage<SortType>('notesAllSortType', 'dateCreated');
  const [allNotesSortDirection, setAllNotesSortDirection] = useLocalStorage<SortDirection>('notesAllSortDirection', 'desc');
  const [archivedNotesSortType, setArchivedNotesSortType] = useLocalStorage<SortType>('notesArchivedSortType', 'dateCreated');
  const [archivedNotesSortDirection, setArchivedNotesSortDirection] = useLocalStorage<SortDirection>('notesArchivedSortDirection', 'desc');
  
  // Computed sort values based on active tab
  const sortType = activeTab === 'archived' ? archivedNotesSortType : allNotesSortType;
  const setSortType = activeTab === 'archived' ? setArchivedNotesSortType : setAllNotesSortType;
  const sortDirection = activeTab === 'archived' ? archivedNotesSortDirection : allNotesSortDirection;
  const setSortDirection = activeTab === 'archived' ? setArchivedNotesSortDirection : setAllNotesSortDirection;
  const [folderSortType, setFolderSortType] = useLocalStorage<NoteFolderSortType>('foldersSortType', 'name');
  const [folderSortDirection, setFolderSortDirection] = useLocalStorage<NoteFolderSortDirection>('foldersSortDirection', 'asc');
  const [customOrder, setCustomOrder] = useLocalStorage<string[]>('notesCustomOrder', []);
  const [draggedNote, setDraggedNote] = useState<string | null>(null);
  const [draggedOverNote, setDraggedOverNote] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartPos, setDragStartPos] = useState<{ x: number; y: number } | null>(null);
  const [currentDragPos, setCurrentDragPos] = useState<{ x: number; y: number } | null>(null);
  const [autoScrollInterval, setAutoScrollInterval] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [isNoteSelected, setIsNoteSelected] = useState<string | null>(null); // For visual feedback
  const [dragPreviewOrder, setDragPreviewOrder] = useState<string[]>([]); // For live reordering preview
  const [dragInsertIndex, setDragInsertIndex] = useState<number>(-1); // Index where note will be inserted
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const pendingNoteIdRef = useRef<string | null>(null);
  const LONG_PRESS_DELAY = 1000; // ms
  const LONG_PRESS_MOVE_THRESHOLD = 10; // px
  const [showPinPad, setShowPinPad] = useState(false);
  const [pinPadMode, setPinPadMode] = useState<'set' | 'unlock'>('set');
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  // Notes unlocked during this session (avoid re-PIN while viewing)
  const [unlockedNoteIds, setUnlockedNoteIds] = useState<string[]>([]);

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

  // Scroll direction for hiding Add button
  const scrollDirection = useScrollDirection();

  // Check if any dialog/editor is open - blocks swipe navigation
  const isAnyDialogOpen = isNoteViewerOpen || isFolderCreatorOpen || isFolderEditorOpen || 
    isMoveToFolderOpen || showNoteTypePopup || showImageCapturePopup || showAudioRecorderPopup ||
    deleteDialogOpen || archiveDialogOpen || showPinPad || isNoteColorEditorOpen ||
    bulkDeleteDialogOpen || bulkArchiveDialogOpen || folderRestoreDialogOpen;

  // Tab swipe navigation
  const handleSwipeLeft = useCallback(() => {
    if (isAnyDialogOpen) return;
    const currentIndex = NOTE_TABS.indexOf(activeTab);
    if (currentIndex < NOTE_TABS.length - 1) {
      setActiveTab(NOTE_TABS[currentIndex + 1]);
    }
  }, [activeTab, isAnyDialogOpen]);

  const handleSwipeRight = useCallback(() => {
    if (isAnyDialogOpen) return;
    const currentIndex = NOTE_TABS.indexOf(activeTab);
    if (currentIndex > 0) {
      setActiveTab(NOTE_TABS[currentIndex - 1]);
    }
  }, [activeTab, isAnyDialogOpen]);

  const swipeHandlers = useSwipeGesture({
    onSwipeLeft: handleSwipeLeft,
    onSwipeRight: handleSwipeRight,
    threshold: 50,
  });

  // Cleanup effect to ensure scroll is restored if component unmounts while dragging
  useEffect(() => {
    return () => {
      // Restore scroll when component unmounts
      document.body.style.overflow = '';
      document.body.style.touchAction = '';
      document.documentElement.style.overscrollBehavior = '';
      // Clear any auto-scroll interval
      if (autoScrollInterval) {
        clearInterval(autoScrollInterval);
      }
    };
  }, [autoScrollInterval]);

  // Prevent pull-to-refresh globally when in custom sort mode
  useEffect(() => {
    if (sortType === 'custom') {
      // Prevent pull-to-refresh on the whole document
      document.body.style.overscrollBehavior = 'none';
      document.documentElement.style.overscrollBehavior = 'none';
      
      const preventRefresh = (e: TouchEvent) => {
        // Prevent pull-to-refresh when touching the page
        if (e.touches.length > 0 && window.pageYOffset <= 0) {
          const touch = e.touches[0];
          if (touch.clientY > touch.screenY) {
            e.preventDefault();
          }
        }
      };
      
      document.addEventListener('touchstart', preventRefresh, { passive: false });
      document.addEventListener('touchmove', preventRefresh, { passive: false });
      
      return () => {
        document.body.style.overscrollBehavior = '';
        document.documentElement.style.overscrollBehavior = '';
        document.removeEventListener('touchstart', preventRefresh);
        document.removeEventListener('touchmove', preventRefresh);
      };
    }
  }, [sortType]);

  const handleTypeSelect = (type: NoteType) => {
    setShowNoteTypePopup(false);
    switch (type) {
      case 'text':
        createEmptyTextNote();
        break;
      case 'list':
        createEmptyListNote();
        break;
      case 'audio':
        setShowAudioRecorderPopup(true);
        break;
      case 'image':
        setShowImageCapturePopup(true);
        break;
    }
  };

  const createEmptyTextNote = () => {
    const newNote: TextNote = {
      id: Date.now().toString(),
      name: '',
      type: 'text',
      description: '',
      color: '#FFFFFF',
      createdAt: new Date().toISOString(),
      pinned: false
    };
    
    // Don't add to notes array yet - only add when user saves with content
    setNoteToView(newNote);
    setIsNewNote(true);
    setIsNoteViewerOpen(true);
  };

  const createEmptyListNote = () => {
    const newNote: ListNote = {
      id: Date.now().toString(),
      name: '',
      type: 'list',
      items: [{ id: Date.now().toString(), text: '', completed: false }],
      color: '#FFFFFF',
      createdAt: new Date().toISOString(),
      pinned: false
    };
    
    // Don't add to notes array yet - only add when user saves with content
    setNoteToView(newNote);
    setIsNewNote(true);
    setIsNoteViewerOpen(true);
  };

  const handleImageSelect = (imageUrl: string) => {
    // Create and immediately save the image note (like audio notes)
    const newNote: ImageNote = {
      id: Date.now().toString(),
      name: '',
      type: 'image',
      imageUrl,
      description: '',
      color: '#FFFFFF',
      createdAt: new Date().toISOString(),
      pinned: false
    };
    
    // Add to notes array immediately
    setNotes((prev: Note[]) => [...prev, newNote]);
    toast.success(say('toastAdded', 'notes'));
    
    // Open in viewer so user can add title/description/more media
    setNoteToView(newNote);
    setIsNewNote(false);  // Set to false since it's already saved
    setIsNoteViewerOpen(true);
  };

  const handleAudioRecordingComplete = (audioUrl: string, duration: number) => {
    const audioMarker = `[audio:${audioUrl}:${duration}]`;
    const newNote: TextNote = {
      id: Date.now().toString(),
      name: '',
      type: 'text',
      description: audioMarker,
      color: '#FFFFFF',
      createdAt: new Date().toISOString(),
      pinned: false
    };
    
    // Add to notes array immediately (like image notes)
    setNotes((prev: Note[]) => [...prev, newNote]);
    toast.success(say('toastAdded', 'notes'));
    
    // Open in viewer so user can add title/description/more media
    setNoteToView(newNote);
    setIsNewNote(false);  // Set to false since it's already saved
    setIsNoteViewerOpen(true);
  };

  const addTextNote = (noteData: Omit<TextNote, 'id' | 'createdAt'>) => {
    const newNote: TextNote = {
      ...noteData,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      pinned: false
    };
    setNotes((prev: Note[]) => [...prev, newNote]);
    toast.success(say('toastAdded', 'notes'));
    
    // Open the new note in viewer with auto-focus
    setNoteToView(newNote);
    setIsNewNote(true);
    setIsNoteViewerOpen(true);
  };

  const addListNote = (noteData: Omit<ListNote, 'id' | 'createdAt'>) => {
    const newNote: ListNote = {
      ...noteData,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      pinned: false
    };
    setNotes((prev: Note[]) => [...prev, newNote]);
    toast.success(say('toastAdded', 'notes'));
    
    // Open the new note in viewer with auto-focus
    setNoteToView(newNote);
    setIsNewNote(true);
    setIsNoteViewerOpen(true);
  };


  const addImageNote = (noteData: Omit<ImageNote, 'id' | 'createdAt'>) => {
    const newNote: ImageNote = {
      ...noteData,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      pinned: false
    };
    setNotes((prev: Note[]) => [...prev, newNote]);
    toast.success(say('toastAdded', 'notes'));
    
    // Open the new note in viewer with auto-focus
    setNoteToView(newNote);
    setIsNewNote(true);
    setIsNoteViewerOpen(true);
  };

  const updateTextNote = (noteData: Omit<TextNote, 'id' | 'createdAt'>) => {
    if (!selectedNote || selectedNote.type !== 'text') return;
    setNotes((prev: Note[]) => prev.map(note => note.id === selectedNote.id ? {
      ...noteData,
      id: selectedNote.id,
      createdAt: selectedNote.createdAt
    } : note));
    setSelectedNote(null);
    toast.success(say('toastUpdated', 'noteViewerTitle'));
  };

  const updateListNote = (noteData: Omit<ListNote, 'id' | 'createdAt'>) => {
    if (!selectedNote || selectedNote.type !== 'list') return;
    setNotes((prev: Note[]) => prev.map(note => note.id === selectedNote.id ? {
      ...noteData,
      id: selectedNote.id,
      createdAt: selectedNote.createdAt
    } : note));
    setSelectedNote(null);
    toast.success(say('toastUpdated', 'noteViewerTitle'));
  };

  const deleteNote = (noteId: string) => {
    checkLockBeforeAction(noteId, () => {
      setItemToDelete({ type: 'note', id: noteId });
      setDeleteDialogOpen(true);
    });
  };

  const confirmDeleteNote = (noteId: string) => {
    // Decrement tag usage for the deleted note
    const noteToDelete = notes.find(n => n.id === noteId) || archivedNotes.find(n => n.id === noteId);
    if (noteToDelete?.tags) {
      updateTagUsage(noteToDelete.tags, []);
    }
    
    setNotes((prev: Note[]) => prev.filter(note => note.id !== noteId));
    setArchivedNotes((prev: Note[]) => prev.filter(note => note.id !== noteId));
    // Update folders to remove the deleted note ID
    setFolders((prev: NoteFolder[]) => prev.map(folder => ({
      ...folder,
      noteIds: folder.noteIds.filter(id => id !== noteId)
    })));
    setArchivedFolders((prev: NoteFolder[]) => prev.map(folder => ({
      ...folder,
      noteIds: folder.noteIds.filter(id => id !== noteId)
    })));
    setSelectedNote(null);
    
    // Auto-close note viewer if the deleted note is currently being viewed
    if (isNoteViewerOpen && noteToView?.id === noteId) {
      setIsNoteViewerOpen(false);
      setNoteToView(null);
      setIsNewNote(false);
      setUnlockedNoteIds(prev => prev.filter(id => id !== noteId));
    }
    
    toast.success(say('toastDeleted', 'noteViewerTitle'));
  };
  
   const confirmArchiveNote = (noteId: string) => {
     const note = notes.find(n => n.id === noteId);
     // Don't ask for PIN if note is currently being viewed or already unlocked in session
     if (note?.locked && !unlockedNoteIds.includes(noteId) && noteToView?.id !== noteId) {
       setActiveNoteId(noteId);
       setPinPadMode('unlock');
       setShowPinPad(true);
       (window as any).pendingAction = () => {
         setItemToArchive({ type: 'note', id: noteId });
         setArchiveDialogOpen(true);
       };
       return;
     }
     setItemToArchive({ type: 'note', id: noteId });
     setArchiveDialogOpen(true);
   };

   const performArchiveNote = (noteId: string) => {
     const noteToArchive = notes.find(note => note.id === noteId);
     if (noteToArchive) {
       // Find which folder this note belongs to (if any)
       const originalFolder = folders.find(folder => folder.noteIds.includes(noteId));
       const originalFolderId = originalFolder?.id;
       
       // Archive the note with original folder ID stored
       const archivedNote = {
         ...noteToArchive,
         originalFolderId: originalFolderId
       };
       
       setArchivedNotes((prev: Note[]) => [...prev, archivedNote]);
       setNotes((prev: Note[]) => prev.filter(note => note.id !== noteId));
       // Update folders to remove the archived note ID
       setFolders((prev: NoteFolder[]) => prev.map(folder => ({
         ...folder,
         noteIds: folder.noteIds.filter(id => id !== noteId)
       })));
     }
     // Re-lock in current session to enforce PIN on archived tab
     setUnlockedNoteIds(prev => prev.filter(id => id !== noteId));
     setSelectedNote(null);
     toast.success(say('toastArchived', 'noteViewerTitle'));
   };
  
   const unarchiveNote = (noteId: string) => {
     const noteToUnarchive = archivedNotes.find(note => note.id === noteId);
     if (noteToUnarchive) {
       // Remove originalFolderId before restoring to notes
       const { originalFolderId, ...restoredNote } = noteToUnarchive;
       
       setNotes((prev: Note[]) => [...prev, restoredNote]);
       setArchivedNotes((prev: Note[]) => prev.filter(note => note.id !== noteId));
       
       // If the note had an original folder, restore association
       if (originalFolderId) {
         const originalFolderInActive = folders.some(folder => folder.id === originalFolderId);
         const originalFolderInArchived = archivedFolders.some(folder => folder.id === originalFolderId);
         
         if (originalFolderInActive) {
           // Folder is active - add note to it
           setFolders((prev: NoteFolder[]) => prev.map(folder =>
             folder.id === originalFolderId 
               ? { ...folder, noteIds: [...folder.noteIds, noteId] }
               : folder
           ));
         } else if (originalFolderInArchived) {
           // Folder is archived - update archived folder's noteIds
           // so connection is preserved when folder is later restored
           setArchivedFolders((prev: NoteFolder[]) => prev.map(folder =>
             folder.id === originalFolderId 
               ? { ...folder, noteIds: [...folder.noteIds, noteId] }
               : folder
           ));
         }
       }
     }
     // Re-lock in current session
     setUnlockedNoteIds(prev => prev.filter(id => id !== noteId));
     setSelectedNote(null);
     toast.success(say('toastRestored', 'noteViewerTitle'));
   };

  const unarchiveFolder = (folderId: string) => {
    const folderToUnarchive = archivedFolders.find(folder => folder.id === folderId);
    if (folderToUnarchive) {
      // Check how many archived notes are in this folder
      const noteIdsAssignedElsewhere = new Set<string>(folders.flatMap(f => f.noteIds));
      const sanitizedNoteIds = folderToUnarchive.noteIds.filter(id => !noteIdsAssignedElsewhere.has(id));
      const archivedNotesInFolder = archivedNotes.filter(note => sanitizedNoteIds.includes(note.id));
      
      if (archivedNotesInFolder.length === 0) {
        // No archived notes inside — restore folder immediately
        restoreFolderOnly(folderId);
      } else {
        // Has archived notes — ask user
        setFolderToRestore(folderId);
        setFolderRestoreDialogOpen(true);
      }
    }
  };

  const restoreFolderOnly = (folderId: string) => {
    const folderToUnarchive = archivedFolders.find(folder => folder.id === folderId);
    if (folderToUnarchive) {
      const noteIdsAssignedElsewhere = new Set<string>(folders.flatMap(f => f.noteIds));
      const sanitizedNoteIds = folderToUnarchive.noteIds.filter(id => !noteIdsAssignedElsewhere.has(id));

      setFolders((prev: NoteFolder[]) => [
        ...prev,
        { ...folderToUnarchive, archived: false, noteIds: sanitizedNoteIds }
      ]);
      setArchivedFolders((prev: NoteFolder[]) => prev.filter(folder => folder.id !== folderId));
      
      toast.success(say('toastRestored', 'tabFolders'));
    }
  };

  const restoreFolderWithNotes = (folderId: string) => {
    const folderToUnarchive = archivedFolders.find(folder => folder.id === folderId);
    if (folderToUnarchive) {
      const noteIdsAssignedElsewhere = new Set<string>(folders.flatMap(f => f.noteIds));
      const sanitizedNoteIds = folderToUnarchive.noteIds.filter(id => !noteIdsAssignedElsewhere.has(id));

      setFolders((prev: NoteFolder[]) => [
        ...prev,
        { ...folderToUnarchive, archived: false, noteIds: sanitizedNoteIds }
      ]);
      setArchivedFolders((prev: NoteFolder[]) => prev.filter(folder => folder.id !== folderId));
      
      const notesToUnarchive = archivedNotes.filter(note => sanitizedNoteIds.includes(note.id));
      if (notesToUnarchive.length > 0) {
        setNotes((prev: Note[]) => [...prev, ...notesToUnarchive]);
        setArchivedNotes((prev: Note[]) => prev.filter(note => !sanitizedNoteIds.includes(note.id)));
      }
      
      toast.success(folderAndCount(t, language, 'folderAndCountRestored', 'note', notesToUnarchive.length));
    }
  };

  const toggleListItem = (noteId: string, itemId: string) => {
    setNotes((prev: Note[]) => prev.map(note => {
      if (note.id === noteId && note.type === 'list') {
        return {
          ...note,
          items: note.items.map(item => item.id === itemId ? {
            ...item,
            completed: !item.completed
          } : item)
        };
      }
      return note;
    }));
  };

  /**
   * A note counts as content when it has a title OR a body.
   *
   * The title used to be ignored here, so a note given only a title was judged empty:
   * a new one was silently dropped instead of being created, and an existing one was
   * deleted the moment its body was cleared. Typing a title is writing the note.
   */
  const isNoteEmpty = (note: Note): boolean => {
    const hasTitle = (note.name || '').trim() !== '';
    if (hasTitle) return false;

    switch (note.type) {
      case 'text':
        // Text note is empty if description has no content
        const textContent = note.description || '';
        // Check if there's any media (images or audio)
        const hasMedia = /\[image:.+?\]|\[audio:.+?:[\d.]+\]/.test(textContent);
        // Remove all markers and check if there's actual text
        const withoutMarkers = textContent
          .replace(/\[image:.+?\]/g, '')
          .replace(/\[audio:.+?:[\d.]+\]/g, '')
          .replace(/\[audionote:.+?\]/g, '')
          .trim();
        // Note is NOT empty if it has media, even without text
        return !hasMedia && withoutMarkers === '';
      
      case 'list':
        // List note is empty if it has no items or all items are empty
        return !note.items || note.items.length === 0 || 
               note.items.every(item => !item.text || item.text.trim() === '');
      
      case 'audio':
        // Audio note is empty if it has no primary audioUrl
        return !note.audioUrl;
      
      case 'image':
        // Image note is empty if it has no primary imageUrl
        return !note.imageUrl;
      
      default:
        return false;
    }
  };

  const saveNoteFromViewer = (noteId: string, updates: Partial<Note>) => {
    
    // Track tag usage if tags are being updated
    if (updates.tags !== undefined) {
      const existingNote = notes.find(note => note.id === noteId);
      const oldTags = existingNote?.tags || noteToView?.tags || [];
      const newTags = updates.tags || [];
      
      // Update tag usage tracking
      updateTagUsage(oldTags, newTags);
    }
    
    // Check if this is a new note that hasn't been saved yet
    const existingNote = notes.find(note => note.id === noteId);
    
    if (!existingNote && noteToView) {
      // This is a new note - add it to the notes array
      const newNote = { ...noteToView, ...updates } as Note;
      
      // Check if the new note is empty
      if (isNoteEmpty(newNote)) {
        setIsNoteViewerOpen(false);
        setNoteToView(null);
        return;
      }
      
      setNotes((prev: Note[]) => [...prev, newNote]);
      setNoteToView(newNote);
      setIsNewNote(false);
      
      // Auto-import to folders based on tags
      setFolders(prev => autoImportNoteToFolders(newNote, prev));
    } else {
      // This is an existing note - update it
      const updatesWithModifiedAt = { ...updates, modifiedAt: new Date().toISOString() };

      /*
       * Derive the updated note SYNCHRONOUSLY, from the state as it is now.
       *
       * This used to be assembled inside the two setState updater callbacks, assigning to an
       * outer `let updatedNote`. That silently did nothing: React does not run an updater
       * until it processes the update, so by the time the very next line read the variable it
       * was still null. Both consumers below were therefore dead code — the tag-driven folder
       * auto-import never ran, and noteToView was never refreshed. A `&& updatedNote` guard
       * made it a no-op rather than a crash, which is why nobody noticed.
       *
       * Updaters must also stay pure; writing to a variable outside them is not allowed to
       * have an observable effect, and under StrictMode they run twice.
       */
      const sourceNote =
        notes.find(note => note.id === noteId) ??
        archivedNotes.find(note => note.id === noteId) ??
        null;
      // `Note` is a discriminated union, and spreading a union widens it to a shape the
      // compiler can no longer prove is any one member. The cast restores what the merge
      // actually guarantees: the source member's own fields, with the updates applied.
      const updatedNote: Note | null = sourceNote
        ? ({ ...sourceNote, ...updatesWithModifiedAt } as Note)
        : null;

      setNotes((prev: Note[]) => prev.map(note => (
        (note.id === noteId ? { ...note, ...updatesWithModifiedAt } : note) as Note
      )));

      setArchivedNotes((prev: Note[]) => prev.map(note => (
        (note.id === noteId ? { ...note, ...updatesWithModifiedAt } : note) as Note
      )));

      // Auto-import to folders based on tags if the note's tags changed
      if (updatedNote && updates.tags !== undefined) {
        setFolders(prev => autoImportNoteToFolders(updatedNote, prev));
      }
      
      // Update noteToView to keep UI in sync
      if (noteToView && noteToView.id === noteId && updatedNote) {
        setNoteToView(updatedNote);
      }
      
      // Check if the note is now empty and auto-delete it
      if (updatedNote && isNoteEmpty(updatedNote)) {
        // Remove from notes array
        setNotes((prev: Note[]) => prev.filter(n => n.id !== noteId));
        setArchivedNotes((prev: Note[]) => prev.filter(n => n.id !== noteId));
        // Close the viewer
        setIsNoteViewerOpen(false);
        setNoteToView(null);
        toast.success(say('toastDeleted', 'noteViewerTitle'));
      }
    }
  };

  const openNoteViewer = (note: Note) => {
    // Check if this note is from the archived notes array
    const isArchivedNote = archivedNotes.some(archivedNote => archivedNote.id === note.id);
    const noteWithArchivedStatus = isArchivedNote ? { ...note, archived: true } : note;
    
    // Always require PIN for locked notes, regardless of previous unlock status
    if (note.locked) {
      setActiveNoteId(note.id);
      setPinPadMode('unlock');
      setShowPinPad(true);
      // Store the note to view after unlock (with proper archived status)
      (window as any).pendingNoteToView = noteWithArchivedStatus;
    } else {
      // If switching to a different note, ensure previous note is re-locked
      if (noteToView?.locked && noteToView.id !== note.id) {
        setUnlockedNoteIds(prev => prev.filter(id => id !== noteToView.id));
      }
      setNoteToView(noteWithArchivedStatus);
      setIsNewNote(false);
      setIsNoteViewerOpen(true);
    }
  };

  const openNoteEditor = (note: Note) => {
    // Open the color editor instead of the note viewer
    setNoteToEditColor(note);
    setIsNoteColorEditorOpen(true);
  };

  const handleEditFromViewer = () => {
    if (!noteToView) return;
    setIsNoteViewerOpen(false);
    openNoteEditor(noteToView);
  };

  const pinNote = (noteId: string) => {
    setNotes((prev: Note[]) => prev.map(note => 
      note.id === noteId ? { ...note, pinned: true } : note
    ));
    // Update noteToView if this is the currently viewed note
    if (noteToView?.id === noteId) {
      setNoteToView(prev => prev ? { ...prev, pinned: true } : null);
    }
    toast.success(say('toastPinned', 'noteViewerTitle'));
  };

  const unpinNote = (noteId: string) => {
    setNotes((prev: Note[]) => prev.map(note => 
      note.id === noteId ? { ...note, pinned: false } : note
    ));
    // Update noteToView if this is the currently viewed note
    if (noteToView?.id === noteId) {
      setNoteToView(prev => prev ? { ...prev, pinned: false } : null);
    }
    toast.success(say('toastUnpinned', 'noteViewerTitle'));
  };

  const copyNote = (noteId: string) => {
    const noteToCopy = notes.find(note => note.id === noteId) || archivedNotes.find(note => note.id === noteId);
    if (noteToCopy) {
      const copiedNote: Note = {
        ...noteToCopy,
        id: Date.now().toString(),
        name: nextCopyName(noteToCopy.name, [...notes, ...archivedNotes].map(n => n.name)),
        createdAt: new Date().toISOString(),
        pinned: false
      };
      setNotes((prev: Note[]) => [...prev, copiedNote]);
      toast.success(say('toastCopied', 'noteViewerTitle'));
    }
  };

  const shareNote = (noteId: string) => {
    // Simple share functionality - copy note content to clipboard
    const noteToShare = notes.find(note => note.id === noteId) || archivedNotes.find(note => note.id === noteId);
    if (noteToShare) {
      let shareText = noteToShare.name;
      
      switch (noteToShare.type) {
        case 'text':
          shareText += noteToShare.description ? `\n\n${noteToShare.description}` : '';
          break;
        case 'list':
          const listItems = noteToShare.items.map(item => 
            `${item.completed ? '✓' : '○'} ${item.text}`
          ).join('\n');
          if (listItems) shareText += `\n\n${listItems}`;
          break;
        case 'audio':
        case 'image':
          shareText += noteToShare.description ? `\n\n${noteToShare.description}` : '';
          break;
      }
      
      navigator.clipboard.writeText(shareText).then(() => {
        toast.success(t('toastContentCopied'));
      }).catch(() => {
        toast.error(t('toastCopyFailed'));
      });
    }
  };

  const addFolder = (folderData: Omit<NoteFolder, 'id' | 'createdAt' | 'noteIds'>, noteIdsToMove?: string[]) => {
    const newFolder: NoteFolder = {
      ...folderData,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      lastNoteAddedAt: noteIdsToMove?.length ? new Date().toISOString() : undefined,
      noteIds: noteIdsToMove || [],
      pinned: false,
      archived: false
    };
    const idsSet = new Set(noteIdsToMove || []);
    setFolders((prev: NoteFolder[]) => {
      const cleaned = noteIdsToMove?.length
        ? prev.map(f => ({ ...f, noteIds: f.noteIds.filter(id => !idsSet.has(id)) }))
        : prev;
      return [...cleaned, newFolder];
    });
    toast.success(say('toastAdded', 'tabFolders'));
  };

  const updateFolder = (folderData: Omit<NoteFolder, 'id' | 'createdAt' | 'noteIds' | 'modifiedAt'>) => {
    if (!selectedFolder) return;
    setFolders((prev: NoteFolder[]) => prev.map(folder =>
      folder.id === selectedFolder.id 
        ? { 
            ...folder, 
            name: folderData.name,
            description: folderData.description,
            color: folderData.color,
            pinned: folderData.pinned,
            archived: folderData.archived,
            modifiedAt: new Date().toISOString()
          }
        : folder
    ));
    setSelectedFolder(null);
    setIsFolderEditorOpen(false);
    toast.success(say('toastUpdated', 'tabFolders'));
  };

  const pinFolder = (folderId: string) => {
    setFolders((prev: NoteFolder[]) => prev.map(folder =>
      folder.id === folderId ? { ...folder, pinned: true } : folder
    ));
    toast.success(say('toastPinned', 'tabFolders'));
  };

  const unpinFolder = (folderId: string) => {
    setFolders((prev: NoteFolder[]) => prev.map(folder => 
      folder.id === folderId ? { ...folder, pinned: false } : folder
    ));
    toast.success(say('toastUnpinned', 'tabFolders'));
  };

  const editFolder = (folderId: string) => {
    const folder = folders.find(f => f.id === folderId);
    if (folder) {
      setSelectedFolder(folder);
      setIsFolderEditorOpen(true);
    }
  };

  const confirmArchiveFolder = (folderId: string) => {
    setItemToArchive({ type: 'folder', id: folderId });
    setArchiveDialogOpen(true);
  };

  const archiveFolder = (folderId: string) => {
    const folderToArchive = folders.find(folder => folder.id === folderId);
    if (folderToArchive) {
      // Archive the folder
      setArchivedFolders((prev: NoteFolder[]) => [...prev, { ...folderToArchive, archived: true }]);
      setFolders((prev: NoteFolder[]) => prev.filter(folder => folder.id !== folderId));
      
      // Archive all notes in this folder
      const notesToArchive = notes.filter(note => folderToArchive.noteIds.includes(note.id));
      if (notesToArchive.length > 0) {
        setArchivedNotes((prev: Note[]) => [...prev, ...notesToArchive]);
        setNotes((prev: Note[]) => prev.filter(note => !folderToArchive.noteIds.includes(note.id)));
      }
      
      toast.success(folderAndCount(t, language, 'folderAndCountArchived', 'note', notesToArchive.length));
    }
  };

  const deleteFolder = (folderId: string) => {
    setItemToDelete({ type: 'folder', id: folderId });
    setDeleteDialogOpen(true);
  };

  const confirmDeleteFolder = (folderId: string) => {
    const folderToDelete = folders.find(folder => folder.id === folderId) || 
                          archivedFolders.find(folder => folder.id === folderId);
    if (folderToDelete) {
      // Get all notes from this folder
      const notesInFolder = [...notes, ...archivedNotes].filter(note => folderToDelete.noteIds.includes(note.id));
      
      // Remove folder and its notes from all lists
      setFolders((prev: NoteFolder[]) => prev.filter(folder => folder.id !== folderId));
      setArchivedFolders((prev: NoteFolder[]) => prev.filter(folder => folder.id !== folderId));
      setNotes((prev: Note[]) => prev.filter(note => !folderToDelete.noteIds.includes(note.id)));
      setArchivedNotes((prev: Note[]) => prev.filter(note => !folderToDelete.noteIds.includes(note.id)));
      
      const noteCount = notesInFolder.length;
      if (noteCount > 0) {
        toast.success(folderAndCount(t, language, 'folderAndCountDeleted', 'note', noteCount));
      } else {
        toast.success(say('toastDeleted', 'tabFolders'));
      }
    }
  };

  const moveNoteToFolder = (noteId: string, folderId: string) => {
    // Remove note from all folders and add to selected folder in a single update
    setFolders((prev: NoteFolder[]) => 
      prev.map(folder => {
        if (folder.id === folderId) {
          // Add note to target folder (avoid duplicates) and update lastNoteAddedAt
          return {
            ...folder,
            lastNoteAddedAt: new Date().toISOString(),
            noteIds: folder.noteIds.includes(noteId) ? folder.noteIds : [...folder.noteIds, noteId]
          };
        } else {
          // Remove note from all other folders
          return {
            ...folder,
            noteIds: folder.noteIds.filter(id => id !== noteId)
          };
        }
      })
    );

    toast.success(say('toastUpdated', 'noteViewerTitle'));
  };

  const handleMoveToFolder = (noteId: string) => {
    setSelectedNoteForMove([noteId]);
    setIsMoveToFolderOpen(true);
  };

  const handleFolderSelect = (folderId: string) => {
    if (selectedNoteForMove && selectedNoteForMove.length > 0) {
      // Batch move all selected notes to the folder
      const idsSet = new Set(selectedNoteForMove);
      setFolders((prev: NoteFolder[]) => 
        prev.map(folder => {
          if (folder.id === folderId) {
            // Add notes to target folder (avoid duplicates) and update lastNoteAddedAt
            const existingIds = new Set(folder.noteIds);
            const newNoteIds = [...folder.noteIds, ...selectedNoteForMove.filter(id => !existingIds.has(id))];
            return {
              ...folder,
              lastNoteAddedAt: new Date().toISOString(),
              noteIds: newNoteIds
            };
          } else {
            // Remove notes from all other folders
            return {
              ...folder,
              noteIds: folder.noteIds.filter(id => !idsSet.has(id))
            };
          }
        })
      );
      toast.success(say('toastUpdated', 'notes'));
      setSelectedNoteForMove(null);
      setIsMoveToFolderOpen(false);
      clearSelection();
      exitBulkMode();
    }
  };

  const handleCreateFolderFromDialog = () => {
    setIsMoveToFolderOpen(false);
    setIsFolderCreatorOpen(true);
    // Note: selectedNoteForMove will be used when folder is created
  };

  // Lock/Unlock functionality
  const handleLockNote = (noteId: string) => {
    setActiveNoteId(noteId);
    setPinPadMode('set');
    setShowPinPad(true);
  };

  const handleUnlockNote = (noteId: string) => {
    const note = notes.find(n => n.id === noteId) || archivedNotes.find(n => n.id === noteId);
    // Don't ask for PIN if note is currently being viewed or already unlocked in session
    if (note?.locked && (unlockedNoteIds.includes(noteId) || noteToView?.id === noteId)) {
      // Note is already unlocked in this session or being viewed, perform unlock directly
      setNotes((prev: Note[]) => prev.map(note => 
        note.id === noteId ? { ...note, locked: false, pin: undefined } : note
      ));
      setArchivedNotes((prev: Note[]) => prev.map(note => 
        note.id === noteId ? { ...note, locked: false, pin: undefined } : note
      ));
      // Update noteToView if this is the currently viewed note
      if (noteToView?.id === noteId) {
        setNoteToView(prev => prev ? { ...prev, locked: false, pin: undefined } : null);
      }
      setUnlockedNoteIds(prev => prev.filter(id => id !== noteId));
      toast.success('Note unlocked successfully!');
      return;
    }
    
    setActiveNoteId(noteId);
    setPinPadMode('unlock');
    setShowPinPad(true);
    // Store the action to remove the lock after PIN verification
    (window as any).pendingAction = () => {
      setNotes((prev: Note[]) => prev.map(note => 
        note.id === noteId ? { ...note, locked: false, pin: undefined } : note
      ));
      setArchivedNotes((prev: Note[]) => prev.map(note => 
        note.id === noteId ? { ...note, locked: false, pin: undefined } : note
      ));
      setUnlockedNoteIds(prev => prev.filter(id => id !== noteId));
      toast.success('Note unlocked successfully!');
    };
  };

   const handleSetPin = (pin: string) => {
     if (activeNoteId) {
       const updatedNotes = notes.map(note =>
         note.id === activeNoteId ? { ...note, locked: true, pin } : note
       );
       const updatedArchived = archivedNotes.map(note =>
         note.id === activeNoteId ? { ...note, locked: true, pin } : note
       );
       setNotes(updatedNotes);
       setArchivedNotes(updatedArchived);
       // Update noteToView if this is the currently viewed note
       if (noteToView?.id === activeNoteId) {
         setNoteToView(prev => prev ? { ...prev, locked: true, pin } : null);
       }
       // Ensure the note is not considered unlocked in this session
       setUnlockedNoteIds(prev => prev.filter(id => id !== activeNoteId));
       toast.success('Note locked with PIN code');
     }
     setActiveNoteId(null);
   };

  const handleUnlockAttempt = (pin: string): boolean => {
    if (activeNoteId) {
      const note = notes.find(n => n.id === activeNoteId) || archivedNotes.find(n => n.id === activeNoteId);
      if (note && note.pin === pin) {
        // Unlock and allow access
        toast.success('Note unlocked');
        // Mark as unlocked for this session to prevent re-prompt within this view
        setUnlockedNoteIds(prev => prev.includes(activeNoteId) ? prev : [...prev, activeNoteId]);

        setActiveNoteId(null);
        
        // If there's a pending note to view, open it
        if ((window as any).pendingNoteToView) {
          setNoteToView((window as any).pendingNoteToView);
          setIsNoteViewerOpen(true);
          (window as any).pendingNoteToView = null;
        }
        
        // Execute any other pending action after unlock
        if ((window as any).pendingAction) {
          (window as any).pendingAction();
          (window as any).pendingAction = null;
        }
        return true;
      } else {
        // Return false to trigger shake animation in PinPadDialog
        return false;
      }
    }
    return false;
  };

  const checkLockBeforeAction = (noteId: string, action: () => void) => {
    const note = notes.find(n => n.id === noteId) || archivedNotes.find(n => n.id === noteId);
    // Don't ask for PIN if note is currently being viewed or already unlocked in session
    const needsPin = note?.locked && !unlockedNoteIds.includes(noteId) && noteToView?.id !== noteId;
    if (needsPin) {
      setActiveNoteId(noteId);
      setPinPadMode('unlock');
      setShowPinPad(true);
      // Store the action to execute after unlock
      (window as any).pendingAction = action;
    } else {
      action();
    }
  };

  const handleAddButtonClick = () => {
    if (activeTab === 'folders') {
      setIsFolderCreatorOpen(true);
    } else {
      // Close any open image capture or audio recorder popups
      setShowImageCapturePopup(false);
      setShowAudioRecorderPopup(false);
      setShowNoteTypePopup(!showNoteTypePopup);
    }
  };

  // Search functionality
  //
  // Text matching differs per note type (list notes search their items), so it is
  // passed into the shared expression evaluator rather than duplicated here.
  // A query with no operators behaves exactly as it always has: every term, tags
  // included, must match.
  //
  // Every field goes through `extractSearchableText` first. A note's `description`
  // stores image and audio attachments as `[audio:<base64 data URL>:<seconds>]`, and a
  // data URL is thousands of characters of arbitrary letters. Searching the raw field
  // therefore matched notes on the *encoding* of a sound rather than on anything a
  // reader could see. Extraction is the same parser the card renders with, so the text
  // being searched and the text being displayed cannot drift apart.
  const searchInNote = (note: Note, query: string): boolean => {
    const expression = parseSearchExpression(query);

    const matchesText = (term: string): boolean => {
      if (extractSearchableText(note).includes(term)) return true;

      switch (note.type) {
        case 'list':
          return note.items.some(item => extractSearchableText(item.text).includes(term));
        default:
          // 'text', 'audio' and 'image' keep all their words in `description`, which
          // the call above already covered.
          return false;
      }
    };

    return matchesSearchExpression(expression, note.tags, matchesText);
  };

  const searchInFolder = (folder: NoteFolder, query: string): boolean => {
    const searchTerm = query.toLowerCase();
    // A folder's own fields are plain text: unlike a note, a folder cannot carry an
    // image or a recording, so there is nothing encoded to strip out here.
    if (folder.name.toLowerCase().includes(searchTerm) || 
        (folder.description?.toLowerCase().includes(searchTerm) || false)) {
      return true;
    }
    
    // Check if any notes in folder match the search
    const folderNotes = notes.filter(note => folder.noteIds.includes(note.id));
    return folderNotes.some(note => searchInNote(note, query));
  };

  const filterNotes = (notesList: Note[]): Note[] => {
    if (!searchQuery.trim()) return notesList;
    return notesList.filter(note => searchInNote(note, searchQuery));
  };

  const filterFolders = (foldersList: NoteFolder[]): NoteFolder[] => {
    if (!searchQuery.trim()) return foldersList;
    return foldersList.filter(folder => searchInFolder(folder, searchQuery));
  };

  const sortNotes = (notesList: Note[]): Note[] => {
    const sorted = [...notesList];
    switch (sortType) {
      case 'custom': {
        // Sort by custom order, then by creation date for new notes
        return sorted.sort((a, b) => {
          const aIndex = customOrder.indexOf(a.id);
          const bIndex = customOrder.indexOf(b.id);
          
          // If both notes are in manual order, sort by their positions
          if (aIndex !== -1 && bIndex !== -1) {
            return aIndex - bIndex;
          }
          
          // If only one note is in manual order, it comes first
          if (aIndex !== -1) return -1;
          if (bIndex !== -1) return 1;
          
          // If neither is in manual order, sort by creation date (newest first)
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
      }
      case 'title': {
        const normalize = (s: string) =>
          (s || '')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '') // strip accents
            .trim();

        const hasTitle = (n: Note) => normalize(n.name).length > 0;

        // 1) Titled notes: sorted by title respecting direction
        const titled = sorted
          .filter(hasTitle)
          .sort((a, b) => {
            const aTitle = normalize(a.name);
            const bTitle = normalize(b.name);
            const cmp = aTitle.localeCompare(bTitle, undefined, { sensitivity: 'base', numeric: true });
            if (cmp !== 0) return sortDirection === 'asc' ? cmp : -cmp;
            return sortDirection === 'asc' ? a.id.localeCompare(b.id) : b.id.localeCompare(a.id);
          });

        // 2) Titleless notes: sorted by creation date respecting direction
        const titleless = sorted
          .filter(n => !hasTitle(n))
          .sort((a, b) => {
            const aTime = new Date(a.createdAt).getTime();
            const bTime = new Date(b.createdAt).getTime();
            return sortDirection === 'asc' ? aTime - bTime : bTime - aTime;
          });

        return [...titled, ...titleless];
      }
      case 'dateCreated':
        return sorted.sort((a, b) => {
          const aTime = new Date(a.createdAt).getTime();
          const bTime = new Date(b.createdAt).getTime();
          return sortDirection === 'asc' ? aTime - bTime : bTime - aTime;
        });
      case 'dateModified':
        return sorted.sort((a, b) => {
          const aModified = new Date(a.modifiedAt || a.createdAt).getTime();
          const bModified = new Date(b.modifiedAt || b.createdAt).getTime();
          return sortDirection === 'asc' ? aModified - bModified : bModified - aModified;
        });
      default:
        return sorted;
    }
  };

  // Auto-scroll functionality
  const checkAutoScroll = (clientY: number) => {
    const scrollThreshold = 100; // pixels from edge to trigger scroll
    const scrollSpeed = 5; // pixels per scroll step
    const windowHeight = window.innerHeight;
    
    // Clear existing auto-scroll
    if (autoScrollInterval) {
      clearInterval(autoScrollInterval);
      setAutoScrollInterval(null);
    }
    
    // Check if near top edge
    if (clientY < scrollThreshold) {
      const interval = setInterval(() => {
        const currentScroll = window.pageYOffset;
        if (currentScroll > 0) {
          window.scrollBy(0, -scrollSpeed);
        } else {
          clearInterval(interval);
          setAutoScrollInterval(null);
        }
      }, 16); // ~60fps
      setAutoScrollInterval(interval);
    }
    // Check if near bottom edge
    else if (clientY > windowHeight - scrollThreshold) {
      const interval = setInterval(() => {
        const currentScroll = window.pageYOffset;
        const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
        if (currentScroll < maxScroll) {
          window.scrollBy(0, scrollSpeed);
        } else {
          clearInterval(interval);
          setAutoScrollInterval(null);
        }
      }, 16); // ~60fps
      setAutoScrollInterval(interval);
    }
  };

  // Drag and drop handlers - supporting both mouse and touch with real-time reordering
  const handleDragStart = (
    noteId: string,
    e?: React.MouseEvent | React.TouchEvent,
    startPos?: { x: number; y: number }
  ) => {
    if (e) {
      e.preventDefault();
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      setDragStartPos({ x: clientX, y: clientY });
      setCurrentDragPos({ x: clientX, y: clientY });
    } else if (startPos) {
      setDragStartPos(startPos);
      setCurrentDragPos(startPos);
    }
    
    // Lock page scrolling and prevent pull-to-refresh
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';
    document.body.style.overscrollBehavior = 'none';
    document.documentElement.style.overscrollBehavior = 'none';
    
    setDraggedNote(noteId);
    setIsDragging(true);
    setIsNoteSelected(null); // Clear selection visual when dragging starts
    setDragInsertIndex(-1); // Reset insert index

    // Add global mouse/touch move listeners for real-time tracking
     const handleMove = (e: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      
      setCurrentDragPos({ x: clientX, y: clientY });
      checkAutoScroll(clientY);
      
      // Calculate insertion index based on cursor position
      const currentNotes = sortType === 'custom' ? sortNotes(notes) : notes;
      const noteElements = document.querySelectorAll('[data-note-id]');
      let insertIndex = -1;
      
      // Find where to insert based on Y position for list view or both X,Y for grid views
      if (effectiveViewType === 'list') {
        // For list view, use vertical positioning
        for (let i = 0; i < noteElements.length; i++) {
          const element = noteElements[i] as HTMLElement;
          const rect = element.getBoundingClientRect();
          const noteId = element.getAttribute('data-note-id');
          
          if (noteId === noteId) continue; // Skip the dragged note
          
          if (clientY < rect.top + rect.height / 2) {
            insertIndex = currentNotes.findIndex(n => n.id === noteId);
            break;
          }
        }
      } else {
        // For grid views, find closest position
        let minDistance = Infinity;
        for (let i = 0; i < noteElements.length; i++) {
          const element = noteElements[i] as HTMLElement;
          const rect = element.getBoundingClientRect();
          const noteElementId = element.getAttribute('data-note-id');
          
          if (noteElementId === noteId) continue; // Skip the dragged note
          
          const centerX = rect.left + rect.width / 2;
          const centerY = rect.top + rect.height / 2;
          const distance = Math.sqrt(Math.pow(clientX - centerX, 2) + Math.pow(clientY - centerY, 2));
          
          if (distance < minDistance) {
            minDistance = distance;
            const noteIndex = currentNotes.findIndex(n => n.id === noteElementId);
            // Determine if we should insert before or after based on position
            insertIndex = clientY > centerY ? noteIndex + 1 : noteIndex;
          }
        }
      }
      
      // If no specific insertion point found, insert at the end
      if (insertIndex === -1) {
        insertIndex = currentNotes.length;
      }
      
      setDragInsertIndex(insertIndex);
    };

    const handleEnd = () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('touchmove', handleMove);
      document.removeEventListener('mouseup', handleEnd);
      document.removeEventListener('touchend', handleEnd);
      commitDragOperation();
    };

    document.addEventListener('mousemove', handleMove, { passive: false });
    document.addEventListener('touchmove', handleMove, { passive: false });
    document.addEventListener('mouseup', handleEnd, { once: true });
    document.addEventListener('touchend', handleEnd, { once: true });
  };


  const commitDragOperation = () => {
    if (draggedNote && dragInsertIndex >= 0) {
      const currentNotes = sortType === 'custom' ? sortNotes(notes) : notes;
      const draggedIndex = currentNotes.findIndex(n => n.id === draggedNote);
      
      if (draggedIndex !== -1 && draggedIndex !== dragInsertIndex) {
        const newOrder = [...currentNotes.map(n => n.id)];
        // Remove dragged item
        newOrder.splice(draggedIndex, 1);
        // Insert at new position (adjust index if we removed an item before the insertion point)
        const adjustedInsertIndex = dragInsertIndex > draggedIndex ? dragInsertIndex - 1 : dragInsertIndex;
        newOrder.splice(adjustedInsertIndex, 0, draggedNote);
        
        setCustomOrder(newOrder);
        
        // Switch to custom sort if not already selected
        if (sortType !== 'custom') {
          setSortType('custom');
          toast.success('Switched to custom ordering');
        }
      }
    }
    
    handleDragEnd();
  };

  const handleDragEnd = () => {
    // Clear auto-scroll
    if (autoScrollInterval) {
      clearInterval(autoScrollInterval);
      setAutoScrollInterval(null);
    }
    
    // Restore page scrolling
    document.body.style.overflow = '';
    document.body.style.touchAction = '';
    document.body.style.overscrollBehavior = '';
    document.documentElement.style.overscrollBehavior = '';
    
    setDraggedNote(null);
    setDraggedOverNote(null);
    setIsDragging(false);
    setDragStartPos(null);
    setCurrentDragPos(null);
    setIsNoteSelected(null);
    setDragPreviewOrder([]);
    setDragInsertIndex(-1);
  };
  
  // Long-press helpers
  const clearLongPressTimer = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    pendingNoteIdRef.current = null;
    setIsNoteSelected(null); // Clear selection visual
  };

  const startLongPress = (
    noteId: string,
    startX: number,
    startY: number,
    source: 'mouse' | 'touch'
  ) => {
    // Reset and store starting state
    clearLongPressTimer();
    pendingNoteIdRef.current = noteId;
    pressStartPosRef.current = { x: startX, y: startY };

    // Cleanup listeners helper
    const cleanup = () => {
      clearLongPressTimer();
      document.removeEventListener('mousemove', onMouseMove as any);
      document.removeEventListener('mouseup', onMouseUp as any);
      document.removeEventListener('mouseleave', onMouseUp as any);
      document.removeEventListener('touchmove', onTouchMove as any);
      document.removeEventListener('touchend', onTouchEnd as any);
      document.removeEventListener('touchcancel', onTouchEnd as any);
    };

    const trigger = () => {
      cleanup();
      const pos = pressStartPosRef.current ?? { x: startX, y: startY };
      // Show selection visual feedback first
      setIsNoteSelected(noteId);
      // Small delay before starting drag for visual feedback
      setTimeout(() => {
        handleDragStart(noteId, undefined, pos);
      }, 100);
      if ('vibrate' in navigator) {
        // Haptic feedback is optional and unsupported in several browsers (and absent
        // entirely on desktop). A failure here must never interrupt the long-press drag.
        try { (navigator as any).vibrate?.(50); } catch { /* vibration unsupported */ }
      }
    };

    longPressTimerRef.current = setTimeout(trigger, LONG_PRESS_DELAY);

    function onMouseMove(ev: MouseEvent) {
      if (!pressStartPosRef.current) return;
      const dx = Math.abs(ev.clientX - pressStartPosRef.current.x);
      const dy = Math.abs(ev.clientY - pressStartPosRef.current.y);
      if (dx > LONG_PRESS_MOVE_THRESHOLD || dy > LONG_PRESS_MOVE_THRESHOLD) {
        cleanup();
      }
    }
    function onMouseUp() { cleanup(); }
    function onTouchMove(ev: TouchEvent) {
      if (!pressStartPosRef.current) return;
      const t = ev.touches[0];
      if (!t) return;
      const dx = Math.abs(t.clientX - pressStartPosRef.current.x);
      const dy = Math.abs(t.clientY - pressStartPosRef.current.y);
      if (dx > LONG_PRESS_MOVE_THRESHOLD || dy > LONG_PRESS_MOVE_THRESHOLD) {
        cleanup();
      }
    }
    function onTouchEnd() { cleanup(); }

    if (source === 'mouse') {
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp, { once: true });
      document.addEventListener('mouseleave', onMouseUp, { once: true });
    } else {
      document.addEventListener('touchmove', onTouchMove, { passive: true });
      document.addEventListener('touchend', onTouchEnd, { once: true });
      document.addEventListener('touchcancel', onTouchEnd, { once: true });
    }
  };

  // Mouse event handlers
  const handleMouseDown = (noteId: string, e: React.MouseEvent) => {
    if (sortType !== 'custom') return;
    startLongPress(noteId, e.clientX, e.clientY, 'mouse');
  };

  // Touch event handlers
  const handleTouchStart = (noteId: string, e: React.TouchEvent) => {
    if (sortType !== 'custom') return;
    const touch = e.touches[0];
    if (!touch) return;
    startLongPress(noteId, touch.clientX, touch.clientY, 'touch');
  };

  const getGridClassName = () => {
    switch (effectiveViewType) {
      case 'x3':
        return 'grid grid-cols-3 gap-2';
      case 'x2':
        return 'grid grid-cols-2 gap-2';
      case 'list':
      default:
        return 'grid grid-cols-1 gap-2';
    }
  };

  const sortFolders = (foldersList: NoteFolder[]): NoteFolder[] => {
    const sorted = [...foldersList];
    switch (folderSortType) {
      case 'name':
        return sorted.sort((a, b) => a.name.localeCompare(b.name));
      case 'dateCreated':
        return sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      case 'dateModified':
        return sorted.sort((a, b) => new Date(b.modifiedAt || b.createdAt).getTime() - new Date(a.modifiedAt || a.createdAt).getTime());
      case 'recentlyAdded':
        return sorted.sort((a, b) => new Date(b.lastNoteAddedAt || b.createdAt).getTime() - new Date(a.lastNoteAddedAt || a.createdAt).getTime());
      case 'noteCount':
        return sorted.sort((a, b) => b.noteIds.length - a.noteIds.length);
      default:
        return sorted;
    }
  };

  /**
   * What to call an item in a confirmation dialog.
   *
   * The dialog state holds only a type and an id, so the item is looked up here. Archived
   * collections are searched too, because the same dialogs are reached from the Archived
   * tab. `itemDisplayName` supplies the opening words of the body when a note has no title,
   * which is the normal state for a new note.
   */
  const displayNameOf = (item: { type: 'note' | 'folder'; id: string } | null): string => {
    if (!item) return t('untitledItem');
    if (item.type === 'note') {
      const found = notes.find(n => n.id === item.id) ?? archivedNotes.find(n => n.id === item.id);
      return itemDisplayName(t, found ?? {});
    }
    const found = folders.find(f => f.id === item.id) ?? archivedFolders.find(f => f.id === item.id);
    return itemDisplayName(t, found ?? {});
  };

  const renderFolderList = (folderList: NoteFolder[], isArchived: boolean) => {
    const filteredFolders = filterFolders(folderList);
    const sortedFolders = sortFolders(filteredFolders);
    // Sort: pinned folders first, then by selected sort type
    const finalSortedFolders = sortedFolders.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return 0;
    });

    if (finalSortedFolders.length === 0) {
      return (
        <Card>
          <CardContent className="text-center py-8">
            <Button 
              onClick={handleAddButtonClick}
              className="h-10 px-8 text-sm font-medium rounded-full bg-black text-white hover:bg-black/90"
            >
              {t('createFolder')}
              <FolderOpen className="ml-2" size={20} />
            </Button>
          </CardContent>
        </Card>
      );
    }

    return (
      /*
       * `items-start` is what keeps a folder's height its own business.
       *
       * A grid stretches its cells to the tallest item in each row by default, so opening
       * one folder made every neighbour in that row as tall as the expanded one. They were
       * genuinely still closed — their state is local to each card — but they grew to the
       * same height and read as if they had all opened together. On a phone the grid is a
       * single column, so nothing shares a row and the problem never appeared there.
       */
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 items-start">
        {finalSortedFolders.map((folder: NoteFolder) => (
          <NoteFolderCard
            key={folder.id}
            folder={folder}
            notes={isArchived ? archivedNotes : notes}
            searchQuery={searchQuery}
            onToggleListItem={toggleListItem}
            onArchiveNote={confirmArchiveNote}
            onDeleteNote={deleteNote}
            onPinNote={pinNote}
            onUnpinNote={unpinNote}
            onCopyNote={copyNote}
            onMoveToFolder={handleMoveToFolder}
            onOpenNote={openNoteViewer}
            onLockNote={handleLockNote}
            onUnlockNote={handleUnlockNote}
            onPinFolder={() => pinFolder(folder.id)}
            onUnpinFolder={() => unpinFolder(folder.id)}
            onEditFolder={() => editFolder(folder.id)}
            onArchiveFolder={!isArchived ? () => confirmArchiveFolder(folder.id) : undefined}
            onDeleteFolder={() => deleteFolder(folder.id)}
            onRestoreFolder={isArchived ? () => unarchiveFolder(folder.id) : undefined}
            showBulkCheckbox={isBulkMode}
            isBulkSelected={selectedItems.has(folder.id)}
            onBulkSelect={toggleItem}
          />
        ))}
      </div>
    );
  };

  const renderArchivedContent = () => {
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <h3 className="text-lg font-medium">{t('archivedNotes')}</h3>
          {archivedNotes.length > 0 ? renderNoteList(archivedNotes, {
            onEdit: openNoteEditor,
            onUnarchive: unarchiveNote,
            onDelete: deleteNote,
            onPin: pinNote,
            onUnpin: unpinNote,
            onCopy: copyNote,
            onMove: handleMoveToFolder,
            onView: openNoteViewer,
            isArchived: true,
            onToggleListItem: toggleListItem,
            onLock: handleLockNote,
            onUnlock: handleUnlockNote
          }) : (
            <Card>
              <CardContent className="text-center py-8">
                <p className="text-muted-foreground">{t('noArchivedNotes')}</p>
              </CardContent>
            </Card>
          )}
        </div>
        
        <div className="space-y-2">
          <h3 className="text-lg font-medium">{t('archivedFolders')}</h3>
          {archivedFolders.length > 0 ? renderFolderList(archivedFolders, true) : (
            <Card>
              <CardContent className="text-center py-8">
                <p className="text-muted-foreground">{t('noArchivedFolders')}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    );
  };

  const renderNoteList = (notesList: Note[], options: any) => {
    const filteredNotes = filterNotes(notesList);
    const sortedNotes = sortNotes(filteredNotes);
    const pinnedNotes = sortedNotes.filter(note => note.pinned);
    const unpinnedNotes = sortedNotes.filter(note => !note.pinned);

    if (filteredNotes.length === 0) {
      return (
        <Card>
          <CardContent className="text-center py-8">
            {searchQuery.trim() ? (
              <p className="text-muted-foreground">No matching notes found.</p>
            ) : (
              <Button 
                onClick={handleAddButtonClick}
                className="h-10 px-8 text-sm font-medium rounded-full bg-black text-white hover:bg-black/90"
              >
                {t('createNote')}
                <Notebook className="ml-2" size={20} />
              </Button>
            )}
          </CardContent>
        </Card>
      );
    }

    return (
      <div className={getGridClassName()}>
        {[...pinnedNotes, ...unpinnedNotes].map((note: Note, index: number) => {
          const draggedIndex = draggedNote ? [...pinnedNotes, ...unpinnedNotes].findIndex(n => n.id === draggedNote) : -1;
          
          // Calculate transform for gap effect
          let gapTransform = '';
          if (isDragging && draggedNote && dragInsertIndex >= 0) {
            // Don't apply gap transform to the dragged note itself
            if (note.id !== draggedNote) {
              if (effectiveViewType === 'list') {
                // For list view, create vertical gap
                if (index >= dragInsertIndex && (draggedIndex === -1 || index < draggedIndex)) {
                  gapTransform = 'translateY(80px)'; // Height of a typical note card
                } else if (index > dragInsertIndex && draggedIndex !== -1 && index > draggedIndex) {
                  gapTransform = 'translateY(80px)';
                }
              } else {
                // For grid views, the gap effect is more complex based on grid layout
                const itemsPerRow = effectiveViewType === 'x3' ? 3 : 2;
                const draggedRow = Math.floor(draggedIndex / itemsPerRow);
                const insertRow = Math.floor(dragInsertIndex / itemsPerRow);
                const currentRow = Math.floor(index / itemsPerRow);
                
                if (currentRow >= insertRow && (draggedIndex === -1 || currentRow < draggedRow)) {
                  const noteHeight = effectiveViewType === 'x3' ? 200 : 240;
                  gapTransform = `translateY(${noteHeight + 16}px)`; // Add gap margin
                } else if (currentRow > insertRow && draggedIndex !== -1 && currentRow > draggedRow) {
                  const noteHeight = effectiveViewType === 'x3' ? 200 : 240;
                  gapTransform = `translateY(${noteHeight + 16}px)`;
                }
              }
            }
          }
          
          return (
            <div
              key={note.id}
              data-note-card={note.id}
              style={{
                transform: draggedNote === note.id && currentDragPos && dragStartPos ? 
                  `translate(${currentDragPos.x - dragStartPos.x}px, ${currentDragPos.y - dragStartPos.y}px)` : 
                  gapTransform,
                transition: draggedNote === note.id ? 'none' : 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                zIndex: draggedNote === note.id ? 1000 : 1
              }}
            >
              <NoteCard
                note={note}
                onClick={() => isBulkMode ? toggleItem(note.id) : openNoteViewer(note)}
                onEdit={() => openNoteEditor(note)}
                onToggleListItem={toggleListItem}
                onArchive={options.onArchive}
                onUnarchive={options.onUnarchive}
                onDelete={deleteNote}
                onPin={options.onPin}
                onUnpin={options.onUnpin}
                onCopy={options.onCopy}
                onShare={() => {}}
                onMoveToFolder={options.onMove}
                onLock={options.onLock}
                onUnlock={options.onUnlock}
                isArchived={options.isArchived}
                searchQuery={searchQuery}
                viewType={effectiveViewType}
                draggable={sortType === 'custom' && !isBulkMode}
                isDragged={draggedNote === note.id}
                isDraggedOver={draggedOverNote === note.id}
                isSelected={isNoteSelected === note.id}
                onMouseDown={(e) => handleMouseDown(note.id, e)}
                onTouchStart={(e) => handleTouchStart(note.id, e)}
                showBulkCheckbox={isBulkMode}
                isBulkSelected={selectedItems.has(note.id)}
                onBulkSelect={toggleItem}
              />
            </div>
          );
        })}
      </div>
    );
  };

  // Get current bulk context based on active tab
  const getBulkContext = (): BulkActionContext => {
    if (activeTab === 'archived') return 'archivedNotes';
    if (activeTab === 'folders') return 'noteFolders';
    return 'notes';
  };

  // Get all item IDs for current view
  // Helper functions for archived selection
  const getArchivedNoteIds = (): string[] => archivedNotes.map(n => n.id);
  const getArchivedFolderIds = (): string[] => archivedFolders.map(f => f.id);

  // Computed selection states for archived tab
  const isAllArchivedNotesSelected = archivedNotes.length > 0 && 
    archivedNotes.every(n => selectedItems.has(n.id));
  const isAllArchivedFoldersSelected = archivedFolders.length > 0 && 
    archivedFolders.every(f => selectedItems.has(f.id));

  const getAllItemIds = (): string[] => {
    if (activeTab === 'archived') {
      return [...archivedNotes.map(n => n.id), ...archivedFolders.map(f => f.id)];
    }
    if (activeTab === 'folders') {
      return folders.map(f => f.id);
    }
    return filterNotes(notes).map(n => n.id);
  };

  // Handle bulk actions
  const handleBulkAction = (action: BulkActionType, color?: string) => {
    const ids = Array.from(selectedItems);
    const idSet = new Set(ids);
    
    switch (action) {
      case 'all':
        toggleAll(getAllItemIds());
        break;
      case 'allItems': {
        // Toggle selection of archived notes only
        const noteIds = getArchivedNoteIds();
        const allNotesSelected = noteIds.every(id => selectedItems.has(id));
        if (allNotesSelected) {
          // Deselect all notes (keep folders selected)
          const folderIds = getArchivedFolderIds();
          const currentFolderSelections = Array.from(selectedItems).filter(id => folderIds.includes(id));
          if (currentFolderSelections.length > 0) {
            toggleAll(currentFolderSelections);
          } else {
            clearSelection();
          }
        } else {
          // Select all notes (keep existing folder selections)
          const currentFolderSelections = Array.from(selectedItems).filter(id => 
            archivedFolders.some(f => f.id === id));
          toggleAll([...currentFolderSelections, ...noteIds]);
        }
        break;
      }
      case 'allFolders': {
        // Toggle selection of archived folders only
        const folderIds = getArchivedFolderIds();
        const allFoldersSelected = folderIds.every(id => selectedItems.has(id));
        if (allFoldersSelected) {
          // Deselect all folders (keep notes selected)
          const noteIds = getArchivedNoteIds();
          const currentNoteSelections = Array.from(selectedItems).filter(id => noteIds.includes(id));
          if (currentNoteSelections.length > 0) {
            toggleAll(currentNoteSelections);
          } else {
            clearSelection();
          }
        } else {
          // Select all folders (keep existing note selections)
          const currentNoteSelections = Array.from(selectedItems).filter(id => 
            archivedNotes.some(n => n.id === id));
          toggleAll([...currentNoteSelections, ...folderIds]);
        }
        break;
      }
      case 'pin':
        // Batch update notes - toggle pin state
        setNotes(prev => prev.map(note => 
          idSet.has(note.id) ? { ...note, pinned: !note.pinned } : note
        ));
        // Batch update folders
        setFolders(prev => prev.map(folder => 
          idSet.has(folder.id) ? { ...folder, pinned: !folder.pinned } : folder
        ));
        clearSelection();
        exitBulkMode();
        toast.success(countedSentence(t, language, 'bulkUpdated', ids.length));
        break;
        break;
      case 'lock':
        // For bulk lock, we'll lock all selected notes
        ids.forEach(id => {
          const note = notes.find(n => n.id === id);
          if (note && !note.locked) {
            setActiveNoteId(id);
            setPinPadMode('set');
            setShowPinPad(true);
          }
        });
        break;
      case 'archive':
        // Show confirmation dialog for bulk archive
        setPendingBulkAction({ ids, action: 'archive' });
        setBulkArchiveDialogOpen(true);
        break;
      case 'delete':
        // Show confirmation dialog for bulk delete
        setPendingBulkAction({ ids, action: 'delete' });
        setBulkDeleteDialogOpen(true);
        break;
      case 'restore': {
        const appendUniqueById = <T extends { id: string }>(prev: T[], items: T[]) => {
          const existing = new Set(prev.map(i => i.id));
          const next = [...prev];
          for (const item of items) {
            if (!existing.has(item.id)) {
              existing.add(item.id);
              next.push(item);
            }
          }
          return next;
        };

        const foldersToRestore = archivedFolders.filter(f => idSet.has(f.id));
        const notesToRestoreAll = archivedNotes.filter(n => idSet.has(n.id));
        const noteIdsRestoredViaFolders = new Set<string>();

        // --- Restore folders (and their still-archived notes) ---
        if (foldersToRestore.length > 0) {
          const noteIdsAssignedElsewhere = new Set<string>(folders.flatMap(f => f.noteIds));

          // sanitize noteIds to avoid duplicating notes across folders
          const sanitizedFolders = foldersToRestore.map(f => ({
            ...f,
            archived: false,
            noteIds: f.noteIds.filter(id => !noteIdsAssignedElsewhere.has(id)),
          }));

          sanitizedFolders.forEach(f => f.noteIds.forEach(id => noteIdsRestoredViaFolders.add(id)));

          const notesFromFoldersToRestore = archivedNotes
            .filter(n => noteIdsRestoredViaFolders.has(n.id))
            // Strip originalFolderId when restoring to active notes list
            .map(n => {
              const { originalFolderId, ...restored } = n;
              return restored;
            });

          setFolders(prev => [...prev, ...sanitizedFolders]);
          setArchivedFolders(prev => prev.filter(f => !idSet.has(f.id)));

          if (notesFromFoldersToRestore.length > 0) {
            setNotes(prev => appendUniqueById(prev, notesFromFoldersToRestore));
            setArchivedNotes(prev => prev.filter(n => !noteIdsRestoredViaFolders.has(n.id)));
          }
        }

        // --- Restore individually-selected notes (preserving original folder association) ---
        const notesToRestore = notesToRestoreAll.filter(n => !noteIdsRestoredViaFolders.has(n.id));
        if (notesToRestore.length > 0) {
          const restoredNotes = notesToRestore.map(note => {
            const { originalFolderId, ...restoredNote } = note;
            return restoredNote;
          });

          setNotes(prev => appendUniqueById(prev, restoredNotes));
          setArchivedNotes(prev => prev.filter(n => !(idSet.has(n.id) && !noteIdsRestoredViaFolders.has(n.id))));

          const folderUpdates: Record<string, string[]> = {};
          notesToRestore.forEach(note => {
            if (note.originalFolderId) {
              if (!folderUpdates[note.originalFolderId]) folderUpdates[note.originalFolderId] = [];
              folderUpdates[note.originalFolderId].push(note.id);
            }
          });

          if (Object.keys(folderUpdates).length > 0) {
            setFolders(prev => prev.map(folder => {
              const noteIdsToAdd = folderUpdates[folder.id];
              if (noteIdsToAdd) {
                return { ...folder, noteIds: Array.from(new Set([...folder.noteIds, ...noteIdsToAdd])) };
              }
              return folder;
            }));
          }
        }

        clearSelection();
        exitBulkMode();
        toast.success(countedSentence(t, language, 'bulkRestored', ids.length));
        break;
      }
      case 'copy':
        // Batch copy notes
        const takenNames = [...notes, ...archivedNotes].map(n => n.name);
        const copiedNotes = notes.filter(n => idSet.has(n.id)).map(note => {
          const copyName = nextCopyName(note.name, takenNames);
          takenNames.push(copyName);
          return {
            ...note,
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            name: copyName,
            createdAt: new Date().toISOString(),
            pinned: false,
          };
        });
        setNotes(prev => [...prev, ...copiedNotes]);
        clearSelection();
        exitBulkMode();
        toast.success(countedSentence(t, language, 'bulkCopied', copiedNotes.length));
        break;
      case 'move':
        if (ids.length > 0) {
          setSelectedNoteForMove(ids);
          setIsMoveToFolderOpen(true);
        }
        break;
      case 'color':
        if (color) {
          // Batch update colors
          setNotes(prev => prev.map(n => idSet.has(n.id) ? { ...n, color } : n));
          setFolders(prev => prev.map(f => idSet.has(f.id) ? { ...f, color } : f));
          clearSelection();
          exitBulkMode();
          toast.success(t('toastColorApplied').replace('{count}', String(ids.length)));
        }
        break;
    }
  };

  const { t, language } = useLanguage();
  // Toast copy is a translated sentence plus a translated entity noun. Both halves are
  // resolved here so the `{entity}` substitution is written once instead of at every toast.
  const say = (key: string, entity: string) => t(key).replace('{entity}', t(entity));
  // Folder toasts name the items a folder contains rather than the folder itself.

  return (
    <FolderMembershipProvider ids={collectFiledIds(
      [...folders, ...archivedFolders].map((folder) => ({ id: folder.id, itemIds: folder.noteIds })),
      archivedNotes,
    )}>
    <Layout 
      showSearch={true}
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      isBulkMode={isBulkMode}
      pageTitle={t('notes')}
    >
      <div {...swipeHandlers}>
        {!isBulkMode && activeTab !== 'archived' && (
          <Button 
            variant="ghostStatic"
            size="icon" 
            onClick={handleAddButtonClick} 
            /*
             * `border border-nav-border` gives this the same hairline as the floating nav
             * capsule below it. Both are black in either theme, so on a dark page a pure
             * black circle had no edge at all and read as a hole rather than a button; the
             * nav solved the same problem with `--nav-border`, which is a fixed 16%
             * lightness precisely so it does not invert with the theme.
             */
            className={cn(
              "fixed bottom-20 right-2 h-14 w-14 rounded-full z-30 bg-black text-white border border-nav-border hover:bg-black/90",
              "transition-all duration-300 ease-out",
              scrollDirection === 'down' 
                ? "opacity-0 translate-y-4 pointer-events-none" 
                : "opacity-100 translate-y-0"
            )}
          >
            {showNoteTypePopup ? <X size={24} /> : <Plus size={24} />}
          </Button>
        )}

        <Tabs value={activeTab} onValueChange={(tab) => { setActiveTab(tab); exitBulkMode(); }} className="flex-1">
        <div className="fixed top-16 left-0 right-0 z-40 px-2">
          <div className="flex items-center justify-between py-2">
          <SlidingTabsList 
            activeValue={activeTab} 
            values={['all-notes', 'folders', 'archived']}
          >
            <TabsTrigger value="all-notes">{t('tabNotes')}</TabsTrigger>
            <TabsTrigger value="folders">{t('tabFolders')}</TabsTrigger>
            <TabsTrigger value="archived">{t('tabArchived')}</TabsTrigger>
          </SlidingTabsList>
          <div className="flex items-center gap-1">
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
              <NoteFolderViewSettings
                sortType={folderSortType}
                sortDirection={folderSortDirection}
                onSortTypeChange={setFolderSortType}
                onSortDirectionChange={setFolderSortDirection}
              />
            ) : (
              <ViewSettings
                viewType={effectiveViewType}
                sortType={sortType}
                sortDirection={sortDirection}
                onViewTypeChange={setViewType}
                onSortTypeChange={setSortType}
                onSortDirectionChange={setSortDirection}
              />
            )}
          </div>
          </div>
        </div>

        <TabsContent value="all-notes" className="mt-14 flex-1 overflow-y-auto">
          {renderNoteList(filterNotes(notes), { 
            onEdit: openNoteEditor,
            onArchive: confirmArchiveNote,
            onDelete: deleteNote,
            onPin: pinNote,
            onUnpin: unpinNote,
            onCopy: copyNote,
            onMove: handleMoveToFolder,
            onView: openNoteViewer,
            onToggleListItem: toggleListItem,
            onLock: handleLockNote,
            onUnlock: handleUnlockNote
          })}
        </TabsContent>
        
        <TabsContent value="folders" className="mt-14 flex-1 overflow-y-auto">
          {renderFolderList(folders, false)}
        </TabsContent>

        <TabsContent value="archived" className="mt-14 flex-1 overflow-y-auto">
          <div className="space-y-2">
            {renderArchivedContent()}
          </div>
        </TabsContent>
      </Tabs>

      <NoteTypePopup
        isOpen={showNoteTypePopup}
        onTypeSelect={handleTypeSelect}
        onClose={() => setShowNoteTypePopup(false)}
      />

      <ImageCapturePopup
        isOpen={showImageCapturePopup}
        onImageSelect={handleImageSelect}
        onClose={() => setShowImageCapturePopup(false)}
      />

      <AudioRecorderPopup
        isOpen={showAudioRecorderPopup}
        onRecordingComplete={handleAudioRecordingComplete}
        onClose={() => setShowAudioRecorderPopup(false)}
      />

      <NoteFolderCreator
        isOpen={isFolderCreatorOpen}
        onClose={() => {
          setIsFolderCreatorOpen(false);
          setSelectedNoteForMove(null);
        }}
        onSave={(folderData) => {
          addFolder(folderData, selectedNoteForMove || undefined);
          setSelectedNoteForMove(null);
          setIsFolderCreatorOpen(false);
        }}
      />

      <NoteFolderEditor
        isOpen={isFolderEditorOpen}
        onClose={() => {
          setIsFolderEditorOpen(false);
          setSelectedFolder(null);
        }}
        onSave={updateFolder}
        initialFolder={selectedFolder || undefined}
      />

       <NoteViewer
         key={noteToView?.id || (isNewNote ? 'new' : 'viewer')}

         note={noteToView}
         isOpen={isNoteViewerOpen}
         isNewNote={isNewNote}
         onClose={() => {
           setIsNoteViewerOpen(false);
           if (noteToView?.locked) {
             // Always re-lock in session on close
             setUnlockedNoteIds(prev => prev.filter(id => id !== noteToView.id));
           }
           setNoteToView(null);
           setIsNewNote(false);
         }}
         onToggleListItem={toggleListItem}
         onSave={saveNoteFromViewer}
         onPin={(noteId) => pinNote(noteId)}
         onUnpin={(noteId) => unpinNote(noteId)}
         onCopy={(noteId) => copyNote(noteId)}
         onShare={(noteId) => shareNote(noteId)}
         onMoveToFolder={(noteId) => handleMoveToFolder(noteId)}
         onArchive={(noteId) => confirmArchiveNote(noteId)}
         onUnarchive={(noteId) => unarchiveNote(noteId)}
         onDelete={(noteId) => deleteNote(noteId)}
         onLock={handleLockNote}
         onUnlock={handleUnlockNote}
       />

      <PinPadDialog
        isOpen={showPinPad}
        onClose={() => setShowPinPad(false)}
        onSubmit={pinPadMode === 'set' ? handleSetPin : handleUnlockAttempt}
        mode={pinPadMode}
      />

      <MoveToFolderDialog
        isOpen={isMoveToFolderOpen}
        onClose={() => {
          setIsMoveToFolderOpen(false);
          setSelectedNoteForMove(null);
        }}
        folders={folders}
        onSelectFolder={handleFolderSelect}
        onCreateNewFolder={handleCreateFolderFromDialog}
        currentFolderId={selectedNoteForMove?.length === 1 ? folders.find(f => f.noteIds.includes(selectedNoteForMove[0]))?.id : undefined}
        getItemCount={(folder) => folder.noteIds.length}
        itemNoun={t('notes')}
      />

      {/* Delete Confirmation Dialog */}
      {/*
        * The title names the item. A note's title is optional, so a nameless one is
        * identified by the opening words of its body — otherwise the dialog would say only
        * "Delete Note" and give no way to tell which note was about to go.
        */}
      <ConfirmationDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title={namedSentence(t, 'confirmDeleteNamed', displayNameOf(itemToDelete))}
        description={namedSentence(t, 'confirmDeleteNamedBody', displayNameOf(itemToDelete))}
        action="delete"
        onCancel={() => {
          // If cancelling deletion of a locked note, re-lock it by removing from unlocked list
          if (itemToDelete?.type === 'note') {
            const note = notes.find(n => n.id === itemToDelete.id) || archivedNotes.find(n => n.id === itemToDelete.id);
            if (note?.locked) {
              setUnlockedNoteIds(prev => prev.filter(id => id !== itemToDelete.id));
            }
          }
          setItemToDelete(null);
        }}
        onConfirm={() => {
          if (itemToDelete) {
            if (itemToDelete.type === 'note') {
              confirmDeleteNote(itemToDelete.id);
            } else {
              confirmDeleteFolder(itemToDelete.id);
            }
          }
          setItemToDelete(null);
        }}
      />

      {/* Archive Confirmation Dialog */}
      <ConfirmationDialog
        open={archiveDialogOpen}
        onOpenChange={setArchiveDialogOpen}
        title={namedSentence(t, 'confirmArchiveNamed', displayNameOf(itemToArchive))}
        description={namedSentence(t, 'confirmArchiveNamedBody', displayNameOf(itemToArchive))}
        action="archive"
        onConfirm={() => {
          if (itemToArchive) {
            if (itemToArchive.type === 'note') {
              performArchiveNote(itemToArchive.id);
            } else {
              archiveFolder(itemToArchive.id);
            }
          }
          setItemToArchive(null);
        }}
      />

      {/* Bulk Archive Confirmation Dialog */}
      <ConfirmationDialog
        open={bulkArchiveDialogOpen}
        onOpenChange={setBulkArchiveDialogOpen}
        title={t('archiveSelectedItems')}
        description={t('confirmArchiveTitle')}
        action="archive"
        onConfirm={() => {
          if (pendingBulkAction) {
            const { ids } = pendingBulkAction;
            const idSet = new Set(ids);
            
            if (activeTab === 'folders') {
              // Batch archive folders (ensure archived flag is set so archived menu shows Restore/Delete)
              const foldersToArchive = folders.filter(f => idSet.has(f.id)).map(f => ({ ...f, archived: true }));

              // Archive all notes inside those folders
              const noteIdsToArchive = new Set<string>(foldersToArchive.flatMap(f => f.noteIds));
              const notesToArchive = notes
                .filter(n => noteIdsToArchive.has(n.id))
                .map(n => ({ ...n, originalFolderId: foldersToArchive.find(f => f.noteIds.includes(n.id))?.id }));

              setArchivedFolders(prev => [...prev, ...foldersToArchive]);
              setArchivedNotes(prev => [...prev, ...notesToArchive]);

              // Remove folders and their notes from active lists
              setFolders(prev => prev
                .filter(f => !idSet.has(f.id))
                .map(f => ({ ...f, noteIds: f.noteIds.filter(id => !noteIdsToArchive.has(id)) }))
              );
              setNotes(prev => prev.filter(n => !noteIdsToArchive.has(n.id)));
            } else {
              // Batch archive notes
              const notesToArchive = notes.filter(n => idSet.has(n.id)).map(note => {
                const originalFolder = folders.find(folder => folder.noteIds.includes(note.id));
                return { ...note, originalFolderId: originalFolder?.id };
              });
              setArchivedNotes(prev => [...prev, ...notesToArchive]);
              setNotes(prev => prev.filter(n => !idSet.has(n.id)));
              // Remove from folders
              setFolders(prev => prev.map(folder => ({
                ...folder,
                noteIds: folder.noteIds.filter(id => !idSet.has(id))
              })));
            }
            clearSelection();
            exitBulkMode();
            toast.success(countedSentence(t, language, 'bulkArchived', ids.length));
          }
          setPendingBulkAction(null);
        }}
        onCancel={() => setPendingBulkAction(null)}
      />

      {/* Bulk Delete Confirmation Dialog */}
      <ConfirmationDialog
        open={bulkDeleteDialogOpen}
        onOpenChange={setBulkDeleteDialogOpen}
        title={t('deleteSelectedItems')}
        description={t('confirmDeleteBody')}
        action="delete"
        onConfirm={() => {
          if (pendingBulkAction) {
            const { ids } = pendingBulkAction;
            const idSet = new Set(ids);
            
            if (activeTab === 'archived') {
              // Batch delete both notes AND folders in archived tab
              setArchivedNotes(prev => prev.filter(n => !idSet.has(n.id)));
              setArchivedFolders(prev => prev.filter(f => !idSet.has(f.id)));
            } else if (activeTab === 'folders') {
              // Batch delete folders
              setFolders(prev => prev.filter(f => !idSet.has(f.id)));
              setArchivedFolders(prev => prev.filter(f => !idSet.has(f.id)));
            } else {
              // Batch delete notes
              setNotes(prev => prev.filter(n => !idSet.has(n.id)));
              setArchivedNotes(prev => prev.filter(n => !idSet.has(n.id)));
              // Remove from folders
              setFolders(prev => prev.map(folder => ({
                ...folder,
                noteIds: folder.noteIds.filter(id => !idSet.has(id))
              })));
              setArchivedFolders(prev => prev.map(folder => ({
                ...folder,
                noteIds: folder.noteIds.filter(id => !idSet.has(id))
              })));
            }
            clearSelection();
            exitBulkMode();
            toast.success(countedSentence(t, language, 'bulkDeleted', ids.length));
          }
          setPendingBulkAction(null);
        }}
        onCancel={() => setPendingBulkAction(null)}
      />

      {/* Folder Restore Confirmation Dialog */}
      <ConfirmationDialog
        open={folderRestoreDialogOpen}
        onOpenChange={(open) => {
          setFolderRestoreDialogOpen(open);
          if (!open) setFolderToRestore(null);
        }}
        title={t('restoreFolder')}
        description={(() => {
          if (!folderToRestore) return '';
          const folder = archivedFolders.find(f => f.id === folderToRestore);
          if (!folder) return '';
          const noteIdsAssignedElsewhere = new Set<string>(folders.flatMap(f => f.noteIds));
          const sanitizedNoteIds = folder.noteIds.filter(id => !noteIdsAssignedElsewhere.has(id));
          const count = archivedNotes.filter(n => sanitizedNoteIds.includes(n.id)).length;
          return `${count} ${t('notes')}`;
        })()}
        action="restore"
        confirmLabel={t('restoreAll')}
        onConfirm={() => {
          if (folderToRestore) restoreFolderWithNotes(folderToRestore);
          setFolderToRestore(null);
        }}
        secondaryAction={{
          label: t('folderOnly'),
          onClick: () => {
            if (folderToRestore) restoreFolderOnly(folderToRestore);
            setFolderToRestore(null);
          }
        }}
      />

      <NoteEditor
        note={noteToEditColor}
        isOpen={isNoteColorEditorOpen}
        onClose={() => {
          setIsNoteColorEditorOpen(false);
          setNoteToEditColor(null);
        }}
        onSave={saveNoteFromViewer}
      />

      <BulkActionBar
        context={getBulkContext()}
        isVisible={isBulkMode}
        isAllSelected={isAllSelected(getAllItemIds())}
        isAllItemsSelected={isAllArchivedNotesSelected}
        isAllFoldersSelected={isAllArchivedFoldersSelected}
        selectedCount={selectedItems.size}
        onAction={handleBulkAction}
      />
      </div>
    </Layout>
    </FolderMembershipProvider>
  );
}