import React, { useState } from 'react';

interface IdentifyStepProps {
  onIdentify: (patientNumber: string, dateOfBirth: string) => Promise<void>;
  onNewPatient: () => void;
  error: string | null;
  isSubmitting: boolean;
}

/**
 * Step one for a returning patient: patient number plus date of birth.
 *
 * The date of birth is not optional politeness — patient numbers run `PAT-000001`, `PAT-000002`,
 * so the number alone would let anyone book as anyone. The service says the same thing for a wrong
 * number and a wrong date, and so does this screen.
 */
const IdentifyStep: React.FC<IdentifyStepProps> = ({
  onIdentify,
  onNewPatient,
  error,
  isSubmitting,
}) => {
  const [patientNumber, setPatientNumber] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!patientNumber.trim() || !dateOfBirth) {
      setLocalError('Enter your patient number and date of birth.');
      return;
    }

    setLocalError(null);
    await onIdentify(patientNumber.trim(), dateOfBirth);
  };

  const message = localError ?? error;

  return (
    <form
      className="bk-card booking-step"
      onSubmit={handleSubmit}
      noValidate
      data-testid="booking-identify-form"
    >
      <h2>Have you been here before?</h2>
      <p className="page-subtitle">
        Enter the patient number from your card, and your date of birth.
      </p>

      {message && (
        <div className="alert alert-danger" role="alert">
          {message}
        </div>
      )}

      <fieldset disabled={isSubmitting}>
        <div className="booking-field-row">
          <div className="form-group">
            <label htmlFor="booking-patient-number">Patient number</label>
            <input
              id="booking-patient-number"
              value={patientNumber}
              maxLength={20}
              autoComplete="off"
              placeholder="PAT-000123"
              onChange={(event) => {
                setPatientNumber(event.target.value);
                setLocalError(null);
              }}
            />
          </div>
          <div className="form-group">
            <label htmlFor="booking-dob">Date of birth</label>
            <input
              id="booking-dob"
              type="date"
              value={dateOfBirth}
              max={today}
              onChange={(event) => {
                setDateOfBirth(event.target.value);
                setLocalError(null);
              }}
            />
          </div>
        </div>
      </fieldset>

      <div className="booking-step-actions">
        <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
          {isSubmitting ? 'Checking…' : 'Continue'}
        </button>
        <button
          type="button"
          className="btn btn-outline"
          onClick={onNewPatient}
          disabled={isSubmitting}
        >
          I am a new patient
        </button>
      </div>
    </form>
  );
};

export default IdentifyStep;
