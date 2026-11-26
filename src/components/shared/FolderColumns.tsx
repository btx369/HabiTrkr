import type { ReactNode } from 'react';
import { useMinWidth } from '@/hooks/useMinWidth';

/**
 * Folders in two independent columns on a wide window, one column on a narrow one.
 *
 * A plain two-column grid lines the folders up in rows, so opening one leaves a blank gap
 * beside it, under its neighbour. Here each column stacks its own folders, so a closed folder
 * always sits right under the one above it. Folders are dealt out left, right, left, right.
 */
export function FolderColumns<T extends { id: string }>({
  items,
  render,
}: {
  items: readonly T[];
  render: (item: T) => ReactNode;
}) {
  const columns = useMinWidth(768) ? 2 : 1;
  return (
    <div className="flex items-start gap-2">
      {Array.from({ length: columns }, (_, column) => (
        <div key={column} className="flex min-w-0 flex-1 flex-col gap-2">
          {items.filter((_, index) => index % columns === column).map((item) => render(item))}
        </div>
      ))}
    </div>
  );
}
