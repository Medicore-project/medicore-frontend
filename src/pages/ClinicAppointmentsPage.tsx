import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { bookedApi, colomboTimeLabel, doctorApi, toDateOnly } from '../api/appointments';
import type { AppointmentSummary, DoctorResponse } from '../api/appointments';
import { extractErrorMessage } from '../utils/apiError';

/** Status values as the appointment service stores them. Mirrors AppointmentStatus. */
const STATUSES = ['Booked', 'Completed', 'Cancelled'] as const;

interface Filters {
  doctorId: string;
  from: string;
  to: string;
  status: string;
}

function defaultFilters(): Filters {
  const today = new Date();
  const weekOut = new Date(today);
  weekOut.setDate(today.getDate() + 6);
  return { doctorId: '', from: toDateOnly(today), to: toDateOnly(weekOut), status: '' };
}

function dayLabel(slotDate: string): string {
  const [year, month, day] = slotDate.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

function statusBadgeClass(status: string): string {
  if (status === 'Booked') return 'badge badge-success';
  return 'badge badge-inactive';
}

/**
 * Every booking in the clinic over a date range — who is coming, to see whom, and when.
 *
 * The front desk's answer to "who booked?". The weekly grid on /appointments shows one doctor at a
 * time; this is the whole clinic in one list, filterable by doctor. Status is filtered here rather
 * than by the service, which returns every status so both screens can decide for themselves.
 */
export const ClinicAppointmentsPage: React.FC = () => {
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [doctors, setDoctors] = useState<DoctorResponse[]>([]);
  const [appointments, setAppointments] = useState<AppointmentSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // First load only. Every later load comes from a filter change, in its handler.
  useEffect(() => {
    let cancelled = false;
    const initial = defaultFilters();

    (async () => {
      try {
        const [doctorList, booked] = await Promise.all([
          doctorApi.list(),
          bookedApi.list({ from: initial.from, to: initial.to }),
        ]);
        if (cancelled) return;
        setDoctors(doctorList);
        setAppointments(booked);
      } catch (err) {
        if (!cancelled) setError(extractErrorMessage(err, 'Failed to load appointments.'));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const load = async (next: Filters) => {
    if (next.from && next.to && next.from > next.to) {
      setError('The start date must not be after the end date.');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      setAppointments(
        await bookedApi.list({
          doctorId: next.doctorId || undefined,
          from: next.from,
          to: next.to,
        }),
      );
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to load appointments.'));
      setAppointments([]);
    } finally {
      setIsLoading(false);
    }
  };

  /** Doctor and dates are server-side filters; status is applied to what is already loaded. */
  const change = (field: keyof Filters, value: string) => {
    const next = { ...filters, [field]: value };
    setFilters(next);
    if (field !== 'status') void load(next);
  };

  const visible = filters.status
    ? appointments.filter((a) => a.status === filters.status)
    : appointments;

  return (
    <div className="management-page clinic-appointments-page">
      <div className="page-header">
        <div>
          <h1>Booked Appointments</h1>
          <p className="page-subtitle">
            Who is booked with which doctor, across the clinic. Times shown in Asia/Colombo.
          </p>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}

      <div className="schedule-toolbar card clinic-appointments-filters">
        <div className="form-group">
          <label htmlFor="booked-doctor">Doctor</label>
          <select
            id="booked-doctor"
            className="filter-select"
            value={filters.doctorId}
            onChange={(e) => change('doctorId', e.target.value)}
          >
            <option value="">All doctors</option>
            {doctors.map((d) => (
              <option key={d.doctorId} value={d.doctorId}>
                {d.fullName}
                {d.specialization ? ` — ${d.specialization}` : ''}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="booked-from">From</label>
          <input
            id="booked-from"
            type="date"
            className="filter-select"
            value={filters.from}
            onChange={(e) => change('from', e.target.value)}
          />
        </div>
        <div className="form-group">
          <label htmlFor="booked-to">To</label>
          <input
            id="booked-to"
            type="date"
            className="filter-select"
            value={filters.to}
            onChange={(e) => change('to', e.target.value)}
          />
        </div>
        <div className="form-group">
          <label htmlFor="booked-status">Status</label>
          <select
            id="booked-status"
            className="filter-select"
            value={filters.status}
            onChange={(e) => change('status', e.target.value)}
          >
            <option value="">Any status</option>
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="card">
        {isLoading ? (
          <p className="schedule-empty">Loading…</p>
        ) : visible.length === 0 ? (
          <div className="schedule-empty schedule-empty--notice">
            <p className="schedule-empty-title">No appointments in this range</p>
            <p className="schedule-empty-hint">Try a wider date range or another doctor.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table" data-testid="clinic-appointments">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Patient</th>
                  <th>Doctor</th>
                  <th>Service</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((a) => (
                  <tr key={a.appointmentId}>
                    <td>{dayLabel(a.slotDate)}</td>
                    <td>
                      {colomboTimeLabel(a.startUtc)}
                      <span className="table-secondary-text">{a.durationMinutes} min</span>
                    </td>
                    <td>
                      <Link to={`/patients/${a.patientId}`} className="font-semibold">
                        {a.patientName ?? 'Unnamed patient'}
                      </Link>
                      {a.patientNumber && (
                        <span className="table-secondary-text">{a.patientNumber}</span>
                      )}
                    </td>
                    <td>
                      {a.doctorName ?? 'Unknown doctor'}
                      {a.specialization && (
                        <span className="table-secondary-text">{a.specialization}</span>
                      )}
                    </td>
                    <td>{a.serviceCode}</td>
                    <td>
                      <span className={statusBadgeClass(a.status)}>{a.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ClinicAppointmentsPage;
