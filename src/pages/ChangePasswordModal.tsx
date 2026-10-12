import React, { useState, type FormEvent } from 'react';
import { staffApi, type StaffResponse } from '../api/staff';
import { extractErrorMessage } from '../utils/apiError';

/** The identity service's own limits on a staff password. */
const MIN_LENGTH = 8;
const MAX_LENGTH = 100;

interface ChangePasswordModalProps {
  staff: StaffResponse;
  onSuccess: () => void;
  onClose: () => void;
}

/** Why a new password cannot be used, or null if it can. */
function passwordProblem(password: string): string | null {
  if (!password) return 'Password is required.';
  // Refused rather than trimmed: the admin goes on to tell the staff member what they typed, and
  // sign-in does not trim, so quietly storing something else would lock that person out.
  if (password !== password.trim()) return 'Password cannot start or end with a space.';
  if (password.length < MIN_LENGTH) return `Password must be at least ${MIN_LENGTH} characters long.`;
  if (password.length > MAX_LENGTH) return `Password must not exceed ${MAX_LENGTH} characters.`;
  return null;
}

function changeError(err: unknown): string {
  if (err && typeof err === 'object' && 'response' in err) {
    const response = (err as { response?: { status?: number; data?: unknown } }).response;
    // The identity service answers a password it refuses with a bare list of messages.
    if (Array.isArray(response?.data) && typeof response.data[0] === 'string') return response.data[0];
    if (response?.status === 404) {
      // The service answers a staff member it cannot find with a problem body. A 404 with no body
      // at all never reached that code: the route itself is missing, which means the Identity
      // service running is older than this page. Saying "no longer exists" then would be wrong.
      return response.data
        ? 'This staff member no longer exists.'
        : 'The Identity service running does not have the change-password feature yet. Rebuild and restart it.';
    }
  }
  return extractErrorMessage(err, 'Could not change the password.');
}

/**
 * An Admin setting a staff member's password for them. There is no "current password" field: the
 * admin is not the account's owner, and the usual reason to be here is that the owner forgot it.
 */
export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({ staff, onSuccess, onClose }) => {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ password?: string; confirmation?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    const problem = passwordProblem(password);
    const errs = {
      password: problem ?? undefined,
      // Only once the password itself is usable; one message at a time is enough.
      confirmation: !problem && confirmation !== password ? 'The two passwords do not match.' : undefined,
    };
    setFieldErrors(errs);
    if (errs.password || errs.confirmation) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await staffApi.changePassword(staff.id, password);
      onSuccess();
    } catch (err: unknown) {
      setError(changeError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Change Password for {staff.fullName}</h2>
          <button type="button" className="modal-close" onClick={onClose}>×</button>
        </div>

        {error && (
          <div className="alert alert-danger" role="alert" style={{ margin: '16px 24px 0' }}>
            <span>{error}</span>
            <button type="button" className="alert-close" onClick={() => setError(null)}>×</button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label htmlFor="cp-password">New Password *</label>
            <input
              id="cp-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isSubmitting}
            />
            {fieldErrors.password && <span className="field-error">{fieldErrors.password}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="cp-confirmation">Confirm New Password *</label>
            <input
              id="cp-confirmation"
              type="password"
              autoComplete="new-password"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              disabled={isSubmitting}
            />
            {fieldErrors.confirmation && <span className="field-error">{fieldErrors.confirmation}</span>}
          </div>

          <p className="field-help">
            At least {MIN_LENGTH} characters. {staff.fullName} will be signed out and must sign in
            again with the new password, so make sure they know it.
          </p>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Changing...' : 'Change Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChangePasswordModal;
