import { useEffect, useMemo, useState } from 'react';
import { EditorDialog } from '@/components/shared/EditorDialog';
import { ColorPicker } from '@/components/shared/ColorPicker';
import { TitleInput } from '@/components/shared/TitleInput';
import { ConfirmationDialog } from '@/components/shared/ConfirmationDialog';
import { DaySelector } from '@/components/ui/day-selector';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Habit } from '@/types/habit';
import { getTodayKey } from '@/lib/dateUtils';
import { useEditorForm } from '@/hooks/useEditorForm';
import { NotebookPen, FileText, Palette } from 'lucide-react';

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
  useUnlimitedTimes: false
};

export function HabitEditor({ isOpen, onClose, onSave, initialHabit, mode = 'create' }: HabitEditorProps) {
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
      useUnlimitedTimes: initialHabit.useUnlimitedTimes || false
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
      return "Your completion count will be preserved. Today's completed status will be cleared since unlimited mode has no daily goal.";
    }
    return "Your completion count will be preserved. If it meets the new daily goal, today will be marked as complete.";
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
      useUnlimitedTimes: formData.useUnlimitedTimes
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
      title={mode === 'create' ? 'Create Habit' : 'Edit Habit'}
      onSave={handleSave}
      saveLabel={mode === 'create' ? 'Create Habit' : 'Save Changes'}
      saveDisabled={!formData.name.trim()}
    >
      <TitleInput
        id="habit-name"
        label="Title"
        value={formData.name}
        onChange={(value) => setFormData(prev => ({ ...prev, name: value }))}
        placeholder="e.g., Drink 8 glasses of water"
        maxLength={35}
        required
        icon={NotebookPen}
        iconColor={ICON_COLOR}
      />
      
      {mode === 'create' && (
        <TitleInput
          id="habit-description"
          label="Description"
          value={formData.description}
          onChange={(value) => setFormData(prev => ({ ...prev, description: value }))}
          placeholder="Add more details about this habit..."
          maxLength={35}
          icon={FileText}
          iconColor={ICON_COLOR}
        />
      )}
      
      <ColorPicker 
        selectedColor={formData.color} 
        onColorChange={(color) => setFormData(prev => ({ ...prev, color }))}
        icon={Palette}
        iconColor={ICON_COLOR}
      />
      
      <div>
        <Label className="text-base">{mode === 'create' ? 'Days of the Week' : 'Active Days'}</Label>
        <DaySelector 
          selectedDays={formData.selectedDays}
          onDaysChange={(days) => setFormData(prev => ({ ...prev, selectedDays: days as boolean[] }))}
          variant="toggle"
        />
      </div>
      
      <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
        <Label htmlFor="number-of-days" className="text-base">Number of days</Label>
        <Switch 
          id="number-of-days" 
          checked={formData.useNumberOfDays} 
          onCheckedChange={handleNumberOfDaysToggle} 
        />
      </div>
      
      {formData.useNumberOfDays && (
        <div className="space-y-4 p-4 bg-muted rounded-lg">
          <div>
            <Label className="text-base">Days per week</Label>
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
                className="w-20 h-10 text-base"
              />
              <div className="flex items-center px-2 text-sm text-muted-foreground">
                days per week
              </div>
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <Label htmlFor="times-per-day" className="text-base">Times a day</Label>
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
              <Label className="text-base">Times per day</Label>
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
                  className="w-20 h-10 text-base"
                />
                <div className="flex items-center px-2 text-sm text-muted-foreground">
                  times per day
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      
      <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
        <Label htmlFor="unlimited-times" className="text-base">Unlimited times</Label>
        <Switch 
          id="unlimited-times" 
          checked={formData.useUnlimitedTimes} 
          onCheckedChange={handleUnlimitedToggle} 
        />
      </div>

      <ConfirmationDialog
        open={showModeConfirmation}
        onOpenChange={setShowModeConfirmation}
        title="Change Tracking Mode?"
        description={getModeChangeMessage()}
        onConfirm={handleModeChangeConfirm}
        onCancel={handleModeChangeCancel}
        action="mode-change"
        hideOverlay
      />
    </EditorDialog>
  );
}
