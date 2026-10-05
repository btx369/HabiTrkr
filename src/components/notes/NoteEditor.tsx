import { useState, useMemo } from 'react';
import { Note } from '@/types/note';
import { TagEditor } from '@/components/shared/TagEditor';
import { ColorPicker } from '@/components/shared/ColorPicker';
import { TitleInput } from '@/components/shared/TitleInput';
import { EditorDialog } from '@/components/shared/EditorDialog';
import { useEditorForm } from '@/hooks/useEditorForm';
import { useToastSettings } from '@/contexts/ToastContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { NotebookPen, Palette, Hash } from 'lucide-react';

const ICON_COLOR = 'currentColor';

interface NoteFormData {
  color: string;
  name: string;
  tags: string[];
}

const defaults: NoteFormData = {
  color: '#FFFFFF',
  name: '',
  tags: []
};

interface NoteEditorProps {
  note: Note | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (noteId: string, updates: Partial<Note>) => void;
}

export function NoteEditor({ note, isOpen, onClose, onSave }: NoteEditorProps) {
  const [hasTagError, setHasTagError] = useState(false);
  const { toast } = useToastSettings();
  const { t } = useLanguage();
  
  const initialData = useMemo(() => 
    note ? {
      color: note.color || '#FFFFFF',
      name: note.name || '',
      tags: note.tags || []
    } : null,
    [note]
  );

  const { formData, updateField, resetForm } = useEditorForm<NoteFormData>({
    initialData,
    defaults,
    isOpen
  });

  const handleSave = () => {
    if (hasTagError) {
      toast.error(t('toastPasteFixTag'));
      return;
    }
    
    if (note) {
      const updates: Partial<Note> = {};
      if (formData.color !== note.color) {
        updates.color = formData.color;
      }
      if (formData.name !== note.name) {
        updates.name = formData.name;
      }
      const originalTags = note.tags || [];
      const tagsChanged = formData.tags.length !== originalTags.length || 
        formData.tags.some((tag, i) => tag !== originalTags[i]);
      if (tagsChanged) {
        updates.tags = formData.tags.length > 0 ? formData.tags : undefined;
      }
      if (Object.keys(updates).length > 0) {
        onSave(note.id, updates);
      }
    }
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
      /*
       * `editNote` is "Edit note" in every language, so the dialog title reads slightly
       * differently from the old hardcoded "Edit Note" — there is no `editNoteTitle` key.
       */
      title={t('editNote')}
      onSave={handleSave}
      saveLabel={t('save')}
    >
      <TitleInput
        id="noteTitle"
        label={t('title')}
        value={formData.name}
        onChange={(value) => updateField('name', value)}
        placeholder="Enter note title..."
        maxLength={50}
        icon={NotebookPen}
        iconColor={ICON_COLOR}
      />

      <TagEditor 
        tags={formData.tags} 
        onTagsChange={(tags) => updateField('tags', tags)}
        onValidationChange={setHasTagError}
        placeholder="Add tags (e.g., #work #project)"
        icon={Hash}
        iconColor={ICON_COLOR}
      />

      <ColorPicker 
        selectedColor={formData.color} 
        onColorChange={(color) => updateField('color', color)}
        icon={Palette}
        iconColor={ICON_COLOR}
      />
    </EditorDialog>
  );
}
