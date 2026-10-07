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
 *   `folderOnly` — the folder moves on its own and its items stay exactly where they are:
 *                  archiving a folder leaves its items active and unfiled, deleting one leaves
 *                  them active, restoring one leaves them in the archive.
 *
 * `folderOnly` clearing the folder's ids is what "unfiled" means here: the items are listed by
 * the page whether or not a folder holds them, so releasing them costs nothing and a folder
 * that claimed items it no longer lists would be lying about its own contents.
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
      : { affectedItemIds: [], folderItemIds: [] };
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
