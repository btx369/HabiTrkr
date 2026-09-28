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
  autoImportEnabled?: boolean;
  autoImportTags?: string[];
}
