export interface EventFolder {
  id: string;
  name: string;
  description?: string;
  color: string;
  eventIds: string[];
  pinned: boolean;
  archived: boolean;
  createdAt: string;
  autoImportEnabled?: boolean; // Premium: Auto-import events with specific tags
  autoImportTags?: string[]; // Tags to auto-import (stored without #)
}