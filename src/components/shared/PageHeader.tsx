import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';

interface PageHeaderProps {
  title: string;
  onBack: () => void;
  /** Optional control shown on the right, mirroring the back button's footprint. */
  trailing?: React.ReactNode;
}

/**
 * The header for pages that render their own full-height container instead of using
 * <Layout> — currently Profile and Tags.
 *
 * Those two pages each had their own copy of this markup, and the copies had already drifted
 * from the shared <Header>: they used `py-4` where it used `py-2`, so their titles sat 8px
 * lower than every other page, which is exactly the misalignment that was noticed when going
 * from Profile back to Notes.
 *
 * Two other defects in the copies are fixed here as a side effect:
 *   - the icon carried `size={24}` AND `[&_svg]:!size-5`; the arbitrary variant wins, so the
 *     number was decorative and the glyph rendered at 20px;
 *   - centring relied on a fixed `w-10` spacer to offset a 40px-wide button, which only works
 *     while the two happen to be the same size. A `flex-1` middle column centres the title on
 *     the viewport regardless of what sits either side — the same approach <Header> uses.
 */
export function PageHeader({ title, onBack, trailing }: PageHeaderProps) {
  const { t } = useLanguage();
  return (
    <div className="flex items-center justify-between py-2 px-2 gap-3">
      <Button
        variant="ghost"
        size="icon"
        onClick={onBack}
        aria-label={t('back')}
        className="text-foreground hover:bg-hover hover:text-foreground rounded-full shrink-0"
      >
        <ChevronLeft size={20} />
      </Button>

      <div className="flex-1 flex items-center justify-center min-w-0">
        <h1 className="text-xl font-semibold text-foreground truncate">{title}</h1>
      </div>

      <div className="flex items-center shrink-0">
        {trailing ?? <div className="w-10" aria-hidden="true" />}
      </div>
    </div>
  );
}
