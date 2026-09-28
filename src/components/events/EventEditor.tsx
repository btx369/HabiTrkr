import { useMemo, useState } from 'react';
import { EditorDialog } from '@/components/shared/EditorDialog';
import { ColorPicker } from '@/components/shared/ColorPicker';
import { TitleInput } from '@/components/shared/TitleInput';
import { TagEditor } from '@/components/shared/TagEditor';
import { DaySelector } from '@/components/ui/day-selector';
import { DatePickerInput } from '@/components/ui/date-scroll-picker';
import { TimePickerDialog } from '@/components/ui/time-picker-dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Event, AlertType, AlertCustomUnit } from '@/types/event';
import { getTodayKey } from '@/lib/dateUtils';
import { useEditorForm } from '@/hooks/useEditorForm';
import { CustomAlertDialog } from './CustomAlertDialog';
import { Bell, CalendarClock, CalendarDays, Clock, Hash, MapPin, NotebookPen, NotebookText, Palette } from 'lucide-react';
import { useToastSettings } from '@/contexts/ToastContext';

const ICON_COLOR = 'currentColor';

interface EventFormData {
  name: string;
  description: string;
  color: string;
  isRecurrent: boolean;
  isAllDay: boolean;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  location: string;
  recurrenceType: 'daily' | 'weekly' | 'monthly' | 'yearly';
  recurrenceInterval: number | string;
  recurrenceDays: number[];
  tags: string[];
  alertType: AlertType;
  alertCustomValue: number;
  alertCustomUnit: AlertCustomUnit;
}

interface EventEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (eventData: Omit<Event, 'id' | 'createdAt'>) => void;
  initialEvent?: Event | null;
  mode?: 'create' | 'edit';
}

const ALERT_OPTIONS: { value: AlertType; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: '5min', label: '5 minutes before' },
  { value: '15min', label: '15 minutes before' },
  { value: '30min', label: '30 minutes before' },
  { value: '1hour', label: '1 hour before' },
  { value: '4hours', label: '4 hours before' },
  { value: '12hours', label: '12 hours before' },
  { value: '1day', label: '1 day before' },
  { value: '4weeks', label: '4 weeks before' },
  { value: 'custom', label: 'Custom...' },
];

const getDefaultDates = () => {
  const today = getTodayKey();
  return { startDate: today, endDate: today };
};

const defaults: EventFormData = {
  name: '',
  description: '',
  color: '#FFFFFF',
  isRecurrent: false,
  isAllDay: false,
  startDate: getDefaultDates().startDate,
  startTime: '',
  endDate: getDefaultDates().endDate,
  endTime: '',
  location: '',
  recurrenceType: 'weekly',
  recurrenceInterval: 1,
  recurrenceDays: [0, 1, 2, 3, 4, 5, 6],
  tags: [],
  alertType: 'none',
  alertCustomValue: 30,
  alertCustomUnit: 'minutes'
};

