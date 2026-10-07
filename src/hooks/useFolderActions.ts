import { useState } from 'react';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';
import { folderAndCount, itemDisplayName, type EntityKind } from '@/lib/countedMessage';
import {
  planFolderAction,
  type FolderActionKind,
  type FolderActionScope,
} from '@/lib/folderActions';

type Setter<T> = (value: T | ((prev: T) => T)) => void;

interface FolderWithIds {
  id: string;
  name?: string;
  description?: string;
  archived?: boolean;
}

interface ItemWithId {
  id: string;
  name?: string;
  description?: string;
}

export interface FolderActionsConfig<
  I extends ItemWithId,
  F extends FolderWithIds,
> {
  /** What the items are called in the dialog's count and in the toast. */
  itemKind: EntityKind;
  /** Where a folder keeps its item ids: `noteIds`, `eventIds` or `habitIds`. */
  itemIdsOf: (folder: F) => string[];
  /** The same folder with those ids replaced. */
  withItemIds: (folder: F, itemIds: string[]) => F;
  items: I[];
  setItems: Setter<I[]>;
  archivedItems: I[];
  setArchivedItems: Setter<I[]>;
  folders: F[];
  setFolders: Setter<F[]>;
  archivedFolders: F[];
  setArchivedFolders: Setter<F[]>;
  /**
   * How an item is marked when it is archived, and unmarked when it is restored. Optional:
   * the notes page moves items between two lists and leaves the flag alone, the habits page
   * sets it.
   */
  markItem?: (item: I, archived: boolean) => I;
}

export interface FolderActionDialogState {
  open: boolean;
  kind: FolderActionKind;
  folderName: string;
  itemCount: number;
  onFolderOnly: () => void;
  onAll: () => void;
  onOpenChange: (open: boolean) => void;
}

/**
 * Folder archive, delete and restore, shared by the notes, events and habits pages.
 *
 * The pages differ in their types and in the key their folders keep their ids under, and in
 * nothing else — so those are the only things they hand over. The decision itself comes from
 * `planFolderAction`, and the question the reader is asked comes from `FolderActionDialog`, so
 * the three pages cannot drift apart again the way they had: only habits had been wired to put
 * a moved item into a newly created folder, and only habits had a restore that worked from
 * inside an archived folder.
 *
 * A folder with nothing in it is not asked about at all: `folderOnly` and `withItems` would do
 * the same thing, and the restore flow already skipped the question in that case.
 */
