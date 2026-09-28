import { useState } from 'react';
import { EventFolder } from '@/types/eventFolder';
import { ColorPicker } from '@/components/shared/ColorPicker';
import { TitleInput } from '@/components/shared/TitleInput';
import { EditorDialog } from '@/components/shared/EditorDialog';
import { NotebookPen, FileText, Palette } from 'lucide-react';

const ICON_COLOR = 'currentColor';

interface EventFolderCreatorProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (folderData: Omit<EventFolder, 'id' | 'createdAt' | 'eventIds'>, eventIdToMove?: string) => void;
  eventIdToMove?: string | null;
}

export function EventFolderCreator({ isOpen, onClose, onSave, eventIdToMove }: EventFolderCreatorProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: '#FFFFFF',
    pinned: false,
    archived: false
  });

  const handleSave = () => {
    if (!formData.name.trim()) return;
    
    onSave(formData, eventIdToMove || undefined);
    handleClose();
  };

  const handleClose = () => {
    setFormData({
      name: '',
      description: '',
      color: '#FFFFFF',
      pinned: false,
      archived: false
    });
    onClose();
  };

  return (
    <EditorDialog
      isOpen={isOpen}
      onClose={handleClose}
      title="Create New Folder"
      onSave={handleSave}
      saveLabel="Create Folder"
      saveDisabled={!formData.name.trim()}
    >
      <TitleInput
        id="name"
        label="Title"
        value={formData.name}
        onChange={(value) => setFormData(prev => ({ ...prev, name: value }))}
        placeholder="Enter folder title..."
        maxLength={35}
        required
        icon={NotebookPen}
        iconColor={ICON_COLOR}
      />
      
      <TitleInput
        id="description"
        label="Description"
        value={formData.description}
        onChange={(value) => setFormData(prev => ({ ...prev, description: value }))}
        placeholder="Enter folder description..."
        maxLength={35}
        icon={FileText}
        iconColor={ICON_COLOR}
      />
      
      <ColorPicker 
        selectedColor={formData.color} 
        onColorChange={(color) => setFormData(prev => ({ ...prev, color }))}
        icon={Palette}
        iconColor={ICON_COLOR}
      />
    </EditorDialog>
  );
}
