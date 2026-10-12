import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  AppointmentStatus,
  appointmentChangeApi,
  colomboTimeLabel,
  doctorApi,
  slotApi,
  type AppointmentHistoryEntry,
  type AppointmentRecord,
} from '../api/appointments';
import { invoiceApi } from '../api/billing';
import AppointmentHistoryList from '../components/appointments/AppointmentHistoryList';
import AppointmentTextDialog from '../components/appointments/AppointmentTextDialog';
import RescheduleDialog from '../components/appointments/RescheduleDialog';
import { useAuth } from '../contexts/AuthContext';
import { extractErrorMessage } from '../utils/apiError';
import { colomboDateTimeLabel, fullDateLabel } from '../utils/bookingLabels';
import { canChangeAppointments, canCompleteAppointment, canMarkNoShow } from '../utils/permissions';

type Dialog = 'reschedule' | 'cancel' | 'complete' | null;

/** The service's limits, mirrored so the fields refuse what the service would. */
const MAX_REASON_LENGTH = 500;
const MAX_NOTES_LENGTH = 8000;

/**
 * The clock, read once when the page mounts. A module-level function rather than `Date.now()`
 * inline, which the React lint rules cannot tell apart from a read during render.
 */
function clockNow(): number {
  return Date.now();
}

/** How a status reads on screen. The service's `NoShow` is one word; people write "No-show". */
function statusLabel(status: string): string {
  return status === AppointmentStatus.NoShow ? 'No-show' : status;
}

/**
 * One appointment, its history, and what can be done with it (SCRUM-36).
 *
 * - Front desk (Admin, Receptionist): reschedule and cancel.
 * - The appointment's own doctor: complete, with the clinical notes that become the patient's
 *   medical record entry.
 * - Front desk and the appointment's own doctor, once it has ended: mark a no-show (SCRUM-38),
 *   which the utilisation report counts.
 *
 * Actions only appear while the appointment is booked; the service refuses them otherwise, and
 * says so. Every rule — the cancellation window, who owns what — is enforced there; the page only
 * hides what would certainly be refused.
 */
