/**
 * Copying an item that sits in a folder: the app asks whether the copy goes into the same
 * folder as the original (Sim / Não). With "Sim" each copy joins its original's folder.
 */
interface FolderLike {
  id: string;
  name?: string;
}

interface FolderIds<F> {
  idsOf: (folder: F) => string[];
  withIds: (folder: F, ids: string[]) => F;
}

/** The folders that hold any of these items, in folder order. */
export function foldersHolding<F extends FolderLike>(itemIds: string[], folders: F[], idsOf: (folder: F) => string[]): F[] {
  const wanted = new Set(itemIds);
  return folders.filter((folder) => idsOf(folder).some((id) => wanted.has(id)));
}

/** Each copy is added to the folder its original is in; copies of unfiled items stay unfiled. */
export function fileCopiesBesideOriginals<F extends FolderLike>(
  pairs: Array<[originalId: string, copyId: string]>,
  folders: F[],
  { idsOf, withIds }: FolderIds<F>,
): F[] {
  return folders.map((folder) => {
    const ids = idsOf(folder);
    const added = pairs.filter(([original, copy]) => ids.includes(original) && !ids.includes(copy)).map(([, copy]) => copy);
    return added.length ? withIds(folder, [...ids, ...added]) : folder;
  });
}
