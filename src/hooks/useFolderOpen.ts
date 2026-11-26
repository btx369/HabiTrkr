import { useCallback, useState } from 'react';

/**
 * Whether a folder card is open, remembered per folder for as long as the app is running.
 *
 * The state used to live inside each card. Folders are laid out in independent columns, and
 * pinning, unpinning or re-sorting moves a folder to another column; React then builds a new
 * card there, which started closed, so folders the person never touched appeared to close.
 * Keeping the state outside the card makes a folder's open state its own, whatever moves.
 */
const openFolders = new Set<string>();

export function useFolderOpen(kind: string, id: string): [boolean, (next: boolean | ((prev: boolean) => boolean)) => void] {
  const key = `${kind}:${id}`;
  const [isOpen, setLocal] = useState(() => openFolders.has(key));
  const setIsOpen = useCallback(
    (next: boolean | ((prev: boolean) => boolean)) => {
      setLocal((prev) => {
        const value = typeof next === 'function' ? next(prev) : next;
        if (value) openFolders.add(key);
        else openFolders.delete(key);
        return value;
      });
    },
    [key],
  );
  return [isOpen, setIsOpen];
}
