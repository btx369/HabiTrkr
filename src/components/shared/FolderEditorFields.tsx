import { TitleInput } from '@/components/shared/TitleInput';
import { ColorPicker } from '@/components/shared/ColorPicker';
import { useLanguage } from '@/contexts/LanguageContext';
import { NotebookPen, FileText, Palette } from 'lucide-react';

const ICON_COLOR = 'currentColor';

interface FolderEditorFieldsProps {
  name: string;
  onNameChange: (value: string) => void;
  description: string;
  onDescriptionChange: (value: string) => void;
  color: string;
  onColorChange: (color: string) => void;
  namePlaceholder?: string;
  descriptionPlaceholder?: string;
  nameMaxLength?: number;
  descriptionMaxLength?: number;
}

export function FolderEditorFields({
  name,
  onNameChange,
  description,
  onDescriptionChange,
  color,
  onColorChange,
  namePlaceholder,
  descriptionPlaceholder,
  nameMaxLength = 35,
  descriptionMaxLength = 35
}: FolderEditorFieldsProps) {
  const { t } = useLanguage();
  // Defaulted here rather than in the parameter list, which cannot see the hook.
  const resolvedNamePlaceholder = namePlaceholder ?? t('placeholderFolderTitle');
  const resolvedDescriptionPlaceholder = descriptionPlaceholder ?? t('placeholderFolderDescription');
  return (
    <>
      <TitleInput
        id="name"
        label={t('title')}
        value={name}
        onChange={onNameChange}
        placeholder={resolvedNamePlaceholder}
        maxLength={nameMaxLength}
        required
        icon={NotebookPen}
        iconColor={ICON_COLOR}
      />
      
      <TitleInput
        id="description"
        label={t('description')}
        value={description}
        onChange={onDescriptionChange}
        placeholder={resolvedDescriptionPlaceholder}
        maxLength={descriptionMaxLength}
        icon={FileText}
        iconColor={ICON_COLOR}
      />
      
      <ColorPicker 
        selectedColor={color} 
        onColorChange={onColorChange}
        icon={Palette}
        iconColor={ICON_COLOR}
      />
    </>
  );
}
