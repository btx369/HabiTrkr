/**
 * View modes shared by the Notes and Events pages.
 *
 * The names describe what the user gets: how many cards fit on one row. The values used
 * to be `medium`/`large`, which described card SIZE and did not match the labels shown
 * in the UI (2x / 3x) — and a plain `grid-cols-N` is not responsive, so "2x" really does
 * mean two per row at every width, phones included.
 *
 * Declared once here because Notes and Events previously each declared their own copy of
 * the same union, which would drift apart the moment one of them changed.
 */
export type ViewType = 'list' | 'x2' | 'x3';

/** Cards per row for each view, used for the drag-gap calculations. */
export const CARDS_PER_ROW: Record<ViewType, number> = {
  list: 1,
  x2: 2,
  x3: 3,
};

/** Labels shown in the view menu. */
export const VIEW_LABELS: Record<ViewType, string> = {
  list: 'List',
  x2: '2x',
  x3: '3x',
};

/** True when the value is one of the supported view modes. */
export function isViewType(value: unknown): value is ViewType {
  return value === 'list' || value === 'x2' || value === 'x3';
}
