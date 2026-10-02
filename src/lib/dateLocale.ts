import { enUS, pt, es, fr, de, it, nl, pl, tr, ja, zhCN, ko } from 'date-fns/locale';
import type { Locale } from 'date-fns';
import { useLanguage } from '@/contexts/LanguageContext';
import type { Language } from '@/contexts/LanguageContext';

/**
 * date-fns locale for each interface language.
 *
 * Month and weekday names written by `format(..., 'MMMM')` come from date-fns, not from the
 * translation dictionary, so without this a Portuguese user would read "Sep 28 - Oct 4" in
 * a calendar that is otherwise in Portuguese. That was the last place English survived.
 */
const DATE_LOCALES: Record<Language, Locale> = {
  en: enUS,
  pt,
  es,
  fr,
  de,
  it,
  nl,
  pl,
  tr,
  ja,
  zh: zhCN,
  ko,
};

/**
 * The date-fns locale for the active interface language.
 *
 * Call it inside a component and pass the result to `format(date, pattern, { locale })`.
 */
export function useDateLocale(): Locale {
  const { language } = useLanguage();
  return DATE_LOCALES[language] ?? enUS;
}
