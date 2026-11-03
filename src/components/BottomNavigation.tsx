import { useLocation, useNavigate } from 'react-router-dom';
import { Notebook, CalendarPlus, Target, CalendarDays, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

const navItems = [
  { path: '/notes', icon: Notebook, label: 'notes' },
  { path: '/events', icon: CalendarPlus, label: 'events' },
  { path: '/', icon: Target, label: 'habits' },
  { path: '/calendar', icon: CalendarDays, label: 'calendar' },
  { path: '/reports', icon: BarChart3, label: 'reports' },
];

interface BottomNavigationProps {
  hidden?: boolean;
}

export const BottomNavigation = ({ hidden = false }: BottomNavigationProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useLanguage();

  if (hidden) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
      {/*
        * Every colour here comes from the `nav` scrim tokens in index.css. The capsule is
        * intentionally dark in BOTH themes, which is why it does not reuse --primary or
        * --foreground: those invert with the theme and would turn it white in dark mode.
        */}
      <div className="flex items-center justify-center gap-2 p-2 bg-nav border border-nav-border rounded-full">
        {navItems.map(({ path, icon: Icon, label }) => {
          const isActive = location.pathname === path;
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              // Icon-only: the name is what screen readers announce (and what tests find).
              aria-label={t(label)}
              aria-current={isActive ? 'page' : undefined}
              /*
               * The hover used to be a scale on this wrapper, which the rest of the app no
               * longer does. Feedback comes from the surface instead: a light veil on the dark
               * capsule for the inactive items, and the icon stepping up a shade. The active
               * item keeps its filled circle and does not lighten, so the current page never
               * looks like something you are about to open.
               */
              className="group flex items-center justify-center"
            >
                <div
                  className={cn(
                    "flex items-center justify-center w-10 h-10 rounded-full transition-all duration-300 ease-out",
                    isActive 
                      ? "bg-nav-active text-white" 
                      : "bg-transparent text-nav-icon group-hover:text-nav-icon-hover group-hover:bg-white/10"
                  )}
                >
                <Icon size={20} />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};