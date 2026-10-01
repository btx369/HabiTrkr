import { useLocation, useNavigate } from 'react-router-dom';
import { Notebook, CalendarPlus, Target, CalendarDays, ListTodo } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { path: '/notes', icon: Notebook },
  { path: '/events', icon: CalendarPlus },
  { path: '/', icon: Target },
  { path: '/calendar', icon: CalendarDays },
  { path: '/tasks', icon: ListTodo },
];

interface BottomNavigationProps {
  hidden?: boolean;
}

export const BottomNavigation = ({ hidden = false }: BottomNavigationProps) => {
  const location = useLocation();
  const navigate = useNavigate();

  if (hidden) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
      {/*
        * Every colour here comes from the `nav` scrim tokens in index.css. The capsule is
        * intentionally dark in BOTH themes, which is why it does not reuse --primary or
        * --foreground: those invert with the theme and would turn it white in dark mode.
        */}
      <div className="flex items-center justify-center gap-2 p-2 bg-nav border border-nav-border rounded-full">
        {navItems.map(({ path, icon: Icon }) => {
          const isActive = location.pathname === path;
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              className="group flex items-center justify-center hover:scale-105 active:scale-[0.95] transition-transform duration-200"
            >
                <div
                  className={cn(
                    "flex items-center justify-center w-10 h-10 rounded-full transition-all duration-300 ease-out",
                    isActive 
                      ? "bg-nav-active text-white" 
                      : "bg-transparent text-nav-icon group-hover:text-nav-icon-hover"
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