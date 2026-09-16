import axios from 'axios';
import React, { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  patientApi,
  isDuplicatePatientError,
  isValidationProblem,
  type CreatePatientBody,
  type DuplicatePatientResponse,
  type PatientRegistrationResponse,
  type ValidationProblemResponse,
} from '../api/patients';
import {
  EMPTY_PATIENT_FORM,
  mapValidationErrors,
  normalizePatientForm,
  validatePatientForm,
  type PatientFieldErrors,
  type PatientForm,
} from '../utils/patientForm';

export const PatientRegistrationPage: React.FC = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState<PatientForm>(EMPTY_PATIENT_FORM);
  const [fieldErrors, setFieldErrors] = useState<PatientFieldErrors>({});
  const [requestError, setRequestError] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<DuplicatePatientResponse | null>(null);
  const [registered, setRegistered] = useState<PatientRegistrationResponse | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const today = new Date().toISOString().slice(0, 10);

  const updateField = (field: keyof PatientForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
    setRequestError(null);
    setDuplicate(null);
  };

  const validate = (): boolean => {
    const errors = validatePatientForm(form, today);
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validate()) return;

    setIsSubmitting(true);
    setRequestError(null);
    setDuplicate(null);
    setRegistered(null);

    const body: CreatePatientBody = normalizePatientForm(form);

    try {
      const patient = await patientApi.register(body);
      setRegistered(patient);
    } catch (error: unknown) {
      if (isDuplicatePatientError(error) && axios.isAxiosError<DuplicatePatientResponse>(error)) {
        setDuplicate(error.response?.data ?? null);
      } else if (isValidationProblem(error) && axios.isAxiosError<ValidationProblemResponse>(error)) {
        setFieldErrors(mapValidationErrors(error.response?.data.errors));
        setRequestError(error.response?.data.title ?? 'Please correct the highlighted fields.');
      } else if (axios.isAxiosError(error) && error.response?.status === 403) {
        setRequestError('You do not have permission to register patients.');
      } else {
        setRequestError('Patient registration failed. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const registerAnother = () => {
    setForm(EMPTY_PATIENT_FORM);
    setFieldErrors({});
    setRegistered(null);
    setDuplicate(null);
    setRequestError(null);
  };

  return (
    <div className="management-page patient-registration-page">
      <div className="page-header">
        <div>
          <Link className="profile-breadcrumb" to="/patients">Patients</Link>
          <h1>Register Patient</h1>
          <p className="page-subtitle">Create a patient profile for appointment booking.</p>
        </div>
      </div>

      {registered && (
        <section className="registration-result registration-success" role="status">
          <span className="registration-result-label">Patient successfully registered</span>
          <strong className="patient-number">{registered.patientNumber}</strong>
          <span>{registered.fullName}</span>
          <button type="button" className="btn btn-primary" onClick={registerAnother}>
            Register another patient
          </button>
          <button type="button" className="btn btn-outline" onClick={() => navigate(`/patients/${registered.patientId}`)}>
            View patient profile
          </button>
        </section>
      )}

      {duplicate && (
        <section className="registration-result registration-duplicate" role="alert">
          <span className="registration-result-label">Patient already registered</span>
          <strong className="patient-number">{duplicate.existingPatient.patientNumber}</strong>
          <span>{duplicate.existingPatient.fullName}</span>
          <span className="text-muted">{duplicate.existingPatient.email}</span>
          {duplicate.existingPatient.isArchived && (
            <span className="archived-notice">This patient is archived. Ask an administrator to restore the record.</span>
          )}
          <p className="existing-patient-help">
            Use this existing patient number when booking the appointment; no duplicate record was created.
          </p>
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => navigate(`/patients/${duplicate.existingPatient.patientId}`)}
          >
            View existing patient
          </button>
        </section>
      )}

      {requestError && (
        <div className="alert alert-danger" role="alert">
          <span>{requestError}</span>
          <button type="button" className="alert-close" onClick={() => setRequestError(null)}>×</button>
        </div>
      )}

      {!registered && (
        <form className="card patient-registration-form" onSubmit={handleSubmit} noValidate>
          <fieldset disabled={isSubmitting}>
            <legend>Personal details</legend>
            <div className="patient-form-grid">
              <div className="form-group">
                <label htmlFor="patient-nic">NIC *</label>
                <input id="patient-nic" value={form.nic} maxLength={12} autoComplete="off"
                  onChange={(event) => updateField('nic', event.target.value)} placeholder="200012345678" />
                {fieldErrors.nic && <span className="field-error">{fieldErrors.nic}</span>}
              </div>
              <div className="form-group">
                <label htmlFor="patient-dob">Date of birth *</label>
                <input id="patient-dob" type="date" value={form.dateOfBirth} max={today}
                  onChange={(event) => updateField('dateOfBirth', event.target.value)} />
                {fieldErrors.dateOfBirth && <span className="field-error">{fieldErrors.dateOfBirth}</span>}
              </div>
              <div className="form-group">
                <label htmlFor="patient-first-name">First name *</label>
                <input id="patient-first-name" value={form.firstName} maxLength={100} autoComplete="given-name"
                  onChange={(event) => updateField('firstName', event.target.value)} />
                {fieldErrors.firstName && <span className="field-error">{fieldErrors.firstName}</span>}
              </div>
              <div className="form-group">
                <label htmlFor="patient-last-name">Last name *</label>
                <input id="patient-last-name" value={form.lastName} maxLength={100} autoComplete="family-name"
                  onChange={(event) => updateField('lastName', event.target.value)} />
                {fieldErrors.lastName && <span className="field-error">{fieldErrors.lastName}</span>}
              </div>
              <div className="form-group patient-field-full">
                <label htmlFor="patient-gender">Gender *</label>
                <select id="patient-gender" value={form.gender}
                  onChange={(event) => updateField('gender', event.target.value)}>
                  <option value="">Select gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
                {fieldErrors.gender && <span className="field-error">{fieldErrors.gender}</span>}
              </div>
            </div>
          </fieldset>

          <fieldset disabled={isSubmitting}>
            <legend>Contact details</legend>
            <div className="patient-form-grid">
              <div className="form-group">
                <label htmlFor="patient-email">Email *</label>
                <input id="patient-email" type="email" value={form.email} maxLength={256} autoComplete="email"
                  onChange={(event) => updateField('email', event.target.value)} placeholder="patient@example.com" />
                {fieldErrors.email && <span className="field-error">{fieldErrors.email}</span>}
              </div>
              <div className="form-group">
                <label htmlFor="patient-phone">Phone *</label>
                <input id="patient-phone" type="tel" value={form.phone} maxLength={20} autoComplete="tel"
                  onChange={(event) => updateField('phone', event.target.value)} placeholder="0771234567" />
                {fieldErrors.phone && <span className="field-error">{fieldErrors.phone}</span>}
              </div>
              <div className="form-group patient-field-full">
                <label htmlFor="patient-address-1">Address line 1 *</label>
                <input id="patient-address-1" value={form.addressLine1} maxLength={200} autoComplete="address-line1"
                  onChange={(event) => updateField('addressLine1', event.target.value)} />
                {fieldErrors.addressLine1 && <span className="field-error">{fieldErrors.addressLine1}</span>}
              </div>
              <div className="form-group">
                <label htmlFor="patient-address-2">Address line 2</label>
                <input id="patient-address-2" value={form.addressLine2} maxLength={200} autoComplete="address-line2"
                  onChange={(event) => updateField('addressLine2', event.target.value)} />
                {fieldErrors.addressLine2 && <span className="field-error">{fieldErrors.addressLine2}</span>}
              </div>
              <div className="form-group">
                <label htmlFor="patient-district">District *</label>
                <input id="patient-district" value={form.district} maxLength={100} autoComplete="address-level1"
                  onChange={(event) => updateField('district', event.target.value)} />
                {fieldErrors.district && <span className="field-error">{fieldErrors.district}</span>}
              </div>
            </div>
          </fieldset>

          <fieldset disabled={isSubmitting}>
            <legend>Emergency contact (optional)</legend>
            <div className="patient-form-grid">
              <div className="form-group">
                <label htmlFor="emergency-name">Contact name</label>
                <input id="emergency-name" value={form.emergencyContactName} maxLength={200}
                  onChange={(event) => updateField('emergencyContactName', event.target.value)} />
                {fieldErrors.emergencyContactName && <span className="field-error">{fieldErrors.emergencyContactName}</span>}
              </div>
              <div className="form-group">
                <label htmlFor="emergency-phone">Contact phone</label>
                <input id="emergency-phone" type="tel" value={form.emergencyContactPhone} maxLength={20}
                  onChange={(event) => updateField('emergencyContactPhone', event.target.value)} />
                {fieldErrors.emergencyContactPhone && <span className="field-error">{fieldErrors.emergencyContactPhone}</span>}
              </div>
            </div>
          </fieldset>

          <div className="patient-form-actions">
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Registering…' : 'Register patient'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default PatientRegistrationPage;
