import { colomboTimeLabel } from '../api/appointments';
import type { AppointmentSummary } from '../api/appointments';

/** Formatting for the Booked Appointments page, kept out of the component file so it can be tested directly. */

/**
 * "Mon 5 Oct 2026". Assembled from parts rather than taken whole from `toLocaleDateString`, whose
 * punctuation differs between ICU builds — Node says "Mon, 5 Oct 2026", some browsers drop the comma.
 */
export function dayLabel(slotDate: string): string {
  const [year, month, day] = slotDate.split('-').map(Number);
  const parts = new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).formatToParts(new Date(year, month - 1, day));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? '';
  return `${part('weekday')} ${part('day')} ${part('month')} ${part('year')}`;
}

function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** The visible rows as CSV, in the order shown. Pure, so it is tested directly. */
export function toCsv(rows: AppointmentSummary[]): string {
  const header = ['Date', 'Time', 'Duration (min)', 'Patient', 'Patient number', 'Doctor', 'Specialization', 'Service', 'Status'];
  const lines = rows.map((a) =>
    [
      a.slotDate,
      colomboTimeLabel(a.startUtc),
      String(a.durationMinutes),
      a.patientName ?? '',
      a.patientNumber ?? '',
      a.doctorName ?? '',
      a.specialization ?? '',
      a.serviceCode,
      a.status,
    ]
      .map(csvCell)
      .join(','),
  );
  return [header.join(','), ...lines].join('\n');
}
