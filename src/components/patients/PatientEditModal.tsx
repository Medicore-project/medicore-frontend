import axios from 'axios';
import React, { useState, type FormEvent } from 'react';
import {
  isValidationProblem,
  patientApi,
  type PatientProfileResponse,
  type UpdatePatientBody,
  type ValidationProblemResponse,
} from '../../api/patients';
import {
  mapValidationErrors,
  normalizePatientForm,
  validatePatientForm,
  type PatientFieldErrors,
  type PatientForm,
} from '../../utils/patientForm';

interface PatientEditModalProps {
  patient: PatientProfileResponse;
  onClose: () => void;
  onSuccess: (patient: PatientProfileResponse) => void;
}

export const PatientEditModal: React.FC<PatientEditModalProps> = ({ patient, onClose, onSuccess }) => {
  const [form, setForm] = useState<PatientForm>({
    nic: patient.nic,
    firstName: patient.firstName,
    lastName: patient.lastName,
    dateOfBirth: patient.dateOfBirth,
    gender: patient.gender,
    email: patient.email,
    phone: patient.phone,
    addressLine1: patient.addressLine1,
    addressLine2: patient.addressLine2 ?? '',
    district: patient.district,
    emergencyContactName: patient.emergencyContactName ?? '',
    emergencyContactPhone: patient.emergencyContactPhone ?? '',
  });
  const [fieldErrors, setFieldErrors] = useState<PatientFieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const today = new Date().toISOString().slice(0, 10);

  const updateField = (field: keyof PatientForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
    setError(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validationErrors = validatePatientForm(form, today);
    setFieldErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    const normalized = normalizePatientForm(form);
    const body: UpdatePatientBody = {
      firstName: normalized.firstName,
      lastName: normalized.lastName,
      dateOfBirth: normalized.dateOfBirth,
      gender: normalized.gender,
      email: normalized.email,
      phone: normalized.phone,
      addressLine1: normalized.addressLine1,
      addressLine2: normalized.addressLine2,
      district: normalized.district,
      emergencyContactName: normalized.emergencyContactName,
      emergencyContactPhone: normalized.emergencyContactPhone,
    };

    setIsSubmitting(true);
    setError(null);
    try {
      onSuccess(await patientApi.update(patient.patientId, body));
    } catch (requestError: unknown) {
      if (isValidationProblem(requestError) && axios.isAxiosError<ValidationProblemResponse>(requestError)) {
        setFieldErrors(mapValidationErrors(requestError.response?.data.errors));
        setError(requestError.response?.data.title ?? 'Please correct the highlighted fields.');
      } else if (axios.isAxiosError(requestError) && requestError.response?.status === 404) {
        setError('This patient no longer exists or has been deleted.');
      } else {
        setError('Failed to update the patient. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel patient-edit-modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>Edit Patient</h2>
            <p className="page-subtitle">{patient.patientNumber} · NIC {patient.nic}</p>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        <form className="modal-form" onSubmit={handleSubmit} noValidate>
          {error && <div className="alert alert-danger" role="alert">{error}</div>}

          <div className="patient-form-grid">
            <div className="form-group">
              <label htmlFor="edit-first-name">First name *</label>
              <input id="edit-first-name" value={form.firstName} maxLength={100}
                onChange={(event) => updateField('firstName', event.target.value)} disabled={isSubmitting} />
              {fieldErrors.firstName && <span className="field-error">{fieldErrors.firstName}</span>}
            </div>
            <div className="form-group">
              <label htmlFor="edit-last-name">Last name *</label>
              <input id="edit-last-name" value={form.lastName} maxLength={100}
                onChange={(event) => updateField('lastName', event.target.value)} disabled={isSubmitting} />
              {fieldErrors.lastName && <span className="field-error">{fieldErrors.lastName}</span>}
            </div>
            <div className="form-group">
              <label htmlFor="edit-dob">Date of birth *</label>
              <input id="edit-dob" type="date" value={form.dateOfBirth} max={today}
                onChange={(event) => updateField('dateOfBirth', event.target.value)} disabled={isSubmitting} />
              {fieldErrors.dateOfBirth && <span className="field-error">{fieldErrors.dateOfBirth}</span>}
            </div>
            <div className="form-group">
              <label htmlFor="edit-gender">Gender *</label>
              <select id="edit-gender" value={form.gender}
                onChange={(event) => updateField('gender', event.target.value)} disabled={isSubmitting}>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
                <option value="PreferNotToSay">Prefer not to say</option>
              </select>
              {fieldErrors.gender && <span className="field-error">{fieldErrors.gender}</span>}
            </div>
            <div className="form-group">
              <label htmlFor="edit-email">Email *</label>
              <input id="edit-email" type="email" value={form.email} maxLength={256}
                onChange={(event) => updateField('email', event.target.value)} disabled={isSubmitting} />
              {fieldErrors.email && <span className="field-error">{fieldErrors.email}</span>}
            </div>
            <div className="form-group">
              <label htmlFor="edit-phone">Phone *</label>
              <input id="edit-phone" type="tel" value={form.phone} maxLength={20}
                onChange={(event) => updateField('phone', event.target.value)} disabled={isSubmitting} />
              {fieldErrors.phone && <span className="field-error">{fieldErrors.phone}</span>}
            </div>
            <div className="form-group patient-field-full">
              <label htmlFor="edit-address-1">Address line 1 *</label>
              <input id="edit-address-1" value={form.addressLine1} maxLength={200}
                onChange={(event) => updateField('addressLine1', event.target.value)} disabled={isSubmitting} />
              {fieldErrors.addressLine1 && <span className="field-error">{fieldErrors.addressLine1}</span>}
            </div>
            <div className="form-group">
              <label htmlFor="edit-address-2">Address line 2</label>
              <input id="edit-address-2" value={form.addressLine2} maxLength={200}
                onChange={(event) => updateField('addressLine2', event.target.value)} disabled={isSubmitting} />
              {fieldErrors.addressLine2 && <span className="field-error">{fieldErrors.addressLine2}</span>}
            </div>
            <div className="form-group">
              <label htmlFor="edit-district">District *</label>
              <input id="edit-district" value={form.district} maxLength={100}
                onChange={(event) => updateField('district', event.target.value)} disabled={isSubmitting} />
              {fieldErrors.district && <span className="field-error">{fieldErrors.district}</span>}
            </div>
            <div className="form-group">
              <label htmlFor="edit-emergency-name">Emergency contact</label>
              <input id="edit-emergency-name" value={form.emergencyContactName} maxLength={200}
                onChange={(event) => updateField('emergencyContactName', event.target.value)} disabled={isSubmitting} />
              {fieldErrors.emergencyContactName && <span className="field-error">{fieldErrors.emergencyContactName}</span>}
            </div>
            <div className="form-group">
              <label htmlFor="edit-emergency-phone">Emergency phone</label>
              <input id="edit-emergency-phone" type="tel" value={form.emergencyContactPhone} maxLength={20}
                onChange={(event) => updateField('emergencyContactPhone', event.target.value)} disabled={isSubmitting} />
              {fieldErrors.emergencyContactPhone && <span className="field-error">{fieldErrors.emergencyContactPhone}</span>}
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isSubmitting}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PatientEditModal;
