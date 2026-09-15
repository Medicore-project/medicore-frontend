import axios from 'axios';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  medicalRecordApi,
  type MedicalRecordResponse,
  type PagedMedicalRecordResponse,
} from '../api/medicalRecords';
import MedicalRecordFormModal from '../components/patients/MedicalRecordFormModal';
import MedicalRecordTimeline from '../components/patients/MedicalRecordTimeline';
import { useAuth } from '../contexts/AuthContext';
import { countNewMedicalRecords, mergeRefreshedMedicalRecords } from '../utils/medicalRecordTimeline';
import { canWriteMedicalRecords } from '../utils/permissions';

const PAGE_SIZE = 10;
const TIMELINE_REFRESH_INTERVAL_MS = 30_000;

export const PatientMedicalRecordsPage: React.FC = () => {
  const { patientId } = useParams<{ patientId: string }>();
  const { user } = useAuth();
  const canWrite = canWriteMedicalRecords(user?.role);
  const [result, setResult] = useState<PagedMedicalRecordResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const resultRef = useRef<PagedMedicalRecordResponse | null>(null);
  const refreshInFlightRef = useRef(false);

  const loadRecords = useCallback(async (requestedPage = 1, append = false, background = false) => {
    if (!patientId) {
      if (!background) {
        setError('Invalid patient identifier.');
        setIsLoading(false);
      }
      return;
    }

    if (background) {
      if (refreshInFlightRef.current) return;
      refreshInFlightRef.current = true;
      setIsRefreshing(true);
      setRefreshError(null);
    } else {
      if (append) setIsLoadingMore(true);
      else setIsLoading(true);
      setError(null);
    }

    try {
      const response = await medicalRecordApi.list(patientId, {
        page: requestedPage,
        pageSize: PAGE_SIZE,
      });

      if (background) {
        const newRecordCount = countNewMedicalRecords(resultRef.current, response);
        if (newRecordCount > 0) {
          setRefreshMessage(
            `Timeline updated with ${newRecordCount} new completed appointment${newRecordCount === 1 ? '' : 's'}.`,
          );
        }
      }

      setResult((current) => {
        let next: PagedMedicalRecordResponse;
        if (background) {
          next = mergeRefreshedMedicalRecords(current, response);
        } else if (!append || !current) {
          next = response;
        } else {
          const recordsById = new Map(current.items.map((record) => [record.recordId, record]));
          response.items.forEach((record) => recordsById.set(record.recordId, record));
          next = { ...response, items: [...recordsById.values()] };
        }

        resultRef.current = next;
        return next;
      });
    } catch (requestError: unknown) {
      if (background) {
        setRefreshError('Automatic timeline refresh failed. Existing records are still available.');
      } else if (axios.isAxiosError(requestError) && requestError.response?.status === 404) {
        setError('Patient not found or the profile has been deleted.');
      } else if (axios.isAxiosError(requestError) && requestError.response?.status === 403) {
        setError('You do not have permission to view this patient’s medical records.');
      } else {
        setError('Failed to load medical records.');
      }
    } finally {
      if (background) {
        refreshInFlightRef.current = false;
        setIsRefreshing(false);
      } else if (append) setIsLoadingMore(false);
      else setIsLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- route and page changes load the matching records
    void loadRecords(1);
  }, [loadRecords]);

  useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void loadRecords(1, false, true);
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') refreshWhenVisible();
    };

    const refreshTimer = window.setInterval(refreshWhenVisible, TIMELINE_REFRESH_INTERVAL_MS);
    window.addEventListener('focus', refreshWhenVisible);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.clearInterval(refreshTimer);
      window.removeEventListener('focus', refreshWhenVisible);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [loadRecords]);

  const handleCreated = (record: MedicalRecordResponse) => {
    setIsCreating(false);
    setSuccessMessage(`Medical record version ${record.version} created successfully.`);
    void loadRecords(1);
  };

  return (
    <div className="management-page medical-records-page">
      <div className="page-header">
        <div>
          <Link className="profile-breadcrumb" to={`/patients/${patientId ?? ''}`}>Patient profile</Link>
          <h1>Medical records</h1>
          <p className="page-subtitle">Patient ID: <strong>{patientId}</strong></p>
        </div>
        {canWrite && (
          <button type="button" className="btn btn-primary" onClick={() => setIsCreating(true)} disabled={!patientId}>
            New medical record
          </button>
        )}
      </div>

      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      {successMessage && (
        <div className="alert alert-success" role="status">
          <span>{successMessage}</span>
          <button type="button" className="alert-close" onClick={() => setSuccessMessage(null)}>×</button>
        </div>
      )}

      <section className="detail-card medical-timeline-section">
        {(isRefreshing || refreshMessage || refreshError) && (
          <div className={`timeline-refresh-status${refreshError ? ' timeline-refresh-error' : ''}`} role="status">
            {isRefreshing
              ? 'Checking for completed appointments…'
              : refreshError ?? refreshMessage}
          </div>
        )}
        {isLoading ? (
          <div className="table-loading"><div className="spinner" /><p>Loading medical records…</p></div>
        ) : result && result.items.length > 0 ? (
          <>
            <div className="medical-timeline-heading">
              <div>
                <h2>Clinical timeline</h2>
                <p>{result.totalCount} current entr{result.totalCount === 1 ? 'y' : 'ies'}, newest first</p>
              </div>
            </div>
            <MedicalRecordTimeline patientId={patientId ?? ''} records={result.items} />
            <div className="timeline-pagination">
              <span className="pagination-info">
                Showing {result.items.length} of {result.totalCount} entries
              </span>
              {result.hasNextPage && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => void loadRecords(result.page + 1, true)}
                  disabled={isLoadingMore}
                >
                  {isLoadingMore ? 'Loading…' : 'Load older entries'}
                </button>
              )}
            </div>
          </>
        ) : (
          <div className="table-empty">
            <strong>No medical records yet</strong>
            <p>{canWrite ? 'Add the first clinical entry for this patient.' : 'No clinical entries are available.'}</p>
          </div>
        )}
      </section>

      {canWrite && isCreating && patientId && (
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
