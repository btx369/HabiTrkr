import { Suspense, lazy, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { ToastProvider } from "@/contexts/ToastContext";
import { WeekStartProvider } from "@/contexts/WeekStartContext";
import HabitTracker from "./pages/HabitTracker";
import { scheduleStoredEventNotifications, scheduleStoredNoteReminders } from "./lib/notificationService";
import { useLanguage } from "./contexts/LanguageContext";

// The habit tracker is the start route, so it stays in the main bundle.
// Everything else is split out: Notes pulls in the rich-text editor and the
// media viewers, and Events pulls in its own editor, none of which are needed
// to show the first screen.
const Notes = lazy(() => import("./pages/Notes"));
const Events = lazy(() => import("./pages/Events"));
const Calendar = lazy(() => import("./pages/Calendar"));
const Profile = lazy(() => import("./pages/Profile"));
const Reports = lazy(() => import("./pages/Reports"));
const Security = lazy(() => import("./pages/Security"));
const InfoPage = lazy(() => import("./pages/InfoPage"));
const TagsManager = lazy(() => import("./pages/TagsManager"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

/** Minimal placeholder shown while a route chunk loads. */
const RouteFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div
      className="h-8 w-8 rounded-full border-2 border-muted-foreground/30 border-t-foreground animate-spin"
      role="status"
      aria-label="Loading"
    />
  </div>
);

/** Arms event and note reminders once the app opens, whichever page that is. */
const ReminderScheduler = () => {
  const { t } = useLanguage();
  useEffect(() => {
    void scheduleStoredEventNotifications();
    void scheduleStoredNoteReminders(t('reminderNotificationTitle'));
    // Once per launch; the Notes page keeps them in step after that.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    {/* Do not pass storageKey here: the default comes from THEME_KEY, and overriding
        it silently reintroduces an old key name that the migration has already moved
        away from — which leaves the app reading an empty address. */}
    <ThemeProvider defaultTheme="light">
      <LanguageProvider>
        <WeekStartProvider>
          <ToastProvider>
            <TooltipProvider>
              <ReminderScheduler />
              <Toaster />
              <Sonner />
              {/* BASE_URL is "/" normally and "/HabiTrkr/" on GitHub Pages (see vite.config.ts). */}
              <BrowserRouter basename={import.meta.env.BASE_URL}>
                <Suspense fallback={<RouteFallback />}>
                  <Routes>
                    <Route path="/" element={<HabitTracker />} />
                    <Route path="/notes" element={<Notes />} />
                    <Route path="/events" element={<Events />} />
                    <Route path="/calendar" element={<Calendar />} />
                    <Route path="/profile" element={<Profile />} />
                    <Route path="/tags" element={<TagsManager />} />
                    <Route path="/reports" element={<Reports />} />
                    {/* The page was Tasks until it became Reports; keep old links working. */}
                    <Route path="/tasks" element={<Navigate to="/reports" replace />} />
                    <Route path="/security" element={<Security />} />
                    <Route path="/about" element={<InfoPage page="about" />} />
                    <Route path="/terms" element={<InfoPage page="terms" />} />
                    <Route path="/privacy" element={<InfoPage page="privacy" />} />
                    {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </BrowserRouter>
            </TooltipProvider>
          </ToastProvider>
        </WeekStartProvider>
      </LanguageProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
