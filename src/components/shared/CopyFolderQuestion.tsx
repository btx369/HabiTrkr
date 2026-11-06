import { useState } from 'react';
import { ConfirmationDialog } from './ConfirmationDialog';
import { useLanguage } from '@/contexts/LanguageContext';
import { foldersHolding } from '@/lib/copyIntoFolder';

interface Pending {
  open: boolean;
  folderName?: string;
  run: (keepInFolder: boolean) => void;
}

/**
 * Before copying items that sit in a folder, asks "Manter na mesma pasta?" with Sim / Não.
 * Items outside folders are copied at once. Closing the question with Escape copies nothing.
 */
export function useCopyFolderQuestion<F extends { id: string; name?: string }>(folders: F[], idsOf: (folder: F) => string[]) {
  const [pending, setPending] = useState<Pending | null>(null);

  const copyWithQuestion = (itemIds: string[], run: (keepInFolder: boolean) => void) => {
    const holding = foldersHolding(itemIds, folders, idsOf);
    if (holding.length === 0) { run(false); return; }
    setPending({ open: true, folderName: itemIds.length === 1 ? holding[0].name || '' : undefined, run });
  };

  const dialog = {
    pending,
    close: () => setPending((prev) => (prev ? { ...prev, open: false } : prev)),
  };
  return { copyWithQuestion, dialog };
}

export function CopyFolderQuestionDialog({ pending, close }: { pending: Pending | null; close: () => void }) {
  const { t } = useLanguage();
  const description = pending?.folderName !== undefined
    ? t('copyKeepFolderBodyOne').replace('{folder}', pending.folderName)
    : t('copyKeepFolderBodyMany');
  return (
    <ConfirmationDialog
      open={!!pending?.open}
      onOpenChange={(open) => { if (!open) close(); }}
      title={t('copyKeepFolderTitle')}
      description={description}
      action="mode-change"
      confirmLabel={t('yes')}
      cancelLabel={t('no')}
      onConfirm={() => pending?.run(true)}
      onCancel={() => pending?.run(false)}
    />
  );
}
