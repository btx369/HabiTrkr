import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LucideIcon } from 'lucide-react';

interface TitleInputProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  required?: boolean;
  icon?: LucideIcon;
  iconColor?: string;
}

export function TitleInput({ 
  id, 
  label, 
  value, 
  onChange, 
  placeholder = "Enter title...",
  maxLength = 35,
  required = false,
  icon: Icon,
  iconColor
}: TitleInputProps) {
  // Calculate warning thresholds based on maxLength
  const warningThreshold = Math.floor(maxLength * 0.85);
  const dangerThreshold = maxLength;

  const getCounterColor = () => {
    if (value.length >= dangerThreshold) return 'text-destructive';
    if (value.length >= warningThreshold) return 'text-orange-500';
    return 'text-muted-foreground';
  };

  return (
    <div>
      <Label htmlFor={id} className="text-base flex items-center gap-2">
        {Icon && <Icon size={16} color={iconColor} />}
        {label}
        {required && <span className="text-destructive">*</span>}
        <span className={`text-xs ${getCounterColor()}`}>
          {value.length}/{maxLength}
        </span>
      </Label>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, maxLength))}
        placeholder={placeholder}
        maxLength={maxLength}
        required={required}
        className="h-12 text-base bg-muted"
      />
    </div>
  );
}
