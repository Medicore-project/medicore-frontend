import React from 'react';
import type { AppointmentSummary } from '../../api/appointments';
import { CalendarIcon, CheckIcon, ClockIcon, CrossCircleIcon } from './BookedIcons';

interface BookedStatsProps {
  /** Everything loaded for the current doctor and dates — before the status filter. */
  appointments: AppointmentSummary[];
}

/**
 * The four counts across the top of the page.
 *
 * Counted before the status filter on purpose: picking "Cancelled" narrows the table, but the cards
 * keep describing the whole range, so choosing a status does not make the other numbers vanish.
 *
 * "Completed", not "Pending": the appointment service has no pending state — a booking is confirmed
 * the moment it is made — so a Pending card could only ever read 0.
 */
const BookedStats: React.FC<BookedStatsProps> = ({ appointments }) => {
  const count = (status: string) => appointments.filter((a) => a.status === status).length;

  const cards = [
    { key: 'total', label: 'Total Appointments', value: appointments.length, Icon: CalendarIcon },
    { key: 'booked', label: 'Booked', value: count('Booked'), Icon: CheckIcon },
    { key: 'completed', label: 'Completed', value: count('Completed'), Icon: ClockIcon },
    { key: 'cancelled', label: 'Cancelled', value: count('Cancelled'), Icon: CrossCircleIcon },
  ];

  return (
    <div className="booked-stats">
      {cards.map(({ key, label, value, Icon }) => (
        <div key={key} className={`booked-stat booked-stat--${key}`} data-testid={`stat-${key}`}>
          <span className="booked-stat-icon">
            <Icon />
          </span>
          <div className="booked-stat-text">
            <strong className="booked-stat-value">{value}</strong>
            <span className="booked-stat-label">{label}</span>
          </div>
          <Icon className="booked-stat-watermark" />
        </div>
      ))}
    </div>
  );
};

export default BookedStats;
