import { Button } from '@/components/ui/button';
import { CardContent } from '@/components/ui/card';
import { ColoredCard } from '@/components/shared/ColoredCard';
import { EditorDialog } from '@/components/shared/EditorDialog';
import { FolderCheck, FolderOpen, FolderPlus } from 'lucide-react';
import { isDefaultColor } from '@/lib/cardColorStyles';
import { getColoredIconClass } from '@/lib/coloredButtonStyles';
import { useLanguage } from '@/contexts/LanguageContext';

/**
 * The fields this dialog actually needs from a folder.
 *
 * Declared structurally rather than as a union of NoteFolder | EventFolder | HabitFolder,
 * because those three differ in ways that do not matter here — NoteFolder carries
 * createdAt/modifiedAt/lastNoteAddedAt while the other two do not — and a union would force
 * every caller to satisfy a shape this component never reads.
 */
export interface MovableFolder {
  id: string;
  name: string;
  description?: string;
  color: string;
}

interface MoveToFolderDialogProps<T extends MovableFolder> {
  isOpen: boolean;
  onClose: () => void;
  folders: T[];
  onSelectFolder: (folderId: string) => void;
  onCreateNewFolder: () => void;
  currentFolderId?: string;
  /**
   * How many items the folder holds, and what to call them. Notes, events and habits each
   * keep their ids under a different key, so the caller supplies the count rather than this
   * component guessing at `noteIds` / `eventIds` / `habitIds`.
   */
  getItemCount: (folder: T) => number;
  itemNoun: string;
  emptyMessage?: string;
}

/**
 * Picks the folder an item should move into.
 *
 * This replaces three separate components — one each for notes, events and habits — that
 * were 90 lines apiece with six lines of difference between them: the folder type, the name
 * of the count field, and the word after the count. Anything fixed in one of them had to be
 * fixed in all three, and the third copy had already drifted.
 */
export function MoveToFolderDialog<T extends MovableFolder>({
  isOpen,
  onClose,
  folders,
  onSelectFolder,
  onCreateNewFolder,
  currentFolderId,
  getItemCount,
  itemNoun,
  emptyMessage,
}: MoveToFolderDialogProps<T>) {
  const { t } = useLanguage();
  return (
    <EditorDialog
      isOpen={isOpen}
      onClose={onClose}
      title={t('moveToFolder')}
      /*
       * The list carries a visible scrollbar. Scrollbars are hidden everywhere else in the app,
       * and this is the one list where that costs the reader something: a dialog showing four
       * folders and a clean bottom edge gives no reason to suspect there are six, and picking
       * one of them is the entire point of the screen.
       */
      scrollClassName="scroll-thin"
      /*
       * The create button lives in the dialog's footer, so it stays put while the list moves. It
       * used to sit at the end of the list itself, which put it below the fold as soon as there
       * were more folders than fitted.
       */
      footer={
        <div className="flex justify-center w-full pt-4">
          <Button onClick={onCreateNewFolder} className="bg-black text-white hover:bg-black/90">
            {t('createNewFolder')}
            <FolderPlus size={16} className="ml-2" />
          </Button>
        </div>
      }
    >
      {/*
       * Only this list scrolls, and the dialog's own middle region does it — the title above and
       * the button below stay where they are. The list used to be capped at 400px with a second
       * scrollbar of its own, which scrolled the panel in two places and only kept the button
       * outside the scrolling area by accident.
       */}
      <div className="space-y-3 pb-1">
        {folders.length === 0 ? (
          /*
           * `emptyMessage` is supplied by the caller and already translated, so it is used as
           * given. Callers that pass nothing fall back to `noFoldersAvailable` — not
           * `noArchivedFolders`, which says something different.
           *
           * No button here: the footer's create button is always on screen, and a second one
           * said the same thing twice.
           */
          <p className="text-center py-8 text-muted-foreground">{emptyMessage ?? t('noFoldersAvailable')}</p>
        ) : (
          folders.map((folder) => {
              const isCurrentFolder = folder.id === currentFolderId;
              const hasColor = folder.color && !isDefaultColor(folder.color);
              const iconColor = getColoredIconClass(!!hasColor);
              return (
                <ColoredCard 
                  key={folder.id} 
                  color={folder.color}
                  useFallback
                  className={`transition-all ${isCurrentFolder ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                  onClick={() => !isCurrentFolder && onSelectFolder(folder.id)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <h4 className="font-medium">{folder.name}</h4>
                        {folder.description && (
                          <p className="text-sm text-muted-foreground">{folder.description}</p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          {getItemCount(folder)} {itemNoun}
                        </p>
                      </div>
                      {isCurrentFolder ? (
                        <FolderCheck size={20} className={iconColor} />
                      ) : (
                        <FolderOpen size={20} className={iconColor} />
                      )}
                    </div>
                  </CardContent>
                </ColoredCard>
              );
            })
        )}
      </div>
    </EditorDialog>
  );
}
