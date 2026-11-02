import { beforeEach, describe, expect, it } from 'vitest';
import type { Note } from '@/types/note';
import {
  clearPinFailures,
  createPinFields,
  getPinLockoutRemaining,
  recordPinFailure,
  upgradeLegacyPin,
  verifyNotePin,
  withoutPin,
} from './notePin';

const note = (fields: Partial<Note> = {}): Note =>
  ({ id: 'n', name: 'n', type: 'text', color: '', createdAt: '', pinned: false, description: 'secret', ...fields }) as Note;

beforeEach(() => localStorage.clear());

describe('note PIN', () => {
  it('stores a salted hash that accepts only the right PIN', async () => {
    const fields = await createPinFields('4821');
    expect(JSON.stringify(fields)).not.toContain('4821');
    const locked = note({ locked: true, ...fields });
    expect(await verifyNotePin(locked, '4821')).toBe(true);
    expect(await verifyNotePin(locked, '4822')).toBe(false);
  });

  it('uses a different salt each time', async () => {
    const [a, b] = await Promise.all([createPinFields('1234'), createPinFields('1234')]);
    expect(a.pinHash).not.toBe(b.pinHash);
  });

  it('upgrades a legacy plain-text PIN', async () => {
    const upgraded = await upgradeLegacyPin(note({ locked: true, pin: '1234' }));
    expect(upgraded.pin).toBeUndefined();
    expect(upgraded.locked).toBe(true);
    expect(await verifyNotePin(upgraded, '1234')).toBe(true);
  });

  it('removes every PIN field on unlock', () => {
    const unlocked = withoutPin(note({ locked: true, pin: '1', pinHash: 'h', pinSalt: 's' }));
    expect([unlocked.locked, unlocked.pin, unlocked.pinHash, unlocked.pinSalt]).toEqual([false, undefined, undefined, undefined]);
  });

  it('locks after five wrong guesses, doubling each time, and clears on success', () => {
    const now = 1_000_000;
    for (let i = 0; i < 5; i++) recordPinFailure('n', now);
    expect(getPinLockoutRemaining('n', now)).toBe(0);
    recordPinFailure('n', now);
    expect(getPinLockoutRemaining('n', now)).toBe(30_000);
    recordPinFailure('n', now);
    expect(getPinLockoutRemaining('n', now)).toBe(60_000);
    clearPinFailures('n');
    expect(getPinLockoutRemaining('n', now)).toBe(0);
  });
});
