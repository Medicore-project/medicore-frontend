import React from 'react';
import type { PublicDoctor, PublicSlot } from '../../api/booking';
import { BrainIcon, ChevronDownIcon, StethoscopeIcon, UserIcon } from '../icons/LineIcons';
import SlotTimeGrid from './SlotTimeGrid';

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

/**
 * Choosing a doctor, a date and a time.
 *
 * Specialization is a filter rather than a required step — a patient who knows their doctor's name
 * should not have to work out which specialty they belong to first.
 *
 * The date strip shows every day from today, greying out the ones with no free time, so a patient
 * can see the doctor's pattern rather than a list with unexplained gaps. Times are only ever the
 * free ones: the public listing does not say which times are taken, deliberately, so there is no
 * "unavailable time" to draw. Both live in `SlotTimeGrid`, which rescheduling reuses.
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
          <SlotTimeGrid
            slots={slots}
            selectedDate={selectedDate}
            selectedSlotId={selectedSlotId}
            isLoading={isLoadingSlots}
            onSelectDate={onSelectDate}
            onPickSlot={onPickSlot}
            numbered
          />
        </section>
      )}
    </div>
  );
};

export default SlotPicker;
