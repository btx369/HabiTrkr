import { useSyncExternalStore } from 'react';

/** Phones up to ~480px wide, where a habit's name, badges and seven day buttons don't fit on one row. */
const QUERY = '(max-width: 480px)';

const subscribe = (onChange: () => void) => {
  const mql = window.matchMedia(QUERY);
  mql.addEventListener('change', onChange);
  return () => mql.removeEventListener('change', onChange);
};

export function useNarrowScreen(): boolean {
  return useSyncExternalStore(subscribe, () => window.matchMedia(QUERY).matches, () => false);
}
