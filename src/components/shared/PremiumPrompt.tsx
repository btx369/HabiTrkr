import { Crown } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface PremiumPromptProps {
  feature: string;
}

export function PremiumPrompt({ feature }: PremiumPromptProps) {
  return (
    <Alert className="border-amber-500 bg-amber-50 dark:bg-amber-950">
      <Crown className="h-4 w-4 text-amber-600" />
      <AlertTitle className="text-amber-900 dark:text-amber-100">Premium Feature</AlertTitle>
      <AlertDescription className="text-amber-800 dark:text-amber-200">
        {feature} is a premium feature. Upgrade to unlock this functionality.
      </AlertDescription>
    </Alert>
  );
}
