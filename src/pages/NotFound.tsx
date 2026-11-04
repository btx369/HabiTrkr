import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";

const NotFound = () => {
  const location = useLocation();
  const { t } = useLanguage();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  // Theme tokens, so the page follows light and dark mode like the rest of the app.
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4 text-foreground">404</h1>
        <p className="text-lg text-muted-foreground mb-6">{t('notFoundMessage')}</p>
        {/* A router Link, so "home" respects the base path (/HabiTrkr/ on GitHub Pages). */}
        <Button asChild>
          <Link to="/">{t('backToHome')}</Link>
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
