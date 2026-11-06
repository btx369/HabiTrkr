import { useState, useRef, useEffect, useReducer, useLayoutEffect } from 'react';
import { 
  Play, 
  Pause, 
  Check, 
  Edit,
  Trash2,
  MoreVertical,
  GripVertical,
  PaletteIcon,
  FileText,
  List,
  Mic,
  Image as ImageIcon,
  X,
  Save,
  ArrowLeft,
  Plus,
  Lock,
  Search,
  ChevronDown,
  Pin,
  FolderOpen
} from 'lucide-react';
import { useIsFiled } from '@/contexts/FolderMembershipContext';
import { useToastSettings } from '@/contexts/ToastContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ItemActionMenu } from '@/components/shared/ItemActionMenu';
import { AudioPlayer } from '@/components/shared/AudioPlayer';
import { Note, ListItem } from '@/types/note';
import { NoteEditor } from './NoteEditor';
import { NoteActionBar } from './NoteActionBar';
import { ReminderDialog } from './ReminderDialog';
import { ReminderChip } from './ReminderChip';
import { requestNotificationPermission } from '@/lib/notificationService';
import { formatReminder, nextReminderTime } from '@/lib/noteReminders';
import { useDateLocale } from '@/lib/dateLocale';
import type { NoteReminder } from '@/types/note';
import { highlightText } from '@/lib/textHighlight';
import { renderMarkdownWithHighlight } from '@/lib/markdownRenderer';
import { parseNoteContent } from '@/lib/noteContentRenderer';
import { readImageForStorage } from '@/lib/imageCompression';
import { extractSearchableText } from '@/lib/noteSearchText';
import { ImageGalleryViewer } from './ImageGalleryViewer';
import { isDefaultColor } from '@/lib/cardColorStyles';
import { useKeyboardViewport } from '@/hooks/useKeyboardViewport';
import { getColoredIconButtonStyles, getColoredIconClass, getColoredBorderClass } from '@/lib/coloredButtonStyles';
import { AudioRecorderPopup } from './AudioRecorderPopup';
import { ImageCapturePopup } from './ImageCapturePopup';
import { TextFormattingBar } from './TextFormattingBar';
import { ListNote, TextNote } from '@/types/note';
import { RichTextEditor, RichTextEditorHandle } from './RichTextEditor';
import { countedSentence } from '@/lib/countedMessage';

/**
 * Convert hex color to rgba for glass effect (matching ColoredCard)
 */
