import axios from 'axios';
import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { allergyApi, type AllergyResponse } from '../api/allergies';
import { useAuth } from '../contexts/AuthContext';
import { canWritePrescriptions } from '../utils/prescriptionPermissions';
import AllergyFormModal from '../components/patients/AllergyFormModal';

// ── Formatters ────────────────────────────────────────────────────────────────

function fmtDate(value: string): string {
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(new Date(value));
}

// ── Sub-component: severity badge ────────────────────────────────────────────

const SeverityBadge: React.FC<{ severity: string }> = ({ severity }) => (
  <span className={`badge allergy-severity-badge badge-severity-${severity.toLowerCase()}`}>
    {severity}
  </span>
);

// ── Sub-component: single allergy card ───────────────────────────────────────

interface AllergyCardProps {
  allergy: AllergyResponse;
  canWrite: boolean;
  isDeactivating: boolean;
  isDeleting: boolean;
  onEdit: (a: AllergyResponse) => void;
  onDeactivate: (a: AllergyResponse) => void;
  onDelete: (a: AllergyResponse) => void;
}

const AllergyCard: React.FC<AllergyCardProps> = ({
  allergy,
  canWrite,
  isDeactivating,
  isDeleting,
  onEdit,
  onDeactivate,
  onDelete,
}) => (
  <article className="rx-card allergy-card" aria-label={`Allergy: ${allergy.allergen}`}>
    <div className="rx-card-header">
      <div className="rx-card-drug">
        <span className="rx-drug-name">{allergy.allergen}</span>
        <SeverityBadge severity={allergy.severity} />
        {allergy.status === 'Inactive' && (
          <span className="badge badge-rx-completed">Inactive</span>
        )}
      </div>

      {canWrite && (
        <div className="rx-card-actions">
          {allergy.status === 'Active' && (
            <>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => onEdit(allergy)}
              >
                Edit
              </button>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                disabled={isDeactivating}
                onClick={() => onDeactivate(allergy)}
              >
                {isDeactivating ? 'Deactivating…' : 'Deactivate'}
              </button>
            </>
          )}
          <button
            type="button"
            className="btn btn-danger-outline btn-sm"
            disabled={isDeleting}
            onClick={() => onDelete(allergy)}
          >
            {isDeleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      )}
    </div>

    <dl className="rx-details">
      {allergy.reaction && (
        <div>
          <dt>Reaction</dt>
          <dd>{allergy.reaction}</dd>
        </div>
      )}
      <div>
        <dt>Recorded</dt>
        <dd>
          <time dateTime={allergy.recordedAtUtc}>{fmtDate(allergy.recordedAtUtc)}</time>
        </dd>
      </div>
      <div>
        <dt>Recorded by</dt>
        <dd>
          {allergy.recordedByClinicianEmail}{' '}
          <span className="rx-role">({allergy.recordedByClinicianRole})</span>
        </dd>
      </div>
    </dl>

    {allergy.notes && (
      <p className="rx-notes">
        <span className="rx-notes-label">Notes</span>
        {allergy.notes}
      </p>
    )}
  </article>
);

// ── Main page component ───────────────────────────────────────────────────────

