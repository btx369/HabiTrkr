import { Note } from '@/types/note';
import { Event } from '@/types/event';
import { NoteFolder } from '@/types/noteFolder';
import { EventFolder } from '@/types/eventFolder';

/**
 * Check if a note should be auto-imported into any folders
 * Returns array of folder IDs that should contain this note
 */
export function checkNoteAutoImport(note: Note, folders: NoteFolder[]): string[] {
  if (!note.tags || note.tags.length === 0) return [];
  
  const folderIds: string[] = [];
  
  for (const folder of folders) {
    if (!folder.autoImportEnabled || !folder.autoImportTags || folder.autoImportTags.length === 0) {
      continue;
    }
    
    // Check if note has any of the folder's auto-import tags
    const hasMatchingTag = note.tags.some(noteTag => 
      folder.autoImportTags!.includes(noteTag.toLowerCase())
    );
    
    if (hasMatchingTag && !folder.noteIds.includes(note.id)) {
      folderIds.push(folder.id);
    }
  }
  
  return folderIds;
}

/**
 * Check if an event should be auto-imported into any event folders
 * Returns array of folder IDs that should contain this event
 */
export function checkEventAutoImport(event: Event, eventFolders: EventFolder[]): string[] {
  if (!event.tags || event.tags.length === 0) return [];
  
  const folderIds: string[] = [];
  
  for (const folder of eventFolders) {
    if (!folder.autoImportEnabled || !folder.autoImportTags || folder.autoImportTags.length === 0) {
      continue;
    }
    
    // Check if event has any of the folder's auto-import tags
    const hasMatchingTag = event.tags.some(eventTag => 
      folder.autoImportTags!.includes(eventTag.toLowerCase())
    );
    
    if (hasMatchingTag && !folder.eventIds.includes(event.id)) {
      folderIds.push(folder.id);
    }
  }
  
  return folderIds;
}

/**
 * Auto-import note into matching folders
 * Returns updated folders array
 */
export function autoImportNoteToFolders(note: Note, folders: NoteFolder[]): NoteFolder[] {
  const folderIdsToUpdate = checkNoteAutoImport(note, folders);
  
  if (folderIdsToUpdate.length === 0) return folders;
  
  return folders.map(folder => {
    if (folderIdsToUpdate.includes(folder.id)) {
      return {
        ...folder,
        noteIds: [...folder.noteIds, note.id]
      };
    }
    return folder;
  });
}

/**
 * Auto-import event into matching folders
 * Returns updated event folders array
 */
export function autoImportEventToFolders(event: Event, eventFolders: EventFolder[]): EventFolder[] {
  const folderIdsToUpdate = checkEventAutoImport(event, eventFolders);
  
  if (folderIdsToUpdate.length === 0) return eventFolders;
  
  return eventFolders.map(folder => {
    if (folderIdsToUpdate.includes(folder.id)) {
      return {
        ...folder,
        eventIds: [...folder.eventIds, event.id]
      };
    }
    return folder;
  });
}
