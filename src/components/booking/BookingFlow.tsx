import React, { useCallback, useEffect, useState } from 'react';
import { colomboTimeLabel } from '../../api/appointments';
import {
  appointmentApi,
  bookingIdentityApi,
  isAlreadyRegisteredError,
  isBookingSessionExpiredError,
  isIdentityNotFoundError,
  publicBookingApi,
} from '../../api/booking';
import type {
  AppointmentResponse,
  PatientAppointment,
  PublicDoctor,
  PublicSlot,
} from '../../api/booking';
import { clearBookingToken } from '../../api/bookingToken';
import { extractErrorMessage } from '../../utils/apiError';
import { fullDateLabel } from '../../utils/bookingLabels';
import {
  EMPTY_PATIENT_FORM,
  mapValidationErrors,
  normalizePatientForm,
  validatePatientForm,
} from '../../utils/patientForm';
import type { PatientFieldErrors, PatientForm } from '../../utils/patientForm';
import AppointmentTextDialog from '../appointments/AppointmentTextDialog';
import RescheduleDialog from '../appointments/RescheduleDialog';
import { CheckIcon } from '../icons/LineIcons';
import BillingNotice from './BillingNotice';
import BookingForCard from './BookingForCard';
import BookingStepper from './BookingStepper';
import BookingSummary from './BookingSummary';
import IdentifyStep from './IdentifyStep';
import RegisterStep from './RegisterStep';
import SlotPicker from './SlotPicker';
import UpcomingAppointments from './UpcomingAppointments';

/** What the service records when nothing else is chosen. Mirrors ServiceCodes.GeneralConsultation. */
const DEFAULT_SERVICE_CODE = 'GEN-CONSULT';

/** The service's limit on a cancellation reason. */
const MAX_REASON_LENGTH = 500;

/** Which of the patient's own appointments is being changed, and how (SCRUM-36). */
type UpcomingChange = { kind: 'reschedule' | 'cancel'; appointment: PatientAppointment };

/** "Nimal Perera · Mon, 5 Oct 2026, 09:00" — which appointment a dialog is about. */
function describeUpcoming(appointment: PatientAppointment): string {
  const when = `${fullDateLabel(appointment.slotDate)}, ${colomboTimeLabel(appointment.startUtc)}`;
  return appointment.doctorName ? `${appointment.doctorName} · ${when}` : when;
}

type BookingStep =
  | { kind: 'identify' }
  | { kind: 'register' }
  | { kind: 'choose' }
  | { kind: 'booked'; appointment: AppointmentResponse; doctor: PublicDoctor };

interface BookingIdentity {
  patientId: string;
  patientNumber: string;
  fullName: string;
  /** True when this number was issued moments ago, so the page can tell them to keep it. */
  isNewlyRegistered: boolean;
}

/**
 * The public booking flow: identify or register, choose a doctor, a date and a time, confirm.
 *
 * The identity, the demographics form and the booking error live **outside** the step, on purpose.
 * Registering a patient and booking a slot are two calls to two services that cannot share a
 * transaction, so a slot can be taken between them. When that happens the patient record already
 * exists, and the recovery is the whole point: the patient number stays on screen, the form is not
 * shown again, and only slot selection is retried. Nobody re-registers and nobody retypes anything.
 *
 * There is no separate confirm step. The chosen time is state beside the step, reviewed in the
 * summary panel next to the choices, and booked from there.
 */
