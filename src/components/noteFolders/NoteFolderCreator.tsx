import { useState } from 'react';
import { NoteFolder } from '@/types/noteFolder';
import { ColorPicker } from '@/components/shared/ColorPicker';
import { TitleInput } from '@/components/shared/TitleInput';
import { EditorDialog } from '@/components/shared/EditorDialog';
import { NotebookPen, FileText, Palette } from 'lucide-react';

const ICON_COLOR = 'currentColor';

interface NoteFolderCreatorProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (folderData: Omit<NoteFolder, 'id' | 'createdAt' | 'noteIds'>) => void;
}

export function NoteFolderCreator({ isOpen, onClose, onSave }: NoteFolderCreatorProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#FFFFFF');

  const handleSave = () => {
    if (!name.trim()) return;
    
    onSave({
      name: name.trim(),
      description: description.trim() || undefined,
      color,
    });
    
    handleClose();
  };

  const handleClose = () => {
    setName('');
    setDescription('');
    setColor('#FFFFFF');
    onClose();
  };

  return (
    <EditorDialog
      isOpen={isOpen}
      onClose={handleClose}
      title="Create New Folder"
      onSave={handleSave}
      saveLabel="Create Folder"
      saveDisabled={!name.trim()}
    >
      <TitleInput
        id="folder-name"
        label="Title"
        value={name}
        onChange={setName}
        placeholder="Enter folder title..."
        maxLength={35}
        required
        icon={NotebookPen}
        iconColor={ICON_COLOR}
      />
      
      <TitleInput
        id="folder-description"
        label="Description"
        value={description}
        onChange={setDescription}
        placeholder="Enter folder description..."
        maxLength={35}
        icon={FileText}
        iconColor={ICON_COLOR}
      />
      
      <ColorPicker 
        selectedColor={color} 
        onColorChange={setColor}
        icon={Palette}
        iconColor={ICON_COLOR}
      />
    </EditorDialog>
  );
}
