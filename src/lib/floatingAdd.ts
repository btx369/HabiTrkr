/**
 * The bottom navigation capsule (208px wide) and the Add button (48px) to its right.
 *
 * On a wide phone the capsule is centred and the Add button sits in the middle of the gap
 * between the capsule and the screen edge. On a narrow phone (iPhone 13/mini, 390px and
 * less) a centred capsule leaves too little room, and the Add button touched it. There the
 * capsule moves left just enough to keep a 72px gap (12px either side of the button).
 */
const CAPSULE_LEFT = 'max(8px, min(calc(50% - 104px), calc(100% - 280px)))';

/** Left edge of the navigation capsule. */
// `bottom` also clears the iPhone home indicator when the app runs full screen.
export const NAV_CAPSULE_STYLE = { left: CAPSULE_LEFT, bottom: 'calc(16px + env(safe-area-inset-bottom))' } as const;

export const FLOATING_ADD_CLASS =
  'fixed h-12 w-12 rounded-full z-50 px-0 py-0 bg-leaf text-leaf-foreground border border-nav-border shadow-[0_6px_16px_-8px_hsl(var(--cocoa)/0.5)] hover:bg-leaf/90 [&_svg]:!size-6';

export const FLOATING_ADD_STYLE = {
  // Centred in the gap between the capsule's right edge and the screen edge.
  left: `calc((${CAPSULE_LEFT} + 208px + 100%) / 2 - 24px)`,
  bottom: 'calc(17px + env(safe-area-inset-bottom))',
} as const;

/** Right offset that lines popups opened by the Add button up with its right edge. */
export const FLOATING_ADD_POPUP_RIGHT = `max(0.5rem, calc((100% - ${CAPSULE_LEFT} - 208px) / 2 - 24px))`;
