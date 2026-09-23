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
import type { AppointmentResponse, PublicDoctor, PublicSlot } from '../../api/booking';
import { clearBookingToken } from '../../api/bookingToken';
import { extractErrorMessage } from '../../utils/apiError';
import {
  EMPTY_PATIENT_FORM,
  mapValidationErrors,
  normalizePatientForm,
  validatePatientForm,
} from '../../utils/patientForm';
import type { PatientFieldErrors, PatientForm } from '../../utils/patientForm';
import BillingNotice from './BillingNotice';
import ConfirmStep from './ConfirmStep';
import IdentifyStep from './IdentifyStep';
import RegisterStep from './RegisterStep';
import SlotPicker from './SlotPicker';

/** What the service records when nothing else is chosen. Mirrors ServiceCodes.GeneralConsultation. */
const DEFAULT_SERVICE_CODE = 'GEN-CONSULT';

type BookingStep =
  | { kind: 'identify' }
  | { kind: 'register' }
  | { kind: 'choose' }
  | { kind: 'confirm'; slot: PublicSlot; doctor: PublicDoctor }
  | { kind: 'booked'; appointment: AppointmentResponse; doctor: PublicDoctor };

interface BookingIdentity {
  patientId: string;
  patientNumber: string;
  fullName: string;
  /** True when this number was issued moments ago, so the page can tell them to keep it. */
  isNewlyRegistered: boolean;
}

/**
 * The public booking flow: identify or register, choose a doctor and a time, confirm.
 *
 * The identity, the demographics form and the booking error live **outside** the step, on purpose.
 * Registering a patient and booking a slot are two calls to two services that cannot share a
 * transaction, so a slot can be taken between them. When that happens the patient record already
 * exists, and the recovery is the whole point: the patient number stays on screen, the form is not
 * shown again, and only slot selection is retried. Nobody re-registers and nobody retypes anything.
 */
