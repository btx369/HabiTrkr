import { useState, useEffect } from 'react';
import { HabitFolder } from '@/types/habitFolder';
import { ColorPicker } from '@/components/shared/ColorPicker';
import { TitleInput } from '@/components/shared/TitleInput';
import { EditorDialog } from '@/components/shared/EditorDialog';
import { NotebookPen, FileText, Palette } from 'lucide-react';

const ICON_COLOR = 'currentColor';

interface HabitFolderEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (folderData: Partial<HabitFolder>) => void;
  folder: HabitFolder | null;
}

export function HabitFolderEditor({ isOpen, onClose, onSave, folder }: HabitFolderEditorProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#FFFFFF');

  useEffect(() => {
    if (folder && isOpen) {
      setName(folder.name);
      setDescription(folder.description || '');
      setColor(folder.color);
    }
  }, [folder, isOpen]);

  const handleSave = () => {
    if (!name.trim()) return;
    
    onSave({
      name: name.trim(),
      description: description.trim() || undefined,
      color,
      modifiedAt: new Date().toISOString(),
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
      title="Edit Folder"
      onSave={handleSave}
      saveLabel="Save Changes"
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
