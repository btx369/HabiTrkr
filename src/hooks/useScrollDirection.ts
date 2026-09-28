import { useState, useEffect, useRef } from 'react';

type ScrollDirection = 'up' | 'down' | 'idle';

export function useScrollDirection(threshold = 1): ScrollDirection {
  const [scrollDirection, setScrollDirection] = useState<ScrollDirection>('idle');
  const lastScrollY = useRef(0);
  const ticking = useRef(false);

  useEffect(() => {
    const updateScrollDirection = () => {
      const scrollY = window.scrollY;
      const diff = scrollY - lastScrollY.current;
      
      // At the top of the page, always show the button
      if (scrollY < 10) {
        setScrollDirection('idle');
      } else if (Math.abs(diff) > threshold) {
        setScrollDirection(diff > 0 ? 'down' : 'up');
      }
      
      lastScrollY.current = scrollY;
      ticking.current = false;
    };

    const onScroll = () => {
      if (!ticking.current) {
        requestAnimationFrame(updateScrollDirection);
        ticking.current = true;
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [threshold]);

  return scrollDirection;
}
