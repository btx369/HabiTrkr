import { useState, useEffect, useCallback, useRef } from 'react';

interface UseEditorFormOptions<T> {
  initialData: Partial<T> | null | undefined;
  defaults: T;
  isOpen: boolean;
}

interface UseEditorFormResult<T> {
  formData: T;
  setFormData: React.Dispatch<React.SetStateAction<T>>;
  updateField: <K extends keyof T>(field: K, value: T[K]) => void;
  hasChanges: boolean;
  resetForm: () => void;
}

export function useEditorForm<T extends object>({
  initialData,
  defaults,
  isOpen,
}: UseEditorFormOptions<T>): UseEditorFormResult<T> {
  const [formData, setFormData] = useState<T>(defaults);
  const snapshotRef = useRef<{ data: T; initialDataString: string }>({ 
    data: defaults, 
    initialDataString: '' 
  });

  // Initialize form when dialog opens or initialData changes
  useEffect(() => {
    if (isOpen) {
      const initialDataString = JSON.stringify(initialData);
      // Only reinitialize if initialData actually changed
      if (initialDataString !== snapshotRef.current.initialDataString) {
        const newData = initialData 
          ? { ...defaults, ...initialData } 
          : defaults;
        setFormData(newData);
        snapshotRef.current = { data: newData, initialDataString };
      }
    } else {
      // Reset the ref when dialog closes so next open will reinitialize
      snapshotRef.current.initialDataString = '';
    }
  }, [isOpen, initialData, defaults]);

  // Update a single field
  const updateField = useCallback(<K extends keyof T>(field: K, value: T[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  // Reset form to defaults
  const resetForm = useCallback(() => {
    setFormData(defaults);
    snapshotRef.current = { data: defaults, initialDataString: '' };
  }, [defaults]);

  // Check if form has changes from initial state
  const hasChanges = JSON.stringify(formData) !== JSON.stringify(snapshotRef.current.data);

  return {
    formData,
    setFormData,
    updateField,
    hasChanges,
    resetForm,
  };
}
