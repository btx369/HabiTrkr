import { useMemo, useState } from 'react';
import { EditorDialog } from '@/components/shared/EditorDialog';
import { ColorPicker } from '@/components/shared/ColorPicker';
import { TitleInput } from '@/components/shared/TitleInput';
import { TagEditor } from '@/components/shared/TagEditor';
import { DaySelector } from '@/components/ui/day-selector';
import { DatePickerInput } from '@/components/ui/date-scroll-picker';
import { TimePickerDialog, oneHourAfter } from '@/components/ui/time-picker-dialog';
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
import { useLanguage } from '@/contexts/LanguageContext';

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
  /** Day a new event starts on (yyyy-MM-dd); today when left out. */
  initialDate?: string;
}

/**
 * The alert options, resolved with `t()`.
 *
 * Built by a function of `t` rather than declared as a constant, because most of the
 * labels have to be COMPOSED from a count, a unit and `before` — a module level table
 * cannot call the hook, and a bare key cannot express "5 minutes before". The caller
 * resolves them once per render; see `alertOptions` in the component.
 *
 * `value` is the AlertType discriminant and is never translated.
 */
const getAlertOptions = (t: (key: string) => string): { value: AlertType; label: string }[] => [
  { value: 'none', label: t('none') },
  { value: '5min', label: `${5} ${t('unitMinutes')} ${t('before')}` },
  { value: '15min', label: `${15} ${t('unitMinutes')} ${t('before')}` },
  { value: '30min', label: `${30} ${t('unitMinutes')} ${t('before')}` },
  // `unitHour` exists for exactly this: the plural key would read "1 hours before".
  { value: '1hour', label: `${1} ${t('unitHour')} ${t('before')}` },
  { value: '4hours', label: `${4} ${t('unitHours')} ${t('before')}` },
  { value: '12hours', label: `${12} ${t('unitHours')} ${t('before')}` },
  { value: '1day', label: `${1} ${t('unitDays')} ${t('before')}` },
  { value: '4weeks', label: `${4} ${t('unitWeeks')} ${t('before')}` },
  { value: 'custom', label: t('custom') },
];

/**
 * The stored AlertCustomUnit values as unit translation keys, for composing the label of
 * a custom alert ("30 minutes before") the same way the fixed options above do.
 */
const CUSTOM_ALERT_UNIT_KEYS: Record<AlertCustomUnit, string> = {
  minutes: 'unitMinutes',
  hours: 'unitHours',
  days: 'unitDays',
  weeks: 'unitWeeks',
};

/**
 * The recurrence units, declared like the alert options so both selects read the same way.
 * Here every label is a single key, so the table holds the KEY and the render site calls
 * `t()` — the same pattern BulkActionBar uses.
 * These labels were previously the <option> text of a native select.
 */
