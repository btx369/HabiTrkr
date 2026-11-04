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
      // A shrink under ~120px is browser chrome (address bar), not a keyboard.
      const covered = window.innerHeight - vv.height - vv.offsetTop;
      const keyboardOpen = window.innerHeight - vv.height > 120 && vv.scale <= 1.01;
      setViewport(keyboardOpen && covered > -1 ? { height: vv.height, top: vv.offsetTop } : null);
    };
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, [enabled]);

  return viewport;
}
