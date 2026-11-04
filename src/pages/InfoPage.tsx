import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/shared/PageHeader';
import { settingsPanelClass } from '@/components/shared/SettingsRow';
import { useLanguage } from '@/contexts/LanguageContext';
import { APP_VERSION } from '@/lib/appInfo';
import { ABOUT, LEGAL_UPDATED, PRIVACY, TERMS, textFor } from '@/lib/infoPages';

const PAGES = {
  about: { title: 'helpAbout', text: ABOUT },
  terms: { title: 'termsOfService', text: TERMS },
  privacy: { title: 'privacyPolicy', text: PRIVACY },
} as const;

/** Help/About, Terms of Service and Privacy Policy: a title and sections of text. */
export default function InfoPage({ page }: { page: keyof typeof PAGES }) {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const { title, text } = PAGES[page];

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title={t(title)} onBack={() => navigate(-1)} />
      <div className="px-2 pb-8 space-y-4">
        {page === 'about' && (
          <div className={`${settingsPanelClass} flex flex-col items-center gap-1 p-6 text-center`}>
            <img src={`${import.meta.env.BASE_URL}icon-192.png`} alt="" className="h-16 w-16 rounded-2xl" />
            <h2 className="pt-2 text-xl font-semibold text-foreground">HabiTrkr</h2>
            <p className="text-sm text-muted-foreground">{t('appVersion').replace('{version}', APP_VERSION)}</p>
          </div>
        )}
        <div className={`${settingsPanelClass} space-y-5 p-5`}>
          {textFor(text, language).map((section) => (
            <section key={section.heading} className="space-y-2">
              <h3 className="text-base font-semibold text-foreground">{section.heading}</h3>
              {section.body.map((paragraph) => (
                <p key={paragraph} className="text-sm leading-relaxed text-muted-foreground">{paragraph}</p>
              ))}
            </section>
          ))}
          {page !== 'about' && (
            <p className="border-t pt-4 text-xs text-muted-foreground">
              {t('lastUpdated').replace(
                '{date}',
                new Date(`${LEGAL_UPDATED}T12:00:00`).toLocaleDateString(language, { day: 'numeric', month: 'long', year: 'numeric' }),
              )}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
