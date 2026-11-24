import { useLocation, useNavigate } from 'react-router-dom';
import { NAV_CAPSULE_STYLE } from '@/lib/floatingAdd';
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
    <div className="fixed z-50" style={NAV_CAPSULE_STYLE}>
      {/* Every colour here comes from the `nav` tokens in index.css: a light capsule in the light theme, a raised dark one in the dark theme. */}
      <div className="flex items-center justify-center gap-1 p-1.5 bg-nav border border-nav-border rounded-full shadow-[0_6px_18px_-10px_hsl(var(--cocoa)/0.45)]">
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
                    "flex items-center justify-center w-9 h-9 rounded-full transition-colors duration-200 ease-out",
                    isActive 
                      ? "bg-nav-active text-nav-active-foreground" 
                      : "bg-transparent text-nav-icon group-hover:text-nav-icon-hover group-hover:bg-foreground/10"
                  )}
                >
                <Icon size={22} />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};