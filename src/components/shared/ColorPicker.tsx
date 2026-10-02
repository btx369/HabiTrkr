import { Label } from '@/components/ui/label';
import { NOTE_COLORS } from '@/constants/colors';
import { useLanguage } from '@/contexts/LanguageContext';
import { LucideIcon } from 'lucide-react';

interface ColorPickerProps {
  selectedColor: string;
  onColorChange: (color: string) => void;
  label?: string;
  icon?: LucideIcon;
  iconColor?: string;
}

export function ColorPicker({ 
  selectedColor, 
  onColorChange, 
  label,
  icon: Icon,
  iconColor
}: ColorPickerProps) {
  const { t } = useLanguage();
  // Defaulted here rather than in the parameter list: a default value cannot see the hook,
  // and this label appears in every editor, so an English default leaked everywhere.
  const resolvedLabel = label ?? t('color');
  return (
    <div>
      <Label className="text-sm flex items-center gap-2">
        {Icon && <Icon size={16} color={iconColor} />}
        {resolvedLabel}
      </Label>
      <div className="grid grid-cols-6 gap-3 mt-3 p-1 justify-items-center">
        <button
          type="button"
          onClick={() => onColorChange('#FFFFFF')}
          className={`w-8 h-8 rounded-full border-2 flex items-center justify-center bg-white transition-all ${
            selectedColor === '#FFFFFF' || selectedColor === ''
              ? 'border-foreground scale-110' 
              : 'border-border'
          }`}
        >
          <span className="text-gray-400 text-xs">✕</span>
        </button>
        {NOTE_COLORS.filter(color => color !== '#FFFFFF').map((color) => (
          <button
            key={color}
            type="button"
            className={`w-8 h-8 rounded-full border-2 transition-all ${
              selectedColor === color 
                ? 'border-foreground scale-110' 
                : 'border-border'
            }`}
            style={{ backgroundColor: color }}
            onClick={() => onColorChange(color)}
          />
        ))}
      </div>
    </div>
  );
}