const BookingFlow: React.FC = () => {
  const [step, setStep] = useState<BookingStep>({ kind: 'identify' });

  // Survives every transition below, including a failed booking.
  const [identity, setIdentity] = useState<BookingIdentity | null>(null);
  const [form, setForm] = useState<PatientForm>(EMPTY_PATIENT_FORM);
  const [fieldErrors, setFieldErrors] = useState<PatientFieldErrors>({});
  const [stepError, setStepError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Doctor, date and time selection.
  const [specializations, setSpecializations] = useState<string[]>([]);
  const [specialization, setSpecialization] = useState('');
  const [doctors, setDoctors] = useState<PublicDoctor[]>([]);
  const [doctorId, setDoctorId] = useState('');
  const [slots, setSlots] = useState<PublicSlot[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<PublicSlot | null>(null);
  const [isLoadingDoctors, setIsLoadingDoctors] = useState(false);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);

  // The identified patient's own upcoming bookings. Null until loaded, and left null when loading
  // fails — seeing past bookings is a convenience and must never stand between a patient and a
  // new one, so a failure here shows nothing rather than an error.
  const [upcoming, setUpcoming] = useState<PatientAppointment[] | null>(null);
  const [upcomingChange, setUpcomingChange] = useState<UpcomingChange | null>(null);
  const [upcomingNotice, setUpcomingNotice] = useState<string | null>(null);

  const selectedDoctor = doctors.find((candidate) => candidate.doctorId === doctorId) ?? null;

  // ── Data loading ────────────────────────────────────────────────────────────

  // The one mount effect: the specialization list never depends on who is booking.
  useEffect(() => {
    let cancelled = false;

    publicBookingApi
      .specializations()
      .then((result) => {
        if (!cancelled) setSpecializations(result);
      })
      .catch(() => {
        // A missing filter list is not worth an error banner — the doctor list still loads.
        if (!cancelled) setSpecializations([]);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  /**
   * Loads a doctor's free times and lands on a date that has some — the one already chosen if it
   * still does, otherwise the first. Any chosen time is dropped: after a reload it may be gone.
   */
  const loadSlots = useCallback(async (wantedDoctorId: string, keepDate: string | null = null) => {
    setSelectedSlot(null);
    if (!wantedDoctorId) {
      setSlots([]);
      setSelectedDate(null);
      return;
    }

    setIsLoadingSlots(true);
    try {
      const result = await publicBookingApi.slots(wantedDoctorId);
      setSlots(result);
      const stillFree = keepDate !== null && result.some((slot) => slot.slotDate === keepDate);
      setSelectedDate(stillFree ? keepDate : (result[0]?.slotDate ?? null));
    } catch (err) {
      setStepError(extractErrorMessage(err, 'Could not load available times.'));
      setSlots([]);
      setSelectedDate(null);
    } finally {
      setIsLoadingSlots(false);
    }
  }, []);

  const loadDoctors = useCallback(async (wanted: string) => {
    setIsLoadingDoctors(true);
    try {
      const result = await publicBookingApi.doctors(wanted || undefined);
      setDoctors(result);
      setDoctorId(result.length === 1 ? result[0].doctorId : '');
      setSlots([]);
      setSelectedDate(null);
      setSelectedSlot(null);
      return result;
    } catch (err) {
      setStepError(extractErrorMessage(err, 'Could not load doctors. Please try again.'));
      setDoctors([]);
      return [];
    } finally {
      setIsLoadingDoctors(false);
    }
  }, []);

  const loadUpcoming = useCallback(async () => {
    try {
      setUpcoming(await appointmentApi.mine());
    } catch {
      setUpcoming(null);
    }
  }, []);

  /** Everything that has to happen once we know who the patient is. */
  const goToChoosing = useCallback(async () => {
    setStep({ kind: 'choose' });
    const [found] = await Promise.all([loadDoctors(specialization), loadUpcoming()]);
    if (found.length === 1) await loadSlots(found[0].doctorId);
  }, [loadDoctors, loadSlots, loadUpcoming, specialization]);

  // ── Identify / register ─────────────────────────────────────────────────────

  const handleIdentify = async (patientNumber: string, dateOfBirth: string) => {
    setIsSubmitting(true);
    setStepError(null);
    try {
      const found = await bookingIdentityApi.identify(patientNumber, dateOfBirth);
      setIdentity({
        patientId: found.patientId,
        patientNumber: found.patientNumber,
        fullName: found.fullName,
        isNewlyRegistered: false,
      });
      await goToChoosing();
    } catch (err) {
      // One message for a wrong number and a wrong date alike — the service does not distinguish
      // them, and neither should this, since patient numbers are sequential.
      setStepError(
        isIdentityNotFoundError(err)
          ? 'We could not find a patient with that number and date of birth. Check both, or register as a new patient.'
          : extractErrorMessage(err, 'Something went wrong. Please try again.'),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFieldChange = (field: keyof PatientForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
    setStepError(null);
  };

  const handleRegister = async () => {
    const today = new Date().toISOString().slice(0, 10);
    const errors = validatePatientForm(form, today);

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setStepError('Please correct the highlighted fields.');
      return;
    }

    setIsSubmitting(true);
    setStepError(null);
    try {
      const registered = await bookingIdentityApi.publicRegister(normalizePatientForm(form));
      setIdentity({
        patientId: registered.patientId,
        patientNumber: registered.patientNumber,
        fullName: registered.fullName,
        isNewlyRegistered: true,
      });
      await goToChoosing();
    } catch (err) {
      if (isAlreadyRegisteredError(err)) {
        // The service will not say who holds the NIC, so neither can this screen.
        setStepError(
          'A patient with this NIC is already registered. Use your patient number and date of birth instead.',
        );
      } else {
        const problem = (err as { response?: { data?: { errors?: Record<string, string[]> } } })
          .response?.data?.errors;
        if (problem) setFieldErrors(mapValidationErrors(problem));
        setStepError(extractErrorMessage(err, 'Could not register you. Please check your details.'));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  /** Starts over as someone else. The token goes with the identity — it named that patient. */
  const changePatient = () => {
    clearBookingToken();
    setIdentity(null);
    setUpcoming(null);
    setUpcomingNotice(null);
    setSelectedSlot(null);
    setStepError(null);
    setStep({ kind: 'identify' });
  };

  /**
   * The booking token has expired. It cannot be refreshed — an anonymous visitor has no refresh
   * token — so ask them to identify again, keeping anything they typed.
   */
  const expireSession = () => {
    clearBookingToken();
    setIdentity(null);
    setUpcoming(null);
    setUpcomingChange(null);
    setUpcomingNotice(null);
    setSelectedSlot(null);
    setStep({ kind: 'identify' });
    setStepError('Your booking session expired. Please identify yourself again.');
  };

  // ── Choosing ────────────────────────────────────────────────────────────────

  const handleSpecializationChange = async (value: string) => {
    setSpecialization(value);
    setStepError(null);
    const found = await loadDoctors(value);
    if (found.length === 1) await loadSlots(found[0].doctorId);
  };

  const handleDoctorChange = async (value: string) => {
    setDoctorId(value);
    setStepError(null);
    await loadSlots(value);
  };

  const handleSelectDate = (date: string) => {
    setSelectedDate(date);
    setSelectedSlot(null);
  };

  const handlePickSlot = (slot: PublicSlot) => {
    setStepError(null);
    setSelectedSlot(slot);
  };

  // ── Booking, and recovering from a lost slot ────────────────────────────────

  const handleConfirm = async () => {
    if (!selectedSlot || !selectedDoctor) return;

    setIsSubmitting(true);
    setStepError(null);
    try {
      const appointment = await appointmentApi.book(selectedSlot.slotId, DEFAULT_SERVICE_CODE);
      setStep({ kind: 'booked', appointment, doctor: selectedDoctor });
      setSelectedSlot(null);
      await loadUpcoming();
    } catch (err) {
      if (isBookingSessionExpiredError(err)) {
        expireSession();
      } else {
        // 409 (slot gone, or a clash with their own diary) and 400 (the list was stale) both mean
        // "pick again". The service worded the reason; show it rather than guessing. The times are
        // refetched, staying on the same day if it still has any.
        setStepError(
          extractErrorMessage(err, 'That time is no longer available. Please choose another.'),
        );
        await loadSlots(doctorId, selectedSlot.slotDate);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Changing one of your own appointments (SCRUM-36) ────────────────────────

  /**
   * Runs one change to an upcoming appointment. A rejection other than an expired session goes
   * back to the dialog, which shows the service's wording — the cancellation policy, or "someone
   * booked this slot a moment ago" — and stays open.
   */
  const changeUpcoming = async (
    appointment: PatientAppointment,
    change: () => Promise<void>,
    notice: string,
  ) => {
    try {
      await change();
    } catch (err) {
      if (isBookingSessionExpiredError(err)) {
        expireSession();
        return;
      }
      throw err;
    }

    setUpcomingChange(null);
    setUpcomingNotice(notice);
    await loadUpcoming();
    // The change freed one of this doctor's times, and a reschedule took another. If that doctor's
    // grid is open beside the list, show it as it now is.
    if (doctorId && doctorId === appointment.doctorId) await loadSlots(doctorId, selectedDate);
  };

  const bookAnother = async () => {
    setStepError(null);
    setStep({ kind: 'choose' });
    await loadSlots(doctorId, selectedDate);
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  const currentStep =
    step.kind === 'booked' ? 4 : selectedSlot ? 3 : step.kind === 'choose' && doctorId ? 2 : 1;

  return (
    <div className="bk-flow">
      <BookingStepper current={currentStep} />

      <div className="bk-layout">
        <div className="bk-main">
          {identity && (
            <BookingForCard
              patientNumber={identity.patientNumber}
              fullName={identity.fullName}
              isNewlyRegistered={identity.isNewlyRegistered}
              onChangePatient={changePatient}
              disabled={isSubmitting}
            />
          )}

          {step.kind === 'identify' && (
            <IdentifyStep
              onIdentify={handleIdentify}
              onNewPatient={() => {
                setStepError(null);
                setStep({ kind: 'register' });
              }}
              error={stepError}
              isSubmitting={isSubmitting}
            />
          )}

          {step.kind === 'register' && (
            <RegisterStep
              form={form}
              fieldErrors={fieldErrors}
              error={stepError}
              isSubmitting={isSubmitting}
              onChange={handleFieldChange}
              onSubmit={handleRegister}
              onBackToIdentify={() => {
                setStepError(null);
                setStep({ kind: 'identify' });
              }}
            />
          )}

          {step.kind === 'choose' && (
            <SlotPicker
              specializations={specializations}
              specialization={specialization}
              doctors={doctors}
              doctorId={doctorId}
              slots={slots}
              selectedDate={selectedDate}
              selectedSlotId={selectedSlot?.slotId ?? null}
              isLoadingDoctors={isLoadingDoctors}
              isLoadingSlots={isLoadingSlots}
              error={stepError}
              onSpecializationChange={handleSpecializationChange}
              onDoctorChange={handleDoctorChange}
              onSelectDate={handleSelectDate}
              onPickSlot={handlePickSlot}
            />
          )}

          {step.kind === 'booked' && (
            <section className="bk-card bk-done" role="status" data-testid="booking-confirmation">
              <span className="bk-done-icon">
                <CheckIcon />
              </span>
              <h2>Your appointment is confirmed</h2>
              <p className="bk-done-detail">
                <strong>{step.doctor.fullName}</strong> ·{' '}
                {fullDateLabel(step.appointment.slotDate)} at{' '}
                {colomboTimeLabel(step.appointment.startUtc)}
              </p>
              <p className="field-help">Please arrive ten minutes early and bring your patient number.</p>
              <BillingNotice serviceCode={step.appointment.serviceCode} />
              <button type="button" className="btn btn-outline" onClick={bookAnother}>
                Book another appointment
              </button>
            </section>
          )}
        </div>

        <aside className="bk-side">
          {step.kind !== 'booked' && (
            <BookingSummary
              patient={identity}
              specialization={specialization}
              doctor={step.kind === 'choose' ? selectedDoctor : null}
              slot={selectedSlot}
              serviceCode={DEFAULT_SERVICE_CODE}
              isSubmitting={isSubmitting}
              onConfirm={() => void handleConfirm()}
            />
          )}
          {identity && upcoming && (step.kind === 'choose' || step.kind === 'booked') && (
            <UpcomingAppointments
              appointments={upcoming}
              notice={upcomingNotice}
              onReschedule={(appointment) => {
                setUpcomingNotice(null);
                setUpcomingChange({ kind: 'reschedule', appointment });
              }}
              onCancel={(appointment) => {
                setUpcomingNotice(null);
                setUpcomingChange({ kind: 'cancel', appointment });
              }}
            />
          )}
        </aside>
      </div>

      {upcomingChange?.kind === 'reschedule' && (
        <RescheduleDialog
          subtitle={describeUpcoming(upcomingChange.appointment)}
          loadSlots={() => publicBookingApi.slots(upcomingChange.appointment.doctorId)}
          onConfirm={(newSlot) =>
            changeUpcoming(
              upcomingChange.appointment,
              () => appointmentApi.reschedule(upcomingChange.appointment.appointmentId, newSlot.slotId),
              `Your appointment was moved to ${fullDateLabel(newSlot.slotDate)} at ${colomboTimeLabel(newSlot.startUtc)}.`,
            )
          }
          onClose={() => setUpcomingChange(null)}
        />
      )}

      {upcomingChange?.kind === 'cancel' && (
        <AppointmentTextDialog
          title="Cancel appointment"
          subtitle={describeUpcoming(upcomingChange.appointment)}
          label="Reason for cancelling"
          placeholder="e.g. I am travelling"
          help="Shared with the clinic."
          maxLength={MAX_REASON_LENGTH}
          confirmLabel="Cancel appointment"
          busyLabel="Cancelling…"
          dismissLabel="Keep appointment"
          danger
          onConfirm={(reason) =>
            changeUpcoming(
              upcomingChange.appointment,
              () => appointmentApi.cancel(upcomingChange.appointment.appointmentId, reason),
              'Your appointment was cancelled.',
            )
          }
          onClose={() => setUpcomingChange(null)}
        />
      )}
    </div>
  );
};

export default BookingFlow;