function hexToRgba(hexColor: string, alpha: number): string {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Hover tint for controls sitting on a coloured note: the same colour a step lighter,
 * matching how ColoredCard tints its own controls. Kept identical in formula so a note
 * looks the same whether it is open or shown as a card.
 */
function getLighterColor(hexColor: string): string {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  const lighterR = Math.min(255, Math.round(r + (255 - r) * 0.25));
  const lighterG = Math.min(255, Math.round(g + (255 - g) * 0.25));
  const lighterB = Math.min(255, Math.round(b + (255 - b) * 0.25));

  return `rgba(${lighterR}, ${lighterG}, ${lighterB}, 0.6)`;
}

interface NoteViewerProps {
  note: Note | null;
  isOpen: boolean;
  isNewNote?: boolean;
  onClose: () => void;
  onSave?: (noteId: string, updates: Partial<Note>) => void;
  onToggleListItem?: (noteId: string, itemId: string) => void;
  onArchive?: (noteId: string) => void;
  onUnarchive?: (noteId: string) => void;
  onDelete?: (noteId: string) => void;
  onPin?: (noteId: string) => void;
  onUnpin?: (noteId: string) => void;
  onCopy?: (noteId: string) => void;
  onShare?: (noteId: string) => void;
  onMoveToFolder?: (noteId: string) => void;
  onLock?: (noteId: string) => void;
  onUnlock?: (noteId: string) => void;
}

export function NoteViewer({ 
  note, 
  isOpen, 
  isNewNote = false,
  onClose, 
  onSave,
  onToggleListItem,
  onArchive,
  onUnarchive,
  onDelete,
  onPin,
  onUnpin,
  onCopy,
  onShare,
  onMoveToFolder,
  onLock,
  onUnlock
}: NoteViewerProps) {
  const { toast } = useToastSettings();
  const { t, language } = useLanguage();
  const isFiled = useIsFiled(note?.id ?? '');
  // Toast copy is a translated sentence plus a translated entity noun. Both halves are
  // resolved here so the `{entity}` substitution is written once instead of at every toast.
  const say = (key: string, entity: string) => t(key).replace('{entity}', t(entity));

  /*
   * An archived note is read-only.
   *
   * Opening one used to allow editing, and saving it created a *second* note in the active
   * list: the page looked for the note among the active ones only, did not find it, and took
   * that to mean it was new — so typing in an archived note left a copy of it on the notes
   * screen and the archived original untouched. Editing an archived note is now refused here as
   * well as in the page, and the only way to change one is to restore it first.
   *
   * `archived` is set by the page when it opens a note from the archive; the stored notes do not
   * carry the flag.
   */
  const readOnly = Boolean(note?.archived);

  /**
   * The single door every write from this viewer goes through, so an archived note cannot be
   * edited by a path that forgot to check.
   */
  const saveIfEditable = (updates: Partial<Note>, noteId: string | undefined = note?.id) => {
    if (readOnly || !noteId) return;
    onSave?.(noteId, updates);
  };

  /** Sets or clears the reminder, and asks for notifications the first time one is set. */
  const saveReminder = async (reminder: NoteReminder | undefined) => {
    saveIfEditable({ reminder });
    if (!reminder) {
      toast.success(t('reminderRemoved'));
      return;
    }
    const next = nextReminderTime(reminder);
    const when = next ? formatReminder(next, dateLocale, { today: t('today'), tomorrow: t('reminderTomorrow') }) : '';
    const allowed = await requestNotificationPermission().catch(() => false);
    if (allowed) toast.success(t('reminderSet').replace('{when}', when));
    else toast.info(t('reminderNotificationsOff'));
  };

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [isEditingContent, setIsEditingContent] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const [editedDescription, setEditedDescription] = useState('');
  const [editedItems, setEditedItems] = useState<ListItem[]>([]);
  const [displayItems, setDisplayItems] = useState<ListItem[]>([]);
  const [isColorEditorOpen, setIsColorEditorOpen] = useState(false);
  const [clickedListItemId, setClickedListItemId] = useState<string | null>(null);
  const [desiredListCursorIndex, setDesiredListCursorIndex] = useState<number | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isCompletedExpanded, setIsCompletedExpanded] = useState(false);
  const [isAddingNewItem, setIsAddingNewItem] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryStartIndex, setGalleryStartIndex] = useState(0);
  const [showAudioRecorder, setShowAudioRecorder] = useState(false);
  const [showImageCapturePopup, setShowImageCapturePopup] = useState(false);
  const [showReminderDialog, setShowReminderDialog] = useState(false);
  const dateLocale = useDateLocale();
  const [editingAudioUrl, setEditingAudioUrl] = useState<string | null>(null);
  const [editingAudioText, setEditingAudioText] = useState('');
  const [showFormattingBar, setShowFormattingBar] = useState(false);
  // The formatting button enters edit mode WITHOUT focusing the editor, so it never raises
  // the keyboard. Read (and cleared) by the focus-on-edit effect below.
  const skipEditFocusRef = useRef(false);
  // While the keyboard is open the note is resized to the visible area, which lifts the
  // action bar (and the formatting button in it) above the keyboard.
  const keyboardViewport = useKeyboardViewport(isOpen);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const audioRefs = useRef<Record<string, HTMLAudioElement>>({});
  const formattingTextareaRef = useRef<HTMLTextAreaElement>(null);
  const richTextEditorRef = useRef<RichTextEditorHandle>(null);
  const scrollAreaRootRef = useRef<HTMLDivElement>(null);
  const pendingScrollRestoreRef = useRef<number | null>(null);

  // Mirrors of list-editing state, for the focus effect below to read without taking
  // them as dependencies. That effect runs when editing starts and again when the note
  // type changes; if it depended on displayItems/editedItems it would also re-run on
  // every keystroke and steal focus from the input being typed into. Reading the refs
  // keeps the timing identical while guaranteeing the latest values.
  const displayItemsRef = useRef(displayItems);
  displayItemsRef.current = displayItems;
  const editedItemsRef = useRef(editedItems);
  editedItemsRef.current = editedItems;
  const clickedListItemIdRef = useRef(clickedListItemId);
  clickedListItemIdRef.current = clickedListItemId;
  const desiredListCursorIndexRef2 = useRef(desiredListCursorIndex);
  desiredListCursorIndexRef2.current = desiredListCursorIndex;
  const isAddingNewItemRef = useRef(isAddingNewItem);
  isAddingNewItemRef.current = isAddingNewItem;

  // Latest `note`, for the reset effect. Keyed on note?.id so the reset happens when the
  // user switches notes, not on every parent re-render.
  const noteRef = useRef(note);
  noteRef.current = note;
  
  // Force re-render for formatting bar updates
  const [, forceUpdate] = useReducer((x: number) => x + 1, 0);

  // Helper to get the ScrollArea viewport element
  const getScrollViewport = () => 
    scrollAreaRootRef.current?.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement | null;

  // Restore scroll position after formatting bar toggle
  useLayoutEffect(() => {
    if (pendingScrollRestoreRef.current !== null) {
      const scrollTop = pendingScrollRestoreRef.current;
      pendingScrollRestoreRef.current = null;
      requestAnimationFrame(() => {
        const viewport = getScrollViewport();
        if (viewport) {
          viewport.scrollTop = scrollTop;
        }
      });
    }
  }, [showFormattingBar]);

  // Helper function to insert content markers in the correct order
  const insertContentInOrder = (currentContent: string, newMarker: string, type: 'image' | 'audio'): string => {
    if (!currentContent) return newMarker;
    
    // 1) Extract and preserve existing audio-note labels
    const audioNoteMap = new Map<string, string>();
    const audioNoteRegex = /\[audionote:([^\]]+):([^:\]]*)\]/g;
    let audioNoteMatch;
    while ((audioNoteMatch = audioNoteRegex.exec(currentContent)) !== null) {
      audioNoteMap.set(audioNoteMatch[1], audioNoteMatch[2]);
    }
    
    // 2) Parse content (audionote markers are stripped by parser)
    const parts = parseNoteContent(currentContent);
    
    // Separate parts by type
    const images = parts.filter(p => p.type === 'image');
    const audio = parts.filter(p => p.type === 'audio');
    const text = parts.filter(p => p.type === 'text');
    
    // Add the new marker to the appropriate array
    if (type === 'image') {
      images.push({ type: 'image', content: newMarker.replace('[image:', '').replace(']', '') });
    } else if (type === 'audio') {
      const match = newMarker.match(/\[audio:(.+?):([\d.]+)\]/);
      if (match) {
        audio.push({ type: 'audio', content: match[1], duration: parseFloat(match[2]) });
      }
    }
    
    // 3) Reconstruct content in order: images -> audio (with labels) -> text
    let result = '';
    
    images.forEach(img => {
      result += `[image:${img.content}]`;
    });
    
    audio.forEach(aud => {
      result += `[audio:${aud.content}:${aud.duration ?? 0}]`;
      // Restore audio-note label if it exists
      const encodedLabel = audioNoteMap.get(aud.content);
      if (encodedLabel) {
        result += `[audionote:${aud.content}:${encodedLabel}]`;
      }
    });
    
    text.forEach(txt => {
      result += txt.content;
    });
    
    return result.trim();
  };

  // Handle image actions in gallery
  const handleCopyImageUrl = (imageUrl: string) => {
    navigator.clipboard.writeText(imageUrl);
    toast.success(say('toastCopied', 'noteViewerTitle'), {
      description: t('toastContentCopied'),
    });
  };

  const handleShareImage = async (imageUrl: string) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: note?.name || 'Image',
          url: imageUrl,
        });
      } catch {
        // The user dismissed the share sheet, or the platform refused it. Either way
        // there is nothing to recover from and nothing to report.
      }
    } else {
      // Fallback to copying the URL
      handleCopyImageUrl(imageUrl);
    }
  };

  const handleDeleteImage = (imageUrl: string) => {
    if (readOnly || !note) return;
    
    // For image notes, prevent deletion of the main image
    if (note.type === 'image' && imageUrl === note.imageUrl) {
      toast.error(t('cannotDelete'), {
        description: t('cannotDeleteMainImage'),
      });
      return;
    }
    
    // Get the current description (use editing state if available, otherwise note description)
    const currentDescription = isEditingContent ? editedDescription : (note.description || '');
    
    // Remove the image markdown from description
    const imageMarkdown = `[image:${imageUrl}]`;
    const updatedDescription = currentDescription.replace(imageMarkdown, '').trim();
    
    // Update the editing state if we're in edit mode
    if (isEditingContent) {
      setEditedDescription(updatedDescription);
    }
    
    // Save immediately
    saveIfEditable({ description: updatedDescription });
    
    // Close gallery
    setGalleryOpen(false);
    
    toast.success(say('toastUpdated', 'noteViewerTitle'));
  };

  const titleInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const desiredCursorIndexRef = useRef<number | null>(null);
  const scrollPosRef = useRef<{ top: number; left: number }>({ top: 0, left: 0 });

  const autoResizeTextarea = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    const viewport = ta.closest('[data-radix-scroll-area-viewport]') as HTMLElement | null;
    const prevTop = viewport?.scrollTop ?? 0;
    const prevLeft = viewport?.scrollLeft ?? 0;

    // Resize without causing scroll jumps
    ta.style.height = 'auto';
    const newHeight = ta.scrollHeight;
    ta.style.height = `${newHeight}px`;

    if (viewport) {
      viewport.scrollTop = prevTop;
      viewport.scrollLeft = prevLeft;
    }
  };
  // Compute caret index within text content based on click position
  const getCaretIndexWithin = (container: HTMLElement, node: Node, offset: number) => {
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    let index = 0;
    let current: Node | null = walker.nextNode();
    while (current) {
      if (current === node) return index + offset;
      index += (current.textContent || '').length;
      current = walker.nextNode();
    }
    return index;
  };

  const getCaretIndexFromPoint = (container: HTMLElement, x: number, y: number): number | null => {
    let range: Range | null = null;
    const anyDoc = document as any;
    if ((document as any).caretRangeFromPoint) {
      range = (document as any).caretRangeFromPoint(x, y);
    } else if (anyDoc.caretPositionFromPoint) {
      const pos = anyDoc.caretPositionFromPoint(x, y);
      if (pos) {
        range = document.createRange();
        range.setStart(pos.offsetNode, pos.offset);
      }
    }
    if (!range || !container.contains(range.startContainer)) return null;
    return getCaretIndexWithin(container, range.startContainer, range.startOffset);
  };

  // Auto-focus for new notes
  useEffect(() => {
    if (isNewNote && isOpen && note) {
      // For new notes, start editing content instead of title
      if (note.type === 'text') {
        setEditedDescription(note.description || '');
        setIsEditingContent(true);
      } else if (note.type === 'list') {
        setEditedItems([...note.items]);
        setIsEditingContent(true);
      } else if (note.type === 'audio' || note.type === 'image') {
        setEditedDescription(note.description || '');
        setIsEditingContent(true);
      }
    }
  }, [isNewNote, isOpen, note]);

  // Reset all editing state when note changes to prevent content leakage.
  // Deliberately keyed on the note id, not the whole note: `note` is a fresh object on
  // every parent render, so depending on it would re-run this reset continuously and
  // wipe edits mid-typing. The body reads noteRef so it still sees the current note.
  useEffect(() => {
    const currentNote = noteRef.current;
    if (currentNote) {
      // Reset editing states
      setIsEditingContent(false);
      setIsEditingTitle(false);
      
      // Reset content to current note
      setEditedDescription(currentNote.description || '');
      setEditedTitle(currentNote.name || '');
      
      if (currentNote.type === 'list') {
        setDisplayItems(currentNote.items);
        setEditedItems(currentNote.items);
      }
      
      // Reset search state
      setIsSearching(false);
      setSearchQuery('');
      
      // Reset popup states
      setShowFormattingBar(false);
      setShowAudioRecorder(false);
      setShowImageCapturePopup(false);
      setGalleryOpen(false);
    }
  }, [note?.id]);
  
  // Subscribe to editor events to update formatting bar reactively
  useEffect(() => {
    const editor = richTextEditorRef.current?.editor;
    if (!editor) return;
    
    const updateHandler = () => forceUpdate();
    editor.on('update', updateHandler);
    editor.on('selectionUpdate', updateHandler);
    
    return () => {
      editor.off('update', updateHandler);
      editor.off('selectionUpdate', updateHandler);
    };
  }, [richTextEditorRef.current?.editor]);

  // Handle Escape key to close formatting bar and other popups
  useEffect(() => {
    if (!isOpen) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Close formatting bar first if open
        if (showFormattingBar) {
          setShowFormattingBar(false);
          e.preventDefault();
          return;
        }
        // Close search if open
        if (isSearching) {
          setIsSearching(false);
          setSearchQuery('');
          e.preventDefault();
          return;
        }
        // Close gallery if open
        if (galleryOpen) {
          setGalleryOpen(false);
          e.preventDefault();
          return;
        }
        // Close audio recorder if open
        if (showAudioRecorder) {
          setShowAudioRecorder(false);
          e.preventDefault();
          return;
        }
        // Close image capture if open
        if (showImageCapturePopup) {
          setShowImageCapturePopup(false);
          e.preventDefault();
          return;
        }
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, showFormattingBar, isSearching, galleryOpen, showAudioRecorder, showImageCapturePopup]);

  // Focus title input when editing starts
  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  // Focus content textarea when editing starts and restore desired cursor index if present
  useEffect(() => {
    if (isEditingContent) {
      if (note?.type === 'list') {
      // For list notes, focus the specific clicked item or the first input field.
      // Reads the *Ref mirrors so the values are current without those values having to
      // be dependencies (which would re-run this and steal focus on every keystroke).
      setTimeout(() => {
        const clickedListItemId = clickedListItemIdRef.current;
        const desiredListCursorIndex = desiredListCursorIndexRef2.current;
        const isAddingNewItem = isAddingNewItemRef.current;
        if (clickedListItemId) {
          // Focus the specific input for the clicked item
          const inputs = document.querySelectorAll('input[data-list-item-input]') as NodeListOf<HTMLInputElement>;
          const items = isEditingContent ? editedItemsRef.current : displayItemsRef.current;
          const clickedIndex = items.findIndex(item => item.id === clickedListItemId);
          if (clickedIndex >= 0 && inputs[clickedIndex]) {
            inputs[clickedIndex].focus();
            // Position cursor at the desired index or end of text
            const cursorPos = desiredListCursorIndex !== null ? 
              Math.min(desiredListCursorIndex, inputs[clickedIndex].value.length) : 
              inputs[clickedIndex].value.length;
            inputs[clickedIndex].setSelectionRange(cursorPos, cursorPos);
          }
          setClickedListItemId(null); // Reset after focusing
          setDesiredListCursorIndex(null); // Reset after focusing
        } else if (!isAddingNewItem) {
          // Only focus first input if we're not adding a new item
          const firstInput = document.querySelector('input[data-list-item-input]') as HTMLInputElement;
          if (firstInput) {
            firstInput.focus();
          }
        }
      }, 100);
      } else {
        // For non-list notes, focus the rich text editor if available; otherwise fallback to textarea
        if (skipEditFocusRef.current) {
          skipEditFocusRef.current = false; // entered edit mode from the formatting button
        } else if (richTextEditorRef.current) {
          requestAnimationFrame(() => {
            richTextEditorRef.current?.focus();
          });
        } else if (textareaRef.current) {
          const ta = textareaRef.current;
          
          // Focus without scrolling
          ta.focus({ preventScroll: true });

          // Restore previously captured scroll position (avoid jump to top)
          const viewport = ta.closest('[data-radix-scroll-area-viewport]') as HTMLElement | null;
          if (viewport) {
            viewport.scrollTop = scrollPosRef.current.top;
            viewport.scrollLeft = scrollPosRef.current.left;
          }
          
          if (desiredCursorIndexRef.current !== null) {
            const i = Math.max(0, Math.min(ta.value.length, desiredCursorIndexRef.current));
            ta.setSelectionRange(i, i);
            desiredCursorIndexRef.current = null;
          }
          
          // Synchronous resize to avoid initial flicker and scroll jumps
          autoResizeTextarea();
          
          // Double-check next frame in case content measurement changes
          requestAnimationFrame(() => {
            autoResizeTextarea();
            // Re-assert scroll position after layout
            if (viewport) {
              viewport.scrollTop = scrollPosRef.current.top;
              viewport.scrollLeft = scrollPosRef.current.left;
            }
          });
        }
      }
    }
  }, [isEditingContent, note?.type]);

  if (!note) return null;

  const handleBackClick = () => {
    // Save any pending changes before closing
    if (isEditingTitle) {
      saveTitle();
    }
    if (isEditingContent) {
      saveContent();
    }
    // Reset search state
    setIsSearching(false);
    setSearchQuery('');
    // Reset popup states
    setShowAudioRecorder(false);
    setShowImageCapturePopup(false);
    setShowFormattingBar(false);
    onClose();
  };

  const handleSearchToggle = () => {
    if (isSearching) {
      setIsSearching(false);
      setSearchQuery('');
    } else {
      setIsSearching(true);
      // Focus search input after state update
      setTimeout(() => {
        if (searchInputRef.current) {
          searchInputRef.current.focus();
        }
      }, 0);
    }
  };

  const handleCloseClick = () => {
    // If this is a new note and hasn't been saved yet, don't save it
    if (isNewNote) {
      // Just close without saving - the note was never added to the notes array
      setIsEditingTitle(false);
      setIsEditingContent(false);
      setEditedTitle('');
      setEditedDescription('');
      setEditedItems([]);
      // Reset popup states
      setShowAudioRecorder(false);
      setShowImageCapturePopup(false);
      setShowFormattingBar(false);
      onClose();
      return;
    }
    
    // For existing notes, discard any pending changes
    setIsEditingTitle(false);
    setIsEditingContent(false);
    setEditedTitle('');
    setEditedDescription('');
    setEditedItems([]);
    // Reset popup states
    setShowAudioRecorder(false);
    setShowImageCapturePopup(false);
    setShowFormattingBar(false);
    onClose();
  };

  const startEditingTitle = () => {
    if (readOnly) return;
    setEditedTitle(note.name || '');
    setIsEditingTitle(true);
  };

  const startEditingContent = (event?: React.MouseEvent, itemId?: string) => {
    if (readOnly) return;

    if (note.type === 'text') {
      setEditedDescription(note.description || '');
    } else if (note.type === 'audio' || note.type === 'image') {
      setEditedDescription(note.description || '');
    } else if (note.type === 'list') {
      setEditedItems([...note.items]);
      // Store which list item was clicked for proper focus handling
      if (itemId && event) {
        setClickedListItemId(itemId);
        // Calculate cursor position within the clicked list item text
        const container = event.currentTarget as HTMLElement;
        const idx = getCaretIndexFromPoint(container, event.clientX, event.clientY);
        setDesiredListCursorIndex(idx);
      }
    }

    // Capture desired cursor index based on click position for text-based notes
    if ((note.type === 'text' || note.type === 'audio' || note.type === 'image') && event) {
      const container = event.currentTarget as HTMLElement;
      const idx = getCaretIndexFromPoint(container, (event as React.MouseEvent).clientX, (event as React.MouseEvent).clientY);
      desiredCursorIndexRef.current = idx !== null ? idx : null;
    }

    // Preserve current scroll position of the ScrollArea viewport to avoid jumps
    if (event) {
      const viewport = event.currentTarget.closest('[data-radix-scroll-area-viewport]') as HTMLElement | null;
      if (viewport) {
        scrollPosRef.current = { top: viewport.scrollTop, left: viewport.scrollLeft };
      }
    }

    setIsEditingContent(true);
  };

  /**
   * Save the title, once the user has finished editing it.
   *
   * This deliberately does NOT run on every keystroke. Saving on each character called
   * up into the page, which replaced `noteToView`, which re-rendered this viewer and
   * dropped it out of title-editing mode — so the field vanished after the first letter
   * and further typing went nowhere.
   *
   * Enter commits and closes the field; clicking away commits too. That is the whole
   * interaction, so no debounce is needed.
   */
  const saveTitle = () => {
    if (readOnly) return;
    if (onSave && editedTitle.trim() !== note.name) {
      saveIfEditable({ name: editedTitle.trim() });
    }
    setIsEditingTitle(false);
  };

  const saveContent = () => {
    if (readOnly || !onSave) return;
    
    
    // Check if there's any meaningful content
    let hasContent = false;
    const updatedNote: any = {};
    
    if (note.type === 'text' && editedDescription.trim()) {
      hasContent = true;
      updatedNote.description = editedDescription;
    } else if ((note.type === 'audio' || note.type === 'image') && editedDescription.trim()) {
      hasContent = true;
      updatedNote.description = editedDescription;
    } else if (note.type === 'list' && editedItems.some(item => item.text.trim())) {
      hasContent = true;
      const filteredItems = editedItems.filter(item => item.text.trim());
      updatedNote.items = filteredItems;
      // Update display items to match the saved state
      setDisplayItems(filteredItems);
    }
    
    
    // Only save if there's content or if this is an existing note
    if (hasContent || !isNewNote) {
      saveIfEditable(updatedNote);
    }
    
    setIsEditingContent(false);
  };

  const applyFormatting = (formatType: 'h1' | 'h2' | 'normal' | 'bold' | 'italic' | 'underline' | 'clear') => {
    // Use the rich text editor if available, otherwise fall back to textarea
    if (richTextEditorRef.current) {
      richTextEditorRef.current.applyFormat(formatType);
      forceUpdate(); // Immediately update button states
      return;
    }
    
    const textarea = formattingTextareaRef.current || textareaRef.current;
    if (!textarea) return;
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = editedDescription;
    const selectedText = text.substring(start, end);
    
    let newText = text;
    let newCursorPos = start;
    
    // Get the current line
    const beforeCursor = text.substring(0, start);
    const afterCursor = text.substring(end);
    const lineStart = beforeCursor.lastIndexOf('\n') + 1;
    const lineEnd = text.indexOf('\n', end);
    const currentLine = text.substring(lineStart, lineEnd === -1 ? text.length : lineEnd);
    
    switch (formatType) {
      case 'h1':
        if (start !== end) {
          // Wrap selection
          newText = text.substring(0, start) + '# ' + selectedText + afterCursor;
          newCursorPos = end + 2;
        } else {
          // Add to start of line
          const lineContent = currentLine.replace(/^#+\s*/, '');
          newText = text.substring(0, lineStart) + '# ' + lineContent + text.substring(lineEnd === -1 ? text.length : lineEnd);
          newCursorPos = start + 2;
        }
        break;
        
      case 'h2':
        if (start !== end) {
          newText = text.substring(0, start) + '## ' + selectedText + afterCursor;
          newCursorPos = end + 3;
        } else {
          const lineContent = currentLine.replace(/^#+\s*/, '');
          newText = text.substring(0, lineStart) + '## ' + lineContent + text.substring(lineEnd === -1 ? text.length : lineEnd);
          newCursorPos = start + 3;
        }
        break;
        
      case 'normal':
        // Remove heading markers from current line
        const lineContent = currentLine.replace(/^#+\s*/, '');
        const diff = currentLine.length - lineContent.length;
        newText = text.substring(0, lineStart) + lineContent + text.substring(lineEnd === -1 ? text.length : lineEnd);
        newCursorPos = Math.max(lineStart, start - diff);
        break;
        
      case 'bold':
        if (start !== end) {
          // Check if already bold
          const isBold = text.substring(start - 2, start) === '**' && text.substring(end, end + 2) === '**';
          if (isBold) {
            newText = text.substring(0, start - 2) + selectedText + text.substring(end + 2);
            newCursorPos = start - 2;
          } else {
            newText = text.substring(0, start) + '**' + selectedText + '**' + afterCursor;
            newCursorPos = end + 4;
          }
        }
        break;
        
      case 'italic':
        if (start !== end) {
          const isItalic = text.substring(start - 1, start) === '*' && text.substring(end, end + 1) === '*' &&
                          text.substring(start - 2, start) !== '**';
          if (isItalic) {
            newText = text.substring(0, start - 1) + selectedText + text.substring(end + 1);
            newCursorPos = start - 1;
          } else {
            newText = text.substring(0, start) + '*' + selectedText + '*' + afterCursor;
            newCursorPos = end + 2;
          }
        }
        break;
        
      case 'underline':
        if (start !== end) {
          const isUnderline = text.substring(start - 2, start) === '__' && text.substring(end, end + 2) === '__';
          if (isUnderline) {
            newText = text.substring(0, start - 2) + selectedText + text.substring(end + 2);
            newCursorPos = start - 2;
          } else {
            newText = text.substring(0, start) + '__' + selectedText + '__' + afterCursor;
            newCursorPos = end + 4;
          }
        }
        break;
        
      case 'clear':
        if (start !== end) {
          // Remove all formatting markers from selection
          const cleaned = selectedText
            .replace(/^#+\s*/, '')
            .replace(/\*\*/g, '')
            .replace(/\*/g, '')
            .replace(/__/g, '');
          newText = text.substring(0, start) + cleaned + afterCursor;
          newCursorPos = start + cleaned.length;
        } else {
          // Clear formatting from entire content
          const cleaned = text
            .replace(/^#+\s*/gm, '')
            .replace(/\*\*/g, '')
            .replace(/\*/g, '')
            .replace(/__/g, '');
          newText = cleaned;
          newCursorPos = Math.min(start, cleaned.length);
        }
        break;
    }
    
    setEditedDescription(newText);
    
    // Restore cursor position
    setTimeout(() => {
      if (textarea) {
        textarea.focus();
        textarea.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  };

  const addListItem = () => {
    const newItem = {
      id: crypto.randomUUID(),
      text: '',
      completed: false
    };
    setEditedItems(prev => [...prev, newItem]);
    
    // Focus the new input after it's rendered - target only UNCHECKED item inputs
    setTimeout(() => {
      const inputs = Array.from(
        document.querySelectorAll('input[data-list-item-input]:not(.line-through)')
      ) as HTMLInputElement[];
      const lastInput = inputs[inputs.length - 1];
      if (lastInput) {
        lastInput.focus();
        const len = lastInput.value.length;
        // setSelectionRange throws on input types that do not support text selection
        // (number, email, date...). Focusing is what matters here; the caret position
        // is only a nicety, so a failure is deliberately ignored rather than logged.
        try { lastInput.setSelectionRange?.(len, len); } catch { /* caret not settable on this input type */ }
        lastInput.scrollIntoView({ block: 'nearest' });
      }
    }, 50);
    // The flag has to outlive the edit-mode focus effect, which looks at it 100ms after
    // editing starts. It used to be cleared right after focusing the new row (at 50ms), so the
    // effect then saw "not adding" and moved focus to the FIRST item, scrolling the list to
    // the top. Clear it after that effect has run.
    setTimeout(() => setIsAddingNewItem(false), 300);
  };

  const beginAddItem = () => {
    if (!isEditingContent) {
      setIsAddingNewItem(true); // Set flag to prevent useEffect interference
      setEditedItems([...displayItems]);
      setIsEditingContent(true);
      setTimeout(() => {
        addListItem();
      }, 0);
    } else {
      addListItem();
    }
  };

  const handleListItemKeyDown = (e: React.KeyboardEvent, itemId: string) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      addListItem();
    }
  };

  const updateListItem = (itemId: string, text: string) => {
    setEditedItems(prev => prev.map(item => 
      item.id === itemId ? { ...item, text } : item
    ));
  };

  const removeListItem = (itemId: string) => {
    setEditedItems(prev => prev.filter(item => item.id !== itemId));
  };

  /**
   * Drag-to-reorder for list items, as in Google Keep: hold the grip and move up or down.
   * The grip captures the pointer, so the gesture keeps working while the row moves under
   * the finger, and `touch-none` on it stops the page from scrolling instead. Rows are found
   * by position, so only unchecked rows (which carry data-list-row) are drop targets.
   */
  const [draggingItemId, setDraggingItemId] = useState<string | null>(null);
  const draggedOrderChangedRef = useRef(false);

  const moveListItem = (fromId: string, toId: string) => {
    const apply = (prev: ListItem[]) => {
      const from = prev.findIndex(i => i.id === fromId);
      const to = prev.findIndex(i => i.id === toId);
      if (from < 0 || to < 0 || from === to) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      draggedOrderChangedRef.current = true;
      return next;
    };
    if (isEditingContent) setEditedItems(apply);
    else setDisplayItems(apply);
  };

  const handleGripPointerDown = (e: React.PointerEvent<HTMLElement>, itemId: string) => {
    if (readOnly) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    draggedOrderChangedRef.current = false;
    setDraggingItemId(itemId);
  };

  const handleGripPointerMove = (e: React.PointerEvent<HTMLElement>) => {
    if (!draggingItemId) return;
    const rows = Array.from(document.querySelectorAll('[data-list-row]')) as HTMLElement[];
    if (rows.length === 0) return;
    // Nearest row to the pointer, so dragging past the first/last row still lands there.
    let target = rows[0];
    let best = Infinity;
    for (const row of rows) {
      const r = row.getBoundingClientRect();
      const dist = e.clientY < r.top ? r.top - e.clientY : e.clientY > r.bottom ? e.clientY - r.bottom : 0;
      if (dist < best) { best = dist; target = row; }
    }
    const overId = target.dataset.listRow;
    if (overId && overId !== draggingItemId) moveListItem(draggingItemId, overId);
    // Scroll the list when the finger nears its top or bottom edge.
    const scroller = target.closest('.overflow-auto') as HTMLElement | null;
    if (scroller) {
      const sr = scroller.getBoundingClientRect();
      if (e.clientY < sr.top + 48) scroller.scrollBy({ top: -14 });
      else if (e.clientY > sr.bottom - 48) scroller.scrollBy({ top: 14 });
    }
  };

  const handleGripPointerEnd = () => {
    if (!draggingItemId) return;
    setDraggingItemId(null);
    // In view mode there is no Save button, so the new order is stored as soon as the drag ends.
    // In edit mode it goes in with the rest of the edits.
    if (!isEditingContent && draggedOrderChangedRef.current) {
      saveIfEditable({ items: displayItemsRef.current } as Partial<Note>);
    }
    draggedOrderChangedRef.current = false;
  };

  const handleListItemToggle = (itemId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isEditingContent) {
      // When editing, update local state immediately
      setEditedItems(prev => prev.map(item => 
        item.id === itemId ? { ...item, completed: !item.completed } : item
      ));
    } else {
      // When not editing, update display state immediately for visual feedback
      setDisplayItems(prev => prev.map(item => 
        item.id === itemId ? { ...item, completed: !item.completed } : item
      ));
      // Also call parent to update the actual note
      if (onToggleListItem) {
        onToggleListItem(note.id, itemId);
      }
    }
  };


  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleShare = () => {
    if (navigator.share) {
      let shareText = '';
      
      switch (note.type) {
        case 'text':
          shareText = `${note.name}\n\n${note.description}`;
          break;
        case 'list':
          shareText = `${note.name}\n\n${note.items.map(item => `${item.completed ? '✓' : '○'} ${item.text}`).join('\n')}`;
          break;
        case 'audio':
          shareText = `${note.name}\n\nAudio note (${formatDuration(note.duration)})`;
          break;
        case 'image':
          shareText = `${note.name}\n\nImage note`;
          break;
      }
      
      navigator.share({
        title: note.name,
        text: shareText,
      });
    } else {
      // Fallback for browsers that don't support Web Share API
      let shareText = '';
      
      switch (note.type) {
        case 'text':
          shareText = `${note.name}\n\n${note.description}`;
          break;
        case 'list':
          shareText = `${note.name}\n\n${note.items.map(item => `${item.completed ? '✓' : '○'} ${item.text}`).join('\n')}`;
          break;
        case 'audio':
          shareText = `${note.name}\n\nAudio note (${formatDuration(note.duration)})`;
          break;
        case 'image':
          shareText = `${note.name}\n\nImage note`;
          break;
      }
      
      navigator.clipboard.writeText(shareText);
    }
  };

  const handleCameraCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && note) {
      readImageForStorage(file).then((imageUrl) => {
        const newContent = editedDescription
          ? `${editedDescription}\n[image:${imageUrl}]`
          : `[image:${imageUrl}]`;
        setEditedDescription(newContent);
      });
    }
    e.target.value = '';
  };

  const handleGallerySelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && note) {
      readImageForStorage(file).then((imageUrl) => {
        const newContent = editedDescription
          ? `${editedDescription}\n[image:${imageUrl}]`
          : `[image:${imageUrl}]`;
        setEditedDescription(newContent);
      });
    }
    e.target.value = '';
  };

  const extractImages = (content: string): string[] => {
    const parts = parseNoteContent(content);
    return parts.filter(part => part.type === 'image').map(part => part.content);
  };

  // Same extraction the card and the search engine use, but without trimming: the
  // result is rendered as markdown, where leading whitespace is layout.
  const extractTextContent = (content: string): string =>
    extractSearchableText({ description: content }, { lowercase: false, trim: false });

  const extractAudio = (content: string): { content: string; duration?: number }[] => {
    const parts = parseNoteContent(content);
    return parts
      .filter(part => part.type === 'audio')
      .map(part => ({ content: part.content, duration: part.duration }));
  };

  const getAudiosWithLabels = (content: string): { content: string; duration?: number; label?: string }[] => {
    const audios: { content: string; duration?: number; label?: string }[] = [];
    
    // First, extract all audionote markers into a map
    const audioNotes = new Map<string, string>();
    const audioNoteRegex = /\[audionote:([^\]]+):([^:\]]*)\]/g;
    let noteMatch;
    while ((noteMatch = audioNoteRegex.exec(content)) !== null) {
      const url = noteMatch[1];
      const encodedLabel = noteMatch[2];
      const decodedLabel = decodeURIComponent(encodedLabel);
      audioNotes.set(url, decodedLabel);
    }
    
    
    // Then extract audio markers and match with their notes
    const audioRegex = /\[audio:(.+?):([\d.]+)\]/g;
    let m;
    while ((m = audioRegex.exec(content)) !== null) {
      const url = m[1];
      const duration = parseFloat(m[2]);
      const label = audioNotes.get(url);
      audios.push({ content: url, duration, label });
    }
    
    return audios;
  };

  /**
   * Removes an audio clip and its caption from a list note's markdown.
   *
   * Matching is done by index, not by rebuilding the marker and string-replacing it. The
   * label is optional, so the old reconstruction produced `[audionote:<url>:undefined]`
   * whenever a clip had no caption — a marker that is never in the content, so the delete
   * silently did nothing. `encodeURIComponent(undefined)` also yields the literal string
   * "undefined" rather than failing, so nothing warned about it either.
   */
  const removeAudioFromContent = (content: string, url: string): string => {
    let result = content;

    // The caption marker carries a free-form label, so find it by index like upsertAudioNote.
    const noteStart = result.indexOf(`[audionote:${url}:`);
    if (noteStart !== -1) {
      const noteEnd = result.indexOf(']', noteStart);
      if (noteEnd !== -1) result = result.slice(0, noteStart) + result.slice(noteEnd + 1);
    }

    // The clip itself. Deleting the caption but leaving the player behind would look like
    // the delete had half-worked.
    const audioRegex = new RegExp(`\\[audio:${url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:[\\d.]+\\]`, 'g');
    result = result.replace(audioRegex, '');

    return result;
  };

  const upsertAudioNote = (content: string, url: string, duration: number, noteText: string): string => {
    
    const text = noteText.trim().slice(0, 25);
    const encoded = encodeURIComponent(text);
    const newNoteMarker = `[audionote:${url}:${encoded}]`;
    
    // Check if an audionote already exists for this URL and replace it
    const noteStart = content.indexOf(`[audionote:${url}:`);
    if (noteStart !== -1) {
      const noteEnd = content.indexOf(']', noteStart);
      if (noteEnd !== -1) {
        const result = content.slice(0, noteStart) + newNoteMarker + content.slice(noteEnd + 1);
        return result;
      }
    }
    
    // Otherwise, insert after the audio marker (any duration)
    const audioMarker = `[audio:${url}:`;
    const audioStart = content.indexOf(audioMarker);
    
    if (audioStart === -1) {
      console.error('[upsertAudioNote] Could not find audio marker in content!');
      return content;
    }
    
    const audioEnd = content.indexOf(']', audioStart);
    if (audioEnd === -1) {
      console.error('[upsertAudioNote] Could not find audio marker end bracket!');
      return content;
    }
    
    const result = content.slice(0, audioEnd + 1) + newNoteMarker + content.slice(audioEnd + 1);
    return result;
  };

  const deleteAudioAndNote = (content: string, url: string, duration: number): string => {
    let result = content;
    
    // Remove the audionote marker (with optional preceding newline)
    const noteStart = result.indexOf(`[audionote:${url}:`);
    if (noteStart !== -1) {
      const before = result.slice(0, noteStart);
      const noteEnd = result.indexOf(']', noteStart);
      const after = noteEnd !== -1 ? result.slice(noteEnd + 1) : result.slice(noteStart);
      const trimmedBefore = before.endsWith('\n') ? before.slice(0, -1) : before;
      result = trimmedBefore + after;
    }
    
    // Remove the audio marker (with optional following newline)
    const audioStart = result.indexOf(`[audio:${url}:`);
    if (audioStart !== -1) {
      const before = result.slice(0, audioStart);
      const audioEnd = result.indexOf(']', audioStart);
      let after = audioEnd !== -1 ? result.slice(audioEnd + 1) : result.slice(audioStart);
      if (after.startsWith('\n')) after = after.slice(1);
      result = before + after;
    }
    
    return result;
  };

  const openGallery = (index: number) => {
    setGalleryStartIndex(index);
    setGalleryOpen(true);
  };

  const getTypeIcon = () => {
    switch (note.type) {
      case 'text':
        return <FileText size={20} className="text-muted-foreground" />;
      case 'list':
        return <List size={20} className="text-muted-foreground" />;
      case 'audio':
        return <Mic size={20} className="text-muted-foreground" />;
      case 'image':
        return <ImageIcon size={20} className="text-muted-foreground" />;
      default:
        return <FileText size={20} className="text-muted-foreground" />;
    }
  };

  const renderImageGrid = (images: string[]) => {
    if (images.length === 0) return null;

    if (images.length === 1) {
      return (
        <div 
          className="block w-full max-w-full cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            openGallery(0);
          }}
        >
          <img
            src={images[0]}
            alt={t('noteImageAlt')}
            className="block w-full h-auto rounded-lg"
          />
        </div>
      );
    }

    if (images.length === 2) {
      return (
        <div className="grid grid-cols-2 gap-2 w-full max-w-full">
          {images.map((img, idx) => (
            <div 
              key={idx}
              className="cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                openGallery(idx);
              }}
            >
              <img
                src={img}
                alt={`Note image ${idx + 1}`}
                className="w-full h-48 object-cover rounded-lg"
              />
            </div>
          ))}
        </div>
      );
    }

    // 3 or more images
    return (
      <div className="grid grid-cols-3 gap-2 w-full max-w-full">
        {images.map((img, idx) => (
          <div 
            key={idx}
            className="cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              openGallery(idx);
            }}
          >
            <img
              src={img}
              alt={`Note image ${idx + 1}`}
              className="w-full h-32 object-cover rounded-lg"
            />
          </div>
        ))}
      </div>
    );
  };
  
  // Where a note's media markers currently live. A list renders them from the edit buffer
  // when it has one and from the saved description otherwise; other notes use the buffer only
  // while editing.
  const currentAudioDescription = (): string =>
    note.type === 'list'
      ? (editedDescription || (note as ListNote).description || '')
      : (isEditingContent ? editedDescription : (note.description || ''));

  const renderAudioList = (audios: { content: string; duration?: number; label?: string }[]) => (
    <div className="space-y-3">
      {audios.map((a, index) => {
        const uniqueKey = `${a.content}-${a.duration ?? 0}`;
        
        return (
          <div key={uniqueKey} className="block w-full max-w-full space-y-2">
            <div className="flex items-center gap-2">
              {/* Shared AudioPlayer rather than a native <audio controls>: the native
                  element rendered a different control set from the note cards and had no
                  playback-speed control. `onPlay` preserves the previous behaviour of
                  stopping any other track in this note. */}
              <div
                className="flex-1 min-w-0"
                onClick={(e) => e.stopPropagation()}
                onDoubleClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <AudioPlayer
                  hasColor={!isDefaultColor(note.color)}
                  audioUrl={a.content}
                  initialDuration={a.duration ?? 0}
                  showSeeker
                  showSpeedControl
                  onPlay={() => {
                    Object.entries(audioRefs.current).forEach(([key, el]) => {
                      if (key !== uniqueKey && el && !el.paused) {
                        el.pause();
                      }
                    });
                  }}
                />
              </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghostStatic" 
                  size="icon" 
                  /*
                   * `--card-hover-color` rather than a fixed `hover:bg-black/10`. A black veil
                   * is invisible in dark mode, where the surface underneath is already near
                   * black, so this menu had no hover there at all. The variable is already
                   * defined by both containers that can host this row: the note dialog and
                   * ColoredCard each set it to a tint of the note's own colour, or to the
                   * shared --hover veil when the note has no colour. Reading it means one
                   * class works on a plain note, on a coloured note, and in either theme.
                   */
                  className="h-8 w-8 p-0 self-center hover:bg-[var(--card-hover-color)] data-[state=open]:bg-[var(--card-hover-color)]"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreVertical size={20} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="z-[60] bg-background border border-border">
                <DropdownMenuItem 
                  onClick={() => {
                    setEditingAudioUrl(a.content);
                    setEditingAudioText(a.label || '');
                  }}
                >
                  <Edit size={20} className="mr-2" />
                  {a.label ? t('editNote') : t('addNote')}
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => {
                    const currentDescription = currentAudioDescription();
                    const updatedDescription = deleteAudioAndNote(currentDescription, a.content, a.duration ?? 0);
                    
                    // ALWAYS update local state to ensure immediate UI update
                    setEditedDescription(updatedDescription);
                    const wasEditing = isEditingContent;
                    const isList = note.type === 'list';
                    
                    // Temporarily set editing mode to trigger UI update. A list keeps its own
                    // edit buffers, so it is left alone.
                    if (!wasEditing && !isList) {
                      setIsEditingContent(true);
                    }
                    
                    saveIfEditable({ description: updatedDescription });
                    
                    // Reset editing state after a brief delay to allow the save to complete
                    if (!isList) {
                      setTimeout(() => {
                        setIsEditingContent(false);
                        setEditedDescription('');
                      }, 100);
                    }
                    
                    toast.success(say('toastUpdated', 'noteViewerTitle'));
                  }}
                  className="text-destructive"
                >
                  <Trash2 size={20} className="mr-2" />
                  {t('delete')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          
          {editingAudioUrl === a.content ? (
            <div className="flex items-center gap-2">
              <Input
                value={editingAudioText}
                onChange={(e) => setEditingAudioText(e.target.value)}
                maxLength={25}
                placeholder={t('audioLabelPlaceholder')}
                className="flex-1 text-sm"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const trimmed = editingAudioText.trim();
                    if (trimmed) {
                      const currentDescription = currentAudioDescription();
                      const updatedDescription = upsertAudioNote(
                        currentDescription,
                        a.content,
                        a.duration ?? 0,
                        trimmed
                      );
                      
                      if (updatedDescription === currentDescription) {
                        toast.error(t('attachNoteFailed'));
                        return;
                      }
                      
                      if (isEditingContent) {
                        setEditedDescription(updatedDescription);
                      }
                      
                      saveIfEditable({ description: updatedDescription });
                      // Update local state so the label appears immediately
                      setEditedDescription(updatedDescription);
                      toast.success(say('toastUpdated', 'noteViewerTitle'));
                      setEditingAudioUrl(null);
                      setEditingAudioText('');
                    }
                  } else if (e.key === 'Escape') {
                    setEditingAudioUrl(null);
                    setEditingAudioText('');
                  }
                }}
              />
              <Button
                size="sm"
                onClick={() => {
                  const trimmed = editingAudioText.trim();
                  if (trimmed) {
                    const currentDescription = currentAudioDescription();
                    const updatedDescription = upsertAudioNote(
                      currentDescription,
                      a.content,
                      a.duration ?? 0,
                      trimmed
                    );
                    
                    if (updatedDescription === currentDescription) {
                      toast.error(t('attachNoteFailed'));
                      return;
                    }
                    
                    if (isEditingContent) {
                      setEditedDescription(updatedDescription);
                    }
                    
                    saveIfEditable({ description: updatedDescription });
                    // Update local state so the label appears immediately
                    setEditedDescription(updatedDescription);
                    toast.success(say('toastUpdated', 'noteViewerTitle'));
                    setEditingAudioUrl(null);
                    setEditingAudioText('');
                  }
                }}
              >
                <Save size={20} />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditingAudioUrl(null);
                  setEditingAudioText('');
                }}
              >
                <X size={20} />
              </Button>
            </div>
          ) : (
            a.label && (
              <div className="mt-1 text-sm text-muted-foreground">
                {a.label}
              </div>
            )
          )}
        </div>
        );
      })}
    </div>
  );
  
  const renderNoteContent = () => {
    switch (note.type) {
      case 'text':
        const images = isEditingContent 
          ? extractImages(editedDescription) 
          : extractImages(note.description || '');
        const audioParts = isEditingContent
          ? extractAudio(editedDescription)
          : extractAudio(note.description || '');
        const audioWithLabels = editedDescription
          ? getAudiosWithLabels(editedDescription)
          : getAudiosWithLabels(note.description || '');
        const textContent = isEditingContent 
          ? extractTextContent(editedDescription) 
          : extractTextContent(note.description || '');
        
        return (
          <div className="w-full h-full flex flex-col">
            {isEditingContent ? (
              <div className="flex flex-col space-y-3 pr-3">
                {images.length > 0 && renderImageGrid(images)}
                {audioWithLabels.length > 0 && renderAudioList(audioWithLabels)}
                <RichTextEditor
                  ref={richTextEditorRef}
                  content={textContent}
                  onChange={(newText) => { 
                    const imageMarkers = images.map(img => `[image:${img}]`).join('');
                    
                    // Preserve audio notes when updating text
                    const currentContent = editedDescription;
                    const audioNotesRegex = /\[audionote:.+?\]/g;
                    const audioNotes = currentContent.match(audioNotesRegex) || [];
                    const audioMarkers = audioParts.map(a => `[audio:${a.content}:${a.duration ?? 0}]`).join('');
                    const audioNotesStr = audioNotes.join('');
                    
                    const allMarkers = [imageMarkers, audioMarkers, audioNotesStr].filter(Boolean).join('');
                    const combined = allMarkers + newText;
                    setEditedDescription(combined);
                  }}
                  placeholder={t('startWriting')}
                  className="w-full min-h-[3rem]"
                  onFocus={() => {
                    if (!isEditingContent) {
                      setIsEditingContent(true);
                    }
                  }}
                />
              </div>
            ) : (
              <div 
                className="w-full max-w-full min-w-0 flex flex-col space-y-3 cursor-text pr-3"
                onClick={(e) => startEditingContent(e)}
              >
                {images.length > 0 && renderImageGrid(images)}
                {audioWithLabels.length > 0 && renderAudioList(audioWithLabels)}
                {textContent ? (
                  <div className="text-sm leading-relaxed">
                    {renderMarkdownWithHighlight(textContent, searchQuery)}
                  </div>
                ) : (
                  <div className="text-sm leading-relaxed text-muted-foreground min-h-[3rem] mb-0.5">
                    {t('startWriting')}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      
      case 'list':
        const items = isEditingContent ? editedItems : displayItems;
        const uncompletedItems = items.filter(item => !item.completed);
        const completedItems = items.filter(item => item.completed);
        
        // Extract media from list note description
        const listNote = note as ListNote;
        const listDescription = editedDescription || listNote.description || '';
        const listImages = listDescription ? extractImages(listDescription) : [];
        const listAudioWithLabels = listDescription ? getAudiosWithLabels(listDescription) : [];
        
        return (
          <div className="h-full flex flex-col overflow-hidden">
            {/* Render images at the top if present */}
            {listImages.length > 0 && renderImageGrid(listImages)}
            
            {/* Same audio list (player, label, and the Add note / Delete menu) as the text and
                image notes, so a recording looks and behaves the same in every note type. */}
            {listAudioWithLabels.length > 0 && <div className="mb-4">{renderAudioList(listAudioWithLabels)}</div>}
            
            <div className="min-h-0 space-y-2 flex-1 overflow-auto">
              {/* Uncompleted items */}
              {uncompletedItems.map((item) => (
                <div
                  key={item.id}
                  data-list-row={item.id}
                  className={`flex items-center gap-1 min-w-0 min-h-[2rem] ${draggingItemId === item.id ? 'rounded-md bg-hover opacity-80 shadow-sm' : ''}`}
                >
                  {!readOnly && (
                    <span
                      role="button"
                      aria-label={t('dragToReorder')}
                      onPointerDown={(e) => handleGripPointerDown(e, item.id)}
                      onPointerMove={handleGripPointerMove}
                      onPointerUp={handleGripPointerEnd}
                      onPointerCancel={handleGripPointerEnd}
                      className="flex h-8 w-6 flex-shrink-0 cursor-grab touch-none items-center justify-center text-muted-foreground active:cursor-grabbing"
                    >
                      <GripVertical size={20} />
                    </span>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    role="checkbox"
                    aria-checked={false}
                    aria-label={item.text || t('listItemPlaceholder')}
                    onClick={(e) => handleListItemToggle(item.id, e)}
                    className="h-6 w-6 p-0 flex-shrink-0"
                  >
                  </Button>
                  {isEditingContent ? (
                    <div className="flex items-center gap-2 flex-1 min-w-0 min-h-[1.75rem]">
                      <Input
                        value={item.text}
                        onChange={(e) => updateListItem(item.id, e.target.value)}
                        onKeyDown={(e) => handleListItemKeyDown(e, item.id)}
                        placeholder={t('listItemPlaceholder')}
                        data-list-item-input
                        className="text-sm flex-1 border-none shadow-none focus-visible:ring-0 p-1 bg-transparent rounded-none h-7"
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeListItem(item.id)}
                        className="h-6 w-6 p-0 flex-shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      >
                        <X size={12} />
                      </Button>
                    </div>
                  ) : (
                     <span 
                       className="text-sm leading-none break-words flex-1 min-w-0 cursor-pointer hover:bg-hover p-1 min-h-[1.75rem] flex items-center"
                       onClick={(e) => startEditingContent(e, item.id)}
                      >
                       {highlightText(item.text, searchQuery)}
                     </span>
                   )}
                 </div>
                ))}
                
                {/* Add item button - always visible, positioned between uncompleted and completed */}
                <Button
                  variant="outline"
                  onClick={isEditingContent ? addListItem : beginAddItem}
                  className="h-8 w-full justify-start text-muted-foreground hover:bg-hover flex-shrink-0"
                >
                  <Plus size={20} className="mr-2" />
                  {t('addListItem')}
                </Button>
                
                 {/* Completed items - show only if there are any */}
                 {completedItems.length > 0 && (
                  <Collapsible open={isCompletedExpanded} onOpenChange={setIsCompletedExpanded}>
                    <div className={`${uncompletedItems.length > 0 ? 'border-t border-border/50 pt-3 mt-4' : 'pt-3 mt-2'}`}>
                      <CollapsibleTrigger asChild>
                        <Button
                          variant="ghost"
                          className="h-auto p-0 justify-start text-xs text-muted-foreground font-medium hover:text-foreground"
                        >
                          <ChevronDown 
                            size={12} 
                            className={`mr-1 transition-transform ${isCompletedExpanded ? 'rotate-0' : '-rotate-90'}`}
                          />
                          {countedSentence(t, language, 'checkedItems', completedItems.length)}
                        </Button>
                      </CollapsibleTrigger>
                    </div>
                    <CollapsibleContent className="space-y-2 mt-3">
                      {completedItems.map((item) => (
                        <div key={item.id} className="flex items-center gap-3 min-w-0">
                          <Button
                            size="sm"
                            variant="default"
                            role="checkbox"
                            aria-checked={true}
                            aria-label={item.text || t('listItemPlaceholder')}
                            onClick={(e) => handleListItemToggle(item.id, e)}
                            className="h-6 w-6 p-0 flex-shrink-0"
                          >
                            <Check size={12} />
                          </Button>
                          {isEditingContent ? (
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <Input
                                value={item.text}
                                onChange={(e) => updateListItem(item.id, e.target.value)}
                                onKeyDown={(e) => handleListItemKeyDown(e, item.id)}
                                placeholder={t('listItemPlaceholder')}
                        data-list-item-input
                                className="text-sm flex-1 border-none shadow-none focus-visible:ring-0 p-1 bg-transparent rounded-none line-through text-muted-foreground"
                              />
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => removeListItem(item.id)}
                                className="h-6 w-6 p-0 flex-shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                              >
                                <X size={12} />
                              </Button>
                            </div>
                          ) : (
                             <span 
                               className="text-sm leading-none line-through text-muted-foreground break-words flex-1 min-w-0 cursor-pointer hover:bg-hover p-1 flex items-center"
                               onClick={(e) => startEditingContent(e, item.id)}
                             >
                              {highlightText(item.text, searchQuery)}
                            </span>
                          )}
                        </div>
                      ))}
                    </CollapsibleContent>
                  </Collapsible>
                )}
               
            </div>
          </div>
        );
      
      case 'audio':
        const audioImages = isEditingContent 
          ? extractImages(editedDescription) 
          : extractImages(note.description || '');
        const audioAudioParts = isEditingContent
          ? extractAudio(editedDescription)
          : extractAudio(note.description || '');
        const audioWithLabelsAudio = isEditingContent
          ? getAudiosWithLabels(editedDescription)
          : getAudiosWithLabels(note.description || '');
        const audioTextContent = isEditingContent 
          ? extractTextContent(editedDescription) 
          : extractTextContent(note.description || '');
        
        return (
          <div className="h-full flex flex-col">
            <div className="mb-4">
              {/* Shared player, matching the audio-note card. */}
              <AudioPlayer
                hasColor={!isDefaultColor(note.color)}
                audioUrl={note.audioUrl!}
                initialDuration={note.duration ?? 0}
                showSeeker
                showSpeedControl
                onEnded={() => {}}
              />
            </div>
            
            {isEditingContent ? (
              <div className="flex flex-col space-y-3 pr-3">
                {audioImages.length > 0 && renderImageGrid(audioImages)}
                {audioWithLabelsAudio.length > 0 && renderAudioList(audioWithLabelsAudio)}
                <RichTextEditor
                  ref={richTextEditorRef}
                  content={audioTextContent}
                  onChange={(newText) => { 
                    // Re-parse from current editedDescription to avoid stale closures
                    const currentImages = extractImages(editedDescription);
                    const currentAudios = extractAudio(editedDescription);
                    const currentContent = editedDescription;
                    
                    const imageMarkers = currentImages.map(img => `[image:${img}]`).join('');
                    const audioNotesRegex = /\[audionote:.+?\]/g;
                    const audioNotes = currentContent.match(audioNotesRegex) || [];
                    const audioMarkers = currentAudios.map(a => `[audio:${a.content}:${a.duration ?? 0}]`).join('');
                    const audioNotesStr = audioNotes.join('');
                    
                    const allMarkers = [imageMarkers, audioMarkers, audioNotesStr].filter(Boolean).join('');
                    const combined = allMarkers + newText;
                    setEditedDescription(combined);
                  }}
                  placeholder={t('startWriting')}
                  className="w-full min-h-[3rem]"
                  onFocus={() => {
                    if (!isEditingContent) {
                      setIsEditingContent(true);
                    }
                  }}
                />
              </div>
            ) : (
              <div 
                className="w-full max-w-full min-w-0 flex flex-col space-y-3 cursor-text pr-3"
                onClick={(e) => startEditingContent(e)}
              >
                {audioImages.length > 0 && renderImageGrid(audioImages)}
                {audioWithLabelsAudio.length > 0 && renderAudioList(audioWithLabelsAudio)}
                {audioTextContent ? (
                  <div className="text-sm leading-relaxed">
                    {renderMarkdownWithHighlight(audioTextContent, searchQuery)}
                  </div>
                ) : (
                  <div className="text-sm leading-relaxed text-muted-foreground min-h-[3rem] mb-0.5">
                    {t('startWriting')}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      
      case 'image':
        const imageNoteImages = isEditingContent 
          ? extractImages(editedDescription) 
          : extractImages(note.description || '');
        const imageNoteAudioParts = isEditingContent
          ? extractAudio(editedDescription)
          : extractAudio(note.description || '');
        const imageWithLabelsAudio = isEditingContent
          ? getAudiosWithLabels(editedDescription)
          : getAudiosWithLabels(note.description || '');
        const imageTextContent = isEditingContent 
          ? extractTextContent(editedDescription) 
          : extractTextContent(note.description || '');
        
        // Combine the main image with embedded images
        const allImages = [note.imageUrl, ...imageNoteImages];
        
        return (
          <div className="h-full flex flex-col">
            {/* Main image - show even when editing */}
            {allImages.length > 0 && <div className="mb-4 pr-3">{renderImageGrid(allImages)}</div>}
            
            {isEditingContent ? (
              <div className="flex flex-col space-y-3 pr-3">
                {imageWithLabelsAudio.length > 0 && renderAudioList(imageWithLabelsAudio)}
                <RichTextEditor
                  ref={richTextEditorRef}
                  content={imageTextContent}
                  onChange={(newText) => { 
                    // Re-parse from current editedDescription to avoid stale closures
                    const currentImages = extractImages(editedDescription);
                    const currentAudios = extractAudio(editedDescription);
                    const currentContent = editedDescription;
                    
                    const imageMarkers = currentImages.map(img => `[image:${img}]`).join('');
                    const audioNotesRegex = /\[audionote:.+?\]/g;
                    const audioNotes = currentContent.match(audioNotesRegex) || [];
                    const audioMarkers = currentAudios.map(a => `[audio:${a.content}:${a.duration ?? 0}]`).join('');
                    const audioNotesStr = audioNotes.join('');
                    
                    const allMarkers = [imageMarkers, audioMarkers, audioNotesStr].filter(Boolean).join('');
                    const combined = allMarkers + newText;
                    setEditedDescription(combined);
                  }}
                  placeholder={t('startWriting')}
                  className="w-full min-h-[3rem]"
                  onFocus={() => {
                    if (!isEditingContent) {
                      setIsEditingContent(true);
                    }
                  }}
                />
              </div>
            ) : (
              <div 
                className="w-full max-w-full min-w-0 flex flex-col space-y-3 cursor-text pr-3"
                onClick={(e) => startEditingContent(e)}
              >
                {imageWithLabelsAudio.length > 0 && renderAudioList(imageWithLabelsAudio)}
                {imageTextContent ? (
                  <div className="text-sm leading-relaxed">
                    {renderMarkdownWithHighlight(imageTextContent, searchQuery)}
                  </div>
                ) : (
                  <div className="text-sm leading-relaxed text-muted-foreground min-h-[3rem] mb-0.5">
                    {t('startWriting')}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      
      default:
        return null;
    }
  };

  // Used by both the Gallery and the Camera input.
  const handleImagePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
          const file = e.target.files?.[0];
          if (file) {
            readImageForStorage(file).then((imageUrl) => {
              // Add image to note description
              const imageMarker = `[image:${imageUrl}]`;
              if (note.type === 'text' || note.type === 'audio' || note.type === 'image') {
                const currentDesc = isEditingContent ? editedDescription : (note.description || '');
                const newDesc = currentDesc ? `${currentDesc}\n${imageMarker}` : imageMarker;
                setEditedDescription(newDesc);
                if (!isEditingContent) {
                  setIsEditingContent(true);
                }
                
                // Focus the textarea after adding image
                setTimeout(() => {
                  if (textareaRef.current) {
                    textareaRef.current.focus();
                  }
                }, 100);
              }
            });
          }
          e.target.value = '';
        }

  // Use standardized color helpers for consistent styling
  const hasColor = !isDefaultColor(note.color);
  const iconButtonStyles = getColoredIconButtonStyles(hasColor);
  const iconColorClass = getColoredIconClass(hasColor);
  const borderClass = getColoredBorderClass(hasColor, 20);
  
  /*
   * Hover for the header buttons (search, close, ⋮) on an uncoloured note: the shared
   * --hover veil, so the button tints and the ICON KEEPS ITS COLOUR. The old intent here
   * was a black pill with white icons, which is why the menu icon carried an explicit
   * `group-hover:text-white`; that flipped the dots to white on a light background and
   * made them look like they had vanished. On a coloured note the tint is derived from
   * the note colour instead.
   */
  const themedHoverStyles = hasColor 
    ? iconButtonStyles.className 
    : 'hover:bg-hover';
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent 
        hideCloseButton 
        className={`fixed inset-0 w-full max-w-none h-full max-h-none m-0 !rounded-none flex flex-col p-0 border-0 translate-x-0 translate-y-0 left-0 top-0 data-[state=open]:animate-hero-expand data-[state=closed]:animate-hero-collapse ${
          hasColor ? 'text-[#000000] [&_.text-muted-foreground]:text-[#000000]/70 [&_.text-foreground]:text-[#000000]' : ''
        }`}
        // `--card-hover-color` is set here for the same reason ColoredCard sets it:
        // the action menu (⋮) inside styles its hover with that variable. Without it the
        // variable was undefined on this dialog and the button hovered to no colour at
        // all, unlike every card, which tints a shade lighter than the card itself.
        //
        // An uncoloured note reads the page background, not `--card`. `--card` is pure
        // white, which made the whole note body a bright cold sheet while the action bar
        // at the bottom (a translucent wash over it) came out visibly greyer — the bar
        // looked wrong but the body was the thing out of step.
        style={{
          // Opaque: the same tint as before, laid over the page background instead of over
          // whatever is behind the dialog. Translucent and blurred, it showed smudges of the
          // cards behind a coloured note, which stood out in the dark theme.
          backgroundColor: 'hsl(var(--background))',
          ...(hasColor
            ? { backgroundImage: `linear-gradient(${hexToRgba(note.color, 0.75)}, ${hexToRgba(note.color, 0.75)})` }
            : {}),
          ...(keyboardViewport
            ? { height: keyboardViewport.height, maxHeight: keyboardViewport.height, top: keyboardViewport.top, bottom: 'auto' }
            : {}),
          ...(hasColor
            ? ({ '--card-hover-color': getLighterColor(note.color) } as React.CSSProperties)
            : {}),
        }}
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => {
          // Radix only calls this when the viewer is the top layer, so open menus and dialogs
          // inside it close first. Our own popups are not Radix layers: the keydown handler
          // above closes those, one per press. Fields with their own Esc (title, search,
          // audio label) cancel first; a second Esc then closes the note, saving it.
          e.preventDefault();
          if (showFormattingBar || isSearching || galleryOpen || showAudioRecorder || showImageCapturePopup || editingAudioUrl) return;
          const active = document.activeElement;
          if (active instanceof HTMLInputElement) return;
          handleBackClick();
        }}
      >
        <DialogHeader className={`flex-row items-center justify-between space-y-0 border-b px-3 flex-shrink-0 h-14 ${borderClass}`}>
          <DialogTitle className="sr-only" id="note-viewer-title">{t('noteViewerTitle')}</DialogTitle>
          <DialogDescription className="sr-only">{t('noteViewerSubtitle')}</DialogDescription>
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <Button
              aria-label={t('back')}
                  variant={iconButtonStyles.variant}
                  size="sm"
                  onClick={handleBackClick}
                  className={`h-9 w-9 p-0 [&_svg]:!size-6 flex-shrink-0 rounded-full transition-colors duration-200 ${themedHoverStyles}`}
                >
              <ArrowLeft size={20} />
            </Button>
            {/* Save button for list notes when editing */}
            {isEditingContent && note.type === 'list' && (
              <Button
                aria-label={t('save')}
                variant="ghost"
                size="sm"
                onClick={() => {
                  saveContent();
                }}
                className="h-9 w-9 p-0 [&_svg]:!size-6 flex-shrink-0 hover:bg-hover rounded-full bg-primary/10"
              >
                <Check size={20} className="text-primary" />
              </Button>
            )}
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Button
                aria-label={t('search')}
                aria-pressed={isSearching}
                variant={iconButtonStyles.variant}
                size="sm"
                onClick={handleSearchToggle}
                // While searching the button is filled, like the open buttons of the action
                // bar, so it is clear that tapping it again switches the search off.
                className={`h-9 w-9 p-0 [&_svg]:!size-6 flex-shrink-0 rounded-full transition-colors duration-200 ${isSearching ? 'bg-black text-white hover:bg-black' : themedHoverStyles}`}
              >
                <Search size={20} />
              </Button>
              {isSearching ? (
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <Input
                    ref={searchInputRef}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t('searchInNote')}
                    className="text-sm h-8 px-2 border-none shadow-none focus-visible:ring-0 bg-transparent rounded-none flex-1 min-w-0"
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        handleSearchToggle();
                      }
                    }}
                  />
                  {searchQuery && (
                    <Button
                      variant={iconButtonStyles.variant}
                      size="sm"
                      onClick={() => setSearchQuery('')}
                      className={`h-6 w-6 p-0 flex-shrink-0 rounded-full ${iconButtonStyles.className}`}
                    >
                      <X size={12} />
                    </Button>
                  )}
                </div>
              ) : isEditingTitle ? (
                <Input
                  ref={titleInputRef}
                  maxLength={35}
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  onBlur={saveTitle}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      saveTitle();
                    }
                  }}
                  className="text-lg md:text-lg font-medium py-1 px-2 border-none shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent rounded-full"
                />
              ) : (
              /*
               * The title doubles as the control that edits it, and when a note has no
               * title yet it renders nothing at all — an invisible hit area with no hint
               * that a title can be given. It used to look filled in only because new
               * notes were seeded with the literal word "Title", which put a bogus value
               * in the data and had to be special-cased out of the cards. The prompt
               * below is display-only, so the field stays genuinely empty until typed in.
               *
               * The pencil is always present for an untitled note rather than appearing
               * on hover: there is no hover on a touch screen, and that is where the
               * prompt is needed most.
               */
              <DialogTitle
                  className={`group flex items-center gap-1.5 text-lg font-medium truncate px-2 py-1 rounded-full ${readOnly ? '' : 'cursor-pointer'} ${hasColor ? iconButtonStyles.className : readOnly ? '' : 'hover:bg-hover hover:text-foreground'}`}
                  onClick={readOnly ? undefined : startEditingTitle}
                >
                  {note.name ? (
                    highlightText(note.name, searchQuery)
                  ) : readOnly ? (
                    // No "Add a title" prompt on an archived note: it would invite a write that
                    // cannot happen.
                    <span className="text-muted-foreground/70 italic font-normal">{t('untitledItem')}</span>
                  ) : (
                    <>
                      <span className="text-muted-foreground/70 italic font-normal">{t('addTitle')}</span>
                      <Edit size={20} className="flex-shrink-0 text-muted-foreground/50" />
                    </>
                  )}
                </DialogTitle>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* The same status icons as the note's card, in the same order: folder, then pin. */}
              {isFiled && <FolderOpen size={24} className={iconColorClass} />}
              {note.pinned && !note.archived && <Pin size={24} className={iconColorClass} />}
              {note.locked && <Lock size={20} className={iconColorClass} />}
            </div>
          </div>
          {/*
            * Says why nothing here can be typed into. Without it an archived note simply ignores
            * taps, which reads as the app being broken rather than as the note being locked.
            */}
          {readOnly && (
            <p className="px-2 pb-1 text-xs text-muted-foreground">{t('archivedReadOnly')}</p>
          )}
          <div className="flex items-center gap-2 flex-shrink-0">
            <ItemActionMenu
              large
              isPinned={note.pinned}
              isArchived={note.archived}
              isDeleted={false}
              isLocked={note.locked}
              onPin={onPin ? () => onPin(note.id) : undefined}
              onUnpin={onUnpin ? () => onUnpin(note.id) : undefined}
              onEdit={readOnly ? undefined : () => setIsColorEditorOpen(true)}
              onArchive={onArchive ? () => onArchive(note.id) : undefined}
              onDelete={onDelete ? () => onDelete(note.id) : undefined}
              onRestore={onUnarchive ? () => onUnarchive(note.id) : undefined}
              onLock={onLock ? () => onLock(note.id) : undefined}
              onUnlock={onUnlock ? () => onUnlock(note.id) : undefined}
              onShare={onShare ? () => onShare(note.id) : undefined}
              onCopy={onCopy ? () => onCopy(note.id) : undefined}
              onMoveToFolder={onMoveToFolder ? () => onMoveToFolder(note.id) : undefined}
              size="md"
              hoverClass={themedHoverStyles}
              iconColorClass={hasColor ? 'text-[#000000]' : 'text-foreground'}
            />
            <Button
              variant={iconButtonStyles.variant}
              size="sm"
              aria-label={t('close')}
                  onClick={handleCloseClick}
              className={`h-9 w-9 p-0 [&_svg]:!size-6 rounded-full transition-colors duration-200 ${themedHoverStyles}`}
            >
              <X size={20} />
            </Button>
          </div>
        </DialogHeader>
        
        <ScrollArea ref={scrollAreaRootRef} className="flex-1 h-full w-full" scrollbarClassName={hasColor ? 'bg-black/30' : 'bg-foreground/20'} style={{ overflowAnchor: 'none' }}>
          <div className="h-full w-full box-border py-3 px-3 flex flex-col items-stretch max-w-full space-y-3" style={{ overflowAnchor: 'none' }}>
            {renderNoteContent()}
            {note.reminder && (
              <div className="pt-1">
                <ReminderChip
                  reminder={note.reminder}
                  onEdit={readOnly ? undefined : () => setShowReminderDialog(true)}
                  onRemove={readOnly ? undefined : () => saveReminder(undefined)}
                />
              </div>
            )}
          </div>
        </ScrollArea>
        
        {/*
          * The dock holds nothing but ways to change the note — add a photo, a recording, a
          * tick box, tags, a reminder, formatting — so an archived note does not show it at
          * all. Restore and delete stay available in the header menu.
          */}
        {!readOnly && (
        <div className={`flex-shrink-0 border-t ${borderClass}`}>
          {/* Text Formatting Bar - only for text/audio/image notes when editing */}
          {note.type !== 'list' && isEditingContent && showFormattingBar && (
            <TextFormattingBar 
              onFormat={applyFormatting} 
              onClose={() => setShowFormattingBar(false)}
              editor={richTextEditorRef.current?.editor || null}
              noteColor={note.color}
            />
          )}
          <NoteActionBar
            note={note}
            onSave={(noteId, updates) => saveIfEditable(updates, noteId)}
            onRemindMe={() => {
              (document.activeElement as HTMLElement)?.blur();
              setShowReminderDialog(true);
            }}
            hasReminder={!!note.reminder}
            onTakePhoto={() => {
              // Blur any focused button to prevent space key from triggering it
              (document.activeElement as HTMLElement)?.blur();
              // Straight to the camera: the chooser it used to open duplicated "Add image".
              cameraInputRef.current?.click();
            }}
            onAddImage={() => {
              // Blur any focused button to prevent space key from triggering it
              (document.activeElement as HTMLElement)?.blur();
              if (galleryInputRef.current) {
                galleryInputRef.current.click();
              }
            }}
            onStartRecording={() => {
              // Blur any focused button to prevent space key from triggering it
              (document.activeElement as HTMLElement)?.blur();
              setShowAudioRecorder(true);
            }}
            onAddTickBoxes={() => {
              if (!note) return;
            
            // Case 1: Note is already a list → Convert BACK to text
            if (note.type === 'list') {
              const listNote = note as ListNote;
              
              if (!listNote.items || listNote.items.length === 0) {
                toast.error(t('listHasNoItems'));
                return;
              }
              
              // Reconstruct text from list items
              const textLines = listNote.items.map(item => item.text).join('\n');
              
              // Merge with existing media content if present
              let finalDescription = textLines;
              if (listNote.description && listNote.description.trim()) {
                // Append text to existing media content
                finalDescription = listNote.description + '\n' + textLines;
              }
              
              // Convert back to text note
              const updatedNote: TextNote = {
                ...note,
                type: 'text',
                description: finalDescription
              };
              
              // Remove list-specific properties
              delete (updatedNote as any).items;
              
              // Leave list editing and show the text at once. Without this the viewer kept its
              // (empty) edit buffers and showed a blank note until the next press.
              setIsEditingContent(false);
              setEditedDescription(finalDescription);
              if (onSave) {
                saveIfEditable(updatedNote);
                toast.success(say('toastUpdated', 'noteViewerTitle'));
              }
              return;
            }
            
            // Case 2: Note is text/audio/image → Convert TO list
            const currentContent = isEditingContent ? editedDescription : 
              (note.type === 'text' ? note.description : note.description || '');
            
            // Parse to separate media from text
            const parts = parseNoteContent(currentContent);
            const textParts = parts.filter(p => p.type === 'text');
            const mediaParts = parts.filter(p => p.type === 'image' || p.type === 'audio');
            const textContent = textParts.map(p => p.content).join('\n');
            
            // Split into lines and filter empties
            const lines = textContent.split('\n')
              // The text is stored as markdown: a list item should be the plain words.
              .map(line => line.replace(/^#{1,6}\s+/, '').replace(/\*\*|__|\*/g, '').trim())
              .filter(line => line.length > 0);
            
            if (lines.length === 0) {
              toast.error(t('noTextToConvert'));
              return;
            }
            
            // Create list items
            const listItems = lines.map(text => ({
              id: crypto.randomUUID(),
              text,
              completed: false
            }));
            
            // Reconstruct media content (preserve images and audio)
            let mediaDescription = '';
            mediaParts.forEach(part => {
              if (part.type === 'image') {
                mediaDescription += `[image:${part.content}]\n`;
              } else if (part.type === 'audio') {
                mediaDescription += `[audio:${part.content}:${part.duration}]\n`;
              }
            });
            
            // Convert note to list type
            const updatedNote: any = {
              ...note,
              type: 'list',
              items: listItems,
              description: mediaDescription.trim() || undefined
            };
            
            // Remove old type-specific properties
            delete updatedNote.audioUrl;
            delete updatedNote.duration;
            delete updatedNote.imageUrl;
            
            // Show the new list at once. The viewer reads its edit buffers while it is in
            // edit mode, and those were empty, so the converted note looked blank.
            setEditedItems(listItems);
            setDisplayItems(listItems);
            setIsEditingContent(false);
            setEditedDescription(mediaDescription.trim());
            if (onSave) {
              saveIfEditable(updatedNote);
              toast.success(countedSentence(t, language, 'toastItemCount', lines.length));
            }
          }}
            onToggleFormatting={() => {
              // Blur the button to prevent focus/scroll issues. When already editing the
              // editor keeps focus (the button does not take it on press), so the keyboard
              // stays as it was; when not editing, edit mode starts without focusing.
              if (!isEditingContent) {
                (document.activeElement as HTMLElement)?.blur();
                skipEditFocusRef.current = true;
              }
              
              // Capture scroll position before toggle
              const viewport = getScrollViewport();
              if (viewport) {
                pendingScrollRestoreRef.current = viewport.scrollTop;
              }
              
              // If not editing, enter edit mode first
              if (!isEditingContent) {
                if (note.type === 'text') {
                  setEditedDescription(note.description || '');
                } else if (note.type === 'audio' || note.type === 'image') {
                  setEditedDescription(note.description || '');
                }
                setIsEditingContent(true);
              }
              // Toggle formatting bar
              setShowFormattingBar(!showFormattingBar);
            }}
            showFormattingBar={isEditingContent && showFormattingBar}
            isTextNote={note.type !== 'list'}
          />
        </div>
        )}

        {/* Popups inside DialogContent to prevent closing the note */}
        <AudioRecorderPopup
          isOpen={showAudioRecorder}
          onClose={() => setShowAudioRecorder(false)}
          onRecordingComplete={(audioUrl, duration) => {
            // Add audio to note description with proper ordering
            const audioMarker = `[audio:${audioUrl}:${duration}]`;
            if (note && (note.type === 'text' || note.type === 'audio' || note.type === 'image' || note.type === 'list')) {
              // Capture current scroll position before making changes
              const ta = textareaRef.current;
              const viewport = ta?.closest('[data-radix-scroll-area-viewport]') as HTMLElement | null;
              const scrollTop = viewport?.scrollTop ?? 0;
              const scrollLeft = viewport?.scrollLeft ?? 0;
              
              const currentDesc = currentAudioDescription();
              const newDesc = insertContentInOrder(currentDesc, audioMarker, 'audio');
              setEditedDescription(newDesc);
              
              // Save the audio to the note immediately
              saveIfEditable({ description: newDesc });
              
              if (!isEditingContent) {
                setIsEditingContent(true);
              }
              
              // Restore scroll position after adding audio
              setTimeout(() => {
                if (viewport) {
                  viewport.scrollTop = scrollTop;
                  viewport.scrollLeft = scrollLeft;
                }
                if (ta) {
                  ta.focus({ preventScroll: true });
                }
              }, 100);
            }
            setShowAudioRecorder(false);
          }}
        />

        <ReminderDialog
          isOpen={showReminderDialog}
          onClose={() => setShowReminderDialog(false)}
          reminder={note.reminder}
          onSave={(reminder) => void saveReminder(reminder)}
        />

        <ImageCapturePopup
          isOpen={showImageCapturePopup}
          onClose={() => setShowImageCapturePopup(false)}
          onImageSelect={(imageUrl) => {
            // Add image to note description with proper ordering
            const imageMarker = `[image:${imageUrl}]`;
            if (note && (note.type === 'text' || note.type === 'audio' || note.type === 'image' || note.type === 'list')) {
              const currentDesc = isEditingContent ? editedDescription : (note.description || '');
              const newDesc = insertContentInOrder(currentDesc, imageMarker, 'image');
              setEditedDescription(newDesc);
              
              // Save the image to the note immediately
              saveIfEditable({ description: newDesc });
              
              if (!isEditingContent) {
                setIsEditingContent(true);
              }
              
              // Focus the textarea after adding image
              setTimeout(() => {
                if (textareaRef.current) {
                  textareaRef.current.focus();
                }
              }, 100);
            }
            setShowImageCapturePopup(false);
          }}
        />
      </DialogContent>

      <NoteEditor
        note={note}
        isOpen={isColorEditorOpen}
        onClose={() => setIsColorEditorOpen(false)}
        onSave={(noteId, updates) => saveIfEditable(updates, noteId)}
      />

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleImagePicked}
        className="hidden"
      />

      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        onChange={handleImagePicked}
        className="hidden"
      />


      <ImageGalleryViewer
        images={
          note.type === 'image'
            ? [note.imageUrl, ...extractImages(isEditingContent ? editedDescription : (note.description || ''))]
            : (note.type === 'text' || note.type === 'audio' || note.type === 'list')
            ? extractImages(isEditingContent ? editedDescription : (note.description || ''))
            : []
        }
        initialIndex={galleryStartIndex}
        isOpen={galleryOpen}
        onClose={() => setGalleryOpen(false)}
        onCopy={handleCopyImageUrl}
        onShare={handleShareImage}
        onDelete={handleDeleteImage}
      />

    </Dialog>
  );
}
