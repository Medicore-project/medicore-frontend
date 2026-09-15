import axios from 'axios';
import React, { useState, type FormEvent } from 'react';
import {
  allergyApi,
  type AllergyResponse,
  type AllergySeverity,
  type CreateAllergyBody,
  type UpdateAllergyBody,
} from '../../api/allergies';

const SEVERITY_OPTIONS: AllergySeverity[] = ['Mild', 'Moderate', 'Severe', 'Unknown'];

interface AllergyFormModalProps {
  patientId: string;
  allergy?: AllergyResponse; // present when editing
  onClose: () => void;
  onSuccess: (allergy: AllergyResponse) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function blankForm() {
  return { allergen: '', severity: 'Unknown' as AllergySeverity, reaction: '', notes: '' };
}

function fromExisting(a: AllergyResponse) {
  return {
    allergen: a.allergen,
    severity: a.severity,
    reaction: a.reaction ?? '',
    notes: a.notes ?? '',
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

export const AllergyFormModal: React.FC<AllergyFormModalProps> = ({
  patientId,
  allergy,
  onClose,
  onSuccess,
}) => {
  const isEditing = Boolean(allergy);
  const [form, setForm] = useState(allergy ? fromExisting(allergy) : blankForm);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const set = <K extends keyof typeof form>(field: K, value: (typeof form)[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError(null);
  };

  // ── Validation ──────────────────────────────────────────────────────────────

  const validate = (): string | null => {
    if (!form.allergen.trim()) return 'Allergen name is required.';
    if (form.allergen.trim().length > 200) return 'Allergen must be 200 characters or fewer.';
    if (!form.severity) return 'Severity is required.';
    if (form.reaction.length > 500) return 'Reaction must be 500 characters or fewer.';
    if (form.notes.length > 2000) return 'Notes must be 2,000 characters or fewer.';
    return null;
  };

  // ── Submit ──────────────────────────────────────────────────────────────────

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const reaction = form.reaction.trim() || null;
    const notes = form.notes.trim() || null;

    try {
      let saved: AllergyResponse;

      if (allergy) {
        const body: UpdateAllergyBody = {
          allergen: form.allergen.trim(),
          severity: form.severity,
          reaction,
          notes,
        };
        saved = await allergyApi.update(patientId, allergy.allergyId, body);
      } else {
        const body: CreateAllergyBody = {
          allergen: form.allergen.trim(),
          severity: form.severity,
          reaction,
          notes,
        };
        saved = await allergyApi.create(patientId, body);
      }

      onSuccess(saved);
    } catch (requestError: unknown) {
      if (axios.isAxiosError(requestError)) {
        switch (requestError.response?.status) {
          case 400:
            setError('Some allergy details are invalid. Check the form and try again.');
            break;
          case 403:
            setError('You do not have permission to record allergies.');
            break;
          case 404:
            setError('The patient or allergy no longer exists.');
            break;
          default:
            setError('Failed to save the allergy. Please try again.');
        }
      } else {
        setError('Failed to save the allergy. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel allergy-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2 id="allergy-modal-title">
              {isEditing ? 'Edit allergy' : 'Record allergy'}
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
          aria-labelledby="allergy-modal-title"
        >
          {error && (
            <div className="alert alert-danger" role="alert">
              {error}
            </div>
          )}

          {/* Allergen + Severity (side by side) */}
          <div className="allergy-form-row">
            <div className="form-group">
              <label htmlFor="al-allergen">Allergen *</label>
              <input
                id="al-allergen"
                value={form.allergen}
                onChange={(e) => set('allergen', e.target.value)}
                maxLength={200}
                placeholder="e.g. Penicillin"
                disabled={isSubmitting}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="al-severity">Severity *</label>
              <select
                id="al-severity"
                value={form.severity}
                onChange={(e) => set('severity', e.target.value as AllergySeverity)}
                disabled={isSubmitting}
                required
              >
                {SEVERITY_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Reaction */}
          <div className="form-group">
            <label htmlFor="al-reaction">Observed reaction</label>
            <input
              id="al-reaction"
              value={form.reaction}
              onChange={(e) => set('reaction', e.target.value)}
              maxLength={500}
              placeholder="e.g. Anaphylaxis, Rash, Hives"
              disabled={isSubmitting}
            />
            <span className="field-help">Optional — describe the observed reaction.</span>
          </div>

          {/* Notes */}
          <div className="form-group">
            <label htmlFor="al-notes">Notes</label>
            <textarea
              id="al-notes"
              rows={3}
              maxLength={2000}
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              disabled={isSubmitting}
              placeholder="Optional clinical notes…"
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
            <button type="submit" className="btn btn-danger" disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : isEditing ? 'Save changes' : 'Record allergy'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AllergyFormModal;
