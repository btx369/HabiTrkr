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
  singleRow?: boolean;
}

export function ColorPicker({ 
  selectedColor, 
  onColorChange, 
  label,
  icon: Icon,
  iconColor,
  singleRow = false
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
      <div className={singleRow
        ? 'flex w-full flex-nowrap justify-start gap-1 mt-3 p-1 md:justify-between md:gap-0 md:px-1'
        : 'grid grid-cols-6 gap-3 mt-3 p-1 justify-items-center'}>
        <button
          type="button"
          onClick={() => onColorChange('#FFFFFF')}
          className={`${singleRow ? 'w-6 h-6' : 'w-8 h-8'} rounded-full border-2 flex items-center justify-center bg-white transition-all ${
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
            className={`${singleRow ? 'w-6 h-6' : 'w-8 h-8'} rounded-full border-2 transition-all ${
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
