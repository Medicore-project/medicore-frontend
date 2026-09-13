import axios from 'axios';
import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  medicalRecordApi,
  type MedicalRecordResponse,
  type PagedMedicalRecordResponse,
} from '../api/medicalRecords';
import MedicalRecordFormModal from '../components/patients/MedicalRecordFormModal';

const PAGE_SIZE = 10;

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export const PatientMedicalRecordsPage: React.FC = () => {
  const { patientId } = useParams<{ patientId: string }>();
  const [result, setResult] = useState<PagedMedicalRecordResponse | null>(null);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadRecords = useCallback(async () => {
    if (!patientId) {
      setError('Invalid patient identifier.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      setResult(await medicalRecordApi.list(patientId, { page, pageSize: PAGE_SIZE }));
    } catch (requestError: unknown) {
      if (axios.isAxiosError(requestError) && requestError.response?.status === 404) {
        setError('Patient not found or the profile has been deleted.');
      } else if (axios.isAxiosError(requestError) && requestError.response?.status === 403) {
        setError('You do not have permission to view this patient’s medical records.');
      } else {
        setError('Failed to load medical records.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [page, patientId]);

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- route and page changes load the matching records
    void loadRecords();
  }, [loadRecords]);

  const handleCreated = (record: MedicalRecordResponse) => {
    setIsCreating(false);
    setSuccessMessage(`Medical record version ${record.version} created successfully.`);
    setPage(1);
    void loadRecords();
  };

  return (
    <div className="management-page medical-records-page">
      <div className="page-header">
        <div>
          <Link className="profile-breadcrumb" to={`/patients/${patientId ?? ''}`}>Patient profile</Link>
          <h1>Medical records</h1>
          <p className="page-subtitle">Patient ID: <strong>{patientId}</strong></p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setIsCreating(true)} disabled={!patientId}>
          New medical record
        </button>
      </div>

      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      {successMessage && (
        <div className="alert alert-success" role="status">
          <span>{successMessage}</span>
          <button type="button" className="alert-close" onClick={() => setSuccessMessage(null)}>×</button>
        </div>
      )}

      <section className="table-card">
        {isLoading ? (
          <div className="table-loading"><div className="spinner" /><p>Loading medical records…</p></div>
        ) : result && result.items.length > 0 ? (
          <>
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Authored</th>
                    <th>Clinician</th>
                    <th>Role</th>
                    <th>Visit reference</th>
                    <th>Version</th>
                    <th aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {result.items.map((record) => (
                    <tr key={record.recordId}>
                      <td>{formatDateTime(record.authoredAtUtc)}</td>
                      <td>
                        <span className="font-semibold">{record.authorClinicianEmail}</span>
                        <small className="table-secondary-text">{record.authorClinicianId}</small>
                      </td>
                      <td><span className="badge badge-inactive">{record.authorClinicianRole}</span></td>
                      <td><code>{record.visitReference}</code></td>
                      <td><span className="badge badge-success">v{record.version}</span></td>
                      <td>
                        <Link
                          className="btn btn-outline btn-sm"
                          to={`/patients/${patientId}/records/${record.recordId}`}
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="pagination-bar">
              <span className="pagination-info">
                Page {result.page} of {Math.max(result.totalPages, 1)} · {result.totalCount} records
              </span>
              <div className="action-buttons">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setPage((current) => current - 1)}
                  disabled={!result.hasPreviousPage}
                >
                  Previous
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setPage((current) => current + 1)}
                  disabled={!result.hasNextPage}
                >
                  Next
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="table-empty">
            <strong>No medical records yet</strong>
            <p>Add the first clinical entry for this patient.</p>
          </div>
        )}
      </section>

      {isCreating && patientId && (
        <MedicalRecordFormModal
          patientId={patientId}
          onClose={() => setIsCreating(false)}
          onSuccess={handleCreated}
        />
      )}
    </div>
  );
};

export default PatientMedicalRecordsPage;
