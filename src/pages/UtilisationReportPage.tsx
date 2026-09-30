import React, { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { doctorApi, type DoctorResponse } from '../api/appointments';
import { departmentsApi, type Department } from '../api/departments';
import {
  utilisationReportsApi,
  type DoctorUtilisationRow,
  type UtilisationExportFormat,
  type UtilisationReportFilters,
  type UtilisationReportResponse,
} from '../api/utilisationReports';
import { extractErrorMessage } from '../utils/apiError';
import { triggerBrowserDownload } from '../utils/download';

interface FilterFormState {
  doctorId: string;
  departmentId: string;
  from: string;
  to: string;
}

const EMPTY_FILTERS: FilterFormState = { doctorId: '', departmentId: '', from: '', to: '' };

/**
 * Fixed categorical order, validated for colour-vision deficiency and contrast (the aqua sits
 * under 3:1, so every value is also in the table). Colour follows the measure, never the doctor:
 * no-show is the same orange in both charts.
 */
const SERIES = {
  completed: '#2a78d6',
  noShow: '#eb6834',
  booked: '#1baf7a',
  fill: '#4a3aa7',
} as const;

/**
 * Every bar: a 2px gap in the card's own colour between touching bars, and no entry animation,
 * so the chart is complete the moment it renders — for print, screenshots and slow devices alike.
 */
const BAR = { stroke: '#ffffff', strokeWidth: 2, isAnimationActive: false } as const;

/** Legend text stays in text ink; the swatch beside it carries the series colour. */
function legendLabel(value: string): React.ReactNode {
  return <span className="utilisation-legend-label">{value}</span>;
}

/** At or above this slot fill a doctor is flagged as in high demand — the story's "over-subscribed". */
const HIGH_DEMAND_FILL = 0.9;

function toApiFilters(filters: FilterFormState): UtilisationReportFilters {
  return {
    doctorId: filters.doctorId || undefined,
    departmentId: filters.departmentId || undefined,
    from: filters.from || undefined,
    to: filters.to || undefined,
  };
}

/** A 0–1 rate as a percentage to one place; a dash when there was nothing to divide by. */
function formatPercent(rate: number | null): string {
  return rate === null ? '–' : `${(rate * 100).toFixed(1)}%`;
}

/** A Colombo calendar date (`2026-09-01`) as people read it. Formatted in UTC so it never shifts a day. */
function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeZone: 'UTC' }).format(
    new Date(`${value}T00:00:00Z`),
  );
}

function formatGeneratedAt(value: string): string {
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function describeError(error: unknown, fallback: string): string {
  const status = (error as { response?: { status?: number } })?.response?.status;
  if (status === 403) return 'Only administrators can view this report.';
  return extractErrorMessage(error, fallback);
}

/** Chart height that gives every doctor a readable bar, however many there are. */
function chartHeight(doctorCount: number): number {
  return Math.max(220, doctorCount * 44 + 70);
}

const AppointmentsChart: React.FC<{ doctors: DoctorUtilisationRow[] }> = ({ doctors }) => {
  const data = doctors.map((doctor) => ({
    name: doctor.doctorName,
    completed: doctor.completed,
    noShow: doctor.noShow,
    booked: doctor.booked,
  }));
  const hasData = doctors.some((doctor) => doctor.total > 0);

  return (
    <section className="card demographics-chart-card">
      <div className="demographics-section-heading">
        <h2>Appointments by doctor</h2>
        <p>Completed, no-show and still-booked appointments; cancellations are left out</p>
      </div>
      <div
        className="utilisation-chart"
        style={{ height: hasData ? chartHeight(doctors.length) : 160 }}
        role="img"
        aria-label="Appointments by doctor chart"
      >
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
              <XAxis type="number" allowDecimals={false} stroke="#64748b" fontSize={11} />
              <YAxis type="category" dataKey="name" width={150} stroke="#64748b" fontSize={11} />
              <Tooltip cursor={{ fill: '#f1f5f9' }} />
              <Legend formatter={legendLabel} />
              <Bar dataKey="completed" name="Completed" stackId="appointments" fill={SERIES.completed} {...BAR} />
              <Bar dataKey="noShow" name="No-show" stackId="appointments" fill={SERIES.noShow} {...BAR} />
              <Bar
                dataKey="booked"
                name="Still booked"
                stackId="appointments"
                fill={SERIES.booked}
                radius={[0, 4, 4, 0]}
                {...BAR}
              />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="demographics-chart-empty">No appointments in this period.</p>
        )}
      </div>
    </section>
  );
};

