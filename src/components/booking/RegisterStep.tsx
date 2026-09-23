import React from 'react';
import type { PatientFieldErrors, PatientForm } from '../../utils/patientForm';

interface RegisterStepProps {
  form: PatientForm;
  fieldErrors: PatientFieldErrors;
  error: string | null;
  isSubmitting: boolean;
  onChange: (field: keyof PatientForm, value: string) => void;
  onSubmit: () => Promise<void>;
  onBackToIdentify: () => void;
}

/**
 * Step one for a first-time patient: the details the clinic needs to open a record.
 *
 * The same fields and the same validation rules as the front desk's registration page, reused from
 * `utils/patientForm` — a patient registered here must be indistinguishable from one registered at
 * the counter.
 */
const RegisterStep: React.FC<RegisterStepProps> = ({
  form,
  fieldErrors,
  error,
  isSubmitting,
  onChange,
  onSubmit,
  onBackToIdentify,
}) => {
  const today = new Date().toISOString().slice(0, 10);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    await onSubmit();
  };

  return (
    <form
      className="card booking-step"
      onSubmit={handleSubmit}
      noValidate
      data-testid="booking-register-form"
    >
      <h2>Your details</h2>
      <p className="page-subtitle">
        We will give you a patient number to use next time you book.
      </p>

      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}

      <fieldset disabled={isSubmitting}>
        <legend>About you</legend>
        <div className="patient-form-grid">
          <div className="form-group">
            <label htmlFor="booking-nic">NIC *</label>
            <input
              id="booking-nic"
              value={form.nic}
              maxLength={12}
              autoComplete="off"
              placeholder="200012345678"
              onChange={(event) => onChange('nic', event.target.value)}
            />
            {fieldErrors.nic && <span className="field-error">{fieldErrors.nic}</span>}
          </div>
          <div className="form-group">
            <label htmlFor="booking-register-dob">Date of birth *</label>
            <input
              id="booking-register-dob"
              type="date"
              value={form.dateOfBirth}
              max={today}
              onChange={(event) => onChange('dateOfBirth', event.target.value)}
            />
            {fieldErrors.dateOfBirth && (
              <span className="field-error">{fieldErrors.dateOfBirth}</span>
            )}
          </div>
          <div className="form-group">
            <label htmlFor="booking-first-name">First name *</label>
            <input
              id="booking-first-name"
              value={form.firstName}
              maxLength={100}
              onChange={(event) => onChange('firstName', event.target.value)}
            />
            {fieldErrors.firstName && <span className="field-error">{fieldErrors.firstName}</span>}
          </div>
          <div className="form-group">
            <label htmlFor="booking-last-name">Last name *</label>
            <input
              id="booking-last-name"
              value={form.lastName}
              maxLength={100}
              onChange={(event) => onChange('lastName', event.target.value)}
            />
            {fieldErrors.lastName && <span className="field-error">{fieldErrors.lastName}</span>}
          </div>
          <div className="form-group">
            <label htmlFor="booking-gender">Gender *</label>
            <select
              id="booking-gender"
              value={form.gender}
              onChange={(event) => onChange('gender', event.target.value)}
            >
              <option value="">Select gender</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>
            {fieldErrors.gender && <span className="field-error">{fieldErrors.gender}</span>}
          </div>
        </div>
      </fieldset>

      <fieldset disabled={isSubmitting}>
        <legend>How we reach you</legend>
        <div className="patient-form-grid">
          <div className="form-group">
            <label htmlFor="booking-phone">Phone *</label>
            <input
              id="booking-phone"
              value={form.phone}
              maxLength={15}
              placeholder="0771234567"
              onChange={(event) => onChange('phone', event.target.value)}
            />
            {fieldErrors.phone && <span className="field-error">{fieldErrors.phone}</span>}
          </div>
          <div className="form-group">
            <label htmlFor="booking-email">Email *</label>
            <input
              id="booking-email"
              type="email"
              value={form.email}
              maxLength={200}
              onChange={(event) => onChange('email', event.target.value)}
            />
            {fieldErrors.email && <span className="field-error">{fieldErrors.email}</span>}
          </div>
          <div className="form-group patient-field-full">
            <label htmlFor="booking-address">Address *</label>
            <input
              id="booking-address"
              value={form.addressLine1}
              maxLength={200}
              onChange={(event) => onChange('addressLine1', event.target.value)}
            />
            {fieldErrors.addressLine1 && (
              <span className="field-error">{fieldErrors.addressLine1}</span>
            )}
          </div>
          <div className="form-group">
            <label htmlFor="booking-district">District *</label>
            <input
              id="booking-district"
              value={form.district}
              maxLength={100}
              onChange={(event) => onChange('district', event.target.value)}
            />
            {fieldErrors.district && <span className="field-error">{fieldErrors.district}</span>}
          </div>
        </div>
      </fieldset>

      <div className="booking-step-actions">
        <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
          {isSubmitting ? 'Registering…' : 'Continue'}
        </button>
        <button
          type="button"
          className="btn btn-outline"
          onClick={onBackToIdentify}
          disabled={isSubmitting}
        >
          I already have a patient number
        </button>
      </div>
    </form>
  );
};

export default RegisterStep;
