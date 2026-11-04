import { useRef, TouchEvent, WheelEvent } from 'react';

interface SwipeGestureOptions {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  threshold?: number;
}

export const useSwipeGesture = ({ onSwipeLeft, onSwipeRight, threshold = 80 }: SwipeGestureOptions) => {
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);
  const touchEndY = useRef<number | null>(null);

  const handleTouchStart = (e: TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    touchEndX.current = null;
    touchEndY.current = null;
  };

  const handleTouchMove = (e: TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
    touchEndY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = () => {
    if (touchStartX.current === null || touchEndX.current === null ||
        touchStartY.current === null || touchEndY.current === null) return;

    const deltaX = touchEndX.current - touchStartX.current;
    const deltaY = Math.abs(touchEndY.current - touchStartY.current);

    // Only trigger swipe if horizontal movement exceeds threshold AND is greater than vertical movement
    if (Math.abs(deltaX) > threshold && Math.abs(deltaX) > deltaY) {
      if (deltaX > 0) {
        onSwipeRight?.();
      } else {
        onSwipeLeft?.();
      }
    }

    touchStartX.current = null;
    touchStartY.current = null;
    touchEndX.current = null;
    touchEndY.current = null;
  };

  // Desktop: horizontal trackpad scroll (two-finger swipe) or a sideways mouse wheel.
  const wheelLockUntil = useRef(0);
  const handleWheel = (e: WheelEvent) => {
    if (Math.abs(e.deltaX) < 40 || Math.abs(e.deltaX) < Math.abs(e.deltaY) * 1.5) return;
    const now = Date.now();
    if (now < wheelLockUntil.current) return;
    wheelLockUntil.current = now + 600; // one tab per gesture (inertia keeps firing events)
    if (e.deltaX > 0) onSwipeLeft?.(); else onSwipeRight?.();
  };

  return {
    onWheel: handleWheel,
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd,
  };
};