const RatesChart: React.FC<{ doctors: DoctorUtilisationRow[] }> = ({ doctors }) => {
  // One unit, one axis: both measures are percentages of 0–100.
  const data = doctors.map((doctor) => ({
    name: doctor.doctorName,
    noShowPct: doctor.noShowRate === null ? null : Number((doctor.noShowRate * 100).toFixed(1)),
    fillPct: doctor.fillRate === null ? null : Number((doctor.fillRate * 100).toFixed(1)),
  }));
  const hasData = data.some((row) => row.noShowPct !== null || row.fillPct !== null);

  return (
    <section className="card demographics-chart-card">
      <div className="demographics-section-heading">
        <h2>No-show rate and slot fill</h2>
        <p>Where no-shows cost time, and who is close to fully booked</p>
      </div>
      <div
        className="utilisation-chart"
        style={{ height: hasData ? chartHeight(doctors.length) : 160 }}
        role="img"
        aria-label="No-show rate and slot fill chart"
      >
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
              <XAxis type="number" domain={[0, 100]} unit="%" stroke="#64748b" fontSize={11} />
              <YAxis type="category" dataKey="name" width={150} stroke="#64748b" fontSize={11} />
              <Tooltip
                cursor={{ fill: '#f1f5f9' }}
                formatter={(value) => (typeof value === 'number' ? `${value.toFixed(1)}%` : 'No data')}
              />
              <Legend formatter={legendLabel} />
              <Bar dataKey="noShowPct" name="No-show rate" fill={SERIES.noShow} radius={[0, 4, 4, 0]} {...BAR} />
              <Bar dataKey="fillPct" name="Slot fill" fill={SERIES.fill} radius={[0, 4, 4, 0]} {...BAR} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="demographics-chart-empty">No outcomes or slots in this period yet.</p>
        )}
      </div>
    </section>
  );
};

/**
 * The doctor utilisation report (SCRUM-38): which doctors are over-subscribed and where no-shows
 * cost the clinic. Admin only.
 *
 * Opens on every doctor for the current month (the service decides the month, in Colombo time).
 * Doctor, department and dates combine freely; exports carry exactly the filters last applied, so
 * the file always matches the screen.
 */
