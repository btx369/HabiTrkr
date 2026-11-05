/**
 * The bottom navigation capsule (250px wide) and the Add button (56px) to its right.
 *
 * On a wide phone the capsule is centred and the Add button sits in the middle of the gap
 * between the capsule and the screen edge. On a narrow phone (iPhone 13/mini, 390px and
 * less) a centred capsule leaves too little room, and the Add button touched it. There the
 * capsule moves left just enough to keep an 80px gap (12px either side of the button).
 */
const CAPSULE_LEFT = 'max(8px, min(calc(50% - 125px), calc(100% - 330px)))';

/** Left edge of the navigation capsule. */
// `bottom` also clears the iPhone home indicator when the app runs full screen.
export const NAV_CAPSULE_STYLE = { left: CAPSULE_LEFT, bottom: 'calc(16px + env(safe-area-inset-bottom))' } as const;

export const FLOATING_ADD_CLASS =
  'fixed h-14 w-14 rounded-full z-50 px-0 py-0 bg-black text-white border border-nav-border hover:bg-black/90 [&_svg]:!size-6';

export const FLOATING_ADD_STYLE = {
  // Centred in the gap between the capsule's right edge and the screen edge.
  left: `calc((${CAPSULE_LEFT} + 250px + 100%) / 2 - 28px)`,
  bottom: 'calc(17px + env(safe-area-inset-bottom))',
} as const;

/** Right offset that lines popups opened by the Add button up with its right edge. */
export const FLOATING_ADD_POPUP_RIGHT = `max(0.5rem, calc((100% - ${CAPSULE_LEFT} - 250px) / 2 - 28px))`;
