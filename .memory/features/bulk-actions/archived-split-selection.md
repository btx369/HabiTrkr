# Memory: features/bulk-actions/archived-split-selection
Updated: now

Archived sections (Notes and Events) have separate "All Notes/Events" and "All Folders" buttons instead of a single "All" button. This allows independent selection of items and folders:

- `allItems` action type: Selects/deselects all archived notes or events only
- `allFolders` action type: Selects/deselects all archived folders only
- Selection is independent - selecting all notes doesn't affect folder selections and vice versa
- When toggling off a selection type, the other type's selections are preserved

The `ARCHIVED_NOTES_ACTIONS` and `ARCHIVED_EVENTS_ACTIONS` arrays in BulkActionBar.tsx define these separate actions. The BulkActionBar component accepts `isAllItemsSelected` and `isAllFoldersSelected` props to indicate the selection state of each type.

Bulk delete in the archived tab now correctly deletes both notes/events AND folders (fixed bug where only items were deleted, not folders).
