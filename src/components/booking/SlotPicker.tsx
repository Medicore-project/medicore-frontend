import React, { useMemo, useRef } from 'react';
import { colomboTimeLabel } from '../../api/appointments';
import type { PublicDoctor, PublicSlot } from '../../api/booking';
import { addDaysIso, chipLabel, colomboToday, datesBetween } from '../../utils/bookingLabels';
import {
  BrainIcon,
  CalendarIcon,
  CheckBadgeIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  StethoscopeIcon,
  UserIcon,
} from '../icons/LineIcons';

interface SlotPickerProps {
  specializations: string[];
  specialization: string;
  doctors: PublicDoctor[];
  doctorId: string;
  slots: PublicSlot[];
  selectedDate: string | null;
  selectedSlotId: string | null;
  isLoadingDoctors: boolean;
  isLoadingSlots: boolean;
  error: string | null;
  onSpecializationChange: (value: string) => void;
  onDoctorChange: (doctorId: string) => void;
  onSelectDate: (date: string) => void;
  onPickSlot: (slot: PublicSlot) => void;
}

/** At least two weeks of dates, so a doctor who works once a week still shows a pattern. */
const MIN_DAYS_SHOWN = 14;

/**
 * Choosing a doctor, a date and a time.
 *
 * Specialization is a filter rather than a required step — a patient who knows their doctor's name
 * should not have to work out which specialty they belong to first.
 *
 * The date strip shows every day from today, greying out the ones with no free time, so a patient
 * can see the doctor's pattern rather than a list with unexplained gaps. Times are only ever the
 * free ones: the public listing does not say which times are taken, deliberately, so there is no
 * "unavailable time" to draw.
 */
const SlotPicker: React.FC<SlotPickerProps> = ({
  specializations,
  specialization,
  doctors,
  doctorId,
  slots,
  selectedDate,
  selectedSlotId,
  isLoadingDoctors,
  isLoadingSlots,
  error,
  onSpecializationChange,
  onDoctorChange,
  onSelectDate,
  onPickSlot,
}) => {
  const stripRef = useRef<HTMLDivElement>(null);

  const slotsByDate = useMemo(() => {
    const map = new Map<string, PublicSlot[]>();
    slots.forEach((slot) => map.set(slot.slotDate, [...(map.get(slot.slotDate) ?? []), slot]));
    return map;
  }, [slots]);

  const dates = useMemo(() => {
    const today = colomboToday();
    const lastSlotDate = slots.length ? slots[slots.length - 1].slotDate : today;
    const minimumEnd = addDaysIso(today, MIN_DAYS_SHOWN - 1);
    return datesBetween(today, lastSlotDate > minimumEnd ? lastSlotDate : minimumEnd);
  }, [slots]);

  const timesForDay = selectedDate ? slotsByDate.get(selectedDate) ?? [] : [];

  // jsdom has no scrollBy; a missing method must not throw on click.
  const scrollStrip = (direction: 1 | -1) =>
    stripRef.current?.scrollBy?.({ left: direction * 320, behavior: 'smooth' });

  return (
    <div className="bk-picker" data-testid="booking-slot-picker">
      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}

      {/* ── 1 and 2: specialization and doctor ── */}
      <section className="bk-card bk-choose">
        <div className="bk-field">
          <label htmlFor="booking-specialization" className="bk-section-title">
            <StethoscopeIcon className="bk-section-icon" />
            1. Select Specialization
          </label>
          <div className="bk-select">
            <span className="bk-select-badge">
              <BrainIcon />
            </span>
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
            <ChevronDownIcon className="bk-select-chevron" />
          </div>
        </div>

        <div className="bk-field">
          <label htmlFor="booking-doctor" className="bk-section-title">
            <UserIcon className="bk-section-icon" />
            2. Select Doctor
          </label>
          <div className="bk-select">
            <span className="bk-select-badge">
              <UserIcon />
            </span>
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
            <ChevronDownIcon className="bk-select-chevron" />
          </div>
        </div>

        {!isLoadingDoctors && doctors.length === 0 && (
          <div className="bk-empty bk-choose-empty">
            <span className="bk-empty-title">No doctors are available to book right now</span>
            <span>Please try another specialization, or call the clinic.</span>
          </div>
        )}
      </section>

      {/* ── 3 and 4: date and time ── */}
      {doctorId && (
        <section className="bk-card bk-when">
          <h3 className="bk-section-title">
            <CalendarIcon className="bk-section-icon" />
            3. Select Date
          </h3>

          {isLoadingSlots ? (
            <p className="bk-empty">Loading times…</p>
          ) : slots.length === 0 ? (
            <div className="bk-empty">
              <span className="bk-empty-title">No free times for this doctor</span>
              <span>Try another doctor, or check again later — times open up when schedules change.</span>
            </div>
          ) : (
            <>
              <div className="bk-dates">
                <button
                  type="button"
                  className="bk-dates-arrow"
                  aria-label="Earlier dates"
                  onClick={() => scrollStrip(-1)}
                >
                  <ChevronLeftIcon />
                </button>
                <div className="bk-dates-strip" ref={stripRef}>
                  {dates.map((date) => {
                    const free = slotsByDate.get(date)?.length ?? 0;
                    const { weekday, date: day } = chipLabel(date);
                    const isSelected = date === selectedDate;
                    return (
                      <button
                        key={date}
                        type="button"
                        className={`bk-date${isSelected ? ' bk-date--selected' : ''}`}
                        disabled={free === 0}
                        aria-pressed={isSelected}
                        title={free === 0 ? 'No free times' : `${free} free time${free === 1 ? '' : 's'}`}
                        data-testid="date-option"
                        onClick={() => onSelectDate(date)}
                      >
                        <span className="bk-date-weekday">{weekday}</span>
                        <span className="bk-date-day">{day}</span>
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  className="bk-dates-arrow"
                  aria-label="Later dates"
                  onClick={() => scrollStrip(1)}
                >
                  <ChevronRightIcon />
                </button>
              </div>

              <div className="bk-times-header">
                <h3 className="bk-section-title">
                  <ClockIcon className="bk-section-icon" />
                  4. Select Time Slot
                </h3>
                <ul className="bk-legend" aria-label="Legend">
                  <li>
                    <span className="bk-legend-dot bk-legend-dot--available" />
                    Available
                  </li>
                  <li>
                    <span className="bk-legend-dot bk-legend-dot--selected" />
                    Selected
                  </li>
                </ul>
              </div>

              <div className="bk-times">
                {timesForDay.map((slot) => {
                  const isSelected = slot.slotId === selectedSlotId;
                  return (
                    <button
                      key={slot.slotId}
                      type="button"
                      className={`bk-time${isSelected ? ' bk-time--selected' : ''}`}
                      aria-pressed={isSelected}
                      data-testid="slot-option"
                      data-slot-id={slot.slotId}
                      onClick={() => onPickSlot(slot)}
                    >
                      <span className="bk-time-label" data-testid="slot-time">
                        {colomboTimeLabel(slot.startUtc)}
                      </span>
                      <span className="bk-time-duration">{slot.durationMinutes} min</span>
                      {isSelected && <CheckBadgeIcon className="bk-time-check" />}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );
};

export default SlotPicker;