export function useFolderActions<I extends ItemWithId, F extends FolderWithIds>({
  itemKind,
  itemIdsOf,
  withItemIds,
  items,
  setItems,
  archivedItems,
  setArchivedItems,
  folders,
  setFolders,
  archivedFolders,
  setArchivedFolders,
  markItem = (item) => item,
}: FolderActionsConfig<I, F>) {
  const { t, language } = useLanguage();
  const [pending, setPending] = useState<{ kind: FolderActionKind; folderId: string } | null>(null);

  const folderById = (folderId: string): F | undefined =>
    folders.find((folder) => folder.id === folderId) ?? archivedFolders.find((folder) => folder.id === folderId);

  const idsClaimedElsewhere = (exceptFolderId: string): Set<string> =>
    new Set(folders.filter((folder) => folder.id !== exceptFolderId).flatMap(itemIdsOf));

  const toastKey: Record<FolderActionKind, 'folderAndCountArchived' | 'folderAndCountDeleted' | 'folderAndCountRestored'> = {
    archive: 'folderAndCountArchived',
    delete: 'folderAndCountDeleted',
    restore: 'folderAndCountRestored',
  };
  const plainToastKey: Record<FolderActionKind, string> = {
    archive: 'toastArchived',
    delete: 'toastDeleted',
    restore: 'toastRestored',
  };

  /** Applies an action to the page's own state. The only per-page part is which setters. */
  const apply = (kind: FolderActionKind, scope: FolderActionScope, folderId: string) => {
    const folder = folderById(folderId);
    if (!folder) return;

    const archivedIds = new Set(archivedItems.map((item) => item.id));
    const plan = planFolderAction({
      kind,
      scope,
      folderItemIds: itemIdsOf(folder),
      claimedElsewhere: idsClaimedElsewhere(folderId),
      archivedIds,
    });
    const affected = new Set(plan.affectedItemIds);

    if (kind === 'archive') {
      setArchivedFolders((prev) => [...prev, { ...withItemIds(folder, plan.folderItemIds), archived: true }]);
      setFolders((prev) => prev.filter((entry) => entry.id !== folderId));
      if (affected.size) {
        const moving = items.filter((item) => affected.has(item.id));
        setArchivedItems((prev) => [...prev, ...moving.map((item) => markItem(item, true))]);
        setItems((prev) => prev.filter((item) => !affected.has(item.id)));
      }
    }

    if (kind === 'delete') {
      setFolders((prev) => prev.filter((entry) => entry.id !== folderId));
      setArchivedFolders((prev) => prev.filter((entry) => entry.id !== folderId));
      if (affected.size) {
        setItems((prev) => prev.filter((item) => !affected.has(item.id)));
        setArchivedItems((prev) => prev.filter((item) => !affected.has(item.id)));
      }
    }

    if (kind === 'restore') {
      const restored = { ...withItemIds(folder, plan.folderItemIds), archived: false };
      setFolders((prev) => (prev.some((entry) => entry.id === folderId) ? prev : [...prev, restored]));
      setArchivedFolders((prev) => prev.filter((entry) => entry.id !== folderId));
      if (affected.size) {
        const moving = archivedItems.filter((item) => affected.has(item.id));
        setItems((prev) => {
          const existing = new Set(prev.map((item) => item.id));
          return [...prev, ...moving.filter((item) => !existing.has(item.id)).map((item) => markItem(item, false))];
        });
        setArchivedItems((prev) => prev.filter((item) => !affected.has(item.id)));
      }
    }

    const count = plan.affectedItemIds.length;
    toast.success(count > 0
      ? folderAndCount(t, language, toastKey[kind], itemKind, count)
      : t(plainToastKey[kind]).replace('{entity}', t('tabFolders')));
  };

  /**
   * Opens the question, or goes straight ahead when there is nothing to choose.
   *
   * `folderOnly` and `withItems` differ only in what happens to the items, so a folder with
   * none of them has one possible outcome and does not need a dialog.
   */
  const request = (kind: FolderActionKind, folderId: string, scopeWhenEmpty: FolderActionScope) => {
    const folder = folderById(folderId);
    if (!folder) return;

    const archivedIds = new Set(archivedItems.map((item) => item.id));
    const wouldMove = planFolderAction({
      kind,
      scope: 'withItems',
      folderItemIds: itemIdsOf(folder),
      claimedElsewhere: idsClaimedElsewhere(folderId),
      archivedIds,
    }).affectedItemIds.length;

    if (wouldMove === 0) {
      apply(kind, scopeWhenEmpty, folderId);
      return;
    }
    setPending({ kind, folderId });
  };

  const close = () => setPending(null);

  const pendingFolder = pending ? folderById(pending.folderId) : undefined;
  const dialog: FolderActionDialogState = {
    open: Boolean(pending && pendingFolder),
    kind: pending?.kind ?? 'archive',
    folderName: pendingFolder ? itemDisplayName(t, pendingFolder) : '',
    itemCount: pendingFolder
      ? planFolderAction({
          kind: pending!.kind,
          scope: 'withItems',
          folderItemIds: itemIdsOf(pendingFolder),
          claimedElsewhere: idsClaimedElsewhere(pending!.folderId),
          archivedIds: new Set(archivedItems.map((item) => item.id)),
        }).affectedItemIds.length
      : 0,
    onFolderOnly: () => {
      if (pending) apply(pending.kind, 'folderOnly', pending.folderId);
      close();
    },
    onAll: () => {
      if (pending) apply(pending.kind, 'withItems', pending.folderId);
      close();
    },
    onOpenChange: (open: boolean) => { if (!open) close(); },
  };

  return {
    /** Ask to archive a folder, or archive it outright when it holds nothing. */
    requestArchive: (folderId: string) => request('archive', folderId, 'withItems'),
    /** Ask to delete a folder, or delete it outright when it holds nothing. */
    requestDelete: (folderId: string) => request('delete', folderId, 'withItems'),
    /** Ask how much of an archived folder to bring back; restore it when there is no choice. */
    requestRestore: (folderId: string) => request('restore', folderId, 'folderOnly'),
    /**
     * Apply an action without asking. For the bulk flows, which have already asked once for
     * everything they are about and must not open a dialog per folder as they run.
     */
    applyFolderAction: apply,
    /** Props for `<FolderActionDialog />`, spread at the page's root. */
    dialog,
  };
}
