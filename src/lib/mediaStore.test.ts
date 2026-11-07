import { describe, expect, it, beforeEach } from 'vitest';
import { __enableForTests, dehydrateValue, hydrateValue, dehydrateText, hydrateText } from './mediaStore';

const IMG = 'data:image/png;base64,' + 'A'.repeat(2000);
const AUD = 'data:audio/webm;base64,' + 'B'.repeat(1500);

describe('mediaStore boundary', () => {
  beforeEach(() => __enableForTests(true));

  it('replaces data URLs with short references and restores them', () => {
    const note = { id: '1', description: `hello [image:${IMG}] [audio:${AUD}:3.5]`, imageUrl: IMG };
    const stored = dehydrateValue(note);
    const json = JSON.stringify(stored);
    expect(json).not.toContain('base64');
    expect(json.length).toBeLessThan(300);
    expect(hydrateValue(stored)).toEqual(note);
  });

  it('gives identical media the same reference (copied notes share one entry)', () => {
    expect(dehydrateText(IMG)).toBe(dehydrateText(IMG));
  });

  it('leaves text without media, and unknown references, untouched', () => {
    expect(dehydrateText('plain text')).toBe('plain text');
    expect(hydrateText('see idb-media:zzz-1 here')).toBe('see idb-media:zzz-1 here');
  });

  it('does nothing when the store is disabled', () => {
    __enableForTests(false);
    const note = { description: `[image:${IMG}]` };
    expect(dehydrateValue(note)).toBe(note);
  });
});
