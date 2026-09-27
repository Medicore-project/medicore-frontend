import React from 'react';
import type { PatientWaitlistEntry } from '../../api/waitlist';
import { WaitlistStatus } from '../../api/waitlist';
import { fullDateLabel } from '../../utils/bookingLabels';
import { ClockIcon } from '../icons/LineIcons';

interface WaitlistJoinCardProps {
  /** The fully booked day, as `YYYY-MM-DD`. */
  date: string;
  doctorName: string;
  /** The patient's active entry for this doctor's day, if they are already waiting. */
  entry: PatientWaitlistEntry | null;
  isJoining: boolean;
  error: string | null;
  onJoin: () => void;
}

/**
 * Shown in place of the times on a fully booked day (SCRUM-37): the way onto that day's waitlist,
 * or where the patient already stands on it.
 *
 * Nothing is sent to the patient when a time frees up, so the card says plainly how offers work:
 * they wait here, on this page, for a limited time.
 */
const WaitlistJoinCard: React.FC<WaitlistJoinCardProps> = ({
  date,
  doctorName,
  entry,
  isJoining,
  error,
  onJoin,
}) => (
  <div className="bk-waitlist-join" data-testid="waitlist-join">
    <h3 className="bk-section-title">
      <ClockIcon className="bk-section-icon" />
      Fully booked
    </h3>
    <p className="bk-waitlist-join-lead">
      {doctorName} has no free times left on <strong>{fullDateLabel(date)}</strong>.
    </p>

    {error && (
      <div className="alert alert-danger" role="alert">
        {error}
      </div>
    )}

    {entry?.status === WaitlistStatus.Offered ? (
      <p className="bk-waitlist-join-status" role="status">
        A time on this day is being held for you — see <strong>Your waitlist</strong>.
      </p>
    ) : entry ? (
      <p className="bk-waitlist-join-status" role="status">
        You are on the waitlist for this day
        {entry.placeInLine ? (
          <>
            {' '}
            — <strong>#{entry.placeInLine} in line</strong>
          </>
        ) : null}
        .
      </p>
    ) : (
      <>
        <p className="field-help">
          Join the waitlist and, if someone cancels, the time is offered to the first patient in
          line. An offer is held for a short time only, so check back on this page to accept it.
        </p>
        <button type="button" className="btn btn-primary" onClick={onJoin} disabled={isJoining}>
          {isJoining ? 'Joining…' : 'Join the waitlist'}
        </button>
      </>
    )}
  </div>
);

export default WaitlistJoinCard;