export const PatientAllergiesPage: React.FC = () => {
  const { patientId } = useParams<{ patientId: string }>();
  const { user } = useAuth();
  // Same policy as prescriptions — Doctor + Nurse can write
  const canWrite = canWritePrescriptions(user?.role);

  const [allergies, setAllergies] = useState<AllergyResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editingAllergy, setEditingAllergy] = useState<AllergyResponse | undefined>(undefined);
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // ── Data ────────────────────────────────────────────────────────────────────

  const loadAllergies = useCallback(async () => {
    if (!patientId) return;
    setIsLoading(true);
    setError(null);
    try {
      setAllergies(await allergyApi.list(patientId));
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.status === 404) {
        setError('Patient not found.');
      } else {
        setError('Failed to load allergies. Please refresh the page.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    void loadAllergies();
  }, [loadAllergies]);

  // ── Derived lists ───────────────────────────────────────────────────────────

  const active = allergies.filter((a) => a.status === 'Active');
  const inactive = allergies.filter((a) => a.status === 'Inactive');

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleFormSuccess = (saved: AllergyResponse) => {
    setShowForm(false);
    setEditingAllergy(undefined);
    setAllergies((prev) => {
      const idx = prev.findIndex((a) => a.allergyId === saved.allergyId);
      return idx >= 0
        ? prev.map((a) => (a.allergyId === saved.allergyId ? saved : a))
        : [saved, ...prev];
    });
    setSuccessMessage(
      editingAllergy
        ? `Allergy for ${saved.allergen} updated.`
        : `Allergy to ${saved.allergen} recorded.`,
    );
  };

  const handleDeactivate = async (allergy: AllergyResponse) => {
    if (!patientId) return;
    if (
      !window.confirm(
        `Deactivate "${allergy.allergen}"? It will no longer trigger conflict warnings during prescribing.`,
      )
    )
      return;

    setDeactivatingId(allergy.allergyId);
    setError(null);
    try {
      const updated = await allergyApi.deactivate(patientId, allergy.allergyId);
      setAllergies((prev) =>
        prev.map((a) => (a.allergyId === allergy.allergyId ? updated : a)),
      );
      setSuccessMessage(`Allergy to ${allergy.allergen} deactivated.`);
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.status === 409) {
        setError('This allergy is already inactive.');
      } else {
        setError('Failed to deactivate the allergy. Please try again.');
      }
    } finally {
      setDeactivatingId(null);
    }
  };

  const handleDelete = async (allergy: AllergyResponse) => {
    if (!patientId) return;
    if (
      !window.confirm(
        `Delete the allergy record for "${allergy.allergen}"? This cannot be undone.`,
      )
    )
      return;

    setDeletingId(allergy.allergyId);
    setError(null);
    try {
      await allergyApi.remove(patientId, allergy.allergyId);
      setAllergies((prev) => prev.filter((a) => a.allergyId !== allergy.allergyId));
      setSuccessMessage(`Allergy for ${allergy.allergen} deleted.`);
    } catch {
      setError('Failed to delete the allergy. Please try again.');
    } finally {
      setDeletingId(null);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="table-loading">
        <div className="spinner" />
        <p>Loading allergies…</p>
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
          <h1>Allergies</h1>
          <p className="page-subtitle">
            {active.length} active · {inactive.length} inactive
          </p>
        </div>

        {canWrite && (
          <button
            type="button"
            className="btn btn-danger"
            onClick={() => {
              setEditingAllergy(undefined);
              setShowForm(true);
            }}
          >
            + Record allergy
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

      {/* Active allergies */}
      <section className="card" aria-labelledby="active-allergy-heading">
        <div className="rx-section-header">
          <div>
            <h2 id="active-allergy-heading">Active allergies</h2>
            <p className="page-subtitle">
              These are checked against new prescriptions at the point of care.
            </p>
          </div>
          {active.length > 0 && (
            <span className="badge badge-rx-active">{active.length}</span>
          )}
        </div>

        {active.length === 0 ? (
          <div className="table-empty">
            <p>No active allergies recorded for this patient.</p>
            {canWrite && (
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={() => {
                  setEditingAllergy(undefined);
                  setShowForm(true);
                }}
              >
                Record first allergy
              </button>
            )}
          </div>
        ) : (
          <div className="rx-list">
            {active.map((a) => (
              <AllergyCard
                key={a.allergyId}
                allergy={a}
                canWrite={canWrite}
                isDeactivating={deactivatingId === a.allergyId}
                isDeleting={deletingId === a.allergyId}
                onEdit={(item) => {
                  setEditingAllergy(item);
                  setShowForm(true);
                }}
                onDeactivate={handleDeactivate}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </section>

      {/* Inactive allergies (collapsible) */}
      {inactive.length > 0 && (
        <section className="card rx-history-section" aria-label="Inactive allergies">
          <details className="rx-history-details">
            <summary className="rx-history-summary">
              <span>Inactive allergy history</span>
              <span className="badge badge-inactive">{inactive.length}</span>
            </summary>
            <div className="rx-history-list">
              {inactive.map((a) => (
                <AllergyCard
                  key={a.allergyId}
                  allergy={a}
                  canWrite={canWrite}
                  isDeactivating={false}
                  isDeleting={deletingId === a.allergyId}
                  onEdit={() => undefined}
                  onDeactivate={() => undefined}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          </details>
        </section>
      )}

      {/* Form modal */}
      {showForm && (
        <AllergyFormModal
          patientId={patientId!}
          allergy={editingAllergy}
          onClose={() => {
            setShowForm(false);
            setEditingAllergy(undefined);
          }}
          onSuccess={handleFormSuccess}
        />
      )}
    </div>
  );
};

export default PatientAllergiesPage;
