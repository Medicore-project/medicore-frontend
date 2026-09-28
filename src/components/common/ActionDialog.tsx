import React, { useEffect, useRef, useState, type FormEvent } from 'react';
import { extractErrorMessage } from '../../utils/apiError';

type ActionDialogProps = {
  title: string;
  /** What is being acted on, in one line. */
  subtitle?: string;
  /** Consequences worth reading before confirming. */
  body?: React.ReactNode;
  /** An optional free-text field — a reason or a note. Blank is allowed and sent as null. */
  field?: { label: string; placeholder?: string; maxLength: number };
  confirmLabel: string;
  busyLabel: string;
  dismissLabel?: string;
  tone?: 'primary' | 'success' | 'danger';
  /**
   * Performs the action with the typed text (or null). Resolving closes the dialog; rejecting keeps
   * it open with the service's own message and what was typed.
   */
  onConfirm: (text: string | null) => Promise<void>;
  onClose: () => void;
};

/**
 * An in-app replacement for `window.confirm` and `window.prompt` on the scheduling pages: the same
 * question, but styled, with the consequences spelled out, room for an optional note, and the
 * service's error shown in place rather than lost.
 */
const ActionDialog: React.FC<ActionDialogProps> = ({
  title,
  subtitle,
  body,
  field,
  confirmLabel,
  busyLabel,
  dismissLabel = 'Cancel',
  tone = 'primary',
  onConfirm,
  onClose,
}) => {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const firstFieldRef = useRef<HTMLTextAreaElement | null>(null);
  const confirmRef = useRef<HTMLButtonElement | null>(null);

  // Focus where the user acts next, and close on Escape unless the action is in flight.
  useEffect(() => {
    (firstFieldRef.current ?? confirmRef.current)?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isSubmitting, onClose]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await onConfirm(text.trim() || null);
    } catch (err) {
      setError(extractErrorMessage(err, 'That did not work. Please try again.'));
      setIsSubmitting(false);
    }
  };

  const confirmClass = tone === 'danger' ? 'btn-danger-outline' : tone === 'success' ? 'btn-success' : 'btn-primary';

  return (
    <div className="modal-overlay sc-dialog-overlay" onClick={isSubmitting ? undefined : onClose}>
      <div
        className={`modal-panel sc-dialog sc-dialog--${tone}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sc-dialog-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <div>
            <h2 id="sc-dialog-title">{title}</h2>
            {subtitle && <p className="page-subtitle">{subtitle}</p>}
          </div>
          <button type="button" className="modal-close" onClick={onClose} disabled={isSubmitting} aria-label="Close">
            ×
          </button>
        </div>

        <form className="modal-form" onSubmit={handleSubmit} noValidate>
          {error && (
            <div className="alert alert-danger" role="alert">
              {error}
            </div>
          )}
          {body && <div className="sc-dialog-body">{body}</div>}

          {field && (
            <div className="form-group">
              <label htmlFor="sc-dialog-text">
                {field.label} <span className="sc-optional">optional</span>
              </label>
              <textarea
                id="sc-dialog-text"
                ref={firstFieldRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={field.maxLength}
                rows={3}
                placeholder={field.placeholder}
                disabled={isSubmitting}
              />
              <span className="field-help sc-dialog-count">
                {text.length}/{field.maxLength}
              </span>
            </div>
          )}

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isSubmitting}>
              {dismissLabel}
            </button>
            <button ref={confirmRef} type="submit" className={`btn ${confirmClass}`} disabled={isSubmitting}>
              {isSubmitting ? busyLabel : confirmLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ActionDialog;
