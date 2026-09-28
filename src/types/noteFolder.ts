export interface NoteFolder {
  id: string;
  name: string;
  description?: string;
  color: string;
  createdAt: string;
  modifiedAt?: string;
  lastNoteAddedAt?: string;
  noteIds: string[];
  pinned?: boolean;
  archived?: boolean;
  autoImportEnabled?: boolean; // Premium: Auto-import notes with specific tags
  autoImportTags?: string[]; // Tags to auto-import (stored without #)
}