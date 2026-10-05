import { useMemo } from 'react';
import { NoteFolder } from '@/types/noteFolder';
import { FolderEditorFields } from '@/components/shared/FolderEditorFields';
import { EditorDialog } from '@/components/shared/EditorDialog';
import { AutoImportSection } from '@/components/shared/AutoImportSection';
import { useLanguage } from '@/contexts/LanguageContext';
import { useEditorForm } from '@/hooks/useEditorForm';

interface NoteFolderFormData {
  name: string;
  description: string;
  color: string;
  autoImportEnabled: boolean;
  autoImportTags: string[];
}

interface NoteFolderEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (folderData: Omit<NoteFolder, 'id' | 'createdAt' | 'noteIds'>) => void;
  initialFolder?: NoteFolder;
}

const defaults: NoteFolderFormData = {
  name: '',
  description: '',
  color: '#6366f1',
  autoImportEnabled: false,
  autoImportTags: []
};

export function NoteFolderEditor({ isOpen, onClose, onSave, initialFolder }: NoteFolderEditorProps) {
  const { t } = useLanguage();

  const initialData = useMemo(() => 
    initialFolder ? {
      name: initialFolder.name,
      description: initialFolder.description || '',
      color: initialFolder.color,
      autoImportEnabled: initialFolder.autoImportEnabled || false,
      autoImportTags: initialFolder.autoImportTags || []
    } : null,
    [initialFolder]
  );

  const { formData, setFormData, resetForm } = useEditorForm<NoteFolderFormData>({
    initialData,
    defaults,
    isOpen
  });

  const handleSubmit = () => {
    if (!formData.name.trim()) return;

    onSave({
      name: formData.name.trim(),
      description: formData.description.trim() || undefined,
      color: formData.color,
      pinned: initialFolder?.pinned || false,
      archived: initialFolder?.archived || false,
      autoImportEnabled: formData.autoImportEnabled,
      autoImportTags: formData.autoImportTags.length > 0 ? formData.autoImportTags : undefined
    });

    resetForm();
    onClose();
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <EditorDialog
      isOpen={isOpen}
      onClose={handleClose}
      title={initialFolder ? t('editFolder') : t('createNewFolder')}
      onSave={handleSubmit}
      saveLabel={initialFolder ? t('save') : t('createFolder')}
      saveDisabled={!formData.name.trim()}
    >
      <FolderEditorFields
        name={formData.name}
        onNameChange={(value) => setFormData(prev => ({ ...prev, name: value }))}
        description={formData.description}
        onDescriptionChange={(value) => setFormData(prev => ({ ...prev, description: value }))}
        color={formData.color}
        onColorChange={(color) => setFormData(prev => ({ ...prev, color }))}
      />

      <AutoImportSection
        enabled={formData.autoImportEnabled}
        onEnabledChange={(checked) => setFormData(prev => ({ ...prev, autoImportEnabled: checked }))}
        tags={formData.autoImportTags}
        onTagsChange={(tags) => setFormData(prev => ({ ...prev, autoImportTags: tags }))}
        placeholder="Add tags (e.g., #invoice #receipt)"
      />
    </EditorDialog>
  );
}
