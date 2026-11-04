import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, X, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { TagAutocompleteInput } from '@/components/shared/TagAutocompleteInput';

interface HeaderProps {
  showSearch?: boolean;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  pageTitle?: string;
}

export const Header = ({ showSearch = false, searchQuery = '', onSearchChange, pageTitle }: HeaderProps) => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  const handleCloseSearch = () => {
    onSearchChange?.('');
    setIsSearchExpanded(false);
  };

  // Keep the latest handler in a ref so the two document-level listeners below can
  // call it without listing it as a dependency. Listing it directly would re-subscribe
  // on every render (the function is recreated each time), and omitting it left the
  // listeners calling whichever version existed when they were attached.
  const closeSearchRef = useRef(handleCloseSearch);
  closeSearchRef.current = handleCloseSearch;

  /**
   * Collapse the field, but let the press that caused it finish first.
   *
   * Clearing the query here re-renders the page's list with every item restored, and
   * that happens *between* mousedown and mouseup. The card that was under the cursor is
   * replaced by a different one, so the click lands on an element with no handler and
   * the note never opens — the search had to be dismissed before a filtered result
   * could be tapped. Deferring the clear by a turn keeps the list still for the whole
   * press, so the click reaches the card the user actually aimed at.
   *
   * Escape and the close button clear immediately; there is no press to protect there.
   */
  const deferTimeoutRef = useRef<number | null>(null);

  const handleClickOutside = () => {
    setIsSearchExpanded(false);
    if (deferTimeoutRef.current !== null) window.clearTimeout(deferTimeoutRef.current);
    deferTimeoutRef.current = window.setTimeout(() => {
      deferTimeoutRef.current = null;
      onSearchChange?.('');
    }, 0);
  };

  const handleClickOutsideRef = useRef(handleClickOutside);
  handleClickOutsideRef.current = handleClickOutside;

  // Click outside detection
  useEffect(() => {
    if (!isSearchExpanded) return;

    const onMouseDown = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        handleClickOutsideRef.current();
      }
    };

    document.addEventListener('mousedown', onMouseDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      // A pending clear must not survive the search being closed or the bar unmounting,
      // or it would wipe a query the user has since typed.
      if (deferTimeoutRef.current !== null) {
        window.clearTimeout(deferTimeoutRef.current);
        deferTimeoutRef.current = null;
      }
    };
  }, [isSearchExpanded]);

  // Escape key detection
  useEffect(() => {
    if (!isSearchExpanded) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeSearchRef.current();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isSearchExpanded]);

  return (
    <div className="fixed top-0 left-0 right-0 z-50">
      {/*
        * `py-2`, not `py-4`. Measured at 390px the bar was 72px tall: 16 + a 40px button + 16.
        * Eight pixels of that either side is a lot of empty chrome on a phone, and the icons
        * inside are 20px, so the padding was more than double the glyph. `py-2` takes the bar
        * to 56px and returns 16px of vertical space to the content, which is the scarce
        * dimension here.
        *
        * The content offset in Layout (`pt-16`) is unchanged: it still clears the shorter bar.
        */}
      <div className="flex items-center justify-between py-2 px-2 gap-3">
        {/* Left: Search Button (always visible when showSearch is true) */}
        {showSearch && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsSearchExpanded(true)}
          aria-label={t('search')}
          /*
           * No `!size-7` and no `size={28}`. The arbitrary variant `[&_svg]:!size-7` was
           * forcing the glyph to 28px and overriding the `size={28}` attribute on the icon,
           * so the number in the JSX was decorative and editing it did nothing.
           *
           * Header icons are 24px (the app-wide size for toolbar icons; cards use 20px). The Button base sets `[&_svg]:size-5`;
           * this is one step up from that, set explicitly.
           */
          className={`text-foreground hover:bg-hover hover:text-foreground rounded-full shrink-0 [&_svg]:!size-6 transition-opacity duration-200 ${isSearchExpanded ? 'opacity-0 pointer-events-none w-0 p-0' : ''}`}
        >
          <Search size={24} />
          </Button>
        )}
        
        {/* Center: Expandable Search Bar */}
        {showSearch && isSearchExpanded && (
          <div ref={searchContainerRef} className="flex-1 max-w-md animate-search-expand origin-left">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-foreground/70 h-5 w-5 z-20" />
              <TagAutocompleteInput
                value={searchQuery}
                onChange={(value) => onSearchChange?.(value)}
                placeholder={t('search')}
                inputClassName="pl-10 pr-10 rounded-full bg-[hsl(var(--glass-bg))] backdrop-blur-xl border border-foreground/10"
                autoFocus
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCloseSearch}
                aria-label={t('closeSearch')}
                className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7 p-0 z-20 text-foreground hover:bg-hover hover:text-foreground rounded-full"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>
        )}
        
        {/* Centered Page Title (fades out when search expands) */}
        {(!showSearch || !isSearchExpanded) && (
          <div className="flex-1 flex items-center justify-center">
            {pageTitle && (
              <h1 className="text-xl font-semibold text-foreground transition-opacity duration-200">
                {pageTitle}
              </h1>
            )}
          </div>
        )}
        
        {/* Right: Profile Button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/profile')}
          aria-label={t('profile')}
          /* Same 24px as the search button: the two are a pair and must match. */
          className="text-foreground hover:bg-hover hover:text-foreground rounded-full shrink-0 [&_svg]:!size-6"
        >
          <UserRound size={24} />
        </Button>
      </div>
    </div>
  );
};
