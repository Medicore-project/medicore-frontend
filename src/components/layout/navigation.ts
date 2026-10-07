import type React from 'react';
import {
  ActivityIcon,
  BuildingIcon,
  CalendarIcon,
  CalendarPlusIcon,
  ClockIcon,
  DocumentIcon,
  GridIcon,
  LayersIcon,
  ListIcon,
  PieIcon,
  PlaneIcon,
  ShieldIcon,
  UserIcon,
  UsersIcon,
} from '../icons/LineIcons';
import {
  BOOKED_LIST_ROLES,
  BOOKING_ROLES,
  CLINIC_ROLES,
  FRONT_DESK_ROLES,
  LEAVE_READER_ROLES,
  PATIENT_READER_ROLES,
  SCHEDULE_READER_ROLES,
} from '../../utils/permissions';

export type NavItem = {
  name: string;
  path: string;
  /** Match the path exactly, so /appointments does not light up on /appointments/leave. */
  end?: boolean;
  /** Undefined = any signed-in user; otherwise the exact role set App.tsx gates the route behind. */
  allowedRoles?: readonly string[];
  icon: React.FC<{ className?: string }>;
  /** One line for the quick-jump search and the dashboard's workspace cards. */
  description: string;
};

export type NavSection = { title: string; items: NavItem[] };

/**
 * Every page in the staff workspace, grouped as the sidebar shows them.
 *
 * `allowedRoles` mirrors the role sets App.tsx gates each route behind. Keeping the sidebar in
 * lockstep with the routes means a user is never offered a page that would just bounce them back to
 * `/` — see ProtectedRoute, which does that redirect on a role mismatch. The sidebar, the header's
 * page title, the quick-jump search and the dashboard's shortcuts all read this one list.
 */
export const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Overview',
    items: [
      { name: 'Dashboard', path: '/dashboard', allowedRoles: CLINIC_ROLES, icon: GridIcon, description: 'Today at a glance' },
    ],
  },
  {
    title: 'Patient care',
    items: [
      { name: 'Patients', path: '/patients', allowedRoles: PATIENT_READER_ROLES, icon: UserIcon, description: 'Find, register and open patient records' },
    ],
  },
  {
    title: 'Appointments',
    items: [
      { name: 'Appointments', path: '/appointments', end: true, allowedRoles: SCHEDULE_READER_ROLES, icon: CalendarIcon, description: 'Doctor schedules and the weekly slot grid' },
      { name: 'Booked Appointments', path: '/appointments/booked', allowedRoles: BOOKED_LIST_ROLES, icon: ListIcon, description: 'Who is booked, with filters and export' },
      { name: 'Waitlist', path: '/appointments/waitlist', allowedRoles: BOOKED_LIST_ROLES, icon: ClockIcon, description: 'Patients waiting for a full day' },
      { name: 'Book Appointment', path: '/appointments/book', allowedRoles: BOOKING_ROLES, icon: CalendarPlusIcon, description: 'Book a visit for a patient' },
      { name: 'Doctor Leave', path: '/appointments/leave', allowedRoles: LEAVE_READER_ROLES, icon: PlaneIcon, description: 'Request and review doctor leave' },
    ],
  },
  {
    title: 'Organisation',
    items: [
      { name: 'Departments', path: '/departments', allowedRoles: FRONT_DESK_ROLES, icon: BuildingIcon, description: 'Hospital departments and their staff' },
      { name: 'Specializations', path: '/specializations', allowedRoles: FRONT_DESK_ROLES, icon: LayersIcon, description: 'Medical specializations offered' },
      { name: 'Staff', path: '/staff', allowedRoles: ['Admin'], icon: UsersIcon, description: 'Staff accounts, roles and status' },
    ],
  },
  {
    title: 'Billing',
    items: [
      { name: 'Service Tariffs', path: '/billing/tariffs', allowedRoles: FRONT_DESK_ROLES, icon: DocumentIcon, description: 'Effective-dated service prices and history' },
    ],
  },
  {
    title: 'Reports',
    items: [
      { name: 'Audit Reports', path: '/reports/audit', allowedRoles: ['Admin'], icon: ShieldIcon, description: 'Who changed what, and when' },
      { name: 'Demographics Report', path: '/reports/demographics', allowedRoles: ['Admin'], icon: PieIcon, description: 'Patient population breakdowns' },
      { name: 'Utilisation Report', path: '/reports/utilisation', allowedRoles: ['Admin'], icon: ActivityIcon, description: 'Doctor workload and no-show rates' },
    ],
  },
];

function canSee(item: NavItem, role: string | undefined): boolean {
  return !item.allowedRoles || (!!role && item.allowedRoles.includes(role));
}

/** The sections this role can see, each holding only its visible items; empty sections dropped. */
export function visibleSections(role: string | undefined): NavSection[] {
  return NAV_SECTIONS.map((section) => ({ ...section, items: section.items.filter((item) => canSee(item, role)) })).filter(
    (section) => section.items.length > 0,
  );
}

/** Every page this role can open, flattened in sidebar order. */
export function visibleItems(role: string | undefined): NavItem[] {
  return visibleSections(role).flatMap((section) => section.items);
}

/** Pages reached from another page rather than the sidebar, for the header's title. */
const DETAIL_TITLES: Array<{ pattern: RegExp; title: string; parent: string }> = [
  { pattern: /^\/patients\/register$/, title: 'Register patient', parent: 'Patients' },
  { pattern: /^\/patients\/[^/]+\/records\/[^/]+$/, title: 'Medical record', parent: 'Patients' },
  { pattern: /^\/patients\/[^/]+\/records$/, title: 'Medical records', parent: 'Patients' },
  { pattern: /^\/patients\/[^/]+\/prescriptions$/, title: 'Prescriptions', parent: 'Patients' },
  { pattern: /^\/patients\/[^/]+\/allergies$/, title: 'Allergies', parent: 'Patients' },
  { pattern: /^\/patients\/[^/]+$/, title: 'Patient profile', parent: 'Patients' },
  { pattern: /^\/staff\/[^/]+$/, title: 'Staff member', parent: 'Staff' },
  { pattern: /^\/appointments\/[^/]+$/, title: 'Appointment', parent: 'Booked Appointments' },
  { pattern: /^\/billing\/invoices\/[^/]+$/, title: 'Invoice', parent: 'Billing' },
];

/**
 * The header's title for a path: the section and page for a sidebar page, or the parent page and a
 * detail title for pages opened from elsewhere.
 */
export function pageTitleFor(pathname: string): { section: string; title: string } {
  for (const section of NAV_SECTIONS) {
    const item = section.items.find((candidate) => candidate.path === pathname);
    if (item) return { section: section.title, title: item.name };
  }
  const detail = DETAIL_TITLES.find((entry) => entry.pattern.test(pathname));
  if (detail) return { section: detail.parent, title: detail.title };
  return { section: 'MediCore', title: 'Workspace' };
}
