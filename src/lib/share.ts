/**
 * Sharing notes and events through the phone's own share sheet (WhatsApp, e-mail…).
 *
 * Only text is shared: a note's title and readable text or its list, an event laid out line
 * by line plus a calendar file (.ics) the receiver can add with one tap. Images and audio
 * stay out, and a locked note is not shareable at all. Where the device has no share sheet
 * (most desktop browsers) the text is copied instead.
 */
import type { Note } from '@/types/note';
import type { Event } from '@/types/event';
import type { Language } from '@/contexts/LanguageContext';
import { extractSearchableText } from './noteSearchText';
import { intlLocale, longDate } from './dateFormats';
import { parseStoredDate } from './dateUtils';
import { describeRecurrence } from './recurrenceLabel';

type Translate = (key: string) => string;

/** A note as text: its title, then its readable text or its list. */
export function noteShareText(note: Note): string {
  const parts = [note.name.trim()];
  if (note.type === 'list') {
    // Open items first, as the note shows them; ☐ and ☑ read well in any messaging app.
    const open = note.items.filter((item) => !item.completed).map((item) => `☐ ${item.text}`);
    const done = note.items.filter((item) => item.completed).map((item) => `☑ ${item.text}`);
    parts.push([...open, ...done].join('\n'));
  } else {
    // Images and audio are left out; bold, italic and underline marks are the editor's.
    parts.push(extractSearchableText({ description: note.description }, { lowercase: false })
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/__(.+?)__/g, '$1')
      .replace(/\*(.+?)\*/g, '$1')
      .replace(/\n{3,}/g, '\n\n'));
  }
  return parts.map((part) => part.trim()).filter(Boolean).join('\n\n');
}

export const isShareableNote = (note: Note) => !note.locked;

const startKeyOf = (event: Event) => event.startDate || event.date;
const endKeyOf = (event: Event) => event.endDate || startKeyOf(event);

function timeText(time: string, language: Language): string {
  const [h, m] = time.split(':').map(Number);
  return new Intl.DateTimeFormat(intlLocale(language), { hour: 'numeric', minute: '2-digit' })
    .format(new Date(2000, 0, 1, h, m));
}

/** An event as text: name, day, time, place, repetition and description, one per line. */
export function eventShareText(event: Event, t: Translate, language: Language): string {
  const lines = [event.name.trim()];
  const start = startKeyOf(event) ? parseStoredDate(startKeyOf(event)!) : null;
  const end = endKeyOf(event) ? parseStoredDate(endKeyOf(event)!) : null;
  if (start) {
    const sameDay = !end || end.getTime() === start.getTime();
    lines.push(`📅 ${longDate(start, language)}${sameDay || !end ? '' : ` – ${longDate(end, language)}`}`);
  }
  const startTime = event.startTime || event.time;
  if (event.isAllDay || !startTime) {
    lines.push(`🕒 ${t('allDay')}`);
  } else {
    lines.push(`🕒 ${timeText(startTime, language)}${event.endTime ? ` – ${timeText(event.endTime, language)}` : ''}`);
  }
  if (event.location?.trim()) lines.push(`📍 ${event.location.trim()}`);
  const dayName = (jsDay: number) =>
    new Intl.DateTimeFormat(intlLocale(language), { weekday: 'short' }).format(new Date(2024, 0, 7 + jsDay));
  const recurrence = describeRecurrence(event, t, language, dayName, (d) => (d + 6) % 7);
  if (recurrence) lines.push(`🔁 ${recurrence}`);
  if (event.description?.trim()) lines.push('', event.description.trim());
  return lines.join('\n');
}

// --- Calendar file (iCalendar, RFC 5545) -------------------------------------------------

const icsEscape = (text: string) => text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const icsDate = (key: string) => key.slice(0, 10).replace(/-/g, '');
const icsDateTime = (key: string, time: string) => `${icsDate(key)}T${time.replace(':', '').padEnd(4, '0')}00`;
const nextDayKey = (key: string) => {
  const d = parseStoredDate(key)!;
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const BYDAY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

/** Lines longer than 75 octets are folded, as the format requires. */
const fold = (line: string) => {
  const out: string[] = [];
  let rest = line;
  while (rest.length > 74) { out.push(rest.slice(0, 74)); rest = ' ' + rest.slice(74); }
  out.push(rest);
  return out.join('\r\n');
};

function icsEvent(event: Event): string[] {
  const startKey = startKeyOf(event);
  if (!startKey) return [];
  const endKey = endKeyOf(event) ?? startKey;
  const startTime = event.startTime || event.time;
  const lines = ['BEGIN:VEVENT', `UID:${event.id}@habitrkr`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`];
  if (event.isAllDay || !startTime) {
    // All-day ends are exclusive: the day after the last one.
    lines.push(`DTSTART;VALUE=DATE:${icsDate(startKey)}`, `DTEND;VALUE=DATE:${icsDate(nextDayKey(endKey))}`);
  } else {
    // Floating local time: the receiver sees the same clock time the sender wrote.
    lines.push(`DTSTART:${icsDateTime(startKey, startTime)}`);
    lines.push(`DTEND:${icsDateTime(endKey, event.endTime || startTime)}`);
  }
  lines.push(`SUMMARY:${icsEscape(event.name)}`);
  if (event.location?.trim()) lines.push(`LOCATION:${icsEscape(event.location.trim())}`);
  if (event.description?.trim()) lines.push(`DESCRIPTION:${icsEscape(event.description.trim())}`);
  if (event.isRecurrent && event.recurrenceType) {
    let rule = `RRULE:FREQ=${event.recurrenceType.toUpperCase()};INTERVAL=${Math.max(1, event.recurrenceInterval || 1)}`;
    if (event.recurrenceType === 'weekly' && event.recurrenceDays?.length) {
      rule += `;BYDAY=${event.recurrenceDays.map((d) => BYDAY[d]).join(',')}`;
    }
    lines.push(rule);
  }
  lines.push('END:VEVENT');
  return lines;
}

export function eventsToIcs(events: Event[]): string {
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//HabiTrkr//PT', 'CALSCALE:GREGORIAN', ...events.flatMap(icsEvent), 'END:VCALENDAR']
    .map(fold).join('\r\n') + '\r\n';
}

/** A file name the receiving apps accept: letters, digits and dashes. */
const fileNameFor = (events: Event[]) => {
  const base = events.length === 1 ? events[0].name : 'eventos';
  const safe = base.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
  return `${safe || 'evento'}.ics`;
};

export function eventsIcsFile(events: Event[]): File {
  return new File([eventsToIcs(events)], fileNameFor(events), { type: 'text/calendar' });
}

// --- The share itself --------------------------------------------------------------------

export interface ShareFeedback {
  copied: () => void;
  failed: () => void;
}

/**
 * Opens the device's share sheet with the text (and files, where the device can share them).
 * Without a share sheet the text is copied. Cancelling the sheet is not an error.
 */
export async function shareText(
  { title, text, files }: { title?: string; text: string; files?: File[] },
  feedback: ShareFeedback,
): Promise<void> {
  if (typeof navigator.share === 'function') {
    const withFiles = files?.length && navigator.canShare?.({ files }) ? { files } : {};
    try {
      await navigator.share({ title, text, ...withFiles });
      return;
    } catch (error) {
      if ((error as DOMException)?.name === 'AbortError') return;
      // A refused share (e.g. files not allowed after all) falls back to copying.
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    feedback.copied();
  } catch {
    feedback.failed();
  }
}
