import React, { useMemo, useRef } from 'react';
import { colomboTimeLabel } from '../../api/appointments';
import type { PublicSlot } from '../../api/booking';
import { addDaysIso, chipLabel, colomboToday, datesBetween } from '../../utils/bookingLabels';
import {
  CalendarIcon,
  CheckBadgeIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
} from '../icons/LineIcons';

interface SlotTimeGridProps {
  slots: PublicSlot[];
  selectedDate: string | null;
  selectedSlotId: string | null;
  isLoading: boolean;
  onSelectDate: (date: string) => void;
  onPickSlot: (slot: PublicSlot) => void;
  /**
   * Prefixes the headings "3." and "4.", continuing the booking page's numbered steps. Off where
   * the doctor is already fixed, as in a reschedule, and there are no steps 1 and 2.
   */
  numbered?: boolean;
  /** What to say when the doctor has no free time at all. */
  emptyHint?: string;
}

/** At least two weeks of dates, so a doctor who works once a week still shows a pattern. */
const MIN_DAYS_SHOWN = 14;

/**
 * One doctor's free times: a date strip from today, greying out days with nothing free, and the
 * free times of the chosen day.
 *
 * Extracted from `SlotPicker` in SCRUM-36 so rescheduling offers exactly the same picker as
 * booking, without the specialization and doctor choices that a reschedule does not have.
 */
const SlotTimeGrid: React.FC<SlotTimeGridProps> = ({
  slots,
  selectedDate,
  selectedSlotId,
  isLoading,
  onSelectDate,
  onPickSlot,
  numbered = false,
  emptyHint = 'Try another doctor, or check again later — times open up when schedules change.',
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
    <>
      <h3 className="bk-section-title">
        <CalendarIcon className="bk-section-icon" />
        {numbered ? '3. Select Date' : 'Select Date'}
      </h3>

      {isLoading ? (
        <p className="bk-empty">Loading times…</p>
      ) : slots.length === 0 ? (
        <div className="bk-empty">
          <span className="bk-empty-title">No free times for this doctor</span>
          <span>{emptyHint}</span>
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
              {numbered ? '4. Select Time Slot' : 'Select Time Slot'}
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
    </>
  );
};

export default SlotTimeGrid;
