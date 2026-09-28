import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { usePremiumAccount } from '@/hooks/usePremiumAccount';
import { PremiumPrompt } from '@/components/shared/PremiumPrompt';
import { TagInputField } from '@/components/shared/TagInputField';

interface AutoImportSectionProps {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  tags: string[];
  onTagsChange: (tags: string[]) => void;
  placeholder?: string;
}

export function AutoImportSection({
  enabled,
  onEnabledChange,
  tags,
  onTagsChange,
  placeholder = "Add tags (e.g., #work #personal)"
}: AutoImportSectionProps) {
  const [premiumAccount] = usePremiumAccount();

  if (!premiumAccount.isPremium) {
    return <PremiumPrompt feature="Auto-import by tags" />;
  }

  return (
    <div className="space-y-3 p-4 bg-muted rounded-lg">
      <div className="flex items-center justify-between">
        <Label htmlFor="autoImport" className="text-base">Auto-import by tags</Label>
        <Switch
          id="autoImport"
          checked={enabled}
          onCheckedChange={onEnabledChange}
        />
      </div>
      {enabled && (
        <TagInputField
          tags={tags}
          onTagsChange={onTagsChange}
          placeholder={placeholder}
        />
      )}
    </div>
  );
}
