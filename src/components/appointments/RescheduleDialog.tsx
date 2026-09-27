import React, { useEffect, useState } from 'react';
import type { PublicSlot } from '../../api/booking';
import { colomboTimeLabel } from '../../api/appointments';
import { extractErrorMessage } from '../../utils/apiError';
import { fullDateLabel } from '../../utils/bookingLabels';
import SlotTimeGrid from '../booking/SlotTimeGrid';

/** The date to land on after a load: `keepDate` if it still has free times, otherwise the first. */
function landingDate(slots: PublicSlot[], keepDate: string | null): string | null {
  const stillFree = keepDate !== null && slots.some((slot) => slot.slotDate === keepDate);
  return stillFree ? keepDate : (slots[0]?.slotDate ?? null);
}

interface RescheduleDialogProps {
  /** One line under the title saying which appointment this is. */
  subtitle: string;
  /**
   * The doctor's free times. Staff use the staff slot listing and a patient the public one, so
   * the caller decides; the doctor is always the appointment's own.
   */
  loadSlots: () => Promise<PublicSlot[]>;
  /**
   * Moves the appointment. Resolving means it moved and the caller closes the dialog. Rejecting
   * keeps it open with the service's wording and reloads the times — the usual reason is that
   * someone took that time a moment ago, and the appointment has not moved.
   */
  onConfirm: (slot: PublicSlot) => Promise<void>;
  onClose: () => void;
}

/**
 * Choosing a new time for an existing appointment (SCRUM-36), with the same date strip and time
 * grid as booking. The appointment's current time is never offered: it is booked, and the listing
 * only returns free slots.
 */
const RescheduleDialog: React.FC<RescheduleDialogProps> = ({ subtitle, loadSlots, onConfirm, onClose }) => {
  // The loader the dialog opened with. Callers pass an inline function, a new one every render;
  // depending on it would reload the times on every render. The doctor cannot change while the
  // dialog is open, so the first loader is the right one for its whole life.
  const [loadFreeSlots] = useState(() => loadSlots);
  const [slots, setSlots] = useState<PublicSlot[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<PublicSlot | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The first load. Nothing is set before the first await: loading already starts true.
  useEffect(() => {
    let cancelled = false;

    loadFreeSlots()
      .then((result) => {
        if (cancelled) return;
        setSlots(result);
        setSelectedDate(landingDate(result, null));
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(extractErrorMessage(err, 'Could not load available times.'));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [loadFreeSlots]);

  /** Reloads after a failed move, staying on `keepDate` if it still has free times, as booking does. */
  const reload = async (keepDate: string | null) => {
    setIsLoading(true);
    setSelectedSlot(null);
    try {
      const result = await loadFreeSlots();
      setSlots(result);
      setSelectedDate(landingDate(result, keepDate));
    } catch (err) {
      setError(extractErrorMessage(err, 'Could not load available times.'));
      setSlots([]);
      setSelectedDate(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!selectedSlot || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);
    try {
      await onConfirm(selectedSlot);
    } catch (err) {
      setError(extractErrorMessage(err, 'That time is no longer available. Please choose another.'));
      setIsSubmitting(false);
      await reload(selectedSlot.slotDate);
    }
  };

  return (
    <div className="modal-overlay" onClick={isSubmitting ? undefined : onClose}>
      <div
        className="modal-panel appt-dialog appt-dialog--wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="appt-reschedule-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <h2 id="appt-reschedule-title">Reschedule appointment</h2>
            <p className="page-subtitle">{subtitle}</p>
          </div>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="modal-form">
          {error && (
            <div className="alert alert-danger" role="alert">
              {error}
            </div>
          )}

          <div className="bk-when appt-reschedule-grid">
            <SlotTimeGrid
              slots={slots}
              selectedDate={selectedDate}
              selectedSlotId={selectedSlot?.slotId ?? null}
              isLoading={isLoading}
              onSelectDate={(date) => {
                setSelectedDate(date);
                setSelectedSlot(null);
              }}
              onPickSlot={setSelectedSlot}
              emptyHint="Cancel the appointment instead, or check again later — times open up when schedules change."
            />
          </div>

          <div className="modal-footer">
            <span className="appt-reschedule-choice" data-testid="reschedule-choice">
              {selectedSlot
                ? `Move to ${fullDateLabel(selectedSlot.slotDate)} at ${colomboTimeLabel(selectedSlot.startUtc)}`
                : 'Choose a new date and time'}
            </span>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isSubmitting}>
              Back
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!selectedSlot || isSubmitting}
              onClick={() => void handleConfirm()}
            >
              {isSubmitting ? 'Moving…' : 'Confirm new time'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RescheduleDialog;
