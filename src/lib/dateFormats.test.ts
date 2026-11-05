import { describe, expect, it } from 'vitest';
import { pt, enUS } from 'date-fns/locale';
import { dateRange, longDate, shortDate } from './dateFormats';

describe('date formats', () => {
  it('writes the Portuguese day without "-feira" and with the whole month', () => {
    expect(longDate(new Date(2026, 10, 4), 'pt')).toBe('quarta, 4 de novembro de 2026');
  });

  it('writes Portuguese weeks in Portuguese order with a short month', () => {
    expect(dateRange(new Date(2026, 10, 2), new Date(2026, 10, 8), 'pt', pt)).toBe('2–8 nov 2026');
    expect(dateRange(new Date(2026, 10, 30), new Date(2026, 11, 6), 'pt', pt)).toBe('30 nov – 6 dez 2026');
    expect(dateRange(new Date(2026, 11, 28), new Date(2027, 0, 3), 'pt', pt)).toBe('28 dez 2026 – 3 jan 2027');
  });

  it('uses one short card date', () => {
    expect(shortDate(new Date(2026, 10, 6), 'pt', pt)).toBe('6 nov 2026');
    expect(shortDate(new Date(2026, 10, 6), 'en', enUS)).toBe('Nov 6, 2026');
  });
});
