import axios from 'axios';
import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { medicalRecordApi, type MedicalRecordResponse } from '../api/medicalRecords';
import MedicalRecordFormModal from '../components/patients/MedicalRecordFormModal';
import MedicalRecordVersionTimeline from '../components/patients/MedicalRecordVersionTimeline';
import { useAuth } from '../contexts/AuthContext';
import { canWriteMedicalRecords } from '../utils/permissions';

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'long',
  }).format(new Date(value));
}

export const MedicalRecordDetailPage: React.FC = () => {
  const { patientId, recordId } = useParams<{ patientId: string; recordId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canWrite = canWriteMedicalRecords(user?.role);
  const [record, setRecord] = useState<MedicalRecordResponse | null>(null);
  const [versions, setVersions] = useState<MedicalRecordResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadRecord = useCallback(async () => {
    if (!patientId || !recordId) {
      setError('Invalid medical record address.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const [current, history] = await Promise.all([
        medicalRecordApi.getById(patientId, recordId),
        medicalRecordApi.getVersions(patientId, recordId),
      ]);
      setRecord(current);
      setVersions(history);
    } catch (requestError: unknown) {
      if (axios.isAxiosError(requestError) && requestError.response?.status === 404) {
        setError('Medical record not found or it has been deleted.');
      } else if (axios.isAxiosError(requestError) && requestError.response?.status === 403) {
        setError('You do not have permission to view this medical record.');
      } else {
        setError('Failed to load the medical record.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [patientId, recordId]);

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- route changes load the matching record
    void loadRecord();
  }, [loadRecord]);

  const handleUpdated = (updated: MedicalRecordResponse) => {
    setRecord(updated);
    setIsEditing(false);
    setSuccessMessage(`Version ${updated.version} saved. The previous version remains in the history.`);
    void loadRecord();
  };

  const handleDelete = async () => {
    if (!patientId || !recordId || !record) return;
    if (!window.confirm(`Delete medical record ${record.recordId}? The entry will be archived.`)) return;

    setIsDeleting(true);
    setError(null);
    try {
      await medicalRecordApi.remove(patientId, recordId);
      navigate(`/patients/${patientId}/records`, {
        replace: true,
        state: { message: 'Medical record deleted successfully.' },
      });
    } catch (requestError: unknown) {
      if (axios.isAxiosError(requestError) && requestError.response?.status === 403) {
        setError('You do not have permission to delete medical records.');
      } else if (axios.isAxiosError(requestError) && requestError.response?.status === 404) {
        setError('Medical record not found or already deleted.');
      } else {
        setError('Failed to delete the medical record.');
      }
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return <div className="table-loading"><div className="spinner" /><p>Loading medical record…</p></div>;
  }

  if (!record) {
    return (
      <div className="management-page">
        <div className="alert alert-danger" role="alert">{error ?? 'Medical record not found.'}</div>
        <Link className="btn btn-secondary profile-back-link" to={`/patients/${patientId ?? ''}/records`}>
          ← Back to medical records
        </Link>
      </div>
    );
  }

  return (
    <div className="management-page medical-record-detail-page">
      <div className="page-header">
        <div>
          <Link className="profile-breadcrumb" to={`/patients/${patientId}/records`}>Medical records</Link>
          <h1>Clinical entry</h1>
          <p className="page-subtitle">Record {record.recordId}</p>
        </div>
        {canWrite && (
          <div className="profile-actions">
            <button type="button" className="btn btn-outline" onClick={() => setIsEditing(true)}>Edit record</button>
            <button type="button" className="btn btn-danger-outline" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? 'Deleting…' : 'Delete record'}
            </button>
          </div>
        )}
      </div>

      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      {successMessage && (
        <div className="alert alert-success" role="status">
          <span>{successMessage}</span>
          <button type="button" className="alert-close" onClick={() => setSuccessMessage(null)}>×</button>
        </div>
      )}

      <section className="detail-card">
        <div className="record-card-header">
          <div>
            <span className="badge badge-success">Current · v{record.version}</span>
            <h2 className="detail-section-title">Clinical notes</h2>
          </div>
          <time dateTime={record.authoredAtUtc}>{formatDateTime(record.authoredAtUtc)}</time>
        </div>
        <p className="clinical-notes">{record.clinicalNotes}</p>
        <dl className="record-metadata">
          <div><dt>Author</dt><dd>{record.authorClinicianEmail}</dd></div>
          <div><dt>Role</dt><dd>{record.authorClinicianRole}</dd></div>
          <div><dt>Visit reference</dt><dd><code>{record.visitReference}</code></dd></div>
        </dl>
      </section>

      <section className="detail-card">
        <h2 className="detail-section-title">Conditions</h2>
        {record.conditions.length === 0 ? (
          <p className="condition-empty">No conditions recorded in this version.</p>
        ) : (
          <div className="condition-list">
            {record.conditions.map((condition) => (
              <article className="condition-card" key={condition.conditionId}>
                <div>
                  <strong>{condition.name}</strong>
                  {condition.code && <code>{condition.code}</code>}
                </div>
                <span className={`badge condition-status-${condition.clinicalStatus.toLowerCase()}`}>
                  {condition.clinicalStatus}
                </span>
                {condition.notes && <p>{condition.notes}</p>}
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="detail-card">
        <h2 className="detail-section-title">Version history</h2>
        <p className="page-subtitle">All previous content is retained as a read-only clinical history.</p>
        <MedicalRecordVersionTimeline versions={versions} />
      </section>

      {canWrite && isEditing && patientId && (
        <MedicalRecordFormModal
          patientId={patientId}
          record={record}
          onClose={() => setIsEditing(false)}
          onSuccess={handleUpdated}
        />
      )}
    </div>
  );
};

export default MedicalRecordDetailPage;
