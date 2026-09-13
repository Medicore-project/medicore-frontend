import axios from 'axios';
import React, { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { patientApi, type PatientSearchResult } from '../api/patients';

const PAGE_SIZE = 20;

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
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('q')?.trim() ?? '';
  const page = readPage(searchParams.get('page'));
  const [searchInput, setSearchInput] = useState(query);
  const [items, setItems] = useState<PatientSearchResult[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [hasPreviousPage, setHasPreviousPage] = useState(false);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [isLoading, setIsLoading] = useState(Boolean(query));
  const [error, setError] = useState<string | null>(null);
  const requestSequence = useRef(0);

  const clearResults = useCallback(() => {
    setItems([]);
    setTotalCount(0);
    setTotalPages(0);
    setHasPreviousPage(false);
    setHasNextPage(false);
  }, []);

  const loadPatients = useCallback(async () => {
    if (!query) return;

    const requestId = ++requestSequence.current;
    setIsLoading(true);
    setError(null);

    try {
      const response = await patientApi.search({ q: query, page, pageSize: PAGE_SIZE });
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
  }, [clearResults, page, query]);

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- browser navigation must synchronize the URL-backed search form
    setSearchInput(query);

    if (!query) {
      requestSequence.current++;
      clearResults();
      setError(null);
      setIsLoading(false);
      return;
    }

    void loadPatients();
  }, [clearResults, loadPatients, query]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedQuery = searchInput.trim();

    if (!normalizedQuery) {
      requestSequence.current++;
      setSearchParams({});
      clearResults();
      setError(null);
      setIsLoading(false);
      return;
    }

    setSearchInput(normalizedQuery);
    if (normalizedQuery === query && page === 1) {
      void loadPatients();
      return;
    }

    setSearchParams({ q: normalizedQuery, page: '1' });
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
        <Link className="btn btn-primary" to="/patients/register">
          + Register Patient
        </Link>
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
          placeholder="Enter patient name, NIC or patient number…"
          onChange={(event) => setSearchInput(event.target.value)}
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

      {query && !error && !isLoading && (
        <p className="patient-search-summary">
          {totalCount} patient{totalCount === 1 ? '' : 's'} found for “{query}”
        </p>
      )}

      <div className="card table-card">
        {isLoading ? (
          <div className="table-loading">
            <div className="spinner" />
            <p>Searching patients…</p>
          </div>
        ) : !query ? (
          <div className="table-empty">
            <p>Enter a name, NIC or patient number to find a patient.</p>
          </div>
        ) : items.length === 0 ? (
          <div className="table-empty">
            <p>No patients found.</p>
            <span>Check the search details or register a new patient.</span>
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
                    <td><span className="patient-number-small">{patient.patientNumber}</span></td>
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
                        onClick={() => navigate(`/patients/${patient.patientId}`, {
                          state: { patientSearch: searchState },
                        })}
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

      {query && totalPages > 1 && !isLoading && (
        <div className="pagination-bar">
          <span className="pagination-info">Page {page} of {totalPages}</span>
          <div className="action-buttons">
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              disabled={!hasPreviousPage}
              onClick={() => changePage(page - 1)}
            >
              ← Previous
            </button>
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              disabled={!hasNextPage}
              onClick={() => changePage(page + 1)}
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PatientSearchPage;
