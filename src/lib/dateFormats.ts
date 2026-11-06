import { format } from 'date-fns';
import type { Locale } from 'date-fns';
import type { Language } from '@/contexts/LanguageContext';

/*
 * The app's date formats, in one place so every page writes a date the same way and in
 * the order of the user's language ("4 de novembro", not "novembro 4").
 *
 *   longDate   the day being shown (Calendar day view, selected day):
 *              "quarta, 4 de novembro de 2026" / "Wednesday, November 4, 2026"
 *   shortDate  a date on a card or in a field: "6 nov 2026" / "Nov 6, 2026"
 *   dateRange  a week: "2–8 nov 2026" / "Nov 2 – 8, 2026"
 */

export const intlLocale = (language: Language): string =>
  language === 'pt' ? 'pt-PT' : language === 'zh' ? 'zh-CN' : language;

/**
 * Portuguese weekdays without "-feira" ("quarta", not "quarta-feira"): with the full name
 * the day view's title did not fit on a phone next to the whole month.
 */
const shortenPortugueseWeekday = (text: string) => text.replace(/-feira/g, '');

export function longDate(date: Date, language: Language): string {
  const text = new Intl.DateTimeFormat(intlLocale(language), {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }).format(date);
  return language === 'pt' ? shortenPortugueseWeekday(text) : text;
}

export function shortDate(date: Date, language: Language, locale: Locale): string {
  // date-fns' "PP" is each language's medium date; Portuguese gets "6 nov 2026" instead
  // of "6 de nov de 2026", which is too long for a three-per-row card.
  return format(date, language === 'pt' ? 'd MMM yyyy' : 'PP', { locale });
}

export function dateRange(from: Date, to: Date, language: Language, locale: Locale): string {
  if (language === 'pt') {
    // Intl writes Portuguese ranges as "02/11/2026 – 08/11/2026"; this keeps the month name.
    const sameYear = from.getFullYear() === to.getFullYear();
    const sameMonth = sameYear && from.getMonth() === to.getMonth();
    if (sameMonth) return `${format(from, 'd', { locale })}–${format(to, 'd MMM yyyy', { locale })}`;
    if (sameYear) return `${format(from, 'd MMM', { locale })} – ${format(to, 'd MMM yyyy', { locale })}`;
    return `${format(from, 'd MMM yyyy', { locale })} – ${format(to, 'd MMM yyyy', { locale })}`;
  }
  // formatRange is in every browser the app supports; the TS lib target predates it.
  const formatter = new Intl.DateTimeFormat(intlLocale(language), { day: 'numeric', month: 'short', year: 'numeric' }) as
    Intl.DateTimeFormat & { formatRange?: (a: Date, b: Date) => string };
  return formatter.formatRange
    ? formatter.formatRange(from, to)
    : `${formatter.format(from)} – ${formatter.format(to)}`;
}
