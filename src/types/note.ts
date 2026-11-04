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
  lockType?: 'pin' | 'password'; // How a locked note is protected; absent means PIN
  sealed?: { iv: string; data: string }; // Encrypted content of a password note (lib/noteVault)
  tags?: string[]; // Tags for categorization (stored without #)
  reminder?: NoteReminder; // When to remind about this note (lib/noteReminders)
}

/** A note reminder, Google Keep style: a local date-time, optionally repeating. */
export interface NoteReminder {
  /** Local date and time, `yyyy-MM-ddTHH:mm`. */
  at: string;
  repeat?: 'daily' | 'weekly' | 'monthly' | 'yearly';
  /** Every N days/weeks/months/years; 1 when absent. */
  interval?: number;
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