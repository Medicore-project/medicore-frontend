import React from 'react';
import { useInView } from '../../hooks/useInView';

type RevealVariant = 'up' | 'left' | 'right' | 'zoom' | 'fade';

type RevealProps = React.PropsWithChildren<{
  /** How the block arrives. Defaults to rising into place. */
  variant?: RevealVariant;
  /** Milliseconds to wait after the block scrolls into view — staggers a row of cards. */
  delay?: number;
  className?: string;
  as?: 'div' | 'section' | 'li' | 'article' | 'aside';
  id?: string;
}>;

/**
 * Animates its children in the first time they scroll into view. The motion itself is CSS
 * (`.reveal` in motion.css), which also switches it off under `prefers-reduced-motion`.
 */
export const Reveal: React.FC<RevealProps> = ({
  variant = 'up',
  delay = 0,
  className,
  as: Tag = 'div',
  id,
  children,
}) => {
  const { ref, inView } = useInView<HTMLElement>();
  const classes = ['reveal', `reveal--${variant}`, inView ? 'is-visible' : '', className ?? '']
    .filter(Boolean)
    .join(' ');

  return (
    <Tag
      id={id}
      ref={ref as React.Ref<never>}
      className={classes}
      style={delay ? ({ '--reveal-delay': `${delay}ms` } as React.CSSProperties) : undefined}
    >
      {children}
    </Tag>
  );
};

export default Reveal;
