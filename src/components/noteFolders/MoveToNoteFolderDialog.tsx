import { Button } from '@/components/ui/button';
import { CardContent } from '@/components/ui/card';
import { ColoredCard } from '@/components/shared/ColoredCard';
import { EditorDialog } from '@/components/shared/EditorDialog';
import { NoteFolder } from '@/types/noteFolder';
import { FolderCheck, FolderOpen, FolderPlus } from 'lucide-react';
import { isDefaultColor } from '@/lib/cardColorStyles';
import { getColoredIconClass } from '@/lib/coloredButtonStyles';

interface MoveToNoteFolderDialogProps {
  isOpen: boolean;
  onClose: () => void;
  folders: NoteFolder[];
  onSelectFolder: (folderId: string) => void;
  onCreateNewFolder: () => void;
  currentFolderId?: string;
}

export function MoveToNoteFolderDialog({
  isOpen, 
  onClose, 
  folders, 
  onSelectFolder,
  onCreateNewFolder,
  currentFolderId
}: MoveToNoteFolderDialogProps) {
  return (
    <EditorDialog
      isOpen={isOpen}
      onClose={onClose}
      title="Move to Folder"
      footer={<div />}
    >
      <div className="space-y-3 max-h-[400px] overflow-y-auto">
        {folders.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-4">No folders available</p>
            <Button onClick={onCreateNewFolder} className="bg-black text-white hover:bg-black/90">
              Create New Folder
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
                          {folder.noteIds.length} notes
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
