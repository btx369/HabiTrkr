import { useEffect, useMemo, useState } from 'react';
import { EditorDialog } from '@/components/shared/EditorDialog';
import { ColorPicker } from '@/components/shared/ColorPicker';
import { TitleInput } from '@/components/shared/TitleInput';
import { ConfirmationDialog } from '@/components/shared/ConfirmationDialog';
import { TagEditor } from '@/components/shared/TagEditor';
import { useToastSettings } from '@/contexts/ToastContext';
import { DaySelector } from '@/components/ui/day-selector';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Habit } from '@/types/habit';
import { getTodayKey } from '@/lib/dateUtils';
import { useEditorForm } from '@/hooks/useEditorForm';
import { useLanguage } from '@/contexts/LanguageContext';
import { NotebookPen, FileText, Palette, Hash } from 'lucide-react';

const ICON_COLOR = 'currentColor';

interface HabitFormData {
  name: string;
  description: string;
  color: string;
  selectedDays: boolean[];
  useNumberOfDays: boolean;
  numberOfDaysPerWeek: number | string;
  useTimesPerDay: boolean;
  timesPerDay: number | string;
  useUnlimitedTimes: boolean;
  tags: string[];
}

interface HabitEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (habitData: Omit<Habit, 'id' | 'createdAt' | 'completedDates' | 'completionCounts'>) => void;
  initialHabit?: Habit | null;
  mode?: 'create' | 'edit';
}

const defaults: HabitFormData = {
  name: '',
  description: '',
  color: '#FFFFFF',
  selectedDays: [true, true, true, true, true, true, true],
  useNumberOfDays: false,
  numberOfDaysPerWeek: 1,
  useTimesPerDay: false,
  timesPerDay: 1,
  useUnlimitedTimes: false,
  tags: [],
};

