import axios from 'axios';
import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { prescriptionApi, type PrescriptionResponse } from '../api/prescriptions';
import { useAuth } from '../contexts/AuthContext';
import { canWritePrescriptions } from '../utils/prescriptionPermissions';
import PrescriptionFormModal from '../components/patients/PrescriptionFormModal';
import AllergyBanner from '../components/patients/AllergyBanner';

// ── Formatters ────────────────────────────────────────────────────────────────

function fmtDate(value: string): string {
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(new Date(value));
}

function fmtDatetime(value: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

// ── Sub-component: single prescription card ───────────────────────────────────

interface PrescriptionCardProps {
  rx: PrescriptionResponse;
  canWrite: boolean;
  isCompleting: boolean;
  isDeleting: boolean;
  onEdit: (rx: PrescriptionResponse) => void;
  onComplete: (rx: PrescriptionResponse) => void;
  onDelete: (rx: PrescriptionResponse) => void;
}

const PrescriptionCard: React.FC<PrescriptionCardProps> = ({
  rx,
  canWrite,
  isCompleting,
  isDeleting,
  onEdit,
  onComplete,
  onDelete,
}) => (
  <article className="rx-card" aria-label={`Prescription: ${rx.drug}`}>
    <div className="rx-card-header">
      <div className="rx-card-drug">
        <span className="rx-drug-name">{rx.drug}</span>
        <span
          className={`badge ${rx.status === 'Active' ? 'badge-rx-active' : 'badge-rx-completed'}`}
        >
          {rx.status}
        </span>
      </div>

      {canWrite && (
        <div className="rx-card-actions">
          {rx.status === 'Active' && (
            <>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => onEdit(rx)}
              >
                Edit
              </button>
              <button
                type="button"
                className="btn btn-success btn-sm"
                disabled={isCompleting}
                onClick={() => onComplete(rx)}
              >
                {isCompleting ? 'Completing…' : 'Mark complete'}
              </button>
            </>
          )}
          <button
            type="button"
            className="btn btn-danger-outline btn-sm"
            disabled={isDeleting}
            onClick={() => onDelete(rx)}
          >
            {isDeleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      )}
    </div>

    <dl className="rx-details">
      <div>
        <dt>Dosage</dt>
        <dd>{rx.dosage}</dd>
      </div>
      <div>
        <dt>Frequency</dt>
        <dd>{rx.frequency}</dd>
      </div>
      <div>
        <dt>Duration</dt>
        <dd>{rx.durationDays} {rx.durationDays === 1 ? 'day' : 'days'}</dd>
      </div>
      <div>
        <dt>Prescribed</dt>
        <dd><time dateTime={rx.prescribedAtUtc}>{fmtDate(rx.prescribedAtUtc)}</time></dd>
      </div>
      {rx.status === 'Completed' && rx.completedAtUtc && (
        <div>
          <dt>Completed</dt>
          <dd><time dateTime={rx.completedAtUtc}>{fmtDatetime(rx.completedAtUtc)}</time></dd>
        </div>
      )}
      <div>
        <dt>Prescriber</dt>
        <dd>{rx.prescriberClinicianEmail} <span className="rx-role">({rx.prescriberClinicianRole})</span></dd>
      </div>
    </dl>

    {rx.notes && (
      <p className="rx-notes">
        <span className="rx-notes-label">Notes</span>
        {rx.notes}
      </p>
    )}
  </article>
);

// ── Section: collapsible history panel ────────────────────────────────────────

interface HistorySectionProps {
  items: PrescriptionResponse[];
  canWrite: boolean;
  deletingId: string | null;
  onDelete: (rx: PrescriptionResponse) => void;
}

const HistorySection: React.FC<HistorySectionProps> = ({
  items,
  canWrite,
  deletingId,
  onDelete,
}) => {
  if (items.length === 0) return null;

  return (
    <details className="rx-history-details">
      <summary className="rx-history-summary">
        <span>Prescription history</span>
        <span className="badge badge-inactive">{items.length}</span>
      </summary>
      <div className="rx-history-list">
        {items.map((rx) => (
          <PrescriptionCard
            key={rx.prescriptionId}
            rx={rx}
            canWrite={canWrite}
            isCompleting={false}
            isDeleting={deletingId === rx.prescriptionId}
            onEdit={() => undefined} // completed prescriptions are immutable
            onComplete={() => undefined}
            onDelete={onDelete}
          />
        ))}
      </div>
    </details>
  );
};

// ── Main page component ───────────────────────────────────────────────────────

export const PrescriptionsPanel: React.FC = () => {
  const { patientId } = useParams<{ patientId: string }>();
  const { user } = useAuth();
  const canWrite = canWritePrescriptions(user?.role);

  const [active, setActive] = useState<PrescriptionResponse[]>([]);
  const [history, setHistory] = useState<PrescriptionResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Modal and action state
  const [showForm, setShowForm] = useState(false);
  const [editingRx, setEditingRx] = useState<PrescriptionResponse | undefined>(undefined);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ── Data loading ────────────────────────────────────────────────────────────

  const loadPrescriptions = useCallback(async () => {
    if (!patientId) return;
    setIsLoading(true);
    setError(null);
    try {
      const { active: a, history: h } = await prescriptionApi.list(patientId);
      setActive(a);
      setHistory(h);
    } catch (requestError: unknown) {
      if (axios.isAxiosError(requestError) && requestError.response?.status === 404) {
        setError('Patient not found.');
      } else {
        setError('Failed to load prescriptions. Please refresh the page.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- route-driven data load
    void loadPrescriptions();
  }, [loadPrescriptions]);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleFormSuccess = (saved: PrescriptionResponse) => {
    setShowForm(false);
    setEditingRx(undefined);

    if (saved.status === 'Active') {
      // Upsert into active list (add or replace)
      setActive((prev) => {
        const idx = prev.findIndex((rx) => rx.prescriptionId === saved.prescriptionId);
        return idx >= 0
          ? prev.map((rx) => (rx.prescriptionId === saved.prescriptionId ? saved : rx))
          : [saved, ...prev];
      });
    }

    setSuccessMessage(
      editingRx ? `Prescription for ${saved.drug} updated.` : `Prescription for ${saved.drug} added.`,
    );
  };

  const handleComplete = async (rx: PrescriptionResponse) => {
    if (!patientId) return;
    if (!window.confirm(`Mark "${rx.drug}" as completed? It will move to prescription history.`)) return;

    setCompletingId(rx.prescriptionId);
    setError(null);
    try {
      const completed = await prescriptionApi.complete(patientId, rx.prescriptionId);
      setActive((prev) => prev.filter((item) => item.prescriptionId !== rx.prescriptionId));
      setHistory((prev) => [completed, ...prev]);
      setSuccessMessage(`${rx.drug} marked as completed and moved to history.`);
    } catch (requestError: unknown) {
      if (axios.isAxiosError(requestError) && requestError.response?.status === 409) {
        setError('This prescription is already marked as completed.');
      } else {
        setError('Failed to complete the prescription. Please try again.');
      }
    } finally {
      setCompletingId(null);
    }
  };

  const handleDelete = async (rx: PrescriptionResponse) => {
    if (!patientId) return;
    if (!window.confirm(`Delete the prescription for "${rx.drug}"? This cannot be undone.`)) return;

    setDeletingId(rx.prescriptionId);
    setError(null);
    try {
      await prescriptionApi.remove(patientId, rx.prescriptionId);
      setActive((prev) => prev.filter((item) => item.prescriptionId !== rx.prescriptionId));
      setHistory((prev) => prev.filter((item) => item.prescriptionId !== rx.prescriptionId));
      setSuccessMessage(`Prescription for ${rx.drug} deleted.`);
    } catch {
      setError('Failed to delete the prescription. Please try again.');
    } finally {
      setDeletingId(null);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="table-loading">
        <div className="spinner" />
        <p>Loading prescriptions…</p>
      </div>
    );
  }

  return (
    <div className="management-page prescriptions-page">
      {/* Page header */}
      <div className="page-header">
        <div>
          <Link className="profile-breadcrumb" to={`/patients/${patientId}`}>
            ← Patient profile
          </Link>
          <h1>Prescriptions</h1>
          <p className="page-subtitle">
            {active.length} active · {history.length} in history
          </p>
        </div>

        {canWrite && (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => { setEditingRx(undefined); setShowForm(true); }}
          >
            + Add prescription
          </button>
        )}
      </div>

      {/* Feedback banners */}
      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}
      {successMessage && (
        <div className="alert alert-success" role="status">
          <span>{successMessage}</span>
          <button
            type="button"
            className="alert-close"
            onClick={() => setSuccessMessage(null)}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}

      {/* Compact allergy banner — shows at point of prescribing */}
      {patientId && <AllergyBanner patientId={patientId} compact />}

      {/* Active prescriptions */}
      <section className="card" aria-labelledby="active-rx-heading">
        <div className="rx-section-header">
          <div>
            <h2 id="active-rx-heading">Active prescriptions</h2>
            <p className="page-subtitle">Current medication being administered to this patient.</p>
          </div>
          {active.length > 0 && (
            <span className="badge badge-rx-active">{active.length}</span>
          )}
        </div>

        {active.length === 0 ? (
          <div className="table-empty">
            <p>No active prescriptions for this patient.</p>
            {canWrite && (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => { setEditingRx(undefined); setShowForm(true); }}
              >
                Add first prescription
              </button>
            )}
          </div>
        ) : (
          <div className="rx-list">
            {active.map((rx) => (
              <PrescriptionCard
                key={rx.prescriptionId}
                rx={rx}
                canWrite={canWrite}
                isCompleting={completingId === rx.prescriptionId}
                isDeleting={deletingId === rx.prescriptionId}
                onEdit={(item) => { setEditingRx(item); setShowForm(true); }}
                onComplete={handleComplete}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </section>

      {/* History section (collapsible) */}
      <section className="card rx-history-section" aria-label="Prescription history">
        <HistorySection
          items={history}
          canWrite={canWrite}
          deletingId={deletingId}
          onDelete={handleDelete}
        />
        {history.length === 0 && (
          <p className="rx-history-empty">No completed prescriptions yet.</p>
        )}
      </section>

      {/* Create / Edit modal */}
      {showForm && (
        <PrescriptionFormModal
          patientId={patientId!}
          prescription={editingRx}
          onClose={() => { setShowForm(false); setEditingRx(undefined); }}
          onSuccess={handleFormSuccess}
        />
      )}
    </div>
  );
};

export default PrescriptionsPanel;
