import { useState } from 'react';
import { EventFolder } from '@/types/eventFolder';
import { ColorPicker } from '@/components/shared/ColorPicker';
import { TitleInput } from '@/components/shared/TitleInput';
import { EditorDialog } from '@/components/shared/EditorDialog';
import { useLanguage } from '@/contexts/LanguageContext';
import { NotebookPen, FileText, Palette } from 'lucide-react';

const ICON_COLOR = 'currentColor';

interface EventFolderCreatorProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (folderData: Omit<EventFolder, 'id' | 'createdAt' | 'eventIds'>, eventIdsToMove?: string[]) => void;
  eventIdsToMove?: string[];
}

export function EventFolderCreator({ isOpen, onClose, onSave, eventIdsToMove }: EventFolderCreatorProps) {
  const { t } = useLanguage();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: '#FFFFFF',
    pinned: false,
    archived: false
  });

  const handleSave = () => {
    if (!formData.name.trim()) return;
    
    onSave(formData, eventIdsToMove);
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
      title={t('createNewFolder')}
      onSave={handleSave}
      saveLabel={t('save')}
      saveDisabled={!formData.name.trim()}
    >
      <TitleInput
        id="name"
        label={t('title')}
        value={formData.name}
        onChange={(value) => setFormData(prev => ({ ...prev, name: value }))}
        placeholder={t('placeholderFolderTitle')}
        maxLength={35}
        required
        icon={NotebookPen}
        iconColor={ICON_COLOR}
      />
      
      <TitleInput
        id="description"
        label={t('description')}
        value={formData.description}
        onChange={(value) => setFormData(prev => ({ ...prev, description: value }))}
        placeholder={t('placeholderFolderDescription')}
        maxLength={200}
        icon={FileText}
        iconColor={ICON_COLOR}
      />
      
      <ColorPicker 
        selectedColor={formData.color} 
        onColorChange={(color) => setFormData(prev => ({ ...prev, color }))}
        icon={Palette}
        iconColor={ICON_COLOR}
        singleRow
      />
    </EditorDialog>
  );
}