const BookingFlow: React.FC = () => {
  const [step, setStep] = useState<BookingStep>({ kind: 'identify' });

  // Survives every transition below, including a failed booking.
  const [identity, setIdentity] = useState<BookingIdentity | null>(null);
  const [form, setForm] = useState<PatientForm>(EMPTY_PATIENT_FORM);
  const [fieldErrors, setFieldErrors] = useState<PatientFieldErrors>({});
  const [stepError, setStepError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Doctor and slot selection.
  const [specializations, setSpecializations] = useState<string[]>([]);
  const [specialization, setSpecialization] = useState('');
  const [doctors, setDoctors] = useState<PublicDoctor[]>([]);
  const [doctorId, setDoctorId] = useState('');
  const [slots, setSlots] = useState<PublicSlot[]>([]);
  const [isLoadingDoctors, setIsLoadingDoctors] = useState(false);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);

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

  const loadDoctors = useCallback(async (wanted: string) => {
    setIsLoadingDoctors(true);
    try {
      const result = await publicBookingApi.doctors(wanted || undefined);
      setDoctors(result);
      setDoctorId(result.length === 1 ? result[0].doctorId : '');
      setSlots([]);
      return result;
    } catch (err) {
      setStepError(extractErrorMessage(err, 'Could not load doctors. Please try again.'));
      setDoctors([]);
      return [];
    } finally {
      setIsLoadingDoctors(false);
    }
  }, []);

  const loadSlots = useCallback(async (wantedDoctorId: string) => {
    if (!wantedDoctorId) {
      setSlots([]);
      return;
    }

    setIsLoadingSlots(true);
    try {
      setSlots(await publicBookingApi.slots(wantedDoctorId));
    } catch (err) {
      setStepError(extractErrorMessage(err, 'Could not load available times.'));
      setSlots([]);
    } finally {
      setIsLoadingSlots(false);
    }
  }, []);

  /** Everything that has to happen once we know who the patient is. */
  const goToChoosing = useCallback(async () => {
    setStep({ kind: 'choose' });
    const found = await loadDoctors(specialization);
    if (found.length === 1) await loadSlots(found[0].doctorId);
  }, [loadDoctors, loadSlots, specialization]);

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

  const handlePickSlot = (slot: PublicSlot) => {
    const doctor = doctors.find((candidate) => candidate.doctorId === doctorId);
    if (!doctor) return;

    setStepError(null);
    setStep({ kind: 'confirm', slot, doctor });
  };

  // ── Booking, and recovering from a lost slot ────────────────────────────────

  /** Back to slot selection with a message, keeping the identity and the token. */
  const returnToChoosing = async (message: string) => {
    setStepError(message);
    setStep({ kind: 'choose' });
    await loadSlots(doctorId);
  };

  const handleConfirm = async () => {
    if (step.kind !== 'confirm') return;

    setIsSubmitting(true);
    setStepError(null);
    try {
      const appointment = await appointmentApi.book(step.slot.slotId, DEFAULT_SERVICE_CODE);
      setStep({ kind: 'booked', appointment, doctor: step.doctor });
    } catch (err) {
      if (isBookingSessionExpiredError(err)) {
        // The token cannot be refreshed — an anonymous visitor has no refresh token. Ask them to
        // identify again, keeping anything they typed.
        clearBookingToken();
        setIdentity(null);
        setStep({ kind: 'identify' });
        setStepError('Your booking session expired. Please identify yourself again.');
      } else {
        // 409 (slot gone, or a clash with their own diary) and 400 (the list was stale) both mean
        // "pick again". The service worded the reason; show it rather than guessing.
        await returnToChoosing(
          extractErrorMessage(err, 'That time is no longer available. Please choose another.'),
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const bookAnother = async () => {
    setStepError(null);
    setStep({ kind: 'choose' });
    await loadSlots(doctorId);
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="booking-flow">
      {identity && (
        <section
          className="registration-result registration-success"
          role="status"
          data-testid="patient-number"
        >
          <span className="registration-result-label">
            {identity.isNewlyRegistered ? 'You are registered' : 'Booking as'}
          </span>
          <strong className="patient-number">{identity.patientNumber}</strong>
          <span>{identity.fullName}</span>
          {identity.isNewlyRegistered && (
            <span className="field-help">
              Keep this number — use it with your date of birth next time you book.
            </span>
          )}
        </section>
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
          isLoadingDoctors={isLoadingDoctors}
          isLoadingSlots={isLoadingSlots}
          error={stepError}
          onSpecializationChange={handleSpecializationChange}
          onDoctorChange={handleDoctorChange}
          onPickSlot={handlePickSlot}
        />
      )}

      {step.kind === 'confirm' && (
        <ConfirmStep
          doctor={step.doctor}
          slot={step.slot}
          serviceCode={DEFAULT_SERVICE_CODE}
          isSubmitting={isSubmitting}
          error={stepError}
          onConfirm={handleConfirm}
          onBack={() => {
            setStepError(null);
            setStep({ kind: 'choose' });
          }}
        />
      )}

      {step.kind === 'booked' && (
        <section className="card booking-step" role="status" data-testid="booking-confirmation">
          <h2>Your appointment is confirmed</h2>
          <dl className="booking-summary">
            <div className="detail-row">
              <dt className="detail-label">Doctor</dt>
              <dd className="detail-value">{step.doctor.fullName}</dd>
            </div>
            <div className="detail-row">
              <dt className="detail-label">When</dt>
              <dd className="detail-value">
                {step.appointment.slotDate} at {colomboTimeLabel(step.appointment.startUtc)}
              </dd>
            </div>
          </dl>
          <p className="field-help">Please arrive ten minutes early and bring your patient number.</p>
          <BillingNotice serviceCode={step.appointment.serviceCode} />
          <div className="booking-step-actions">
            <button type="button" className="btn btn-outline" onClick={bookAnother}>
              Book another appointment
            </button>
          </div>
        </section>
      )}
    </div>
  );
};

export default BookingFlow;
