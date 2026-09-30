import React, { useState, type FormEvent } from 'react';
import { extractErrorMessage } from '../../utils/apiError';

interface AppointmentTextDialogProps {
  title: string;
  /** One line under the title saying which appointment this is. */
  subtitle: string;
  label: string;
  placeholder?: string;
  help?: string;
  /** The service's limit — the field refuses more, and a counter shows how close it is. */
  maxLength: number;
  rows?: number;
  confirmLabel: string;
  busyLabel: string;
  /** The button that closes without acting. */
  dismissLabel?: string;
  /** A destructive action gets the danger button. */
  danger?: boolean;
  /**
   * Performs the change. Resolving means it succeeded and the caller closes the dialog; rejecting
   * keeps it open with the service's own wording — the cancellation policy, say — and what was
   * typed.
   */
  onConfirm: (text: string) => Promise<void>;
  onClose: () => void;
}

/**
 * A dialog that asks for one piece of text and then acts: the reason for a cancellation, or the
 * clinical notes that complete a visit (SCRUM-36). One component rather than two, because the two
 * differ only in words and limits.
 *
 * Blank text is refused here as the service would refuse it, so the button stays disabled until
 * there is something to send.
 */
const AppointmentTextDialog: React.FC<AppointmentTextDialogProps> = ({
  title,
  subtitle,
  label,
  placeholder,
  help,
  maxLength,
  rows = 4,
  confirmLabel,
  busyLabel,
  dismissLabel = 'Back',
  danger = false,
  onConfirm,
  onClose,
}) => {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const trimmed = text.trim();

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!trimmed || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);
    try {
      await onConfirm(trimmed);
    } catch (err) {
      setError(extractErrorMessage(err, 'That did not work. Please try again.'));
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={isSubmitting ? undefined : onClose}>
      <div
        className="modal-panel appt-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="appt-dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <h2 id="appt-dialog-title">{title}</h2>
            <p className="page-subtitle">{subtitle}</p>
          </div>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <form className="modal-form" onSubmit={handleSubmit} noValidate>
          {error && (
            <div className="alert alert-danger" role="alert">
              {error}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="appt-dialog-text">{label}</label>
            <textarea
              id="appt-dialog-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={maxLength}
              rows={rows}
              placeholder={placeholder}
              disabled={isSubmitting}
              required
            />
            <span className="field-help appt-dialog-count">
              {help ? `${help} ` : ''}
              {text.length}/{maxLength}
            </span>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isSubmitting}>
              {dismissLabel}
            </button>
            <button
              type="submit"
              className={`btn ${danger ? 'btn-danger-outline' : 'btn-primary'}`}
              disabled={!trimmed || isSubmitting}
            >
              {isSubmitting ? busyLabel : confirmLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AppointmentTextDialog;
