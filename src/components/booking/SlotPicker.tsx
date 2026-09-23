import React from 'react';
import { colomboTimeLabel } from '../../api/appointments';
import type { PublicDoctor, PublicSlot } from '../../api/booking';

interface SlotPickerProps {
  specializations: string[];
  specialization: string;
  doctors: PublicDoctor[];
  doctorId: string;
  slots: PublicSlot[];
  isLoadingDoctors: boolean;
  isLoadingSlots: boolean;
  error: string | null;
  onSpecializationChange: (value: string) => void;
  onDoctorChange: (doctorId: string) => void;
  onPickSlot: (slot: PublicSlot) => void;
}

/** "Wed 24 Sep", the way a date is read aloud. */
function dayLabel(slotDate: string): string {
  const [year, month, day] = slotDate.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

/** Slots in the order they were returned, grouped under the day they fall on. */
function groupByDay(slots: PublicSlot[]): Array<{ date: string; slots: PublicSlot[] }> {
  const days: Array<{ date: string; slots: PublicSlot[] }> = [];

  slots.forEach((slot) => {
    const last = days[days.length - 1];
    if (last && last.date === slot.slotDate) {
      last.slots.push(slot);
    } else {
      days.push({ date: slot.slotDate, slots: [slot] });
    }
  });

  return days;
}

/**
 * Steps two and three: choose a doctor, then a time.
 *
 * Specialization is a filter rather than a required step — a patient who knows their doctor's name
 * should not have to work out which specialty they belong to first.
 */
const SlotPicker: React.FC<SlotPickerProps> = ({
  specializations,
  specialization,
  doctors,
  doctorId,
  slots,
  isLoadingDoctors,
  isLoadingSlots,
  error,
  onSpecializationChange,
  onDoctorChange,
  onPickSlot,
}) => {
  const days = groupByDay(slots);

  return (
    <section className="card booking-step" data-testid="booking-slot-picker">
      <h2>Choose a time</h2>

      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}

      <div className="booking-field-row">
        <div className="form-group">
          <label htmlFor="booking-specialization">Specialization</label>
          <select
            id="booking-specialization"
            value={specialization}
            onChange={(event) => onSpecializationChange(event.target.value)}
          >
            <option value="">All specializations</option>
            {specializations.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="booking-doctor">Doctor</label>
          <select
            id="booking-doctor"
            value={doctorId}
            disabled={isLoadingDoctors || doctors.length === 0}
            onChange={(event) => onDoctorChange(event.target.value)}
          >
            <option value="">Select a doctor</option>
            {doctors.map((doctor) => (
              <option key={doctor.doctorId} value={doctor.doctorId}>
                {doctor.specialization
                  ? `${doctor.fullName} — ${doctor.specialization}`
                  : doctor.fullName}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!isLoadingDoctors && doctors.length === 0 && (
        <div className="schedule-empty schedule-empty--notice">
          <span className="schedule-empty-title">No doctors are available to book right now</span>
          <span className="schedule-empty-hint">
            Please try another specialization, or call the clinic.
          </span>
        </div>
      )}

      {isLoadingSlots && <p className="schedule-empty">Loading times…</p>}

      {!isLoadingSlots && doctorId && slots.length === 0 && (
        <div className="schedule-empty schedule-empty--notice">
          <span className="schedule-empty-title">No free times for this doctor</span>
          <span className="schedule-empty-hint">
            Try another doctor, or check again later — times open up when schedules change.
          </span>
        </div>
      )}

      {!isLoadingSlots &&
        days.map((day) => (
          <div className="booking-day" key={day.date}>
            <h3 className="booking-day-label">{dayLabel(day.date)}</h3>
            <div className="booking-slot-list">
              {day.slots.map((slot) => (
                <button
                  key={slot.slotId}
                  type="button"
                  className="btn btn-outline btn-sm booking-slot"
                  data-testid="slot-option"
                  onClick={() => onPickSlot(slot)}
                >
                  {colomboTimeLabel(slot.startUtc)}
                </button>
              ))}
            </div>
          </div>
        ))}
    </section>
  );
};

export default SlotPicker;
