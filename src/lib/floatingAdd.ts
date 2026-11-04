/**
 * The Add button sits permanently to the right of the bottom navigation capsule, on every
 * page that has one. The capsule is centred and 250px wide, so the button is anchored
 * 131px right of the centre line (6px gap), and clamped so it never leaves the screen.
 * Its vertical centre matches the capsule's (58px tall, 16px off the bottom).
 */
export const FLOATING_ADD_CLASS =
  'fixed bottom-[21px] h-12 w-12 rounded-full z-50 px-0 py-0 bg-black text-white border border-nav-border hover:bg-black/90';

export const FLOATING_ADD_STYLE = {
  left: 'min(calc(50% + 131px), calc(100% - 3.25rem))',
} as const;