const RECURRENCE_OPTIONS: { value: EventFormData['recurrenceType']; label: string }[] = [
  { value: 'daily', label: 'repeatDays' },
  { value: 'weekly', label: 'repeatWeeks' },
  { value: 'monthly', label: 'repeatMonths' },
  { value: 'yearly', label: 'repeatYears' },
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

export function EventEditor({ isOpen, onClose, onSave, initialEvent, mode = 'create', initialDate }: EventEditorProps) {
  const [isCustomAlertOpen, setIsCustomAlertOpen] = useState(false);
  const [isStartTimePickerOpen, setIsStartTimePickerOpen] = useState(false);
  const [isEndTimePickerOpen, setIsEndTimePickerOpen] = useState(false);
  const [hasEndDateError, setHasEndDateError] = useState(false);
  const [hasTagError, setHasTagError] = useState(false);
  const { toast } = useToastSettings();
  const { t } = useLanguage();
  
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

  // Built when the editor opens, so a new event starts on the chosen day (Calendar) or on
  // today, not on the day the app was loaded.
  const formDefaults = useMemo<EventFormData>(() => {
    const day = initialDate ?? getTodayKey();
    return { ...defaults, startDate: day, endDate: day };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recomputed on every open
  }, [initialDate, isOpen]);

  const { formData, setFormData, resetForm } = useEditorForm<EventFormData>({
    initialData,
    defaults: formDefaults,
    isOpen
  });

  const handleSave = () => {
    if (!formData.name.trim()) return;
    
    // Validate tags
    if (hasTagError) {
      toast.error(t('toastPasteFixTag'));
      return;
    }
    
    // Validate end date/time is not before start date/time
    if (formData.startDate && formData.endDate) {
      const startDateTime = new Date(`${formData.startDate}T${formData.startTime || '00:00'}`);
      const endDateTime = new Date(`${formData.endDate}T${formData.endTime || '23:59'}`);
      
      if (endDateTime < startDateTime) {
        setHasEndDateError(true);
        toast.error(t('toastEndBeforeStart'));
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

  /** The alert options with their labels resolved, for this render. */
  const alertOptions = getAlertOptions(t);

  const getAlertDisplayValue = () => {
    if (formData.alertType === 'custom') {
      // Composed like the fixed options, from the unit key behind the stored value.
      return `${formData.alertCustomValue} ${t(CUSTOM_ALERT_UNIT_KEYS[formData.alertCustomUnit])} ${t('before')}`;
    }
    // Falls back to the same literal the `none` option shows, so the trigger can never
    // read differently from the option it stands for.
    return alertOptions.find(opt => opt.value === formData.alertType)?.label || t('none');
  };

  return (
    <>
      <EditorDialog
        isOpen={isOpen}
        onClose={handleClose}
        title={mode === 'create' ? t('createEvent') : t('editEvent')}
        onSave={handleSave}
        saveLabel={t('save')}
        saveDisabled={!formData.name.trim()}
      >
        {/* Title */}
        <TitleInput
          id="event-name"
          label={t('title')}
          value={formData.name}
          onChange={(value) => setFormData(prev => ({ ...prev, name: value }))}
          placeholder={t('placeholderEventTitle')}
          maxLength={35}
          required
          icon={NotebookPen}
          iconColor={ICON_COLOR}
        />

        {/*
          * dateAndTime section.
          *
          * `space-y-3` (12px) throughout, so the section has ONE rhythm instead of three:
          * it used to be 8px from this label to the fields, 12px from a date field to its
          * setTime button, and then 24px out to the next section. The pairing that
          * matters most — a date and the time that goes with it — was therefore the second
          * largest gap in the block, which read as the two being unrelated while the
          * label drifted up towards the title field above it.
          *
          * Measured before the change: 24 / 8 / 12 / 24. After: 24 / 12 / 12 / 24.
          */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm flex items-center gap-2">
              <CalendarClock size={20} color={ICON_COLOR} />
              {t('dateAndTime')}
            </Label>
            <div className="flex items-center gap-2">
              <Label htmlFor="all-day" className="text-sm text-muted-foreground">{t('allDay')}</Label>
              <Switch 
                id="all-day" 
                checked={formData.isAllDay} 
                onCheckedChange={handleAllDayToggle} 
              />
            </div>
          </div>
          {/*
            * `items-start`: the two columns hold the same fields but the End column can
            * grow — it turns red and gains padding when the end date is invalid. Left to
            * stretch, the shorter Start column was padded down to match, which pushed the
            * section's own box well below its visible setTime button and made the gap to
            * the next section depend on the other column's height. Each column now ends
            * where its own content ends.
            */}
          <div className="grid grid-cols-2 gap-4 items-start">
            {/* Start */}
            {/*
              * `space-y-3` (12px), not `space-y-2`. Inside a column the date field and the
              * time button belong together, but every other label-to-control gap in this form
              * is 8px and the gap between sections is 24px — so an 8px pairing read as a
              * section break and the setTime button looked adrift from the date above it.
              * 12px keeps the pair together while staying clearly tighter than a section gap.
              */}
            <div className="space-y-3">
              <DatePickerInput
                id="event-start-date"
                value={formData.startDate}
                onChange={(value) => setFormData(prev => ({ 
                  ...prev, 
                  startDate: value,
                  endDate: (!prev.endDate || prev.endDate === prev.startDate) ? value : prev.endDate
                }))}
                label={t('start')}
                icon={CalendarDays}
                iconColor={ICON_COLOR}
                iconPosition="left"
              />
              {!formData.isAllDay && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsStartTimePickerOpen(true)}
                  /*
                   * `rounded-md`, because the Button base is `rounded-full`. The date field
                   * directly above is a rounded-md input and so is every other control in this
                   * form, so this one was the odd shape out.
                   */
                  className="w-full h-10 text-sm bg-muted justify-start gap-2 rounded-md"
                >
                  <Clock size={20} color={ICON_COLOR} />
                  {formData.startTime || t('setTime')}
                </Button>
              )}
            </div>
            
            {/* End — same `space-y-3` as the Start column above, so the two line up. */}
            <div className={`space-y-3 p-2 -m-2 rounded-lg transition-colors ${hasEndDateError ? 'bg-destructive/20' : ''}`}>
              <DatePickerInput
                id="event-end-date"
                value={formData.endDate}
                onChange={(value) => {
                  setFormData(prev => ({ ...prev, endDate: value }));
                  setHasEndDateError(false);
                }}
                label={t('end')}
                icon={CalendarDays}
                iconColor={ICON_COLOR}
                iconPosition="left"
              />
              {!formData.isAllDay && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEndTimePickerOpen(true)}
                  className={`w-full h-10 text-sm justify-start gap-2 rounded-md ${hasEndDateError ? 'bg-destructive/20 border-destructive/50' : 'bg-muted'}`}
                >
                  <Clock size={20} color={ICON_COLOR} />
                  {formData.endTime || t('setTime')}
                </Button>
              )}
            </div>
          </div>
        </div>

        {/*
          * Recurrent Event.
          *
          * No negative margin here, deliberately. The gap to setTime above is the shared
          * 24px section break, the same as every other section in this form.
          *
          * What made this junction look wrong was never the gap: the Start column is shorter
          * than the End column, and the date grid stretched it to match. That padding pushed
          * the dateAndTime section's own box well past its visible setTime button, so
          * the distance to this box was measured from empty space rather than from the
          * button the eye lands on. `items-start` on the date grid fixes it at the source.
          * Reducing the margin on top of that produced an overlap, which is how the real
          * cause was found.
          */}
        <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
          <Label htmlFor="recurrent" className="text-sm">{t('recurrentEvent')}</Label>
          <Switch 
            id="recurrent" 
            checked={formData.isRecurrent} 
            onCheckedChange={handleRecurrentToggle} 
          />
        </div>
        
        {formData.isRecurrent && (
          <div id="recurrent-options" className="space-y-4 p-4 bg-muted rounded-lg">
            <div>
              <Label className="text-sm">{t('repeatEvery')}</Label>
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
                  className="w-20 h-10 text-sm bg-background"
                />
                {/*
                  * The custom Select, matching the Alert field below it: same trigger styling,
                  * same popup surface, same hover and the same check mark against the chosen
                  * option. This replaced a native <select>, which rendered with the OS
                  * control's own styling and could not match the rest of the form.
                  *
                  * The width comes from `flex-1` on the trigger so it fills the row beside the
                  * interval input, exactly as the native element did.
                  */}
                <Select
                  value={formData.recurrenceType}
                  onValueChange={(value) => setFormData(prev => ({
                    ...prev,
                    recurrenceType: value as EventFormData['recurrenceType']
                  }))}
                >
                  <SelectTrigger className="h-10 text-sm bg-muted flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RECURRENCE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {t(option.label)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {formData.recurrenceType === 'weekly' && (
              <div>
                <Label className="text-sm">{t('onTheseDays')}</Label>
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
          <Label className="text-sm flex items-center gap-2">
            <Bell size={20} color={ICON_COLOR} />
            {t('alert')}
          </Label>
          <Select
            value={formData.alertType}
            onValueChange={handleAlertChange}
          >
            <SelectTrigger className="h-10 text-sm bg-muted">
              <SelectValue>
                {getAlertDisplayValue()}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {alertOptions.map((option) => (
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
          label={t('location')}
          value={formData.location}
          onChange={(value) => setFormData(prev => ({ ...prev, location: value }))}
          placeholder={t('placeholderLocation')}
          maxLength={100}
          icon={MapPin}
          iconColor={ICON_COLOR}
        />
        
        {/* Description */}
        <TitleInput
          id="event-description"
          label={t('description')}
          value={formData.description}
          onChange={(value) => setFormData(prev => ({ ...prev, description: value }))}
          placeholder={t('placeholderEventDescription')}
          maxLength={200}
          icon={NotebookText}
          iconColor={ICON_COLOR}
        />

        {/* Tags */}
        <TagEditor 
          tags={formData.tags} 
          onTagsChange={(tags) => setFormData(prev => ({ ...prev, tags }))}
          onValidationChange={setHasTagError}
          placeholder={t('placeholderAddTagsMeeting')}
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
          singleRow
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
        // The end suggests one hour after the start, when there is one.
        defaultTime={oneHourAfter(formData.startTime)}
      />
    </>
  );
}
