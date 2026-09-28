import React, { useEffect, useState } from 'react';
import { prefersReducedMotion, useInView } from '../../hooks/useInView';

type CountUpProps = {
  /** The final number. */
  to: number;
  /** Text after the number, such as `+` or `%`. */
  suffix?: string;
  durationMs?: number;
  className?: string;
};

/**
 * A figure that counts up from zero when it scrolls into view. Screen readers get the final value
 * from the start in a visually hidden span, so they never hear the digits ticking.
 */
export const CountUp: React.FC<CountUpProps> = ({ to, suffix = '', durationMs = 1600, className }) => {
  const { ref, inView } = useInView<HTMLSpanElement>({ threshold: 0.4 });
  const [value, setValue] = useState(0);
  // Without motion (or without requestAnimationFrame) the final figure shows as soon as it is seen.
  const instant = prefersReducedMotion() || typeof requestAnimationFrame === 'undefined';

  useEffect(() => {
    if (!inView || instant) return;

    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - start) / durationMs, 1);
      // Ease out: fast at first, settling onto the final figure.
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(to * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [inView, instant, to, durationMs]);

  const shown = inView && instant ? to : value;
  const finalText = `${to.toLocaleString('en-US')}${suffix}`;

  return (
    <span ref={ref} className={className}>
      <span className="sr-only">{finalText}</span>
      <span aria-hidden="true">
        {shown.toLocaleString('en-US')}
        {suffix}
      </span>
    </span>
  );
};

export default CountUp;
