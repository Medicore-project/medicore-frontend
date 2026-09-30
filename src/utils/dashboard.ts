import { AppointmentStatus, type AppointmentSummary } from '../api/appointments';
import { BOOKED_LIST_ROLES, CLINIC_ROLES, FRONT_DESK_ROLES } from './permissions';
import { chipLabel, datesBetween } from './bookingLabels';

/**
 * The dashboard's figures, kept out of the component so they can be tested directly. Everything
 * here is pure: pass in the appointments, today's Colombo date and the current instant.
 */

/** How far either side of today the dashboard loads bookings: a week back, six days ahead. */
export const DAYS_BACK = 6;
export const DAYS_AHEAD = 6;

/**
 * What the dashboard may load for a role. Each source mirrors the API policy (or the page gate)
 * behind it, so nobody triggers a 403: the booked list and waitlist for clinic staff, a doctor seeing
 * only their own; staff totals for Admin; departments for the front desk.
 */
export type DashboardPlan = {
  appointments: boolean;
  waitlist: boolean;
  staff: boolean;
  departments: boolean;
  doctors: boolean;
  /** A doctor's own id, so they see their own bookings rather than the whole clinic's. */
  doctorId?: string;
  /** Whether rows open the appointment page (its route is BOOKED_LIST_ROLES only). */
  canOpenAppointments: boolean;
};

const has = (roles: readonly string[], role?: string) => !!role && roles.includes(role);

export function dashboardPlan(role?: string, staffId?: string | null): DashboardPlan {
  const isDoctor = role === 'Doctor';
  // A doctor account with no staff record would otherwise read the whole clinic's bookings.
  const ownOnlyOk = !isDoctor || !!staffId;
  return {
    appointments: has(CLINIC_ROLES, role) && ownOnlyOk,
    waitlist: has(BOOKED_LIST_ROLES, role) && ownOnlyOk,
    staff: role === 'Admin',
    departments: has(FRONT_DESK_ROLES, role),
    doctors: has(CLINIC_ROLES, role) && !isDoctor,
    doctorId: isDoctor && staffId ? staffId : undefined,
    canOpenAppointments: has(BOOKED_LIST_ROLES, role),
  };
}

export const STATUS_META: Record<string, { label: string; tone: string }> = {
  [AppointmentStatus.Booked]: { label: 'Booked', tone: 'blue' },
  [AppointmentStatus.Completed]: { label: 'Completed', tone: 'green' },
  [AppointmentStatus.NoShow]: { label: 'No-show', tone: 'amber' },
  [AppointmentStatus.Cancelled]: { label: 'Cancelled', tone: 'slate' },
};

export function statusLabel(status: string): string {
  return STATUS_META[status]?.label ?? status;
}

export type DayPoint = {
  date: string;
  weekday: string;
  label: string;
  isToday: boolean;
  Booked: number;
  Completed: number;
  NoShow: number;
  Cancelled: number;
};

export type DashboardSummary = {
  /** Today's bookings in time order, every status. */
  today: AppointmentSummary[];
  /** Today's counts by status. */
  todayCounts: Record<string, number>;
  /** Today's bookings that are going ahead or went ahead — everything but cancelled. */
  todayActive: number;
  /** Still-booked appointments after today, within the loaded window. */
  upcoming: number;
  /** The next booked appointment today that has not started yet. */
  next: AppointmentSummary | null;
  /** One point per day across the loaded window. */
  trend: DayPoint[];
};

export function summarise(appointments: AppointmentSummary[], today: string, now: Date, from: string, to: string): DashboardSummary {
  const todays = appointments
    .filter((a) => a.slotDate === today)
    .sort((a, b) => a.startUtc.localeCompare(b.startUtc));

  const todayCounts: Record<string, number> = { Booked: 0, Completed: 0, NoShow: 0, Cancelled: 0 };
  todays.forEach((a) => {
    todayCounts[a.status] = (todayCounts[a.status] ?? 0) + 1;
  });

  const next =
    todays.find((a) => a.status === AppointmentStatus.Booked && new Date(a.startUtc).getTime() >= now.getTime()) ?? null;

  const trend = datesBetween(from, to).map<DayPoint>((date) => {
    const { weekday, date: label } = chipLabel(date);
    const onDay = appointments.filter((a) => a.slotDate === date);
    const count = (status: string) => onDay.filter((a) => a.status === status).length;
    return {
      date,
      weekday,
      label,
      isToday: date === today,
      Booked: count(AppointmentStatus.Booked),
      Completed: count(AppointmentStatus.Completed),
      NoShow: count(AppointmentStatus.NoShow),
      Cancelled: count(AppointmentStatus.Cancelled),
    };
  });

  return {
    today: todays,
    todayCounts,
    todayActive: todays.length - todayCounts.Cancelled,
    upcoming: appointments.filter((a) => a.slotDate > today && a.status === AppointmentStatus.Booked).length,
    next,
    trend,
  };
}

/** "Good morning" and friends, by the Colombo hour. */
export function greetingFor(colomboHour: number): string {
  if (colomboHour < 5) return 'Working late';
  if (colomboHour < 12) return 'Good morning';
  if (colomboHour < 17) return 'Good afternoon';
  return 'Good evening';
}

/** The current hour on the Colombo clock (0–23). */
export function colomboHour(now: Date = new Date()): number {
  return Number(
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Colombo', hour: '2-digit', hour12: false }).format(now),
  ) % 24;
}
