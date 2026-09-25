import React from 'react';
import { colomboTimeLabel } from '../../api/appointments';
import type { PublicDoctor, PublicSlot } from '../../api/booking';
import { fullDateLabel } from '../../utils/bookingLabels';
import {
  ArrowRightIcon,
  BrainIcon,
  CalendarIcon,
  ClockIcon,
  DocumentIcon,
  UserIcon,
} from '../icons/LineIcons';
import BillingNotice from './BillingNotice';

interface BookingSummaryProps {
  patient: { patientNumber: string; fullName: string } | null;
  specialization: string;
  doctor: PublicDoctor | null;
  slot: PublicSlot | null;
  serviceCode: string;
  isSubmitting: boolean;
  onConfirm: () => void;
}

const NOT_YET = 'Not selected yet';

/**
 * What is about to be booked, beside the choices that build it — and the one button that books.
 *
 * This replaced a separate confirm screen: the review happens where the choices are made, so
 * changing the time is a click on the left rather than a "back" and a second pick. Nothing is
 * written until Confirm Appointment, and the billing notice is shown before that click as it was
 * on the confirm screen.
 */
const BookingSummary: React.FC<BookingSummaryProps> = ({
  patient,
  specialization,
  doctor,
  slot,
  serviceCode,
  isSubmitting,
  onConfirm,
}) => {
  const rows = [
    {
      key: 'patient',
      label: 'Patient',
      Icon: UserIcon,
      value: patient ? (
        <>
          <span className="bk-summary-strong">{patient.patientNumber}</span>
          <span className="bk-summary-sub">{patient.fullName}</span>
        </>
      ) : (
        'Not identified yet'
      ),
    },
    {
      key: 'specialization',
      label: 'Specialization',
      Icon: BrainIcon,
      value: doctor?.specialization || specialization || NOT_YET,
    },
    { key: 'doctor', label: 'Doctor', Icon: UserIcon, value: doctor?.fullName ?? NOT_YET },
    {
      key: 'date',
      label: 'Date',
      Icon: CalendarIcon,
      value: slot ? fullDateLabel(slot.slotDate) : NOT_YET,
    },
    {
      key: 'time',
      label: 'Time',
      Icon: ClockIcon,
      value: slot ? `${colomboTimeLabel(slot.startUtc)} (${slot.durationMinutes} minutes)` : NOT_YET,
    },
  ];

  const canConfirm = patient !== null && doctor !== null && slot !== null && !isSubmitting;

  return (
    <section className="bk-card bk-summary" data-testid="booking-confirm">
      <header className="bk-summary-header">
        <span className="bk-summary-header-icon">
          <DocumentIcon />
        </span>
        <div>
          <h2>Appointment Summary</h2>
          <p>Please review your details before booking.</p>
        </div>
      </header>

      <dl className="bk-summary-list">
        {rows.map(({ key, label, Icon, value }) => (
          <div key={key} className="bk-summary-row">
            <span className="bk-summary-icon">
              <Icon />
            </span>
            <div>
              <dt>{label}</dt>
              <dd className={value === NOT_YET ? 'bk-summary-empty' : undefined}>{value}</dd>
            </div>
          </div>
        ))}
      </dl>

      {slot && <BillingNotice serviceCode={serviceCode} />}

      <button type="button" className="bk-confirm" onClick={onConfirm} disabled={!canConfirm}>
        <CalendarIcon className="bk-btn-icon" />
        {isSubmitting ? 'Booking…' : 'Confirm Appointment'}
        {!isSubmitting && <ArrowRightIcon className="bk-btn-icon" />}
      </button>
    </section>
  );
};

export default BookingSummary;
