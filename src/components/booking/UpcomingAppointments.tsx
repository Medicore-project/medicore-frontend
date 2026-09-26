import React from 'react';
import { colomboTimeLabel } from '../../api/appointments';
import type { PatientAppointment } from '../../api/booking';
import { fullDateLabel } from '../../utils/bookingLabels';

interface UpcomingAppointmentsProps {
  appointments: PatientAppointment[];
  /** Offers Reschedule on each row when given (SCRUM-36). */
  onReschedule?: (appointment: PatientAppointment) => void;
  /** Offers Cancel on each row when given (SCRUM-36). */
  onCancel?: (appointment: PatientAppointment) => void;
  /** What the last change did — "Your appointment was cancelled." — shown above the list. */
  notice?: string | null;
}

/**
 * The identified patient's own upcoming bookings, shown beside the booking summary.
 *
 * Before this a booking was visible exactly once, on the confirmation screen; a patient coming
 * back to check when their appointment was had nowhere to look. Read with the booking token, so it
 * only ever lists the bookings of whoever identified.
 *
 * Since SCRUM-36 each row can be rescheduled or cancelled from here. The cancellation window is the
 * service's to enforce; inside it the service answers with the policy, and the dialog shows it.
 */
const UpcomingAppointments: React.FC<UpcomingAppointmentsProps> = ({
  appointments,
  onReschedule,
  onCancel,
  notice,
}) => (
  <section className="bk-card booking-upcoming" data-testid="upcoming-appointments">
    <h2>Your upcoming appointments</h2>
    {notice && (
      <p className="alert alert-success booking-upcoming-notice" role="status">
        {notice}
      </p>
    )}
    {appointments.length === 0 ? (
      <p className="field-help">You have no upcoming appointments.</p>
    ) : (
      <ul className="booking-upcoming-list">
        {appointments.map((appointment) => {
          const when = `${fullDateLabel(appointment.slotDate)} · ${colomboTimeLabel(appointment.startUtc)}`;
          return (
            <li key={appointment.appointmentId} className="booking-upcoming-item">
              <span className="booking-upcoming-when">{when}</span>
              <span className="booking-upcoming-who">
                {appointment.doctorName ?? 'Doctor to be confirmed'}
                {appointment.specialization ? ` — ${appointment.specialization}` : ''}
              </span>
              {(onReschedule || onCancel) && (
                <span className="booking-upcoming-actions">
                  {onReschedule && (
                    <button
                      type="button"
                      className="btn btn-sm btn-outline"
                      aria-label={`Reschedule the appointment on ${when}`}
                      onClick={() => onReschedule(appointment)}
                    >
                      Reschedule
                    </button>
                  )}
                  {onCancel && (
                    <button
                      type="button"
                      className="btn btn-sm btn-danger-outline"
                      aria-label={`Cancel the appointment on ${when}`}
                      onClick={() => onCancel(appointment)}
                    >
                      Cancel
                    </button>
                  )}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    )}
  </section>
);

export default UpcomingAppointments;
