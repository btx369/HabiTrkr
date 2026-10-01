import { ReactNode, useEffect } from 'react';
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
}

export const Layout = ({ 
  children, 
  showSearch = false, 
  searchQuery = '', 
  onSearchChange, 
  hideBottomNav = false,
  isBulkMode = false,
  pageTitle,
  shieldHeight = '7.25rem'
}: LayoutProps) => {
  const location = useLocation();
  const bgColor = 'hsl(var(--background))';

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

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
      <main className={cn("pt-16 px-2", isBulkMode ? "pb-36" : "pb-20")}>
        {children}
      </main>
      <BottomNavigation hidden={hideBottomNav} />
    </div>
  );
};