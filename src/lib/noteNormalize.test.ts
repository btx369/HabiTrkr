import { describe, expect, it } from 'vitest';
import type { Note } from '@/types/note';
import { normalizeNoteType } from './noteNormalize';

const base = { id: 'a', name: 'n', color: '#FFFFFF', createdAt: '2026-01-01T00:00:00.000Z' };

describe('normalizeNoteType', () => {
  it('turns an image note into a text note that carries the picture', () => {
    const out = normalizeNoteType({ ...base, type: 'image', imageUrl: 'data:x', description: 'legenda' } as Note) as unknown as Record<string, unknown>;
    expect(out.type).toBe('text');
    expect(out.imageUrl).toBeUndefined();
    expect(out.description).toBe('[image:data:x]legenda');
  });
  it('turns an audio note into a text note that carries the recording', () => {
    const out = normalizeNoteType({ ...base, type: 'audio', audioUrl: 'data:a', duration: 4, description: '' } as Note) as unknown as Record<string, unknown>;
    expect(out.type).toBe('text');
    expect(out.description).toBe('[audio:data:a:4]');
  });
  it('leaves other notes alone', () => {
    const text = { ...base, type: 'text', description: 'x' } as Note;
    expect(normalizeNoteType(text)).toBe(text);
  });
});
