import { useState } from 'react';
import { HabitFolder } from '@/types/habitFolder';
import { ColorPicker } from '@/components/shared/ColorPicker';
import { TitleInput } from '@/components/shared/TitleInput';
import { EditorDialog } from '@/components/shared/EditorDialog';
import { useLanguage } from '@/contexts/LanguageContext';
import { NotebookPen, FileText, Palette } from 'lucide-react';

const ICON_COLOR = 'currentColor';

interface HabitFolderCreatorProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (folderData: Omit<HabitFolder, 'id' | 'createdAt' | 'habitIds'>) => void;
}

export function HabitFolderCreator({ isOpen, onClose, onSave }: HabitFolderCreatorProps) {
  const { t } = useLanguage();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#FFFFFF');

  const handleSave = () => {
    if (!name.trim()) return;
    
    onSave({
      name: name.trim(),
      description: description.trim() || undefined,
      color,
      pinned: false,
      archived: false,
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
      title={t('createNewFolder')}
      onSave={handleSave}
      saveLabel={t('save')}
      saveDisabled={!name.trim()}
    >
      <TitleInput
        id="folder-name"
        label={t('title')}
        value={name}
        onChange={setName}
        placeholder={t('placeholderFolderTitle')}
        maxLength={35}
        required
        icon={NotebookPen}
        iconColor={ICON_COLOR}
      />
      
      <TitleInput
        id="folder-description"
        label={t('description')}
        value={description}
        onChange={setDescription}
        placeholder={t('placeholderFolderDescription')}
        maxLength={35}
        icon={FileText}
        iconColor={ICON_COLOR}
      />
      
      <ColorPicker 
        selectedColor={color} 
        onColorChange={setColor}
        icon={Palette}
        iconColor={ICON_COLOR}
        singleRow
      />
    </EditorDialog>
  );
}
