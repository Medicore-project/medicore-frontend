import React from 'react';
import { colomboTimeLabel } from '../../api/appointments';
import type { PatientWaitlistEntry } from '../../api/waitlist';
import { WaitlistStatus, isActiveWaitlistStatus } from '../../api/waitlist';
import { colomboToday, fullDateLabel } from '../../utils/bookingLabels';

interface YourWaitlistProps {
  entries: PatientWaitlistEntry[];
  /** What the last answer did — "Booked for …" — shown above the list. */
  notice?: string | null;
  /** Why the last answer was refused, in the service's words. */
  error?: string | null;
  /** The entry an answer is in flight for; its buttons are disabled meanwhile. */
  busyEntryId?: string | null;
  onAccept: (entry: PatientWaitlistEntry) => void;
  onDecline: (entry: PatientWaitlistEntry) => void;
  onLeave: (entry: PatientWaitlistEntry) => void;
}

/** How an entry that has left the queue ended, for a day still to come. */
function outcome(entry: PatientWaitlistEntry): string {
  switch (entry.status) {
    case WaitlistStatus.Accepted:
      return 'Offer accepted — now in your appointments.';
    case WaitlistStatus.Declined:
      return 'You declined the offered time.';
    case WaitlistStatus.Expired:
      return 'The offer expired and passed to the next patient.';
    default:
      return entry.closedReason ? `Removed: ${entry.closedReason}` : 'You left the waitlist.';
  }
}

/**
 * The identified patient's waitlist entries, beside their upcoming appointments (SCRUM-37).
 *
 * The only place an offer is seen: nothing is sent when a time frees up. An open offer is shown
 * first and prominently, with when it lapses; a waiting entry shows its place in line. Entries
 * that have closed stay visible, muted, until their day has passed — so a patient whose offer
 * lapsed learns that it did, instead of finding the entry gone.
 *
 * Hidden when there is nothing to show; most patients are never on a waitlist.
 */
const YourWaitlist: React.FC<YourWaitlistProps> = ({
  entries,
  notice,
  error,
  busyEntryId,
  onAccept,
  onDecline,
  onLeave,
}) => {
  const today = colomboToday();
  const shown = entries
    .filter((entry) => isActiveWaitlistStatus(entry.status) || entry.slotDate >= today)
    .sort(
      (a, b) =>
        Number(b.status === WaitlistStatus.Offered) - Number(a.status === WaitlistStatus.Offered)
        || a.slotDate.localeCompare(b.slotDate),
    );

  if (shown.length === 0 && !notice) return null;

  return (
    <section className="bk-card booking-upcoming booking-waitlist" data-testid="your-waitlist">
      <h2>Your waitlist</h2>
      {notice && (
        <p className="alert alert-success booking-upcoming-notice" role="status">
          {notice}
        </p>
      )}
      {error && (
        <p className="alert alert-danger booking-upcoming-notice" role="alert">
          {error}
        </p>
      )}
      <ul className="booking-upcoming-list">
        {shown.map((entry) => {
          const day = fullDateLabel(entry.slotDate);
          const who = entry.doctorName ?? 'Doctor to be confirmed';
          const busy = busyEntryId === entry.waitlistEntryId;
          const isOffer = entry.status === WaitlistStatus.Offered;
          const isWaiting = entry.status === WaitlistStatus.Waiting;

          return (
            <li
              key={entry.waitlistEntryId}
              className={`booking-upcoming-item${isOffer ? ' booking-waitlist-offer' : ''}${
                isActiveWaitlistStatus(entry.status) ? '' : ' booking-waitlist-closed'
              }`}
              data-testid="waitlist-entry"
            >
              {isOffer && entry.offeredStartUtc ? (
                <>
                  <span className="booking-waitlist-tag">A time is held for you</span>
                  <span className="booking-upcoming-when">
                    {day} · {colomboTimeLabel(entry.offeredStartUtc)}
                  </span>
                  <span className="booking-upcoming-who">{who}</span>
                  {entry.offerExpiresAtUtc && (
                    <span className="booking-waitlist-expiry">
                      Held until {colomboTimeLabel(entry.offerExpiresAtUtc)}
                    </span>
                  )}
                </>
              ) : (
                <>
                  <span className="booking-upcoming-when">{day}</span>
                  <span className="booking-upcoming-who">{who}</span>
                  <span className="booking-waitlist-state">
                    {isWaiting
                      ? entry.placeInLine
                        ? `Waiting — #${entry.placeInLine} in line`
                        : 'Waiting'
                      : outcome(entry)}
                  </span>
                </>
              )}

              {isActiveWaitlistStatus(entry.status) && (
                <span className="booking-upcoming-actions">
                  {isOffer && (
                    <>
                      <button
                        type="button"
                        className="btn btn-sm btn-primary"
                        disabled={busy}
                        aria-label={`Accept the time offered on ${day}`}
                        onClick={() => onAccept(entry)}
                      >
                        Accept
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline"
                        disabled={busy}
                        aria-label={`Decline the time offered on ${day}`}
                        onClick={() => onDecline(entry)}
                      >
                        Decline
                      </button>
                    </>
                  )}
                  {isWaiting && (
                    <button
                      type="button"
                      className="btn btn-sm btn-danger-outline"
                      disabled={busy}
                      aria-label={`Leave the waitlist for ${day}`}
                      onClick={() => onLeave(entry)}
                    >
                      Leave waitlist
                    </button>
                  )}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
};

export default YourWaitlist;
