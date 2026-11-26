import { useLayoutEffect, useState, type RefObject } from 'react';

/**
 * Whether an element is narrower than `px`, following its own width rather than the window's.
 *
 * A habit card in a two-column folder on a desktop window is as narrow as a phone screen, and
 * needs the same two-row layout; the window width says nothing about that.
 */
export function useElementNarrow(ref: RefObject<HTMLElement>, px: number): boolean | null {
  const [narrow, setNarrow] = useState<boolean | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setNarrow(el.getBoundingClientRect().width < px);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, px]);
  return narrow;
}
