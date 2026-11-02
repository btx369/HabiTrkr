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
  pin?: string; // Legacy plain-text PIN; replaced by pinHash on first load (see lib/notePin)
  pinHash?: string; // PBKDF2-SHA256 of the PIN, base64
  pinSalt?: string; // Salt for pinHash, base64
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