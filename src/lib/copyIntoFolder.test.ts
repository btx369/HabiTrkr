import { describe, expect, it } from 'vitest';
import { fileCopiesBesideOriginals, foldersHolding } from './copyIntoFolder';

const ids = {
  idsOf: (f: { id: string; noteIds: string[] }) => f.noteIds,
  withIds: (f: { id: string; noteIds: string[] }, noteIds: string[]) => ({ ...f, noteIds }),
};

describe('copy into folder', () => {
  const folders = [{ id: 'a', noteIds: ['n1'] }, { id: 'b', noteIds: ['n2'] }, { id: 'c', noteIds: [] }];

  it('finds the folders holding the originals', () => {
    expect(foldersHolding(['n2', 'x'], folders, ids.idsOf).map((f) => f.id)).toEqual(['b']);
    expect(foldersHolding(['x'], folders, ids.idsOf)).toEqual([]);
  });

  it('puts each copy beside its original and leaves unfiled copies out', () => {
    const out = fileCopiesBesideOriginals([['n1', 'c1'], ['n2', 'c2'], ['x', 'c3']], folders, ids);
    expect(out.map((f) => f.noteIds)).toEqual([['n1', 'c1'], ['n2', 'c2'], []]);
  });
});
