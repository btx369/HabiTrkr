import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

/** Grid row unit and gap, in px. The grid uses `grid-auto-rows: ROW px` and a column gap only. */
export const MASONRY_ROW = 2;
export const MASONRY_GAP = 8;

/**
 * One cell of a masonry grid: it measures its own content and spans just enough rows to fit.
 *
 * With rows only 2px tall, the grid's auto-placement drops each card into the first free spot,
 * which is under the shorter column. Cards stay children of one container in their own order
 * (so dragging and re-sorting keep working), but no column leaves a gap beside a taller card.
 */
export function MasonryCell({
  children,
  style,
  ...rest
}: { children: ReactNode; style?: CSSProperties } & Omit<React.HTMLAttributes<HTMLDivElement>, 'style'>) {
  const innerRef = useRef<HTMLDivElement>(null);
  const [span, setSpan] = useState(40);

  useLayoutEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    const measure = () => setSpan(Math.max(1, Math.ceil((el.getBoundingClientRect().height + MASONRY_GAP) / MASONRY_ROW)));
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div {...rest} style={{ ...style, gridRowEnd: `span ${span}` }}>
      <div ref={innerRef}>{children}</div>
    </div>
  );
}
