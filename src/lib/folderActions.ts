/**
 * What a folder action does to the folder and to the items inside it, decided in one place.
 *
 * Archiving, deleting and restoring a folder are the same three actions on notes, events and
 * habits, and they were written out three times — once per page — which is how the habits page
 * ended up creating a folder from the Move to folder dialog without putting anything in it
 * while the other two pages did. A rule that lives in three places drifts; this one lives here
 * and the pages only apply its result to their own state.
 *
 * The two scopes are the choice the dialogs offer:
 *
 *   `withItems`  — the folder takes its items with it. Archived together, deleted together,
 *                  restored together.
 *   `folderOnly` — only the folder moves: archiving leaves items active while preserving their
 *                  ids on the archived folder, deleting leaves them active and unfiled, and
 *                  restoring the folder leaves its items in the archive.
 *
 * An archived folder keeps its ids so the relationship can be restored later. The folder
 * membership context ignores archived folders, so those active items do not show as filed
 * until their folder is restored. Deleting a folder clears its ids because the relationship
 * can no longer be restored.
 */

export type FolderActionKind = 'archive' | 'delete' | 'restore';
export type FolderActionScope = 'folderOnly' | 'withItems';

export interface FolderActionPlan {
  /** The items this action archives, deletes or restores — empty for `folderOnly`. */
  affectedItemIds: string[];
  /** The ids the folder holds once the action has run. */
  folderItemIds: string[];
}

export interface FolderActionInput {
  kind: FolderActionKind;
  scope: FolderActionScope;
  /** The ids the folder holds right now. */
  folderItemIds: readonly string[];
  /**
   * Ids already filed in another active folder. Restoring a folder must not claim an item that
   * another folder is holding, or one item would end up in two places.
   */
  claimedElsewhere?: ReadonlySet<string>;
  /** Which of the folder's ids are in the archived collection, for a restore to bring back. */
  archivedIds?: ReadonlySet<string>;
}

export function planFolderAction({
  kind,
  scope,
  folderItemIds,
  claimedElsewhere,
  archivedIds,
}: FolderActionInput): FolderActionPlan {
  const ids = [...folderItemIds];

  if (kind === 'archive') {
    // An item already in the archive is not archived twice; the pages add only what is active.
    return scope === 'withItems'
      ? { affectedItemIds: ids, folderItemIds: ids }
      : { affectedItemIds: [], folderItemIds: ids };
  }

  if (kind === 'delete') {
    // The folder goes either way, so its ids never survive the action.
    return scope === 'withItems'
      ? { affectedItemIds: ids, folderItemIds: [] }
      : { affectedItemIds: [], folderItemIds: [] };
  }

  const restored = claimedElsewhere ? ids.filter((id) => !claimedElsewhere.has(id)) : ids;
  return scope === 'withItems'
    ? {
        affectedItemIds: archivedIds ? restored.filter((id) => archivedIds.has(id)) : restored,
        folderItemIds: restored,
      }
    : { affectedItemIds: [], folderItemIds: restored };
}
