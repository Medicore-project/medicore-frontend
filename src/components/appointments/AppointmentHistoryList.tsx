import React from 'react';
import type { AppointmentHistoryEntry } from '../../api/appointments';
import { colomboDateTimeLabel as whenLabel } from '../../utils/bookingLabels';

/** What the entry did, in one line. */
function describe(entry: AppointmentHistoryEntry): string {
  switch (entry.action) {
    case 'Booked':
      return entry.toStartUtc ? `Booked for ${whenLabel(entry.toStartUtc)}` : 'Booked';
    case 'Rescheduled':
      return entry.fromStartUtc && entry.toStartUtc
        ? `Moved from ${whenLabel(entry.fromStartUtc)} to ${whenLabel(entry.toStartUtc)}`
        : 'Rescheduled';
    case 'Cancelled':
      return 'Cancelled';
    case 'Completed':
      return 'Marked completed';
    default:
      return entry.action;
  }
}

/**
 * Every change to one appointment, oldest first (SCRUM-36): the booking, then each reschedule,
 * cancellation or completion, with who made it and when. A completion's clinical notes are not
 * here — they are in the patient's medical record.
 */
const AppointmentHistoryList: React.FC<{ entries: AppointmentHistoryEntry[] }> = ({ entries }) => {
  if (entries.length === 0) {
    return <p className="appt-history-empty">No changes have been recorded.</p>;
  }

  return (
    <ol className="appt-history" data-testid="appointment-history">
      {entries.map((entry, index) => (
        <li key={`${entry.occurredAtUtc}-${index}`} className={`appt-history-item appt-history-item--${entry.action.toLowerCase()}`}>
          <div className="appt-history-line">
            <strong>{describe(entry)}</strong>
            <time dateTime={entry.occurredAtUtc}>{whenLabel(entry.occurredAtUtc)}</time>
          </div>
          {entry.reason && <p className="appt-history-reason">Reason: {entry.reason}</p>}
          <span className="appt-history-actor">by {entry.actor}</span>
        </li>
      ))}
    </ol>
  );
};

export default AppointmentHistoryList;
