import { ReactNode } from 'react';

export const highlightText = (text: string, searchQuery: string): ReactNode => {
  if (!searchQuery.trim()) {
    return text;
  }

  const regex = new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = text.split(regex);

  return parts.map((part, index) => {
    if (part.toLowerCase() === searchQuery.toLowerCase()) {
      return (
        <mark key={index} className="bg-yellow-200 dark:bg-yellow-800 text-foreground rounded-sm px-0 py-0 leading-[inherit] tracking-[inherit] font-[inherit]">
          {part}
        </mark>
      );
    }
    return part;
  });
};