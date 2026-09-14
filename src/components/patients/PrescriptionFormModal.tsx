import axios from 'axios';
import React, { useState, type FormEvent } from 'react';
import {
  prescriptionApi,
  type CreatePrescriptionBody,
  type PrescriptionResponse,
  type UpdatePrescriptionBody,
} from '../../api/prescriptions';
import { allergyApi, type AllergyResponse } from '../../api/allergies';

interface PrescriptionFormModalProps {
  patientId: string;
  prescription?: PrescriptionResponse; // present when editing
  onClose: () => void;
  onSuccess: (prescription: PrescriptionResponse) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function blankForm() {
  return { drug: '', dosage: '', frequency: '', durationDays: '', notes: '' };
}

function fromExisting(rx: PrescriptionResponse) {
  return {
    drug: rx.drug,
    dosage: rx.dosage,
    frequency: rx.frequency,
    durationDays: String(rx.durationDays),
    notes: rx.notes ?? '',
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

export const PrescriptionFormModal: React.FC<PrescriptionFormModalProps> = ({
  patientId,
  prescription,
  onClose,
  onSuccess,
}) => {
  const isEditing = Boolean(prescription);
  const [form, setForm] = useState(prescription ? fromExisting(prescription) : blankForm);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Allergy conflict warning state
  const [conflictAllergy, setConflictAllergy] = useState<AllergyResponse | null>(null);
  const [pendingBody, setPendingBody] = useState<CreatePrescriptionBody | null>(null);

  const set = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError(null);
    // Clear conflict warning when drug field changes
    if (field === 'drug') {
      setConflictAllergy(null);
      setPendingBody(null);
    }
  };

  // ── Validation ──────────────────────────────────────────────────────────────

  const validate = (): string | null => {
    if (!form.drug.trim()) return 'Drug / medication name is required.';
    if (form.drug.trim().length > 200) return 'Drug name must be 200 characters or fewer.';
    if (!form.dosage.trim()) return 'Dosage is required (e.g. 500 mg).';
    if (form.dosage.trim().length > 100) return 'Dosage must be 100 characters or fewer.';
    if (!form.frequency.trim()) return 'Frequency is required (e.g. Twice daily).';
    if (form.frequency.trim().length > 100) return 'Frequency must be 100 characters or fewer.';

    const days = Number(form.durationDays);
    if (!Number.isInteger(days) || days < 1 || days > 3650) {
      return 'Duration must be a whole number between 1 and 3,650 days.';
    }
    if (form.notes.length > 2000) return 'Notes must be 2,000 characters or fewer.';
    return null;
  };

  // ── Submit helpers ──────────────────────────────────────────────────────────

  /** Final API call — used both on first attempt and after override confirmation. */
  const doCreate = async (body: CreatePrescriptionBody): Promise<void> => {
    setIsSubmitting(true);
    setError(null);
    try {
      const saved = await prescriptionApi.create(patientId, body);
      onSuccess(saved);
    } catch (requestError: unknown) {
      if (axios.isAxiosError(requestError)) {
        if (requestError.response?.status === 409) {
          // Server-side conflict guard triggered (shouldn't normally reach here
          // because we run the client-side preflight, but handle it gracefully)
          setError(
            'An allergy conflict was detected by the server. Please review the patient allergies before prescribing.',
          );
        } else {
          mapAxiosError(requestError.response?.status);
        }
      } else {
        setError('Failed to save the prescription. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const mapAxiosError = (status?: number) => {
    switch (status) {
      case 400:
        setError('Some prescription details are invalid. Check the form and try again.');
        break;
      case 403:
        setError('You do not have permission to write prescriptions.');
        break;
      case 404:
        setError('The patient or prescription no longer exists.');
        break;
      default:
        setError('Failed to save the prescription. Please try again.');
    }
  };

  // ── Main submit ─────────────────────────────────────────────────────────────

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    const durationDays = Number(form.durationDays);
    const notes = form.notes.trim() || null;

    if (prescription) {
      // EDIT — no conflict check on update
      setIsSubmitting(true);
      setError(null);
      try {
        const body: UpdatePrescriptionBody = {
          drug: form.drug.trim(),
          dosage: form.dosage.trim(),
          frequency: form.frequency.trim(),
          durationDays,
          notes,
        };
        const saved = await prescriptionApi.update(patientId, prescription.prescriptionId, body);
        onSuccess(saved);
      } catch (requestError: unknown) {
        if (axios.isAxiosError(requestError)) {
          mapAxiosError(requestError.response?.status);
        } else {
          setError('Failed to save the prescription. Please try again.');
        }
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // CREATE — run client-side conflict pre-flight
    setIsSubmitting(true);
    setError(null);

    const body: CreatePrescriptionBody = {
      drug: form.drug.trim(),
      dosage: form.dosage.trim(),
      frequency: form.frequency.trim(),
      durationDays,
      notes,
    };

    try {
      const conflictCheck = await allergyApi.checkConflict(patientId, body.drug);

      if (conflictCheck.hasConflict && conflictCheck.matchedAllergy) {
        // Show inline conflict warning — don't submit yet
        setConflictAllergy(conflictCheck.matchedAllergy);
        setPendingBody(body);
        setIsSubmitting(false);
        return;
      }
    } catch {
      // If the conflict check itself fails, proceed without blocking — server will
      // act as the final safety net
    }

    await doCreate(body);
  };

  /** Doctor clicked "Prescribe anyway" — resend with overrideConflict: true */
  const handleOverride = async () => {
    if (!pendingBody) return;
    setConflictAllergy(null);
    await doCreate({ ...pendingBody, overrideConflict: true });
  };

  const handleCancelOverride = () => {
    setConflictAllergy(null);
    setPendingBody(null);
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel prescription-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2 id="prescription-modal-title">
              {isEditing ? 'Edit prescription' : 'New prescription'}
            </h2>
            <p className="page-subtitle">Patient {patientId}</p>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close modal">
            ×
          </button>
        </div>

        <form
          className="modal-form"
          onSubmit={handleSubmit}
          noValidate
          aria-labelledby="prescription-modal-title"
        >
          {/* Generic error */}
          {error && (
            <div className="alert alert-danger" role="alert">
              {error}
            </div>
          )}

          {/* ── Allergy conflict warning ────────────────────────────────────── */}
          {conflictAllergy && (
            <div className="allergy-conflict-warning" role="alert" aria-live="assertive">
              <div className="conflict-warning-header">
                <span className="conflict-warning-icon" aria-hidden="true">⚠</span>
                <strong>Allergy conflict detected</strong>
              </div>
              <p className="conflict-warning-body">
                This patient has a recorded{' '}
                <strong>{conflictAllergy.severity.toLowerCase()}</strong> allergy to{' '}
                <strong>{conflictAllergy.allergen}</strong>.
                {conflictAllergy.reaction && (
                  <> Observed reaction: <em>{conflictAllergy.reaction}</em>.</>
                )}
              </p>
              <div className="conflict-warning-actions">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleCancelOverride}
                >
                  Cancel — do not prescribe
                </button>
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={handleOverride}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Saving…' : 'Prescribe anyway'}
                </button>
              </div>
            </div>
          )}

          {/* Drug */}
          <div className="form-group">
            <label htmlFor="rx-drug">Drug / Medication *</label>
            <input
              id="rx-drug"
              value={form.drug}
              onChange={(e) => set('drug', e.target.value)}
              maxLength={200}
              placeholder="e.g. Amoxicillin"
              disabled={isSubmitting}
              required
            />
          </div>

          {/* Dosage + Frequency (side by side) */}
          <div className="prescription-form-row">
            <div className="form-group">
              <label htmlFor="rx-dosage">Dosage *</label>
              <input
                id="rx-dosage"
                value={form.dosage}
                onChange={(e) => set('dosage', e.target.value)}
                maxLength={100}
                placeholder="e.g. 500 mg"
                disabled={isSubmitting}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="rx-frequency">Frequency *</label>
              <input
                id="rx-frequency"
                value={form.frequency}
                onChange={(e) => set('frequency', e.target.value)}
                maxLength={100}
                placeholder="e.g. Twice daily"
                disabled={isSubmitting}
                required
              />
            </div>
          </div>

          {/* Duration */}
          <div className="form-group prescription-duration-group">
            <label htmlFor="rx-duration">Duration (days) *</label>
            <input
              id="rx-duration"
              type="number"
              min={1}
              max={3650}
              step={1}
              value={form.durationDays}
              onChange={(e) => set('durationDays', e.target.value)}
              disabled={isSubmitting}
              required
            />
            <span className="field-help">Maximum 3,650 days (≈ 10 years).</span>
          </div>

          {/* Notes */}
          <div className="form-group">
            <label htmlFor="rx-notes">Notes</label>
            <textarea
              id="rx-notes"
              rows={3}
              maxLength={2000}
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              disabled={isSubmitting}
              placeholder="Optional prescriber instructions or context…"
            />
            <span className="field-help">{form.notes.length.toLocaleString()} / 2,000</span>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting || Boolean(conflictAllergy)}
            >
              {isSubmitting ? 'Checking…' : isEditing ? 'Save changes' : 'Add prescription'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PrescriptionFormModal;