export const UtilisationReportPage: React.FC = () => {
  const [draftFilters, setDraftFilters] = useState<FilterFormState>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<UtilisationReportFilters>({});
  const [report, setReport] = useState<UtilisationReportResponse | null>(null);
  const [doctors, setDoctors] = useState<DoctorResponse[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [exporting, setExporting] = useState<UtilisationExportFormat | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filterError, setFilterError] = useState<string | null>(null);
  const requestSequence = useRef(0);

  const loadReport = useCallback(async (filters: UtilisationReportFilters) => {
    const requestId = ++requestSequence.current;
    setIsLoading(true);
    setError(null);

    try {
      const response = await utilisationReportsApi.get(filters);
      if (requestId === requestSequence.current) setReport(response);
    } catch (requestError: unknown) {
      if (requestId !== requestSequence.current) return;
      setReport(null);
      setError(describeError(requestError, 'Unable to load the utilisation report. Please try again.'));
    } finally {
      if (requestId === requestSequence.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- the report must load when the route mounts
    void loadReport({});
  }, [loadReport]);

  // The filter choices. Either list failing only narrows the choices to "All"; the report still works.
  useEffect(() => {
    let cancelled = false;
    void Promise.allSettled([doctorApi.list(), departmentsApi.list()]).then(([doctorResult, departmentResult]) => {
      if (cancelled) return;
      if (doctorResult.status === 'fulfilled') setDoctors(doctorResult.value);
      if (departmentResult.status === 'fulfilled') setDepartments(departmentResult.value);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const departmentNames = useMemo(
    () => new Map(departments.map((department) => [String(department.id), department.name])),
    [departments],
  );

  // Choosing a department narrows the doctors offered to that department's.
  const doctorChoices = useMemo(
    () => (draftFilters.departmentId
      ? doctors.filter((doctor) => doctor.departmentId === draftFilters.departmentId)
      : doctors),
    [doctors, draftFilters.departmentId],
  );

  const updateFilter = (field: keyof FilterFormState, value: string) => {
    setDraftFilters((current) => {
      const next = { ...current, [field]: value };
      // A doctor outside the newly chosen department would only ever return nothing.
      if (field === 'departmentId' && value && current.doctorId) {
        const doctor = doctors.find((d) => d.doctorId === current.doctorId);
        if (doctor && doctor.departmentId !== value) next.doctorId = '';
      }
      return next;
    });
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

  const downloadReport = async (format: UtilisationExportFormat) => {
    setExporting(format);
    setError(null);
    try {
      const departmentName = appliedFilters.departmentId
        ? departmentNames.get(appliedFilters.departmentId)
        : undefined;
      const download = await utilisationReportsApi.download(appliedFilters, format, departmentName);
      triggerBrowserDownload(download.blob, download.fileName);
    } catch (downloadError: unknown) {
      setError(describeError(downloadError, `Unable to export the ${format.toUpperCase()} report.`));
    } finally {
      setExporting(null);
    }
  };

  const totals = report?.totals;
  const period = report?.appliedFilters;

  return (
    <div className="management-page demographics-report-page utilisation-report-page">
      <div className="page-header demographics-report-header">
        <div>
          <h1>Doctor Utilisation</h1>
          <p className="page-subtitle">See which doctors are over-subscribed and where no-shows cost time.</p>
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
            <label htmlFor="utilisation-department">Department</label>
            <select
              id="utilisation-department"
              value={draftFilters.departmentId}
              onChange={(event) => updateFilter('departmentId', event.target.value)}
            >
              <option value="">All departments</option>
              {departments.map((department) => (
                <option key={String(department.id)} value={String(department.id)}>{department.name}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="utilisation-doctor">Doctor</label>
            <select
              id="utilisation-doctor"
              value={draftFilters.doctorId}
              onChange={(event) => updateFilter('doctorId', event.target.value)}
            >
              <option value="">All doctors</option>
              {doctorChoices.map((doctor) => (
                <option key={doctor.doctorId} value={doctor.doctorId}>{doctor.fullName}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="utilisation-from">From</label>
            <input
              id="utilisation-from"
              type="date"
              value={draftFilters.from}
              onChange={(event) => updateFilter('from', event.target.value)}
            />
          </div>
          <div className="form-group">
            <label htmlFor="utilisation-to">To</label>
            <input
              id="utilisation-to"
              type="date"
              value={draftFilters.to}
              onChange={(event) => updateFilter('to', event.target.value)}
            />
          </div>
        </div>
        <p className="field-help">Leave the dates empty for the current month.</p>
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
          <p>Preparing utilisation report…</p>
        </div>
      ) : report && totals && period ? (
        <>
          <div className="demographics-report-meta">
            <span data-testid="utilisation-period">
              Showing {formatDate(period.from)} – {formatDate(period.to)}
              {period.isDefaultPeriod ? ' (current month)' : ''}
            </span>
            <span>Generated {formatGeneratedAt(report.generatedAtUtc)}</span>
          </div>

          <section className="demographics-kpi-grid utilisation-kpi-grid" aria-label="Report summary">
            <article className="card demographics-kpi-card">
              <span>Appointments</span>
              <strong>{totals.total.toLocaleString()}</strong>
            </article>
            <article className="card demographics-kpi-card">
              <span>Completed</span>
              <strong>{totals.completed.toLocaleString()}</strong>
            </article>
            <article className="card demographics-kpi-card">
              <span>No-shows</span>
              <strong>{totals.noShow.toLocaleString()}</strong>
            </article>
            <article className="card demographics-kpi-card">
              <span>No-show rate</span>
              <strong>{formatPercent(totals.noShowRate)}</strong>
            </article>
            <article className="card demographics-kpi-card">
              <span>Slot fill</span>
              <strong>{formatPercent(totals.fillRate)}</strong>
            </article>
          </section>

          {report.doctors.length === 0 ? (
            <div className="card table-empty demographics-empty-result">
              <p>No doctors match the selected filters.</p>
              <span>Adjust or reset the filters to broaden the report.</span>
            </div>
          ) : (
            <>
              <div className="demographics-chart-grid">
                <AppointmentsChart doctors={report.doctors} />
                <RatesChart doctors={report.doctors} />
              </div>

              <section className="card table-card demographics-patient-table">
                <div className="demographics-section-heading demographics-table-heading">
                  <h2>By doctor</h2>
                  <p>
                    Total counts every appointment not cancelled. No-show rate is no-shows over completed
                    plus no-shows. Slot fill is used slots over slots not blocked.
                  </p>
                </div>
                <div className="table-responsive">
                  <table className="data-table utilisation-table">
                    <thead>
                      <tr>
                        <th>Doctor</th>
                        <th>Department</th>
                        <th className="num">Completed</th>
                        <th className="num">No-shows</th>
                        <th className="num">Still booked</th>
                        <th className="num">Cancelled</th>
                        <th className="num">Total</th>
                        <th className="num">No-show rate</th>
                        <th className="num">Slot fill</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.doctors.map((doctor) => (
                        <tr key={doctor.doctorId} data-testid="utilisation-row">
                          <td>
                            <span className="utilisation-doctor">{doctor.doctorName}</span>
                            {doctor.specialization && (
                              <span className="utilisation-muted utilisation-specialization">{doctor.specialization}</span>
                            )}
                            {!doctor.isActive && <span className="utilisation-muted"> (inactive)</span>}
                          </td>
                          <td>{departmentNames.get(doctor.departmentId) ?? '–'}</td>
                          <td className="num">{doctor.completed}</td>
                          <td className="num">{doctor.noShow}</td>
                          <td className="num">{doctor.booked}</td>
                          <td className="num">{doctor.cancelled}</td>
                          <td className="num"><strong>{doctor.total}</strong></td>
                          <td className="num">{formatPercent(doctor.noShowRate)}</td>
                          <td className="num">
                            {formatPercent(doctor.fillRate)}
                            <span className="utilisation-muted"> ({doctor.usedSlots}/{doctor.bookableSlots})</span>
                            {doctor.fillRate !== null && doctor.fillRate >= HIGH_DEMAND_FILL && (
                              <span className="badge badge-high-demand">High demand</span>
                            )}
                          </td>
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

export default UtilisationReportPage;
