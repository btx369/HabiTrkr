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
  emptyMessage = 'No folders available',
}: MoveToFolderDialogProps<T>) {
  const { t } = useLanguage();
  return (
    <EditorDialog
      isOpen={isOpen}
      onClose={onClose}
      title={t('moveToFolder')}
      footer={<div />}
    >
      <div className="space-y-3 max-h-[400px] overflow-y-auto">
        {folders.length === 0 ? (
          <div className="text-center py-8">
            {/*
              * `emptyMessage` is supplied by the caller and already translated, so it is
              * used as given. The default below is the one untranslated case and has no key
              * of its own — "No folders available" is not `noArchivedFolders`, which says
              * something different.
              */}
            <p className="text-muted-foreground mb-4">{emptyMessage}</p>
            <Button onClick={onCreateNewFolder} className="bg-black text-white hover:bg-black/90">
              {t('createFolder')}
              <FolderPlus size={16} className="ml-2" />
            </Button>
          </div>
        ) : (
          <>
            {folders.map((folder) => {
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
            })}
            
            <div className="flex justify-center pt-2">
              <Button onClick={onCreateNewFolder} className="bg-black text-white hover:bg-black/90">
                Create New Folder
                <FolderPlus size={16} className="ml-2" />
              </Button>
            </div>
          </>
        )}
      </div>
    </EditorDialog>
  );
}
