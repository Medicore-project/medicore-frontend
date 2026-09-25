import React from 'react';

/**
 * Line icons shared by the Booked Appointments and booking pages. Inline SVG, like the login page's,
 * because the app has no icon library and a couple of pages' worth of glyphs is not worth adding one
 * for.
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

export const StethoscopeIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M6 3.5v5a4 4 0 0 0 8 0v-5" />
    <path d="M10 12.5v2.5a4.5 4.5 0 0 0 9 0v-2" />
    <circle cx="19" cy="11" r="2" />
  </Svg>
);

export const BrainIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M12 5.5a3 3 0 0 0-5.6-1.3A3 3 0 0 0 4 8.5a3.2 3.2 0 0 0 .6 5.6A3.3 3.3 0 0 0 8.5 19a3 3 0 0 0 3.5 1V5.5Z" />
    <path d="M12 5.5a3 3 0 0 1 5.6-1.3A3 3 0 0 1 20 8.5a3.2 3.2 0 0 1-.6 5.6 3.3 3.3 0 0 1-3.9 4.9A3 3 0 0 1 12 20" />
  </Svg>
);

export const SwapIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M4 8h14l-3.5-3.5M20 16H6l3.5 3.5" />
  </Svg>
);

export const DocumentIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <rect x="5" y="3.5" width="14" height="17" rx="2.5" />
    <path d="M8.5 8.5h7M8.5 12h7M8.5 15.5h4" />
  </Svg>
);

export const ArrowRightIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M4.5 12h15M14 6.5l5.5 5.5-5.5 5.5" />
  </Svg>
);

export const ChevronRightIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="m10 7 5 5-5 5" />
  </Svg>
);

export const ChevronLeftIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="m14 7-5 5 5 5" />
  </Svg>
);

/** A filled check in a circle — the badge on a selected time. */
export const CheckBadgeIcon: React.FC<IconProps> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <circle cx="12" cy="12" r="10" fill="#ffffff" />
    <path d="m7.5 12.3 3 3 6-6.3" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** The MediCore mark: a heart with a cross. */
export const HeartPlusIcon: React.FC<IconProps> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M12 21s-8.5-5.1-8.5-11.2A4.8 4.8 0 0 1 12 6.7a4.8 4.8 0 0 1 8.5 3.1C20.5 15.9 12 21 12 21Z" fill="currentColor" />
    <path d="M12 9.5v6M9 12.5h6" stroke="#ffffff" strokeWidth={2} strokeLinecap="round" />
  </svg>
);
