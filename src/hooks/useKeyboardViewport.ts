import { useEffect, useState } from 'react';

export interface KeyboardViewport {
  /** Height of the part of the screen the keyboard leaves visible. */
  height: number;
  /** Distance from the top of the layout viewport to the top of the visible area. */
  top: number;
}

/**
 * Tracks the area of the screen that is NOT covered by the on-screen keyboard.
 *
 * Mobile browsers (Chrome on Android, Safari on iOS) leave the layout viewport at full
 * height when the keyboard opens and just paint the keyboard over the bottom of it, so a
 * `fixed inset-0` panel keeps its bottom bar hidden behind the keyboard. The Visual
 * Viewport API reports what is really visible. Returns null while no keyboard is open (or
 * when the API is unavailable), so callers can leave their normal layout untouched.
 */
export function useKeyboardViewport(enabled: boolean): KeyboardViewport | null {
  const [viewport, setViewport] = useState<KeyboardViewport | null>(null);

  useEffect(() => {
    const vv = typeof window !== 'undefined' ? window.visualViewport : null;
    if (!enabled || !vv) {
      setViewport(null);
      return;
    }
    const update = () => {
      // A shrink under ~120px is browser chrome (address bar), not a keyboard. The keyboard
      // can only be up while a text field has focus, which also covers the cases where the
      // browser does not report the viewport growing back (e.g. after a button press made
      // the field lose focus) and would otherwise leave the sheet stuck at keyboard size.
      const active = document.activeElement as HTMLElement | null;
      const typing = !!active && (active.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName));
      const covered = window.innerHeight - vv.height - vv.offsetTop;
      const keyboardOpen = typing && window.innerHeight - vv.height > 120 && vv.scale <= 1.01;
      const next = keyboardOpen && covered > -1 ? { height: vv.height, top: vv.offsetTop } : null;
      // Keep the previous object when nothing changed so the timer does not re-render.
      setViewport((prev) => (prev && next && prev.height === next.height && prev.top === next.top) || (!prev && !next) ? prev : next);
    };
    update();
    // Focus moves (e.g. tapping "Add" next to a field) are re-checked once the browser has
    // settled, and while the keyboard is considered open a slow timer catches any change
    // the events missed.
    const onFocusChange = () => { update(); setTimeout(update, 150); setTimeout(update, 500); };
    const timer = window.setInterval(update, 500);
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    document.addEventListener('focusin', onFocusChange);
    document.addEventListener('focusout', onFocusChange);
    return () => {
      window.clearInterval(timer);
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      document.removeEventListener('focusin', onFocusChange);
      document.removeEventListener('focusout', onFocusChange);
    };
  }, [enabled]);

  return viewport;
}
