import React from 'react';

/**
 * Line icons for the Booked Appointments page. Inline SVG, like the login page's, because the app
 * has no icon library and one page's worth of glyphs is not worth adding one for.
 *
 * Every icon is decorative (`aria-hidden`): each sits beside text that already says the same thing.
 */

type IconProps = { className?: string };

const Svg: React.FC<React.PropsWithChildren<IconProps>> = ({ className, children }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    {children}
  </svg>
);

export const CalendarIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
    <path d="M3.5 10h17M8 3v4M16 3v4" />
  </Svg>
);

export const CheckIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <rect x="3.5" y="3.5" width="17" height="17" rx="4" />
    <path d="m8 12.5 2.8 2.8L16.5 9.5" />
  </Svg>
);

export const ClockIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </Svg>
);

export const CrossCircleIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="m9.2 9.2 5.6 5.6M14.8 9.2l-5.6 5.6" />
  </Svg>
);

export const PinIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z" />
    <circle cx="12" cy="10" r="2.3" />
  </Svg>
);

export const UserIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="8.5" r="3.5" />
    <path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5" />
  </Svg>
);

export const LayersIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="m12 4 8.5 4.5L12 13 3.5 8.5 12 4Z" />
    <path d="m3.5 12.5 8.5 4.5 8.5-4.5M3.5 16.5 12 21l8.5-4.5" />
  </Svg>
);

export const SearchIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4 4" />
  </Svg>
);

export const ListIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <rect x="3.5" y="4" width="17" height="16" rx="3" />
    <path d="M7.5 9h9M7.5 12.5h9M7.5 16h5" />
  </Svg>
);

export const DownloadIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M4.5 19.5h15" />
  </Svg>
);

export const ChevronDownIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="m7 10 5 5 5-5" />
  </Svg>
);

export const SortIcon: React.FC<IconProps & { direction?: 'asc' | 'desc' | null }> = ({
  className,
  direction,
}) => (
  <Svg className={className}>
    <path d="m8.5 9.5 3.5-3.5 3.5 3.5" opacity={direction === 'desc' ? 0.3 : 1} />
    <path d="m8.5 14.5 3.5 3.5 3.5-3.5" opacity={direction === 'asc' ? 0.3 : 1} />
  </Svg>
);

export const DotsIcon: React.FC<IconProps> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
    <circle cx="12" cy="5.5" r="1.7" />
    <circle cx="12" cy="12" r="1.7" />
    <circle cx="12" cy="18.5" r="1.7" />
  </svg>
);
