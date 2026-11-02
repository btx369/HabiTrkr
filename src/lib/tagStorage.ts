/**
 * Global tag storage and tracking
 * Stores all tags with usage frequency in localStorage
 */

const TAGS_STORAGE_KEY = 'allTags';

export interface TagUsage {
  [tag: string]: number; // tag -> usage count
}

/**
 * Get all tags sorted by frequency (most used first)
 */
export function getAllTags(): string[] {
  try {
    const stored = localStorage.getItem(TAGS_STORAGE_KEY);
    if (!stored) return [];
    
    const tagUsage: TagUsage = JSON.parse(stored);
    return Object.entries(tagUsage)
      .sort((a, b) => b[1] - a[1]) // Sort by count descending
      .map(([tag]) => tag);
  } catch (error) {
    console.error('Error getting all tags:', error);
    return [];
  }
}

/**
 * Get all tags with their usage counts
 */
export function getAllTagsWithCounts(): { tag: string; count: number }[] {
  try {
    const stored = localStorage.getItem(TAGS_STORAGE_KEY);
    if (!stored) return [];
    
    const tagUsage: TagUsage = JSON.parse(stored);
    return Object.entries(tagUsage)
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count); // Sort by count descending
  } catch (error) {
    console.error('Error getting all tags with counts:', error);
    return [];
  }
}

/**
 * Get top N most used tags
 */
export function getTopTags(limit: number): string[] {
  const allTags = getAllTags();
  return allTags.slice(0, limit);
}

/**
 * Increment usage count for a tag
 */
export function incrementTagUsage(tag: string): void {
  try {
    const stored = localStorage.getItem(TAGS_STORAGE_KEY);
    const tagUsage: TagUsage = stored ? JSON.parse(stored) : {};
    
    const normalizedTag = tag.toLowerCase();
    tagUsage[normalizedTag] = (tagUsage[normalizedTag] || 0) + 1;
    
    localStorage.setItem(TAGS_STORAGE_KEY, JSON.stringify(tagUsage));
  } catch (error) {
    console.error('Error incrementing tag usage:', error);
  }
}

/**
 * Decrement usage count for a tag
 */
export function decrementTagUsage(tag: string): void {
  try {
    const stored = localStorage.getItem(TAGS_STORAGE_KEY);
    if (!stored) return;
    
    const tagUsage: TagUsage = JSON.parse(stored);
    const normalizedTag = tag.toLowerCase();
    
    if (tagUsage[normalizedTag]) {
      tagUsage[normalizedTag] = Math.max(0, tagUsage[normalizedTag] - 1);
      
      // Remove tag if count reaches 0
      if (tagUsage[normalizedTag] === 0) {
        delete tagUsage[normalizedTag];
      }
      
      localStorage.setItem(TAGS_STORAGE_KEY, JSON.stringify(tagUsage));
    }
  } catch (error) {
    console.error('Error decrementing tag usage:', error);
  }
}

/**
 * Update tag usage when tags change (add/remove)
 */
export function updateTagUsage(oldTags: string[] = [], newTags: string[] = []): void {
  // Find added and removed tags
  const added = newTags.filter(tag => !oldTags.includes(tag));
  const removed = oldTags.filter(tag => !newTags.includes(tag));
  
  // Increment for added tags
  added.forEach(tag => incrementTagUsage(tag));
  
  // Decrement for removed tags
  removed.forEach(tag => decrementTagUsage(tag));
}

/** Collections whose items carry a `tags` list. */
const TAGGED_COLLECTIONS = ['notes', 'archivedNotes', 'events', 'archivedEvents'];
/** Folder lists whose auto-import rules name tags. */
const FOLDER_COLLECTIONS = ['folders', 'archivedFolders', 'eventFolders', 'archivedEventFolders'];