const AppointmentDetailPage: React.FC = () => {
  const { appointmentId } = useParams<{ appointmentId: string }>();
  const { user } = useAuth();

  const [appointment, setAppointment] = useState<AppointmentRecord | null>(null);
  const [history, setHistory] = useState<AppointmentHistoryEntry[]>([]);
  const [doctorName, setDoctorName] = useState<string | null>(null);
  const [invoiceId, setInvoiceId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [isMarkingNoShow, setIsMarkingNoShow] = useState(false);
  const [openedAt] = useState(clockNow);

  // Nothing is set before the first await: loading already starts true. Nothing on screen links
  // one appointment's page to another's, so the id never changes under a mounted page and there
  // is no reset for that case.
  useEffect(() => {
    if (!appointmentId) return;
    let cancelled = false;

    const load = async () => {
      try {
        const [found, entries] = await Promise.all([
          appointmentChangeApi.get(appointmentId),
          appointmentChangeApi.history(appointmentId),
        ]);
        if (cancelled) return;
        setAppointment(found);
        setHistory(entries);

        // The appointment carries only the doctor's id. The name is a nicety: a doctor who has
        // left the clinic is no longer listed, and the page still works without it.
        try {
          const doctors = await doctorApi.list();
          if (!cancelled) setDoctorName(doctors.find((d) => d.doctorId === found.doctorId)?.fullName ?? null);
        } catch {
          // Leave the name unknown.
        }

        // Billing is eventually consistent with the appointment event. A missing invoice should
        // not make the appointment page fail; the link appears once Billing has created it.
        try {
          const invoice = await invoiceApi.getByAppointment(found.appointmentId);
          if (!cancelled) setInvoiceId(invoice.invoiceId);
        } catch {
          // Booking may still be waiting in the outbox/Kafka pipeline.
        }
      } catch (err) {
        if (!cancelled) setError(extractErrorMessage(err, 'Could not load this appointment.'));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [appointmentId]);

  /** After a change: show what the service returned, and the history it just grew. */
  const applyChange = async (updated: AppointmentRecord, message: string) => {
    setAppointment(updated);
    setDialog(null);
    setSuccess(message);
    try {
      setHistory(await appointmentChangeApi.history(updated.appointmentId));
    } catch {
      // The change stands; a stale history is not worth an error over.
    }
  };

  /**
   * A no-show is final, so it is confirmed first. The service's own refusal — not ended yet, no
   * longer booked — is shown as it words it.
   */
  const markNoShow = async (current: AppointmentRecord, description: string) => {
    if (!window.confirm(`Mark ${description} as a no-show? This cannot be undone.`)) return;

    setIsMarkingNoShow(true);
    setError(null);
    try {
      const updated = await appointmentChangeApi.markNoShow(current.appointmentId);
      await applyChange(updated, 'Recorded as a no-show.');
    } catch (err) {
      setError(extractErrorMessage(err, 'Could not mark this appointment as a no-show.'));
    } finally {
      setIsMarkingNoShow(false);
    }
  };

  if (isLoading) {
    return (
      <div className="management-page">
        <p className="appt-detail-loading">Loading appointment…</p>
      </div>
    );
  }

  if (!appointment) {
    return (
      <div className="management-page">
        <div className="alert alert-danger" role="alert">
          {error ?? 'Appointment not found.'}
        </div>
        <Link className="btn btn-secondary profile-back-link" to="/appointments/booked">
          ← Back to booked appointments
        </Link>
      </div>
    );
  }

  const isBooked = appointment.status === AppointmentStatus.Booked;
  const canChange = isBooked && canChangeAppointments(user?.role);
  const canComplete = isBooked && canCompleteAppointment(user, appointment.doctorId);
  // Only once it has ended, as the service requires: before then the patient may still arrive.
  const hasEnded = Date.parse(appointment.endUtc) <= openedAt;
  const canNoShow = isBooked && hasEnded && canMarkNoShow(user, appointment.doctorId);
  const patientLabel = appointment.patientName ?? 'Unnamed patient';
  const whenText = `${fullDateLabel(appointment.slotDate)}, ${colomboTimeLabel(appointment.startUtc)}`;
  const subtitle = `${patientLabel} · ${whenText}`;

  return (
    <div className="management-page appt-detail-page">
      <div className="page-header">
        <div>
          <Link className="profile-breadcrumb" to="/appointments/booked">
            Booked appointments
          </Link>
          <h1>Appointment</h1>
          <p className="page-subtitle">{subtitle}</p>
        </div>
        {(canChange || canComplete || canNoShow) && (
          <div className="profile-actions">
            {canChange && (
              <>
                <button type="button" className="btn btn-outline" onClick={() => setDialog('reschedule')}>
                  Reschedule
                </button>
                <button type="button" className="btn btn-danger-outline" onClick={() => setDialog('cancel')}>
                  Cancel appointment
                </button>
              </>
            )}
            {canNoShow && (
              <button
                type="button"
                className="btn btn-outline"
                disabled={isMarkingNoShow}
                onClick={() => void markNoShow(appointment, `${patientLabel}'s appointment on ${whenText}`)}
              >
                {isMarkingNoShow ? 'Marking…' : 'Mark no-show'}
              </button>
            )}
            {canComplete && (
              <button type="button" className="btn btn-primary" onClick={() => setDialog('complete')}>
                Complete visit
              </button>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="alert alert-danger" role="alert">
          <span>{error}</span>
          <button type="button" className="alert-close" onClick={() => setError(null)}>
            ×
          </button>
        </div>
      )}

      {success && (
        <div className="alert alert-success" role="status">
          <span>{success}</span>
          <button type="button" className="alert-close" onClick={() => setSuccess(null)}>
            ×
          </button>
        </div>
      )}

      <section className="detail-card" aria-label="Appointment details">
        <h2 className="detail-section-title">Details</h2>
        <div className="detail-row">
          <span className="detail-label">Status</span>
          <span className="detail-value">
            <span
              className={`booked-status booked-status--${appointment.status.toLowerCase()}`}
              data-testid="appointment-status"
            >
              {statusLabel(appointment.status)}
            </span>
          </span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Patient</span>
          <span className="detail-value">
            <Link to={`/patients/${appointment.patientId}`}>{patientLabel}</Link>
            {appointment.patientNumber && <span className="appt-detail-muted"> · {appointment.patientNumber}</span>}
          </span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Doctor</span>
          <span className="detail-value">{doctorName ?? 'Doctor no longer listed'}</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">When</span>
          <span className="detail-value" data-testid="appointment-when">
            {whenText}–{colomboTimeLabel(appointment.endUtc)} ({appointment.durationMinutes} min)
          </span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Service</span>
          <span className="detail-value">{appointment.serviceCode}</span>
        </div>
        <div className="detail-row">
          <span className="detail-label">Booked</span>
          <span className="detail-value">{colomboDateTimeLabel(appointment.createdAt)}</span>
        </div>
        {invoiceId && canChangeAppointments(user?.role) && (
          <div className="detail-row">
            <span className="detail-label">Invoice</span>
            <span className="detail-value">
              <Link to={`/billing/invoices/${invoiceId}`}>View invoice and payments</Link>
            </span>
          </div>
        )}
      </section>

      <section className="detail-card" aria-label="History">
        <h2 className="detail-section-title">History</h2>
        <AppointmentHistoryList entries={history} />
      </section>

      {dialog === 'reschedule' && (
        <RescheduleDialog
          subtitle={subtitle}
          loadSlots={() => slotApi.available(appointment.doctorId)}
          onConfirm={async (slot) => {
            const updated = await appointmentChangeApi.reschedule(appointment.appointmentId, slot.slotId);
            await applyChange(
              updated,
              `Moved to ${fullDateLabel(updated.slotDate)} at ${colomboTimeLabel(updated.startUtc)}.`,
            );
          }}
          onClose={() => setDialog(null)}
        />
      )}

      {dialog === 'cancel' && (
        <AppointmentTextDialog
          title="Cancel appointment"
          subtitle={subtitle}
          label="Reason for cancelling"
          placeholder="e.g. Patient is travelling"
          help="Recorded in the appointment's history."
          maxLength={MAX_REASON_LENGTH}
          confirmLabel="Cancel appointment"
          busyLabel="Cancelling…"
          dismissLabel="Keep appointment"
          danger
          onConfirm={async (reason) => {
            const updated = await appointmentChangeApi.cancel(appointment.appointmentId, reason);
            await applyChange(updated, 'The appointment was cancelled and its time released.');
          }}
          onClose={() => setDialog(null)}
        />
      )}

      {dialog === 'complete' && (
        <AppointmentTextDialog
          title="Complete visit"
          subtitle={subtitle}
          label="Clinical notes"
          placeholder="Findings, advice and follow-up"
          help="Added to the patient's medical record."
          maxLength={MAX_NOTES_LENGTH}
          rows={8}
          confirmLabel="Complete visit"
          busyLabel="Completing…"
          dismissLabel="Not yet"
          onConfirm={async (notes) => {
            const updated = await appointmentChangeApi.complete(appointment.appointmentId, notes);
            await applyChange(updated, "The visit was completed and the notes sent to the patient's record.");
          }}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
};

export default AppointmentDetailPage;
