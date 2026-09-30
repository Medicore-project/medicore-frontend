import { useEffect, useRef, useState } from 'react';

/**
 * True once the element has scrolled into view, and stays true — the public pages animate things in
 * once, not every time they cross the edge of the screen.
 *
 * Where `IntersectionObserver` is missing (jsdom in tests, very old browsers) the element counts as
 * visible straight away, so content is never left hidden waiting for an event that cannot come.
 */
export function useInView<T extends Element>(options?: { threshold?: number; rootMargin?: string }) {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(() => typeof IntersectionObserver === 'undefined');
  const threshold = options?.threshold ?? 0.15;
  const rootMargin = options?.rootMargin ?? '0px 0px -8% 0px';

  useEffect(() => {
    const node = ref.current;
    if (!node || inView) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold, rootMargin },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [inView, threshold, rootMargin]);

  return { ref, inView };
}

/** Whether the user asked the OS for less motion. Read once; guarded for jsdom, which has no matchMedia. */
export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
