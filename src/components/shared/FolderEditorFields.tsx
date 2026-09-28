import { TitleInput } from '@/components/shared/TitleInput';
import { ColorPicker } from '@/components/shared/ColorPicker';
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
  namePlaceholder = "Enter folder title...",
  descriptionPlaceholder = "Enter folder description...",
  nameMaxLength = 35,
  descriptionMaxLength = 35
}: FolderEditorFieldsProps) {
  return (
    <>
      <TitleInput
        id="name"
        label="Title"
        value={name}
        onChange={onNameChange}
        placeholder={namePlaceholder}
        maxLength={nameMaxLength}
        required
        icon={NotebookPen}
        iconColor={ICON_COLOR}
      />
      
      <TitleInput
        id="description"
        label="Description"
        value={description}
        onChange={onDescriptionChange}
        placeholder={descriptionPlaceholder}
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