export function HabitEditor({ isOpen, onClose, onSave, initialHabit, mode = 'create' }: HabitEditorProps) {
  const { t } = useLanguage();
  const { toast } = useToastSettings();
  const [hasTagError, setHasTagError] = useState(false);
  const initialData = useMemo(() => 
    initialHabit ? {
      name: initialHabit.name,
      description: initialHabit.description || '',
      color: initialHabit.color,
      selectedDays: initialHabit.activeDays || [true, true, true, true, true, true, true],
      useNumberOfDays: initialHabit.useNumberOfDays || false,
      numberOfDaysPerWeek: initialHabit.numberOfDaysPerWeek || 1,
      useTimesPerDay: initialHabit.useTimesPerDay || false,
      timesPerDay: initialHabit.timesPerDay || 1,
      useUnlimitedTimes: initialHabit.useUnlimitedTimes || false,
      tags: initialHabit.tags || [],
    } : null,
    [initialHabit]
  );

  const { formData, setFormData, resetForm } = useEditorForm<HabitFormData>({
    initialData,
    defaults,
    isOpen
  });

  // Mode change confirmation state
  const [showModeConfirmation, setShowModeConfirmation] = useState(false);
  const [pendingModeChange, setPendingModeChange] = useState<{
    type: 'toUnlimited' | 'fromUnlimited';
    apply: () => void;
  } | null>(null);

  // Check if there's existing progress today
  const hasTodayProgress = useMemo(() => {
    if (!initialHabit || mode !== 'edit') return false;
    return (initialHabit.completionCounts?.[getTodayKey()] || 0) > 0;
  }, [initialHabit, mode]);

  const handleUnlimitedToggle = (checked: boolean) => {
    if (checked && hasTodayProgress) {
      // Switching TO unlimited mode with existing progress
      setPendingModeChange({
        type: 'toUnlimited',
        apply: () => setFormData(prev => ({
          ...prev,
          useUnlimitedTimes: true,
          useNumberOfDays: false,
          useTimesPerDay: false
        }))
      });
      setShowModeConfirmation(true);
    } else {
      setFormData(prev => ({
        ...prev,
        useUnlimitedTimes: checked,
        useNumberOfDays: checked ? false : prev.useNumberOfDays,
        useTimesPerDay: checked ? false : prev.useTimesPerDay
      }));
    }
  };

  const handleNumberOfDaysToggle = (checked: boolean) => {
    if (checked && formData.useUnlimitedTimes && hasTodayProgress) {
      // Switching FROM unlimited mode with existing progress
      setPendingModeChange({
        type: 'fromUnlimited',
        apply: () => setFormData(prev => ({
          ...prev,
          useNumberOfDays: true,
          useUnlimitedTimes: false
        }))
      });
      setShowModeConfirmation(true);
    } else {
      setFormData(prev => ({
        ...prev,
        useNumberOfDays: checked,
        // "Times per day" lives inside this section; hiding the section must not leave
        // it switched on, or the habit is saved with a counter nobody can see or edit.
        useTimesPerDay: checked ? prev.useTimesPerDay : false,
        useUnlimitedTimes: checked ? false : prev.useUnlimitedTimes
      }));
    }
  };

  const handleModeChangeConfirm = () => {
    pendingModeChange?.apply();
    setShowModeConfirmation(false);
    setPendingModeChange(null);
  };

  const handleModeChangeCancel = () => {
    setShowModeConfirmation(false);
    setPendingModeChange(null);
  };

  const getModeChangeMessage = () => {
    if (pendingModeChange?.type === 'toUnlimited') {
      return t('modeChangeToUnlimited');
    }
    return t('modeChangeToGoal');
  };

  // Auto-scroll when toggles are activated
  useEffect(() => {
    if (formData.useNumberOfDays || formData.useTimesPerDay || formData.useUnlimitedTimes) {
      setTimeout(() => {
        const dialogContent = document.querySelector('[data-state="open"] .overflow-y-auto');
        if (dialogContent) {
          const scrollHeight = dialogContent.scrollHeight;
          const clientHeight = dialogContent.clientHeight;
          if (scrollHeight > clientHeight) {
            dialogContent.scrollTo({ top: scrollHeight - clientHeight + 100, behavior: 'smooth' });
          }
        }
      }, 150);
    }
  }, [formData.useNumberOfDays, formData.useTimesPerDay, formData.useUnlimitedTimes]);

  const handleSave = () => {
    if (!formData.name.trim()) return;
    if (hasTagError) {
      toast.error(t('toastPasteFixTag'));
      return;
    }
    
    onSave({
      name: formData.name,
      description: formData.description,
      color: formData.color,
      activeDays: formData.selectedDays,
      useNumberOfDays: formData.useNumberOfDays,
      numberOfDaysPerWeek: typeof formData.numberOfDaysPerWeek === 'string' 
        ? parseInt(formData.numberOfDaysPerWeek) || 1 
        : formData.numberOfDaysPerWeek,
      useTimesPerDay: formData.useTimesPerDay,
      timesPerDay: typeof formData.timesPerDay === 'string' 
        ? parseInt(formData.timesPerDay) || 1 
        : formData.timesPerDay,
      useUnlimitedTimes: formData.useUnlimitedTimes,
      tags: formData.tags.length > 0 ? formData.tags : undefined,
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
      title={mode === 'create' ? t('createHabit') : t('editHabit')}
      onSave={handleSave}
      saveLabel={t('save')}
      saveDisabled={!formData.name.trim()}
    >
      <TitleInput
        id="habit-name"
        label={t('title')}
        value={formData.name}
        onChange={(value) => setFormData(prev => ({ ...prev, name: value }))}
        placeholder={t('placeholderHabitName')}
        maxLength={35}
        required
        icon={NotebookPen}
        iconColor={ICON_COLOR}
      />
      
      {mode === 'create' && (
        <TitleInput
          id="habit-description"
          label={t('description')}
          value={formData.description}
          onChange={(value) => setFormData(prev => ({ ...prev, description: value }))}
          placeholder={t('placeholderHabitDescription')}
          maxLength={35}
          icon={FileText}
          iconColor={ICON_COLOR}
        />
      )}
      
      <TagEditor
        tags={formData.tags}
        onTagsChange={(tags) => setFormData(prev => ({ ...prev, tags }))}
        onValidationChange={setHasTagError}
        placeholder={t('placeholderAddTagsHabit')}
        suggestionsLimit={100}
        icon={Hash}
        iconColor={ICON_COLOR}
      />

      <ColorPicker 
        selectedColor={formData.color} 
        onColorChange={(color) => setFormData(prev => ({ ...prev, color }))}
        icon={Palette}
        iconColor={ICON_COLOR}
        singleRow
      />
      
      <div>
        <Label className="text-sm">{t('daysOfWeek')}</Label>
        <DaySelector 
          selectedDays={formData.selectedDays}
          onDaysChange={(days) => setFormData(prev => ({ ...prev, selectedDays: days as boolean[] }))}
          variant="toggle"
        />
      </div>
      
      <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
        <Label htmlFor="number-of-days" className="text-sm">{t('numberOfDays')}</Label>
        <Switch 
          id="number-of-days" 
          checked={formData.useNumberOfDays} 
          onCheckedChange={handleNumberOfDaysToggle} 
        />
      </div>
      
      {formData.useNumberOfDays && (
        <div className="space-y-4 p-4 bg-muted rounded-lg">
          <div>
            <Label className="text-sm">{t('daysPerWeek')}</Label>
            <div className="flex gap-3 mt-2">
              <Input 
                type="number" 
                min="1" 
                max="7"
                value={formData.numberOfDaysPerWeek} 
                onChange={e => {
                  const val = e.target.value === '' ? '' : Math.min(parseInt(e.target.value) || 1, 7);
                  setFormData(prev => ({ ...prev, numberOfDaysPerWeek: val }));
                }}
                onBlur={e => setFormData(prev => ({ 
                  ...prev, 
                  numberOfDaysPerWeek: Math.min(Math.max(parseInt(e.target.value) || 1, 1), 7)
                }))}
                className="w-20 h-10 text-sm"
              />
              <div className="flex items-center px-2 text-sm text-muted-foreground">
                {t('daysPerWeekInline')}
              </div>
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <Label htmlFor="times-per-day" className="text-sm">{t('timesADay')}</Label>
            <Switch 
              id="times-per-day" 
              checked={formData.useTimesPerDay} 
              onCheckedChange={checked => setFormData(prev => ({
                ...prev,
                useTimesPerDay: checked
              }))} 
            />
          </div>
          
          {formData.useTimesPerDay && (
            <div>
              <Label className="text-sm">{t('timesPerDay')}</Label>
              <div className="flex gap-3 mt-2">
                <Input 
                  type="number" 
                  min="1" 
                  max="999"
                  value={formData.timesPerDay} 
                  onChange={e => {
                    const val = e.target.value === '' ? '' : Math.min(parseInt(e.target.value) || 1, 999);
                    setFormData(prev => ({ ...prev, timesPerDay: val }));
                  }}
                  onBlur={e => setFormData(prev => ({ 
                    ...prev, 
                    timesPerDay: Math.min(Math.max(parseInt(e.target.value) || 1, 1), 999)
                  }))}
                  className="w-20 h-10 text-sm"
                />
                <div className="flex items-center px-2 text-sm text-muted-foreground">
                  {t('timesPerDayInline')}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      
      <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
        <Label htmlFor="unlimited-times" className="text-sm">{t('unlimitedTimes')}</Label>
        <Switch 
          id="unlimited-times" 
          checked={formData.useUnlimitedTimes} 
          onCheckedChange={handleUnlimitedToggle} 
        />
      </div>

      <ConfirmationDialog
        open={showModeConfirmation}
        onOpenChange={setShowModeConfirmation}
        title={t('changeTrackingMode')}
        description={getModeChangeMessage()}
        onConfirm={handleModeChangeConfirm}
        onCancel={handleModeChangeCancel}
        action="mode-change"
        hideOverlay
      />
    </EditorDialog>
  );
}
