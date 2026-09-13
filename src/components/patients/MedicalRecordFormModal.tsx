import axios from 'axios';
import React, { useState, type FormEvent } from 'react';
import {
  medicalRecordApi,
  type ConditionClinicalStatus,
  type ConditionInput,
  type MedicalRecordResponse,
} from '../../api/medicalRecords';

interface MedicalRecordFormModalProps {
  patientId: string;
  record?: MedicalRecordResponse;
  onClose: () => void;
  onSuccess: (record: MedicalRecordResponse) => void;
}

const emptyCondition = (): ConditionInput => ({
  name: '',
  code: '',
  clinicalStatus: 'Active',
  notes: '',
});

export const MedicalRecordFormModal: React.FC<MedicalRecordFormModalProps> = ({
  patientId,
  record,
  onClose,
  onSuccess,
}) => {
  const isEditing = Boolean(record);
  const [visitReference, setVisitReference] = useState(record?.visitReference ?? '');
  const [clinicalNotes, setClinicalNotes] = useState(record?.clinicalNotes ?? '');
  const [conditions, setConditions] = useState<ConditionInput[]>(
    record?.conditions.map(({ name, code, clinicalStatus, notes }) => ({
      name,
      code: code ?? '',
      clinicalStatus,
      notes: notes ?? '',
    })) ?? [],
  );
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updateCondition = (index: number, field: keyof ConditionInput, value: string) => {
    setConditions((current) => current.map((condition, conditionIndex) => (
      conditionIndex === index ? { ...condition, [field]: value } : condition
    )));
    setError(null);
  };

  const validate = (): string | null => {
    if (!isEditing && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(visitReference)) {
      return 'Enter a valid visit reference UUID.';
    }
    if (!clinicalNotes.trim()) return 'Clinical notes are required.';
    if (clinicalNotes.trim().length > 8000) return 'Clinical notes cannot exceed 8,000 characters.';
    if (conditions.length > 20) return 'A record can contain no more than 20 conditions.';
    if (conditions.some((condition) => !condition.name.trim())) return 'Each condition must have a name.';

    const names = conditions.map((condition) => condition.name.trim().toLocaleLowerCase());
    if (new Set(names).size !== names.length) return 'Condition names must be unique within the record.';
    return null;
  };

  const normalizedConditions = (): ConditionInput[] => conditions.map((condition) => ({
    name: condition.name.trim(),
    code: condition.code?.trim() || undefined,
    clinicalStatus: condition.clinicalStatus,
    notes: condition.notes?.trim() || undefined,
  }));

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const saved = record
        ? await medicalRecordApi.update(patientId, record.recordId, {
            expectedVersion: record.version,
            clinicalNotes: clinicalNotes.trim(),
            conditions: normalizedConditions(),
          })
        : await medicalRecordApi.create(patientId, {
            visitReference,
            clinicalNotes: clinicalNotes.trim(),
            conditions: normalizedConditions(),
          });
      onSuccess(saved);
    } catch (requestError: unknown) {
      if (axios.isAxiosError(requestError) && requestError.response?.status === 409) {
        setError('This record was updated by someone else. Close this form, reload it, and try again.');
      } else if (axios.isAxiosError(requestError) && requestError.response?.status === 403) {
        setError('You do not have permission to write medical records.');
      } else if (axios.isAxiosError(requestError) && requestError.response?.status === 404) {
        setError('The patient or medical record no longer exists.');
      } else if (axios.isAxiosError(requestError) && requestError.response?.status === 400) {
        setError('Some medical record details are invalid. Check the form and try again.');
      } else {
        setError('Failed to save the medical record. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel medical-record-modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>{isEditing ? `Edit record · Version ${record?.version}` : 'New medical record entry'}</h2>
            <p className="page-subtitle">Patient {patientId}</p>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        <form className="modal-form" onSubmit={handleSubmit} noValidate>
          {error && <div className="alert alert-danger" role="alert">{error}</div>}

          <div className="form-group">
            <label htmlFor="record-visit-reference">Visit reference *</label>
            <input
              id="record-visit-reference"
              value={visitReference}
              onChange={(event) => setVisitReference(event.target.value.trim())}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              disabled={isEditing || isSubmitting}
              required
            />
            {isEditing && <span className="field-help">The visit reference is retained across versions.</span>}
          </div>

          <div className="form-group">
            <label htmlFor="record-clinical-notes">Clinical notes *</label>
            <textarea
              id="record-clinical-notes"
              rows={8}
              maxLength={8000}
              value={clinicalNotes}
              onChange={(event) => { setClinicalNotes(event.target.value); setError(null); }}
              disabled={isSubmitting}
              required
            />
            <span className="field-help">{clinicalNotes.length.toLocaleString()} / 8,000 characters</span>
          </div>

          <div className="condition-section">
            <div className="condition-section-header">
              <div>
                <h3>Conditions</h3>
                <p className="field-help">Optional diagnoses or clinical conditions for this entry.</p>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setConditions((current) => [...current, emptyCondition()])}
                disabled={isSubmitting || conditions.length >= 20}
              >
                Add condition
              </button>
            </div>

            {conditions.length === 0 && <p className="condition-empty">No conditions added.</p>}
            {conditions.map((condition, index) => (
              <fieldset className="condition-editor" key={`condition-${index + 1}`}>
                <legend>Condition {index + 1}</legend>
                <div className="condition-fields">
                  <div className="form-group">
                    <label htmlFor={`condition-name-${index}`}>Name *</label>
                    <input
                      id={`condition-name-${index}`}
                      maxLength={200}
                      value={condition.name}
                      onChange={(event) => updateCondition(index, 'name', event.target.value)}
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor={`condition-code-${index}`}>Code</label>
                    <input
                      id={`condition-code-${index}`}
                      maxLength={50}
                      value={condition.code ?? ''}
                      onChange={(event) => updateCondition(index, 'code', event.target.value)}
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor={`condition-status-${index}`}>Clinical status *</label>
                    <select
                      id={`condition-status-${index}`}
                      value={condition.clinicalStatus}
                      onChange={(event) => updateCondition(
                        index,
                        'clinicalStatus',
                        event.target.value as ConditionClinicalStatus,
                      )}
                      disabled={isSubmitting}
                    >
                      <option value="Active">Active</option>
                      <option value="Resolved">Resolved</option>
                      <option value="Historical">Historical</option>
                    </select>
                  </div>
                  <div className="form-group condition-notes-field">
                    <label htmlFor={`condition-notes-${index}`}>Notes</label>
                    <input
                      id={`condition-notes-${index}`}
                      maxLength={1000}
                      value={condition.notes ?? ''}
                      onChange={(event) => updateCondition(index, 'notes', event.target.value)}
                      disabled={isSubmitting}
                    />
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-danger-outline btn-sm"
                  onClick={() => setConditions((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                  disabled={isSubmitting}
                >
                  Remove
                </button>
              </fieldset>
            ))}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isSubmitting}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : isEditing ? 'Save new version' : 'Create record'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default MedicalRecordFormModal;
