import React from 'react';
import { SwapIcon, UserIcon } from '../icons/LineIcons';

interface BookingForCardProps {
  patientNumber: string;
  fullName: string;
  isNewlyRegistered: boolean;
  onChangePatient: () => void;
  disabled: boolean;
}

/**
 * Who this booking is for, kept on screen for the rest of the flow.
 *
 * `data-testid="patient-number"` is what the register-then-book recovery is asserted against: a
 * booking that fails after a successful registration must leave this card exactly where it is.
 */
const BookingForCard: React.FC<BookingForCardProps> = ({
  patientNumber,
  fullName,
  isNewlyRegistered,
  onChangePatient,
  disabled,
}) => (
  <section className="bk-card bk-for" role="status" data-testid="patient-number">
    <span className="bk-for-avatar">
      <UserIcon />
    </span>
    <div className="bk-for-text">
      <span className="bk-for-label">{isNewlyRegistered ? 'You are registered' : 'Booking for'}</span>
      <strong className="bk-for-number">{patientNumber}</strong>
      <span className="bk-for-name">{fullName}</span>
      {isNewlyRegistered && (
        <span className="bk-for-hint">
          Keep this number — use it with your date of birth next time you book.
        </span>
      )}
    </div>
    <button type="button" className="bk-for-change" onClick={onChangePatient} disabled={disabled}>
      <SwapIcon className="bk-btn-icon" />
      Change Patient
    </button>
  </section>
);

export default BookingForCard;
