/**
 * Undo for the toast's "Anular" button.
 *
 * Every storage write made by one UI action (one task of the event loop) joins the same
 * group, which keeps the first previous value of each key. The toast takes the group when
 * it is shown, but the group stays open until the action's task ends: a write that lands
 * after the toast call (deleting the selected archived notes after the folder toast had
 * already gone up, for example) is still part of what Undo puts back. It used to be
 * cut off, so Undo restored the folder and lost the note.
 */
interface UndoGroup {
  restores: Map<string, () => void>;
  /** The action opted out of Undo; its toast gets no button. */
  discarded: boolean;
}

let currentGroup: UndoGroup | null = null;

/** Record the first previous value for a storage key in the current UI action. */
export function registerUndo(key: string, restore: () => void): void {
  if (!currentGroup) {
    const group: UndoGroup = { restores: new Map(), discarded: false };
    currentGroup = group;
    queueMicrotask(() => {
      if (currentGroup === group) currentGroup = null;
    });
  }
  if (!currentGroup.restores.has(key)) currentGroup.restores.set(key, restore);
}

/**
 * The current action's rollback, or undefined when it changed nothing so far.
 * Writes made later in the same action are included when the rollback runs.
 */
export function takePendingUndo(): (() => void) | undefined {
  const group = currentGroup;
  if (!group || group.discarded || group.restores.size === 0) return undefined;
  return () => [...group.restores.values()].reverse().forEach((restore) => restore());
}

/** Drop Undo for the current action, for changes that cannot be safely put back. */
export function discardPendingUndo(): void {
  if (currentGroup) currentGroup.discarded = true;
}
