export interface EventFolder {
  id: string;
  name: string;
  description?: string;
  color: string;
  eventIds: string[];
  pinned: boolean;
  archived: boolean;
  createdAt: string;
  lastEventAddedAt?: string; // When an event was last put in the folder (for the "recently added" sort)
  autoImportEnabled?: boolean; // Premium: Auto-import events with specific tags
  autoImportTags?: string[]; // Tags to auto-import (stored without #)
}