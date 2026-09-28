import React from 'react';

/**
 * Line icons shared by the Booked Appointments, booking, home and login pages. Inline SVG, like the login page's,
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

export const PhoneIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M6.6 3.5h2.6l1.4 4-2 1.5a11 11 0 0 0 6.4 6.4l1.5-2 4 1.4v2.6a2 2 0 0 1-2.1 2A16.5 16.5 0 0 1 4.6 5.6a2 2 0 0 1 2-2.1Z" />
  </Svg>
);

export const MailIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <rect x="3.5" y="5.5" width="17" height="13" rx="2.5" />
    <path d="m4 7 8 6 8-6" />
  </Svg>
);

export const LockIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <rect x="5" y="10.5" width="14" height="10" rx="2.5" />
    <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5M12 14.5v2" />
  </Svg>
);

export const EyeIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M2.5 12c1-2.6 4.5-7 9.5-7s8.5 4.4 9.5 7c-1 2.6-4.5 7-9.5 7s-8.5-4.4-9.5-7Z" />
    <circle cx="12" cy="12" r="2.75" />
  </Svg>
);

export const EyeOffIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M3.5 3.5l17 17M10.6 10.6a2 2 0 0 0 2.8 2.8M9.4 5.4A9.7 9.7 0 0 1 12 5c5 0 8.5 4.4 9.5 7-.4 1-1.2 2.3-2.4 3.5M6.6 6.6C4.6 7.9 3.1 9.9 2.5 12c1 2.6 4.5 7 9.5 7 1.9 0 3.6-.6 5-1.5" />
  </Svg>
);

export const HeartIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M12 20s-8-4.8-8-10.6A4.6 4.6 0 0 1 12 6.6a4.6 4.6 0 0 1 8 2.8C20 15.2 12 20 12 20Z" />
  </Svg>
);

export const ShieldIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M12 3.5 19 6v5.5c0 4.4-3 7.8-7 9-4-1.2-7-4.6-7-9V6l7-2.5Z" />
    <path d="m9 12 2.2 2.2L15.5 10" />
  </Svg>
);

export const UsersIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <circle cx="9" cy="8.5" r="3.3" />
    <path d="M3 19.5c.6-3.3 3-5.2 6-5.2s5.4 1.9 6 5.2M15.5 5.4a3.3 3.3 0 0 1 0 6.3M17.5 14.6c1.8.6 3.1 2.2 3.5 4.9" />
  </Svg>
);

export const BuildingIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M4.5 20.5v-14l7.5-3 7.5 3v14M3 20.5h18" />
    <path d="M12 8v5M9.5 10.5h5M10 20.5v-3.5h4v3.5" />
  </Svg>
);

export const ScanIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2" />
    <circle cx="12" cy="12" r="3.5" />
  </Svg>
);

export const LeafIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M5 19c0-8 5-13.5 15-14.5-.5 10-6 15-14 15" />
    <path d="M5 19c3-4 6-6.5 10-8.5" />
  </Svg>
);

export const StarIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="m12 3.8 2.5 5.2 5.6.7-4.1 3.9 1 5.6L12 16.5l-5 2.7 1-5.6-4.1-3.9 5.6-.7L12 3.8Z" />
  </Svg>
);

export const TrendUpIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="m3.5 16.5 6-6 4 4 7-7.5M15 7h5.5v5.5" />
  </Svg>
);

export const PlusIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);

export const MenuIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </Svg>
);

export const CloseIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="m6 6 12 12M18 6 6 18" />
  </Svg>
);

export const ArrowUpIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M12 19.5v-15M6.5 10 12 4.5l5.5 5.5" />
  </Svg>
);

export const ArrowLeftIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M19.5 12h-15M10 6.5 4.5 12l5.5 5.5" />
  </Svg>
);

export const InfoIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 11v5M12 8h.01" />
  </Svg>
);

export const GridIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <rect x="3.5" y="3.5" width="7" height="7" rx="2" />
    <rect x="13.5" y="3.5" width="7" height="7" rx="2" />
    <rect x="3.5" y="13.5" width="7" height="7" rx="2" />
    <rect x="13.5" y="13.5" width="7" height="7" rx="2" />
  </Svg>
);

export const CalendarPlusIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
    <path d="M3.5 10h17M8 3v4M16 3v4M12 13v5M9.5 15.5h5" />
  </Svg>
);

export const PlaneIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M10.5 13.5 4 11l1.5-1.5 7 .5 4.5-5a2 2 0 0 1 2.8 2.8l-5 4.5.5 7L13.8 21l-2.5-6.5-3.8 3.3.3 2.2-1.3 1.3-1.5-3-3-1.5 1.3-1.3 2.2.3 3-2.7Z" />
  </Svg>
);

export const PieIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M12 3.5a8.5 8.5 0 1 0 8.5 8.5H12V3.5Z" />
    <path d="M15 3.8A8.5 8.5 0 0 1 20.2 9H15V3.8Z" />
  </Svg>
);

export const ActivityIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M3 12h4l2.5-6 5 12 2.5-6h4" />
  </Svg>
);

export const LogoutIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M14 4.5h3.5a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H14M9.5 8 5.5 12l4 4M5.5 12h10" />
  </Svg>
);

export const SidebarIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <rect x="3.5" y="4" width="17" height="16" rx="3" />
    <path d="M9.5 4v16M6 8.5h1M6 11.5h1" />
  </Svg>
);

export const RefreshIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4.5v4h-4" />
  </Svg>
);

export const GlobeIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M3.5 12h17M12 3.5c2.3 2.4 3.4 5.2 3.4 8.5s-1.1 6.1-3.4 8.5c-2.3-2.4-3.4-5.2-3.4-8.5S9.7 5.9 12 3.5Z" />
  </Svg>
);

export const SunIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" />
  </Svg>
);

export const MoonIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10Z" />
  </Svg>
);

export const PencilIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M4.5 19.5h4l10-10a2.8 2.8 0 0 0-4-4l-10 10v4ZM13 7l4 4" />
  </Svg>
);

export const TrashIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 12.5h9l1-12.5M10 11v5M14 11v5" />
  </Svg>
);

export const AlertIcon: React.FC<IconProps> = (p) => (
  <Svg {...p}>
    <path d="M12 4 21 19.5H3L12 4Z" />
    <path d="M12 10v4.5M12 17.2h.01" />
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
