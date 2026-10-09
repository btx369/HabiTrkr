interface PendingUndo {
  restore: () => void;
}

const pendingUndo = new Map<string, PendingUndo>();
let clearPendingAtEndOfTask = false;

/** Record the first previous value for a storage key in the current UI action. */
export function registerUndo(key: string, restore: () => void): void {
  if (!pendingUndo.has(key)) pendingUndo.set(key, { restore });

  if (!clearPendingAtEndOfTask) {
    clearPendingAtEndOfTask = true;
    queueMicrotask(() => {
      pendingUndo.clear();
      clearPendingAtEndOfTask = false;
    });
  }
}

/** Take the current action's storage changes and return one rollback operation. */
export function takePendingUndo(): (() => void) | undefined {
  if (pendingUndo.size === 0) return undefined;

  const restoreActions = [...pendingUndo.values()].map(({ restore }) => restore).reverse();
  pendingUndo.clear();
  return () => restoreActions.forEach((restore) => restore());
}
