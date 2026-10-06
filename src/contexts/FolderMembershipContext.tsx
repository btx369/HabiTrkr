import { createContext, useContext, useMemo, type ReactNode } from 'react';

/**
 * Which items are filed inside a folder.
 *
 * A card shows a folder glyph when the thing it draws lives in a folder, and the card is
 * rendered from lists that know nothing about folders — the notes list, the archived list,
 * a folder's own expanded list. Threading a prop down every one of those call sites would
 * mean each of them looking the membership up again, so the page that owns the folder state
 * publishes the ids once and the cards read them here.
 *
 * Nested cards are covered by the same set: an item inside a folder is in the set, so its
 * card shows the glyph wherever it is drawn.
 */
const FolderMembershipContext = createContext<ReadonlySet<string>>(new Set<string>());

interface FolderMembershipProviderProps {
  /** Every id filed in a folder, across active and archived folders. */
  ids: readonly string[];
  children: ReactNode;
}

export function FolderMembershipProvider({ ids, children }: FolderMembershipProviderProps) {
  /*
   * The set is rebuilt from a string key rather than from the array itself: the pages build
   * that array inline, so a new array arrives on every render, and a new Set would re-render
   * every card that reads it. Rebuilding from the key keeps the Set stable while the
   * membership is unchanged.
   */
  const key = ids.join('\u0000');
  const value = useMemo(() => new Set(key ? key.split('\u0000') : []), [key]);
  return <FolderMembershipContext.Provider value={value}>{children}</FolderMembershipContext.Provider>;
}

/** Whether the item with this id is filed in a folder. */
export function useIsFiled(id: string | undefined): boolean {
  const filed = useContext(FolderMembershipContext);
  return id ? filed.has(id) : false;
}
