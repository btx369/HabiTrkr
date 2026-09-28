export type NoteType = 'text' | 'list' | 'audio' | 'image';

export interface BaseNote {
  id: string;
  name: string;
  type: NoteType;
  color: string;
  createdAt: string;
  modifiedAt?: string;
  pinned: boolean;
  archived?: boolean;
  originalFolderId?: string; // Track original folder when note is deleted
  locked?: boolean; // Whether the note is locked
  pin?: string; // 4-digit PIN for locked notes
  tags?: string[]; // Tags for categorization (stored without #)
}

export interface TextNote extends BaseNote {
  type: 'text';
  description: string;
}

export interface ListNote extends BaseNote {
  type: 'list';
  items: ListItem[];
  description?: string; // Optional description for media content (images/audio)
}

export interface AudioNote extends BaseNote {
  type: 'audio';
  audioUrl: string;
  duration: number;
  description?: string;
}

export interface ImageNote extends BaseNote {
  type: 'image';
  imageUrl: string;
  description?: string;
}

export interface ListItem {
  id: string;
  text: string;
  completed: boolean;
}

export type Note = TextNote | ListNote | AudioNote | ImageNote;