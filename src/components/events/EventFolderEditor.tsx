import { EventFolder } from '@/types/eventFolder';
import { FolderEditorFields } from '@/components/shared/FolderEditorFields';
import { EditorDialog } from '@/components/shared/EditorDialog';
import { AutoImportSection } from '@/components/shared/AutoImportSection';
import { useLanguage } from '@/contexts/LanguageContext';
import { useEditorForm } from '@/hooks/useEditorForm';

interface EventFolderFormData {
  name: string;
  description: string;
  color: string;
  pinned: boolean;
  archived: boolean;
  autoImportEnabled: boolean;
  autoImportTags: string[];
}

const defaults: EventFolderFormData = {
  name: '',
  description: '',
  color: '#FFFFFF',
  pinned: false,
  archived: false,
  autoImportEnabled: false,
  autoImportTags: []
};

interface EventFolderEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (folderData: Omit<EventFolder, 'id' | 'createdAt' | 'eventIds'>) => void;
  folder: EventFolder | null;
}

export function EventFolderEditor({ isOpen, onClose, onSave, folder }: EventFolderEditorProps) {
  const { t } = useLanguage();
  const { formData, setFormData, resetForm } = useEditorForm<EventFolderFormData>({
    initialData: folder ? {
      name: folder.name,
      description: folder.description || '',
      color: folder.color,
      pinned: folder.pinned,
      archived: folder.archived,
      autoImportEnabled: folder.autoImportEnabled || false,
      autoImportTags: folder.autoImportTags || []
    } : null,
    defaults,
    isOpen
  });

  const handleSave = () => {
    if (!formData.name.trim()) return;
    
    onSave({
      ...formData,
      autoImportTags: formData.autoImportTags.length > 0 ? formData.autoImportTags : undefined
    });
    handleClose();
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <EditorDialog
      isOpen={isOpen}
      onClose={handleClose}
      title={t('editFolder')}
      onSave={handleSave}
      saveLabel={t('save')}
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
        placeholder="Add tags (e.g., #meeting #work)"
      />
    </EditorDialog>
  );
}
