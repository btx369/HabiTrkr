import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { ToastProvider } from "@/contexts/ToastContext";
import { WeekStartProvider } from "@/contexts/WeekStartContext";
import HabitTracker from "./pages/HabitTracker";

// The habit tracker is the start route, so it stays in the main bundle.
// Everything else is split out: Notes pulls in the rich-text editor and the
// media viewers, and Events pulls in its own editor, none of which are needed
// to show the first screen.
const Notes = lazy(() => import("./pages/Notes"));
const Events = lazy(() => import("./pages/Events"));
const Calendar = lazy(() => import("./pages/Calendar"));
const Profile = lazy(() => import("./pages/Profile"));
const Tasks = lazy(() => import("./pages/Tasks"));
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
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <Suspense fallback={<RouteFallback />}>
                  <Routes>
                    <Route path="/" element={<HabitTracker />} />
                    <Route path="/notes" element={<Notes />} />
                    <Route path="/events" element={<Events />} />
                    <Route path="/calendar" element={<Calendar />} />
                    <Route path="/profile" element={<Profile />} />
                    <Route path="/tags" element={<TagsManager />} />
                    <Route path="/tasks" element={<Tasks />} />
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
