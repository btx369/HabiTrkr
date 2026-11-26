import { forwardRef, useLayoutEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

interface ListItemFieldProps {
  value: string;
  onChange: (value: string) => void;
  onKeyDown?: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  className?: string;
}

/**
 * The text of a list item while editing. A one-line input showed a long item cut to a single
 * line and made it jump back to its full height on save; this wraps like the read-only text
 * and grows with it, so an item keeps the same number of lines in both modes.
 */
export const ListItemField = forwardRef<HTMLTextAreaElement, ListItemFieldProps>(
  ({ value, onChange, onKeyDown, placeholder, className }, forwardedRef) => {
    const innerRef = useRef<HTMLTextAreaElement | null>(null);
    useLayoutEffect(() => {
      const el = innerRef.current;
      if (!el) return;
      el.style.height = 'auto';
      el.style.height = `${el.scrollHeight}px`;
    }, [value]);
    return (
      <textarea
        ref={(el) => {
          innerRef.current = el;
          if (typeof forwardedRef === 'function') forwardedRef(el);
          else if (forwardedRef) forwardedRef.current = el;
        }}
        rows={1}
        value={value}
        // An item is one paragraph: a pasted line break becomes a space.
        onChange={(e) => onChange(e.target.value.replace(/\s*\n\s*/g, ' '))}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        data-list-item-input
        className={cn(
          'block w-full resize-none overflow-hidden border-none bg-transparent p-1 text-sm leading-none shadow-none outline-none placeholder:text-muted-foreground focus-visible:ring-0',
          className,
        )}
      />
    );
  },
);
ListItemField.displayName = 'ListItemField';
