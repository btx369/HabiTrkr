import { useCallback, useRef } from 'react';

export function useRipple<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  const createRipple = useCallback((event: React.MouseEvent<T>) => {
    const element = ref.current;
    if (!element) return;

    const rect = element.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = event.clientX - rect.left - size / 2;
    const y = event.clientY - rect.top - size / 2;

    const ripple = document.createElement('span');
    ripple.style.cssText = `
      position: absolute;
      width: ${size}px;
      height: ${size}px;
      left: ${x}px;
      top: ${y}px;
      background: currentColor;
      opacity: 0.2;
      border-radius: 50%;
      transform: scale(0);
      animation: ripple-effect 0.5s ease-out forwards;
      pointer-events: none;
    `;

    element.appendChild(ripple);

    ripple.addEventListener('animationend', () => {
      ripple.remove();
    });
  }, []);

  return { ref, createRipple };
}
