import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCustomUnit } from '@/types/event';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface CustomAlertDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (value: number, unit: AlertCustomUnit) => void;
  initialValue?: number;
  initialUnit?: AlertCustomUnit;
}

const UNIT_LIMITS: Record<AlertCustomUnit, number> = {
  minutes: 600,
  hours: 120,
  days: 28,
  weeks: 4
};

const UNIT_LABELS: Record<AlertCustomUnit, string> = {
  minutes: 'Minutes before',
  hours: 'Hours before',
  days: 'Days before',
  weeks: 'Weeks before'
};

export function CustomAlertDialog({ 
  isOpen, 
  onClose, 
  onSave,
  initialValue = 30,
  initialUnit = 'minutes'
}: CustomAlertDialogProps) {
  const [value, setValue] = useState(initialValue);
  const [unit, setUnit] = useState<AlertCustomUnit>(initialUnit);

  useEffect(() => {
    if (isOpen) {
      setValue(initialValue);
      setUnit(initialUnit);
    }
  }, [isOpen, initialValue, initialUnit]);

  const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseInt(e.target.value) || 0;
    const maxValue = UNIT_LIMITS[unit];
    setValue(Math.min(Math.max(0, newValue), maxValue));
  };

  const handleUnitChange = (newUnit: AlertCustomUnit) => {
    setUnit(newUnit);
    // Clamp value to new unit's max
    const maxValue = UNIT_LIMITS[newUnit];
    if (value > maxValue) {
      setValue(maxValue);
    }
  };

  const handleSave = () => {
    if (value > 0) {
      onSave(value, unit);
      onClose();
    }
  };

  const currentMax = UNIT_LIMITS[unit];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Custom Alert</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Number input */}
          <div>
            <Label htmlFor="alert-value" className="text-base">
              Alert Time
            </Label>
            <Input
              id="alert-value"
              type="number"
              min={1}
              max={currentMax}
              value={value}
              onChange={handleValueChange}
              className="h-12 text-lg text-center bg-muted mt-2"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Maximum: {currentMax} {unit}
            </p>
          </div>

          {/* Unit selector */}
          <div className="space-y-2">
            <Label className="text-base">Time Unit</Label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(UNIT_LABELS) as AlertCustomUnit[]).map((unitOption) => (
                <Button
                  key={unitOption}
                  type="button"
                  variant={unit === unitOption ? "default" : "outline"}
                  className={`h-12 ${unit === unitOption ? '' : 'bg-muted'}`}
                  onClick={() => handleUnitChange(unitOption)}
                >
                  {UNIT_LABELS[unitOption]}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            className="flex-1"
            disabled={value <= 0}
          >
            Save Changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
