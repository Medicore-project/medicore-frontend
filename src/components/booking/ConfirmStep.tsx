import React from 'react';
import { colomboTimeLabel } from '../../api/appointments';
import type { PublicDoctor, PublicSlot } from '../../api/booking';
import BillingNotice from './BillingNotice';

interface ConfirmStepProps {
  doctor: PublicDoctor;
  slot: PublicSlot;
  serviceCode: string;
  isSubmitting: boolean;
  error: string | null;
  onConfirm: () => Promise<void>;
  onBack: () => void;
}

function fullDayLabel(slotDate: string): string {
  const [year, month, day] = slotDate.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/** The last step before anything is written: say exactly what is about to be booked. */
const ConfirmStep: React.FC<ConfirmStepProps> = ({
  doctor,
  slot,
  serviceCode,
  isSubmitting,
  error,
  onConfirm,
  onBack,
}) => (
  <section className="card booking-step" data-testid="booking-confirm">
    <h2>Confirm your appointment</h2>

    {error && (
      <div className="alert alert-danger" role="alert">
        {error}
      </div>
    )}

    <dl className="booking-summary">
      <div className="detail-row">
        <dt className="detail-label">Doctor</dt>
        <dd className="detail-value">{doctor.fullName}</dd>
      </div>
      {doctor.specialization && (
        <div className="detail-row">
          <dt className="detail-label">Specialization</dt>
          <dd className="detail-value">{doctor.specialization}</dd>
        </div>
      )}
      <div className="detail-row">
        <dt className="detail-label">Date</dt>
        <dd className="detail-value">{fullDayLabel(slot.slotDate)}</dd>
      </div>
      <div className="detail-row">
        <dt className="detail-label">Time</dt>
        <dd className="detail-value">
          {colomboTimeLabel(slot.startUtc)} – {colomboTimeLabel(slot.endUtc)}
        </dd>
      </div>
    </dl>

    <BillingNotice serviceCode={serviceCode} />

    <div className="booking-step-actions">
      <button
        type="button"
        className="btn btn-primary"
        onClick={onConfirm}
        disabled={isSubmitting}
      >
        {isSubmitting ? 'Booking…' : 'Confirm booking'}
      </button>
      <button type="button" className="btn btn-outline" onClick={onBack} disabled={isSubmitting}>
        Choose a different time
      </button>
    </div>
  </section>
);

export default ConfirmStep;
