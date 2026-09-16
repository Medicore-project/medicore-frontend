import axios from 'axios';
import React, { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { patientApi, type PatientSearchResult } from '../api/patients';
import { useAuth } from '../contexts/AuthContext';
import { canManagePatientProfiles } from '../utils/permissions';

const PAGE_SIZE = 20;
const DEBOUNCE_MS = 400;

function readPage(value: string | null): number {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' })
    .format(new Date(`${value}T00:00:00`));
}

export const PatientSearchPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canManagePatients = canManagePatientProfiles(user?.role);
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('q')?.trim() ?? '';
  const page = readPage(searchParams.get('page'));
  const [searchInput, setSearchInput] = useState(query);
  const [items, setItems] = useState<PatientSearchResult[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [hasPreviousPage, setHasPreviousPage] = useState(false);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestSequence = useRef(0);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearResults = useCallback(() => {
    setItems([]);
    setTotalCount(0);
    setTotalPages(0);
    setHasPreviousPage(false);
    setHasNextPage(false);
  }, []);

  const loadPatients = useCallback(async (searchQuery: string, searchPage: number) => {

    const requestId = ++requestSequence.current;
    setIsLoading(true);
    setError(null);

    try {
      const response = await patientApi.search({ q: searchQuery, page: searchPage, pageSize: PAGE_SIZE });
      if (requestId !== requestSequence.current) return;

      setItems(response.items);
      setTotalCount(response.totalCount);
      setTotalPages(response.totalPages);
      setHasPreviousPage(response.hasPreviousPage);
      setHasNextPage(response.hasNextPage);
    } catch (requestError: unknown) {
      if (requestId !== requestSequence.current) return;

      clearResults();
      if (axios.isAxiosError(requestError) && requestError.response?.status === 403) {
        setError('You do not have permission to search patients.');
      } else {
        setError('Patient search failed. Please try again.');
      }
    } finally {
      if (requestId === requestSequence.current) setIsLoading(false);
    }
  }, [clearResults]);

  // Sync URL -> input on back/forward navigation and execute fetch
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- browser navigation must synchronize the URL-backed search form
    setSearchInput(query);

    void loadPatients(query, page);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, page]);

  // Debounced live search — fires 400ms after the user stops typing
  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setSearchInput(value);

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    const normalized = value.trim();

    // Show spinner immediately so the UI feels responsive
    setIsLoading(true);

    debounceTimer.current = setTimeout(() => {
      // Updating the URL param triggers the useEffect above which runs the fetch
      if (normalized) {
        setSearchParams({ q: normalized, page: '1' });
      } else {
        setSearchParams({ page: '1' });
      }
    }, DEBOUNCE_MS);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    const normalizedQuery = searchInput.trim();

    setSearchInput(normalizedQuery);

    if (normalizedQuery === query && page === 1) {
      void loadPatients(normalizedQuery, 1);
      return;
    }

    if (normalizedQuery) {
      setSearchParams({ q: normalizedQuery, page: '1' });
    } else {
      setSearchParams({ page: '1' });
    }
  };

  const changePage = (nextPage: number) => {
    setSearchParams({ q: query, page: String(nextPage) });
  };

  const searchState = searchParams.toString();

  return (
    <div className="management-page patient-search-page">
      <div className="page-header">
        <div>
          <h1>Patient Search</h1>
          <p className="page-subtitle">Find an active patient by name, NIC or patient number.</p>
        </div>
        {canManagePatients && (
          <Link className="btn btn-primary" to="/patients/register">
            + Register Patient
          </Link>
        )}
      </div>

      <form className="card patient-search-bar" role="search" onSubmit={handleSubmit}>
        <label className="sr-only" htmlFor="patient-search">Search patients</label>
        <input
          id="patient-search"
          type="search"
          className="filter-search"
          value={searchInput}
          maxLength={100}
          autoComplete="off"
          placeholder="Type patient name, NIC or patient number…"
          onChange={handleInputChange}
        />
        <button type="submit" className="btn btn-primary" disabled={isLoading}>
          {isLoading ? 'Searching…' : 'Search'}
        </button>
      </form>

      {error && (
        <div className="alert alert-danger" role="alert">
          <span>{error}</span>
          <button type="button" className="alert-close" onClick={() => setError(null)}>×</button>
        </div>
      )}

      {!error && !isLoading && (
        <p className="patient-search-summary">
          {query ? (
            <>{totalCount} patient{totalCount === 1 ? '' : 's'} found for &ldquo;{query}&rdquo;</>
          ) : (
            <>{totalCount} patient{totalCount === 1 ? '' : 's'} total</>
          )}
        </p>
      )}

      <div className="card table-card">
        {isLoading ? (
          <div className="table-loading">
            <div className="spinner" />
            <p>Searching patients…</p>
          </div>
        ) : items.length === 0 ? (
          <div className="table-empty">
            <p>No patients found.</p>
            <span>
              {canManagePatients
                ? 'Check the search details or register a new patient.'
                : 'Check the search details and try again.'}
            </span>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Patient Number</th>
                  <th>NIC</th>
                  <th>Date of Birth</th>
                  <th>Contact</th>
                  <th>District</th>
                  <th className="patient-search-actions-heading">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((patient) => (
                  <tr key={patient.patientId}>
                    <td className="font-semibold">{patient.fullName}</td>
                    <td>
                      <span className="patient-number-small">{patient.patientNumber}</span>
                    </td>
                    <td>{patient.nic}</td>
                    <td>{formatDate(patient.dateOfBirth)}</td>
                    <td>
                      <div className="patient-search-contact">
                        <span>{patient.phone}</span>
                        <span className="text-muted">{patient.email}</span>
                      </div>
                    </td>
                    <td>{patient.district}</td>
                    <td className="patient-search-actions">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline"
                        onClick={() =>
                          navigate(`/patients/${patient.patientId}`, {
                            state: { patientSearch: searchState },
                          })
                        }
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {totalPages > 1 && !isLoading && (
        <div className="pagination-bar">
          <span className="pagination-info">
            Page {page} of {totalPages}
          </span>
          <div className="action-buttons">
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              disabled={!hasPreviousPage}
              onClick={() => changePage(page - 1)}
            >
              &larr; Previous
            </button>
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              disabled={!hasNextPage}
              onClick={() => changePage(page + 1)}
            >
              Next &rarr;
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PatientSearchPage;
