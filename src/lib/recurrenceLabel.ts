/**
 * "Every 2 weeks: Mon, Wed" in the user's language.
 *
 * The cards, the viewer and the calendar each built this sentence in English
 * ("Every Mon, Wed, Fri", "Weekly"), whatever language the app was in, and the card
 * dropped the interval, so "every 2 weeks" read as "every week".
 */
import type { Event } from '@/types/event';
import type { Language } from '@/contexts/LanguageContext';
import { countedSentence } from './countedMessage';

const RULE_KEYS = { daily: 'recurDaily', weekly: 'recurWeekly', monthly: 'recurMonthly', yearly: 'recurYearly' } as const;

/**
 * @param dayName short name for a JS weekday (0 = Sunday), already translated
 * @param dayOrder sorts weekdays into the user's week order
 */
export function describeRecurrence(
  event: Event,
  t: (key: string) => string,
  language: Language,
  dayName: (jsDay: number) => string,
  dayOrder: (jsDay: number) => number = (d) => d,
): string | null {
  if (!event.isRecurrent || !event.recurrenceType) return null;
  const interval = Math.max(1, event.recurrenceInterval || 1);
  const rule = countedSentence(t, language, RULE_KEYS[event.recurrenceType], interval);
  if (event.recurrenceType !== 'weekly' || !event.recurrenceDays?.length) return rule;
  const days = [...event.recurrenceDays].sort((a, b) => dayOrder(a) - dayOrder(b)).map(dayName).join(', ');
  return t('recurOnDays').replace('{rule}', rule).replace('{days}', days);
}
