export interface HabitFolder {
  id: string;
  name: string;
  description?: string;
  color: string;
  habitIds: string[];
  pinned: boolean;
  archived: boolean;
  createdAt: string;
  modifiedAt?: string;
  lastHabitAddedAt?: string; // When a habit was last put in the folder (for the "recently added" sort)
  autoImportEnabled?: boolean;
  autoImportTags?: string[];
}
