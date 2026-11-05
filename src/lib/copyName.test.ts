import { describe, expect, it } from 'vitest';
import { nextCopyName } from './copyName';

describe('nextCopyName', () => {
  it('numbers the first free copy', () => {
    expect(nextCopyName('Thing', ['Thing'])).toBe('Thing (1)');
    expect(nextCopyName('Thing (1)', ['Thing', 'Thing (1)'])).toBe('Thing (2)');
  });

  it('leaves an untitled item untitled', () => {
    expect(nextCopyName('', [''])).toBe('');
    expect(nextCopyName('  ', [])).toBe('');
  });
});
