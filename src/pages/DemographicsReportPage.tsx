import axios from 'axios';
import React, { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  DEMOGRAPHICS_AGE_BANDS,
  DEMOGRAPHICS_GENDERS,
  demographicsReportsApi,
  type DemographicsBreakdownRow,
  type DemographicsExportFormat,
  type DemographicsReportFilters,
  type DemographicsReportResponse,
} from '../api/demographicsReports';

interface FilterFormState {
  ageBand: string;
  gender: string;
  district: string;
  from: string;
  to: string;
}

const EMPTY_FILTERS: FilterFormState = {
  ageBand: '',
  gender: '',
  district: '',
  from: '',
  to: '',
};

const chartColors = {
  patients: '#2563eb',
  visits: '#14b8a6',
  line: '#7c3aed',
};

function toApiFilters(filters: FilterFormState): DemographicsReportFilters {
  return {
    ageBand: filters.ageBand || undefined,
    gender: filters.gender || undefined,
    district: filters.district.trim() || undefined,
    from: filters.from || undefined,
    to: filters.to || undefined,
  };
}

function formatGender(value: string): string {
  return value === 'PreferNotToSay' ? 'Prefer not to say' : value;
}

function formatDateTime(value: string | null): string {
  if (!value) return 'No visits';
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function formatGeneratedAt(value: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function errorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    if (error.response?.status === 403) return 'Only administrators can view this report.';
    if (error.response?.status === 400) return 'The selected report filters are invalid.';
  }
  return fallback;
}

function triggerBrowserDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

const BreakdownChart: React.FC<{
  title: string;
  description: string;
  data: DemographicsBreakdownRow[];
  emptyMessage: string;
}> = ({ title, description, data, emptyMessage }) => {
  const hasData = data.some((item) => item.patientCount > 0 || item.visitCount > 0);

  return (
    <section className="card demographics-chart-card">
      <div className="demographics-section-heading">
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      <div className="demographics-chart" role="img" aria-label={`${title} chart`}>
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="label" tickFormatter={formatGender} stroke="#64748b" fontSize={11} />
              <YAxis allowDecimals={false} stroke="#64748b" fontSize={11} />
              <Tooltip labelFormatter={(label) => (
                typeof label === 'string' ? formatGender(label) : label
              )} />
              <Legend />
              <Bar dataKey="patientCount" name="Patients" fill={chartColors.patients} radius={[4, 4, 0, 0]} />
              <Bar dataKey="visitCount" name="Visits" fill={chartColors.visits} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="demographics-chart-empty">{emptyMessage}</p>
        )}
      </div>
    </section>
  );
};

