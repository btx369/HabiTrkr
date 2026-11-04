import { ReactNode, TouchEvent, WheelEvent, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Header } from './Header';
import { BottomNavigation } from './BottomNavigation';
import { cn } from '@/lib/utils';

interface LayoutProps {
  children: ReactNode;
  showSearch?: boolean;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  hideBottomNav?: boolean;
  isBulkMode?: boolean;
  pageTitle?: string;
  shieldHeight?: string;
  /** Tab-swipe handlers (useSwipeGesture). Applied to the whole page body, except the header zone. */
  swipeHandlers?: {
    onTouchStart: (e: TouchEvent) => void;
    onTouchMove: (e: TouchEvent) => void;
    onTouchEnd: () => void;
    onWheel?: (e: WheelEvent) => void;
  };
}

export const Layout = ({ 
  children, 
  showSearch = false, 
  searchQuery = '', 
  onSearchChange, 
  hideBottomNav = false,
  isBulkMode = false,
  pageTitle,
  shieldHeight = '7.25rem',
  swipeHandlers
}: LayoutProps) => {
  const location = useLocation();
  const bgColor = 'hsl(var(--background))';

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  // Swipes only start below the header zone (title/search/profile + tab row with its
  // bulk-action and cog buttons). The zone is the same height as the fixed shield above.
  const swipeActive = useRef(false);
  const swipeProps = swipeHandlers && {
    ...swipeHandlers,
    onTouchStart: (e: TouchEvent) => {
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      const zone = shieldHeight.endsWith('rem') ? parseFloat(shieldHeight) * rem : parseFloat(shieldHeight);
      const target = e.target as HTMLElement;
      if (e.touches[0].clientY < zone || target.closest?.('input, textarea, select, [role="slider"], [data-no-swipe]')) {
        swipeActive.current = false;
        return;
      }
      swipeActive.current = true;
      swipeHandlers.onTouchStart(e);
    },
    onWheel: (e: WheelEvent) => {
      const zone = parseFloat(shieldHeight) * (shieldHeight.endsWith('rem') ? 16 : 1);
      if (e.clientY < zone || (e.target as HTMLElement).closest?.('[data-no-swipe], input, textarea')) return;
      swipeHandlers.onWheel?.(e);
    },
    onTouchMove: (e: TouchEvent) => { if (swipeActive.current) swipeHandlers.onTouchMove(e); },
    onTouchEnd: () => {
      if (swipeActive.current) swipeHandlers.onTouchEnd();
      swipeActive.current = false;
    },
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: bgColor }}>
      {/* Fixed shield: solid background hides scrolling content behind header/tabs */}
      <div
        className="fixed top-0 left-0 right-0 z-40 pointer-events-none"
        style={{ backgroundColor: bgColor, height: shieldHeight }}
      />
      <Header 
        showSearch={showSearch}
        searchQuery={searchQuery}
        onSearchChange={onSearchChange}
        pageTitle={pageTitle}
      />
      <main {...swipeProps} className={cn("min-h-screen pt-16 px-2", isBulkMode ? "pb-36" : "pb-20")}>
        {children}
      </main>
      <BottomNavigation hidden={hideBottomNav} />
    </div>
  );
};