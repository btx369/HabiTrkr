import { useState, useEffect } from 'react';
import { Note } from '@/types/note';
import { TagEditor } from '@/components/shared/TagEditor';

interface TagEditorPopoverProps {
  note: Note;
  onSave: (noteId: string, updates: Partial<Note>) => void;
  noteColor?: string;
}

export function TagEditorPopover({ note, onSave, noteColor }: TagEditorPopoverProps) {
  const [currentTags, setCurrentTags] = useState<string[]>(note.tags || []);

  useEffect(() => {
    setCurrentTags(note.tags || []);
  }, [note.id, note.tags]);

  const handleTagsChange = (newTags: string[]) => {
    setCurrentTags(newTags);
    onSave(note.id, { tags: newTags });
  };

  return (
    <TagEditor 
      tags={currentTags} 
      onTagsChange={handleTagsChange}
      placeholder="Add tags (e.g., #work #project)"
      noteColor={noteColor}
    />
  );
}