/**
 * Applies `change` to every tag list the app stores: item tags and folder auto-import
 * rules. The rules used to be skipped, so renaming or deleting a tag left folders
 * waiting for a tag that no longer existed and they silently stopped auto-importing.
 * Duplicates are dropped, so renaming #work to an existing #job leaves one #job.
 */
function rewriteAllTags(change: (tags: string[]) => string[]): void {
  const dedupe = (tags: string[]) => [...new Set(change(tags))];
  const rewrite = (key: string, field: 'tags' | 'autoImportTags') => {
    const stored = localStorage.getItem(key);
    if (!stored) return;
    const items: Array<Record<string, unknown>> = JSON.parse(stored);
    const updated = items.map(item =>
      Array.isArray(item[field]) ? { ...item, [field]: dedupe(item[field] as string[]) } : item
    );
    localStorage.setItem(key, JSON.stringify(updated));
  };
  TAGGED_COLLECTIONS.forEach(key => rewrite(key, 'tags'));
  FOLDER_COLLECTIONS.forEach(key => rewrite(key, 'autoImportTags'));
}

/**
 * Rename a tag globally across all notes, events and folder auto-import rules
 */
export function renameTagGlobally(oldTag: string, newTag: string): void {
  try {
    const normalizedOld = oldTag.toLowerCase();
    const normalizedNew = newTag.toLowerCase();
    
    if (normalizedOld === normalizedNew) return;

    rewriteAllTags(tags => tags.map(t => t.toLowerCase() === normalizedOld ? normalizedNew : t));

    // Update allTags storage
    const tagsStored = localStorage.getItem(TAGS_STORAGE_KEY);
    if (tagsStored) {
      const tagUsage: TagUsage = JSON.parse(tagsStored);
      if (tagUsage[normalizedOld]) {
        const oldCount = tagUsage[normalizedOld];
        delete tagUsage[normalizedOld];
        tagUsage[normalizedNew] = (tagUsage[normalizedNew] || 0) + oldCount;
        localStorage.setItem(TAGS_STORAGE_KEY, JSON.stringify(tagUsage));
      }
    }
  } catch (error) {
    console.error('Error renaming tag globally:', error);
  }
}

/**
 * Delete a tag globally from all notes, events and folder auto-import rules
 */
export function deleteTagGlobally(tag: string): void {
  try {
    const normalizedTag = tag.toLowerCase();

    rewriteAllTags(tags => tags.filter(t => t.toLowerCase() !== normalizedTag));

    // Remove from allTags storage
    const tagsStored = localStorage.getItem(TAGS_STORAGE_KEY);
    if (tagsStored) {
      const tagUsage: TagUsage = JSON.parse(tagsStored);
      delete tagUsage[normalizedTag];
      localStorage.setItem(TAGS_STORAGE_KEY, JSON.stringify(tagUsage));
    }
  } catch (error) {
    console.error('Error deleting tag globally:', error);
  }
}

/**
 * Get all tags currently in use from notes and events in localStorage
 */
export function getActiveTagsFromStorage(): string[] {
  try {
    const activeTags = new Set<string>();
    
    // Get tags from notes
    const notesStored = localStorage.getItem('notes');
    if (notesStored) {
      const notes = JSON.parse(notesStored);
      if (Array.isArray(notes)) {
        notes.forEach((note: { tags?: string[] }) => {
          if (note.tags && Array.isArray(note.tags)) {
            note.tags.forEach(tag => activeTags.add(tag.toLowerCase()));
          }
        });
      }
    }
    
    // Get tags from events
    const eventsStored = localStorage.getItem('events');
    if (eventsStored) {
      const events = JSON.parse(eventsStored);
      if (Array.isArray(events)) {
        events.forEach((event: { tags?: string[] }) => {
          if (event.tags && Array.isArray(event.tags)) {
            event.tags.forEach(tag => activeTags.add(tag.toLowerCase()));
          }
        });
      }
    }
    
    return Array.from(activeTags).sort();
  } catch (error) {
    console.error('Error getting active tags from storage:', error);
    return [];
  }
}
