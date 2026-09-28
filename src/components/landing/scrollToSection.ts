import { prefersReducedMotion } from '../../hooks/useInView';

/** Scrolls the home page to one of its sections. The sticky nav's height is taken care of by
 * `scroll-margin-top` on the sections, so this only chooses between a glide and a jump. */
export function scrollToSection(id: string): void {
  const target = document.getElementById(id);
  // jsdom has no scrollIntoView, hence the optional call.
  target?.scrollIntoView?.({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
}
