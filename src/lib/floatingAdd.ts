/**
 * The Add button sits permanently to the right of the bottom navigation capsule, on every
 * page that has one. The capsule is centred and 250px wide, so the button is anchored
 * 131px right of the centre line (6px gap), and clamped so it never leaves the screen.
 * Its vertical centre matches the capsule's (58px tall, 16px off the bottom).
 */
export const FLOATING_ADD_CLASS =
  'fixed bottom-[17px] h-14 w-14 rounded-full z-50 px-0 py-0 bg-black text-white border border-nav-border hover:bg-black/90 [&_svg]:!size-6';

export const FLOATING_ADD_STYLE = {
  // Centred in the gap between the capsule's right edge (50% + 125px) and the screen edge.
  left: 'min(calc(75% + 34.5px), calc(100% - 3.5rem))',
} as const;

/** Right offset that lines popups opened by the Add button up with its right edge. */
export const FLOATING_ADD_POPUP_RIGHT = 'max(0.5rem, calc(25% - 90.5px))';
