import React from 'react';
import { colomboTimeLabel } from '../../api/appointments';
import type { PatientAppointment } from '../../api/booking';

interface UpcomingAppointmentsProps {
  appointments: PatientAppointment[];
}

function dayLabel(slotDate: string): string {
  const [year, month, day] = slotDate.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * The identified patient's own upcoming bookings, shown above the doctor picker.
 *
 * Before this a booking was visible exactly once, on the confirmation screen; a patient coming
 * back to check when their appointment was had nowhere to look. Read with the booking token, so it
 * only ever lists the bookings of whoever identified.
 */
const UpcomingAppointments: React.FC<UpcomingAppointmentsProps> = ({ appointments }) => (
  <section className="card booking-upcoming" data-testid="upcoming-appointments">
    <h2>Your upcoming appointments</h2>
    {appointments.length === 0 ? (
      <p className="field-help">You have no upcoming appointments.</p>
    ) : (
      <ul className="booking-upcoming-list">
        {appointments.map((appointment) => (
          <li key={appointment.appointmentId} className="booking-upcoming-item">
            <span className="booking-upcoming-when">
              {dayLabel(appointment.slotDate)} · {colomboTimeLabel(appointment.startUtc)}
            </span>
            <span className="booking-upcoming-who">
              {appointment.doctorName ?? 'Doctor to be confirmed'}
              {appointment.specialization ? ` — ${appointment.specialization}` : ''}
            </span>
          </li>
        ))}
      </ul>
    )}
  </section>
);

export default UpcomingAppointments;