export const DemographicsReportPage: React.FC = () => {
  const [draftFilters, setDraftFilters] = useState<FilterFormState>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<DemographicsReportFilters>({});
  const [report, setReport] = useState<DemographicsReportResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [exporting, setExporting] = useState<DemographicsExportFormat | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filterError, setFilterError] = useState<string | null>(null);
  const requestSequence = useRef(0);

  const loadReport = useCallback(async (filters: DemographicsReportFilters) => {
    const requestId = ++requestSequence.current;
    setIsLoading(true);
    setError(null);

    try {
      const response = await demographicsReportsApi.get(filters);
      if (requestId === requestSequence.current) setReport(response);
    } catch (requestError: unknown) {
      if (requestId === requestSequence.current) {
        setReport(null);
        setError(errorMessage(requestError, 'Unable to load the demographics report. Please try again.'));
      }
    } finally {
      if (requestId === requestSequence.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- the report must load when the route mounts
    void loadReport({});
  }, [loadReport]);

  const updateFilter = (field: keyof FilterFormState, value: string) => {
    setDraftFilters((current) => ({ ...current, [field]: value }));
    setFilterError(null);
  };

  const applyFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (draftFilters.from && draftFilters.to && draftFilters.from > draftFilters.to) {
      setFilterError('End date must be on or after start date.');
      return;
    }

    const filters = toApiFilters(draftFilters);
    setAppliedFilters(filters);
    void loadReport(filters);
  };

  const resetFilters = () => {
    setDraftFilters(EMPTY_FILTERS);
    setAppliedFilters({});
    setFilterError(null);
    void loadReport({});
  };

  const downloadReport = async (format: DemographicsExportFormat) => {
    setExporting(format);
    setError(null);
    try {
      const download = await demographicsReportsApi.download(appliedFilters, format);
      triggerBrowserDownload(download.blob, download.fileName);
    } catch (downloadError: unknown) {
      setError(errorMessage(downloadError, `Unable to export the ${format.toUpperCase()} report.`));
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="management-page demographics-report-page">
      <div className="page-header demographics-report-header">
        <div>
          <h1>Demographics &amp; Visit History</h1>
          <p className="page-subtitle">Understand active patient demographics and visit demand.</p>
        </div>
        <div className="demographics-export-actions">
          <button
            type="button"
            className="btn btn-outline"
            disabled={!report || isLoading || exporting !== null}
            onClick={() => void downloadReport('Csv')}
          >
            {exporting === 'Csv' ? 'Exporting…' : 'Export CSV'}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!report || isLoading || exporting !== null}
            onClick={() => void downloadReport('Pdf')}
          >
            {exporting === 'Pdf' ? 'Exporting…' : 'Export PDF'}
          </button>
        </div>
      </div>

      <form className="card demographics-filter-panel" onSubmit={applyFilters}>
        <div className="demographics-filter-grid">
          <div className="form-group">
            <label htmlFor="demographics-age-band">Age band</label>
            <select
              id="demographics-age-band"
              value={draftFilters.ageBand}
              onChange={(event) => updateFilter('ageBand', event.target.value)}
            >
              <option value="">All ages</option>
              {DEMOGRAPHICS_AGE_BANDS.map((ageBand) => (
                <option key={ageBand} value={ageBand}>{ageBand}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="demographics-gender">Gender</label>
            <select
              id="demographics-gender"
              value={draftFilters.gender}
              onChange={(event) => updateFilter('gender', event.target.value)}
            >
              <option value="">All genders</option>
              {DEMOGRAPHICS_GENDERS.map((gender) => (
                <option key={gender} value={gender}>{formatGender(gender)}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="demographics-district">District</label>
            <input
              id="demographics-district"
              type="text"
              maxLength={100}
              value={draftFilters.district}
              placeholder="All districts"
              onChange={(event) => updateFilter('district', event.target.value)}
            />
          </div>
          <div className="form-group">
            <label htmlFor="demographics-from">Visit date from</label>
            <input
              id="demographics-from"
              type="date"
              value={draftFilters.from}
              onChange={(event) => updateFilter('from', event.target.value)}
            />
          </div>
          <div className="form-group">
            <label htmlFor="demographics-to">Visit date to</label>
            <input
              id="demographics-to"
              type="date"
              value={draftFilters.to}
              onChange={(event) => updateFilter('to', event.target.value)}
            />
          </div>
        </div>
        {filterError && <p className="field-error" role="alert">{filterError}</p>}
        <div className="demographics-filter-actions">
          <button type="button" className="btn btn-secondary" disabled={isLoading} onClick={resetFilters}>
            Reset
          </button>
          <button type="submit" className="btn btn-primary" disabled={isLoading}>
            {isLoading ? 'Loading…' : 'Apply filters'}
          </button>
        </div>
      </form>

      {error && (
        <div className="alert alert-danger" role="alert">
          <span>{error}</span>
          <button type="button" className="alert-close" aria-label="Dismiss error" onClick={() => setError(null)}>×</button>
        </div>
      )}

      {isLoading ? (
        <div className="card table-loading demographics-loading">
          <div className="spinner" />
          <p>Preparing demographics report…</p>
        </div>
      ) : report ? (
        <>
          <div className="demographics-report-meta">
            <span>Generated {formatGeneratedAt(report.generatedAtUtc)}</span>
            <span>{report.totalPatients} active patient{report.totalPatients === 1 ? '' : 's'} in this result</span>
          </div>

          <section className="demographics-kpi-grid" aria-label="Report summary">
            <article className="card demographics-kpi-card">
              <span>Total patients</span>
              <strong>{report.totalPatients.toLocaleString()}</strong>
            </article>
            <article className="card demographics-kpi-card">
              <span>Total visits</span>
              <strong>{report.totalVisits.toLocaleString()}</strong>
            </article>
            <article className="card demographics-kpi-card">
              <span>Patients with visits</span>
              <strong>{report.patientsWithVisits.toLocaleString()}</strong>
            </article>
            <article className="card demographics-kpi-card">
              <span>Patients without visits</span>
              <strong>{report.patientsWithoutVisits.toLocaleString()}</strong>
            </article>
          </section>

          {report.totalPatients === 0 ? (
            <div className="card table-empty demographics-empty-result">
              <p>No active patients match the selected filters.</p>
              <span>Adjust or reset the filters to broaden the report.</span>
            </div>
          ) : (
            <>
              <div className="demographics-chart-grid">
                <BreakdownChart
                  title="Age breakdown"
                  description="Patients and visits by age band"
                  data={report.ageBands}
                  emptyMessage="No age-band data is available."
                />
                <BreakdownChart
                  title="Gender breakdown"
                  description="Patients and visits by gender"
                  data={report.genders}
                  emptyMessage="No gender data is available."
                />
              </div>

              <div className="demographics-chart-grid">
                <BreakdownChart
                  title="District breakdown"
                  description="Patients and visits by district"
                  data={report.districts}
                  emptyMessage="No district data is available."
                />
                <section className="card demographics-chart-card">
                  <div className="demographics-section-heading">
                    <h2>Visit history</h2>
                    <p>Completed visits by month</p>
                  </div>
                  <div className="demographics-chart" role="img" aria-label="Visit history chart">
                    {report.visitHistory.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={report.visitHistory} margin={{ top: 8, right: 16, left: -12, bottom: 4 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                          <XAxis dataKey="period" stroke="#64748b" fontSize={11} />
                          <YAxis allowDecimals={false} stroke="#64748b" fontSize={11} />
                          <Tooltip />
                          <Line
                            type="monotone"
                            dataKey="visitCount"
                            name="Visits"
                            stroke={chartColors.line}
                            strokeWidth={3}
                            dot={{ r: 4 }}
                            activeDot={{ r: 6 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <p className="demographics-chart-empty">No visits match the selected filters.</p>
                    )}
                  </div>
                </section>
              </div>

              <section className="card table-card demographics-patient-table">
                <div className="demographics-section-heading demographics-table-heading">
                  <h2>Patient summary</h2>
                  <p>Active patients included in this report</p>
                </div>
                <div className="table-responsive">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Patient number</th>
                        <th>Age</th>
                        <th>Age band</th>
                        <th>Gender</th>
                        <th>District</th>
                        <th>Visits</th>
                        <th>First visit</th>
                        <th>Latest visit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.patients.map((patient) => (
                        <tr key={patient.patientId}>
                          <td><span className="patient-number-small">{patient.patientNumber}</span></td>
                          <td>{patient.age}</td>
                          <td>{patient.ageBand}</td>
                          <td>{formatGender(patient.gender)}</td>
                          <td>{patient.district}</td>
                          <td>{patient.visitCount}</td>
                          <td className="text-muted demographics-date-cell">{formatDateTime(patient.firstVisitAtUtc)}</td>
                          <td className="text-muted demographics-date-cell">{formatDateTime(patient.latestVisitAtUtc)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
        </>
      ) : null}
    </div>
  );
};

export default DemographicsReportPage;
