import { BarChart3 } from 'lucide-react';
import { Layout } from '@/components/Layout';
import { useLanguage } from '@/contexts/LanguageContext';

/**
 * Reports and statistics: habits kept per week, streaks, events per month.
 * Placeholder until it is designed; it replaces the old, never-built Tasks page.
 */
export default function Reports() {
  const { t } = useLanguage();

  return (
    <Layout pageTitle={t('reports')} showSearch={false}>
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
        <BarChart3 size={40} className="text-muted-foreground" />
        <p className="text-muted-foreground">{t('comingSoon')}</p>
      </div>
    </Layout>
  );
}
