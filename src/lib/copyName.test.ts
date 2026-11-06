import { describe, expect, it } from 'vitest';
import { nextCopyName } from './copyName';

describe('nextCopyName', () => {
  it('numbers the first free copy', () => {
    expect(nextCopyName('Thing', ['Thing'])).toBe('Thing (1)');
    expect(nextCopyName('Thing (1)', ['Thing', 'Thing (1)'])).toBe('Thing (2)');
  });

  it('numbers an untitled copy without a leading space', () => {
    expect(nextCopyName('', [''])).toBe('(1)');
    expect(nextCopyName('(1)', ['', '(1)'])).toBe('(2)');
  });
});
