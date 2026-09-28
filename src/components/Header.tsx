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

  // Click outside detection
  useEffect(() => {
    if (!isSearchExpanded) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        closeSearchRef.current();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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
      <div className="flex items-center justify-between py-4 px-2 gap-3">
        {/* Left: Search Button (always visible when showSearch is true) */}
        {showSearch && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsSearchExpanded(true)}
          className={`text-foreground hover:bg-black hover:text-white rounded-full shrink-0 transition-opacity duration-200 [&_svg]:!size-7 ${isSearchExpanded ? 'opacity-0 pointer-events-none w-0 p-0' : ''}`}
        >
          <Search size={28} />
          </Button>
        )}
        
        {/* Center: Expandable Search Bar */}
        {showSearch && isSearchExpanded && (
          <div ref={searchContainerRef} className="flex-1 max-w-md animate-search-expand origin-left">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-foreground/70 h-4 w-4 z-20" />
              <TagAutocompleteInput
                value={searchQuery}
                onChange={(value) => onSearchChange?.(value)}
                placeholder={t('search')}
                inputClassName="pl-10 pr-10 rounded-full bg-[hsl(var(--glass-bg))] backdrop-blur-xl border border-[hsl(var(--glass-border))]"
                autoFocus
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCloseSearch}
                className="absolute right-1 top-1/2 transform -translate-y-1/2 h-7 w-7 p-0 z-20 text-foreground hover:bg-black hover:text-white rounded-full"
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
          className="text-foreground hover:bg-black hover:text-white rounded-full shrink-0 [&_svg]:!size-7"
        >
          <UserRound size={28} />
        </Button>
      </div>
    </div>
  );
};