export function EventEditor({ isOpen, onClose, onSave, initialEvent, mode = 'create' }: EventEditorProps) {
  const [isCustomAlertOpen, setIsCustomAlertOpen] = useState(false);
  const [isStartTimePickerOpen, setIsStartTimePickerOpen] = useState(false);
  const [isEndTimePickerOpen, setIsEndTimePickerOpen] = useState(false);
  const [hasEndDateError, setHasEndDateError] = useState(false);
  const [hasTagError, setHasTagError] = useState(false);
  const { toast } = useToastSettings();
  
  const initialData = useMemo(() => 
    initialEvent ? {
      name: initialEvent.name,
      description: initialEvent.description || '',
      color: initialEvent.color,
      isRecurrent: initialEvent.isRecurrent || false,
      // Derive isAllDay: explicit field OR no times set
      isAllDay: initialEvent.isAllDay ?? (!initialEvent.startTime && !initialEvent.time && !initialEvent.endTime),
      // Support both legacy and new date fields
      startDate: initialEvent.startDate || initialEvent.date || '',
      startTime: initialEvent.startTime || initialEvent.time || '',
      endDate: initialEvent.endDate || initialEvent.date || '',
      endTime: initialEvent.endTime || '',
      location: initialEvent.location || '',
      recurrenceType: initialEvent.recurrenceType || 'weekly',
      recurrenceInterval: initialEvent.recurrenceInterval || 1,
      recurrenceDays: initialEvent.recurrenceDays || [0, 1, 2, 3, 4, 5, 6],
      tags: initialEvent.tags || [],
      alertType: initialEvent.alertType || 'none',
      alertCustomValue: initialEvent.alertCustomValue || 30,
      alertCustomUnit: initialEvent.alertCustomUnit || 'minutes'
    } : null,
    [initialEvent]
  );

  const { formData, setFormData, resetForm } = useEditorForm<EventFormData>({
    initialData,
    defaults,
    isOpen
  });

  const handleSave = () => {
    if (!formData.name.trim()) return;
    
    // Validate tags
    if (hasTagError) {
      toast.error("Please fix the tag format before saving");
      return;
    }
    
    // Validate end date/time is not before start date/time
    if (formData.startDate && formData.endDate) {
      const startDateTime = new Date(`${formData.startDate}T${formData.startTime || '00:00'}`);
      const endDateTime = new Date(`${formData.endDate}T${formData.endTime || '23:59'}`);
      
      if (endDateTime < startDateTime) {
        setHasEndDateError(true);
        toast.error("The End Date can't be before the Start Date");
        return;
      }
    }
    
    setHasEndDateError(false);
    
    onSave({
      name: formData.name,
      description: formData.description,
      color: formData.color,
      isRecurrent: formData.isRecurrent,
      isAllDay: formData.isAllDay,
      // Use startDate as the primary date for backwards compatibility
      date: formData.startDate,
      time: formData.isAllDay ? undefined : (formData.startTime || undefined),
      startDate: formData.startDate,
      startTime: formData.isAllDay ? undefined : (formData.startTime || undefined),
      endDate: formData.endDate || undefined,
      endTime: formData.isAllDay ? undefined : (formData.endTime || undefined),
      location: formData.location || undefined,
      recurrenceType: formData.isRecurrent ? formData.recurrenceType : undefined,
      recurrenceInterval: formData.isRecurrent 
        ? (typeof formData.recurrenceInterval === 'string' 
            ? parseInt(formData.recurrenceInterval) || 1 
            : formData.recurrenceInterval) 
        : undefined,
      recurrenceDays: formData.isRecurrent && formData.recurrenceType === 'weekly' 
        ? formData.recurrenceDays 
        : undefined,
      tags: formData.tags.length > 0 ? formData.tags : undefined,
      alertType: formData.alertType !== 'none' ? formData.alertType : undefined,
      alertCustomValue: formData.alertType === 'custom' ? formData.alertCustomValue : undefined,
      alertCustomUnit: formData.alertType === 'custom' ? formData.alertCustomUnit : undefined
    });
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleAllDayToggle = (checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      isAllDay: checked,
      // Clear times when toggling to all-day, keep dates unchanged
      startTime: checked ? '' : prev.startTime,
      endTime: checked ? '' : prev.endTime
    }));
  };

  const handleRecurrentToggle = (checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      isRecurrent: checked
    }));
    // Scroll to show recurrent options when toggled on
    if (checked) {
      setTimeout(() => {
        const recurrentSection = document.getElementById('recurrent-options');
        if (recurrentSection) {
          recurrentSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }, 100);
    }
  };

  const handleAlertChange = (value: AlertType) => {
    if (value === 'custom') {
      setIsCustomAlertOpen(true);
    } else {
      setFormData(prev => ({ ...prev, alertType: value }));
    }
  };

  const handleCustomAlertSave = (value: number, unit: AlertCustomUnit) => {
    setFormData(prev => ({
      ...prev,
      alertType: 'custom',
      alertCustomValue: value,
      alertCustomUnit: unit
    }));
  };

  const getAlertDisplayValue = () => {
    if (formData.alertType === 'custom') {
      return `${formData.alertCustomValue} ${formData.alertCustomUnit} before`;
    }
    return ALERT_OPTIONS.find(opt => opt.value === formData.alertType)?.label || 'None';
  };

  return (
    <>
      <EditorDialog
        isOpen={isOpen}
        onClose={handleClose}
        title={mode === 'create' ? 'Create Event' : 'Edit Event'}
        onSave={handleSave}
        saveLabel={mode === 'create' ? 'Create Event' : 'Save Changes'}
        saveDisabled={!formData.name.trim()}
      >
        {/* Title */}
        <TitleInput
          id="event-name"
          label="Title"
          value={formData.name}
          onChange={(value) => setFormData(prev => ({ ...prev, name: value }))}
          placeholder="e.g., Birthday party"
          maxLength={35}
          required
          icon={NotebookPen}
          iconColor={ICON_COLOR}
        />

        {/* Date and Time Section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-base flex items-center gap-2">
              <CalendarClock size={16} color={ICON_COLOR} />
              Date and Time
            </Label>
            <div className="flex items-center gap-2">
              <Label htmlFor="all-day" className="text-sm text-muted-foreground">All Day</Label>
              <Switch 
                id="all-day" 
                checked={formData.isAllDay} 
                onCheckedChange={handleAllDayToggle} 
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {/* Start */}
            <div className="space-y-2">
              <DatePickerInput
                id="event-start-date"
                value={formData.startDate}
                onChange={(value) => setFormData(prev => ({ 
                  ...prev, 
                  startDate: value,
                  endDate: (!prev.endDate || prev.endDate === prev.startDate) ? value : prev.endDate
                }))}
                label="Start"
                icon={CalendarDays}
                iconColor={ICON_COLOR}
                iconPosition="left"
              />
              {!formData.isAllDay && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsStartTimePickerOpen(true)}
                  className="w-full h-12 text-base bg-muted justify-start gap-2"
                >
                  <Clock size={16} color={ICON_COLOR} />
                  {formData.startTime || 'Set time'}
                </Button>
              )}
            </div>
            
            {/* End */}
            <div className={`space-y-2 p-2 -m-2 rounded-lg transition-colors ${hasEndDateError ? 'bg-destructive/20' : ''}`}>
              <DatePickerInput
                id="event-end-date"
                value={formData.endDate}
                onChange={(value) => {
                  setFormData(prev => ({ ...prev, endDate: value }));
                  setHasEndDateError(false);
                }}
                label="End"
                icon={CalendarDays}
                iconColor={ICON_COLOR}
                iconPosition="left"
              />
              {!formData.isAllDay && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEndTimePickerOpen(true)}
                  className={`w-full h-12 text-base justify-start gap-2 ${hasEndDateError ? 'bg-destructive/20 border-destructive/50' : 'bg-muted'}`}
                >
                  <Clock size={16} color={ICON_COLOR} />
                  {formData.endTime || 'Set time'}
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Recurrent Event */}
        <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
          <Label htmlFor="recurrent" className="text-base">Recurrent Event</Label>
          <Switch 
            id="recurrent" 
            checked={formData.isRecurrent} 
            onCheckedChange={handleRecurrentToggle} 
          />
        </div>
        
        {formData.isRecurrent && (
          <div id="recurrent-options" className="space-y-4 p-4 bg-muted rounded-lg">
            <div>
              <Label className="text-base">Repeat every</Label>
              <div className="flex gap-3 mt-3">
                <Input 
                  type="number" 
                  min="1" 
                  value={formData.recurrenceInterval} 
                  onChange={e => setFormData(prev => ({ 
                    ...prev, 
                    recurrenceInterval: e.target.value === '' ? '' : parseInt(e.target.value) || 1 
                  }))}
                  onBlur={e => setFormData(prev => ({ 
                    ...prev, 
                    recurrenceInterval: parseInt(e.target.value) || 1 
                  }))}
                  className="w-20 h-12 text-base bg-background"
                />
                <select 
                  value={formData.recurrenceType} 
                  onChange={e => setFormData(prev => ({ 
                    ...prev, 
                    recurrenceType: e.target.value as EventFormData['recurrenceType'] 
                  }))}
                  className="px-4 py-3 border rounded-md bg-background h-12 text-base flex-1"
                >
                  <option value="daily">Day(s)</option>
                  <option value="weekly">Week(s)</option>
                  <option value="monthly">Month(s)</option>
                  <option value="yearly">Year(s)</option>
                </select>
              </div>
            </div>
            
            {formData.recurrenceType === 'weekly' && (
              <div>
                <Label className="text-base">On these days</Label>
                <DaySelector 
                  selectedDays={formData.recurrenceDays}
                  onDaysChange={(days) => setFormData(prev => ({ ...prev, recurrenceDays: days as number[] }))}
                  variant="multi-select"
                />
              </div>
            )}
          </div>
        )}

        {/* Alert */}
        <div className="space-y-2">
          <Label className="text-base flex items-center gap-2">
            <Bell size={16} color={ICON_COLOR} />
            Alert
          </Label>
          <Select
            value={formData.alertType}
            onValueChange={handleAlertChange}
          >
            <SelectTrigger className="h-12 text-base bg-muted">
              <SelectValue>
                {getAlertDisplayValue()}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {ALERT_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Location */}
        <TitleInput
          id="event-location"
          label="Location"
          value={formData.location}
          onChange={(value) => setFormData(prev => ({ ...prev, location: value }))}
          placeholder="e.g., Conference Room A"
          maxLength={100}
          icon={MapPin}
          iconColor={ICON_COLOR}
        />
        
        {/* Description */}
        <TitleInput
          id="event-description"
          label="Description"
          value={formData.description}
          onChange={(value) => setFormData(prev => ({ ...prev, description: value }))}
          placeholder="Add more details about this event..."
          maxLength={200}
          icon={NotebookText}
          iconColor={ICON_COLOR}
        />

        {/* Tags */}
        <TagEditor 
          tags={formData.tags} 
          onTagsChange={(tags) => setFormData(prev => ({ ...prev, tags }))}
          onValidationChange={setHasTagError}
          placeholder="Add tags (e.g., #work #meeting)"
          suggestionsLimit={100}
          icon={Hash}
          iconColor={ICON_COLOR}
        />
        
        {/* Color */}
        <ColorPicker 
          selectedColor={formData.color} 
          onColorChange={(color) => setFormData(prev => ({ ...prev, color }))}
          icon={Palette}
          iconColor={ICON_COLOR}
        />
      </EditorDialog>

      {/* Custom Alert Dialog */}
      <CustomAlertDialog
        isOpen={isCustomAlertOpen}
        onClose={() => setIsCustomAlertOpen(false)}
        onSave={handleCustomAlertSave}
        initialValue={formData.alertCustomValue}
        initialUnit={formData.alertCustomUnit}
      />

      {/* Time Picker Dialogs */}
      <TimePickerDialog
        isOpen={isStartTimePickerOpen}
        onClose={() => setIsStartTimePickerOpen(false)}
        onSave={(time) => setFormData(prev => ({ ...prev, startTime: time }))}
        initialTime={formData.startTime}
      />
      <TimePickerDialog
        isOpen={isEndTimePickerOpen}
        onClose={() => setIsEndTimePickerOpen(false)}
        onSave={(time) => setFormData(prev => ({ ...prev, endTime: time }))}
        initialTime={formData.endTime}
      />
    </>
  );
}
