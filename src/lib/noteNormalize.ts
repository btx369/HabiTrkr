/**
 * A note is a note: text, a list, pictures and recordings can all live in one.
 *
 * Older notes were created as separate kinds, "image" (one main picture that could not be
 * removed) and "audio" (one main recording). Newer ones are plain text notes that carry their
 * pictures and recordings as markers in the description. This turns the old kinds into the new
 * one so every note behaves the same: anything in it can be removed, and anything can be added.
 */
import type { Note } from '@/types/note';

type Loose = Record<string, unknown> & { type?: string; description?: string };

export function normalizeNoteType<T extends Note>(note: T): T {
  const n = note as unknown as Loose;
  // A password note keeps its content encrypted; it is converted once it is opened and saved.
  if (n.sealed) return note;
  if (n.type === 'image' && typeof n.imageUrl === 'string') {
    const { imageUrl, ...rest } = n;
    const description = [`[image:${imageUrl}]`, rest.description].filter(Boolean).join('');
    return { ...rest, type: 'text', description } as unknown as T;
  }
  if (n.type === 'audio' && typeof n.audioUrl === 'string') {
    const { audioUrl, duration, ...rest } = n;
    const description = [`[audio:${audioUrl}:${Number(duration) || 0}]`, rest.description].filter(Boolean).join('');
    return { ...rest, type: 'text', description } as unknown as T;
  }
  return note;
}
