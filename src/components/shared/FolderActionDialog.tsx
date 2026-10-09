import { ConfirmationDialog } from '@/components/shared/ConfirmationDialog';
import { countedNoun, namedSentence, type EntityKind } from '@/lib/countedMessage';
import { useLanguage } from '@/contexts/LanguageContext';
import type { FolderActionKind } from '@/lib/folderActions';

interface FolderActionDialogProps {
  open: boolean;
  kind: FolderActionKind;
  /** The folder's display name, already resolved. */
  folderName: string;
  /** How many items the folder action would take with it. */
  itemCount: number;
  itemKind: EntityKind;
  bulk?: boolean;
  onFolderOnly: () => void;
  onAll: () => void;
  onOpenChange: (open: boolean) => void;
}

/**
 * The question asked before a folder is archived, deleted or restored.
 *
 * One component for all three actions and all three pages, so the buttons are the same three
 * in the same order — Cancel, Folder Only, and the action on everything — and nothing can be
 * offered on one page and missing on another. Restoring a folder already asked this way; the
 * archive and delete dialogs asked only "are you sure?" and always took the folder's items
 * along, which is a decision the reader never got to make.
 *
 * The count is what tells someone whether they are about to lose one item or thirty, and
 * `countedNoun` keeps it in agreement with its noun ("1 note", "3 notes", "0 notes").
 */
export function FolderActionDialog({
  open,
  kind,
  folderName,
  itemCount,
  itemKind,
  bulk = false,
  onFolderOnly,
  onAll,
  onOpenChange,
}: FolderActionDialogProps) {
  const { t, language } = useLanguage();

  const title = bulk && kind === 'delete'
    ? t('deleteSelectedItems')
    : bulk && kind === 'archive'
      ? t('archiveSelectedItems')
      : kind === 'restore'
    ? t('restoreFolder')
    : namedSentence(t, kind === 'delete' ? 'confirmDeleteNamed' : 'confirmArchiveNamed', folderName);

  const confirmLabel = kind === 'restore'
    ? t('restoreAll')
    : kind === 'delete' ? t('deleteAll') : t('archiveAll');

  return (
    <ConfirmationDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={countedNoun(t, language, itemKind, itemCount)}
      action={kind}
      confirmLabel={confirmLabel}
      onConfirm={onAll}
      secondaryAction={{ label: t('folderOnly'), onClick: onFolderOnly }}
    />
  );
}
