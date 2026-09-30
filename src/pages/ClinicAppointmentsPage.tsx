import React, { useEffect, useState } from 'react';
import { bookedApi, doctorApi, toDateOnly } from '../api/appointments';
import type { AppointmentSummary, DoctorResponse } from '../api/appointments';
import BookedStats from '../components/appointments/BookedStats';
import BookedTable from '../components/appointments/BookedTable';
import {
  CalendarIcon,
  ChevronDownIcon,
  LayersIcon,
  PinIcon,
  SearchIcon,
  UserIcon,
} from '../components/icons/LineIcons';
import { useAuth } from '../contexts/AuthContext';
import { extractErrorMessage } from '../utils/apiError';

/** Status values as the appointment service stores them. Mirrors AppointmentStatus. */
const STATUSES = ['Booked', 'Completed', 'Cancelled', 'NoShow'] as const;

interface Filters {
  doctorId: string;
  from: string;
  to: string;
  status: string;
}

/**
 * The coming week, for the whole clinic — or, for a doctor, for themselves. A doctor opening this
 * page wants "who is booked with me"; they can still switch to All doctors, as the weekly grid lets
 * them browse any doctor.
 */
function defaultFilters(ownDoctorId: string): Filters {
  const today = new Date();
  const weekOut = new Date(today);
  weekOut.setDate(today.getDate() + 6);
  return { doctorId: ownDoctorId, from: toDateOnly(today), to: toDateOnly(weekOut), status: '' };
}

/**
 * Every booking over a date range — who is coming, to see whom, and when.
 *
 * The weekly grid on /appointments shows one doctor at a time; this is the clinic in one list.
 * Doctor and dates are sent to the service; status is applied here, because the service returns
 * every status and the counts across the top describe all of them.
 *
 * Filters apply on "Apply Filters", not on every change: the fields are a draft, `applied` is what
 * the table shows, so half-typed dates never fire a request.
 */
export const ClinicAppointmentsPage: React.FC = () => {
  const { user } = useAuth();
  const ownDoctorId = user?.role === 'Doctor' && user.staffId ? user.staffId : '';

  const [draft, setDraft] = useState<Filters>(() => defaultFilters(ownDoctorId));
  const [applied, setApplied] = useState<Filters>(() => defaultFilters(ownDoctorId));
  const [doctors, setDoctors] = useState<DoctorResponse[]>([]);
  const [appointments, setAppointments] = useState<AppointmentSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // First load only. Every later load comes from Apply Filters, in its handler.
  useEffect(() => {
    let cancelled = false;
    const initial = defaultFilters(ownDoctorId);

    (async () => {
      try {
        const [doctorList, booked] = await Promise.all([
          doctorApi.list(),
          bookedApi.list({
            doctorId: initial.doctorId || undefined,
            from: initial.from,
            to: initial.to,
          }),
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
  }, [ownDoctorId]);

  const applyFilters = async (e?: React.FormEvent) => {
    e?.preventDefault();

    if (!draft.from || !draft.to) {
      setError('Choose both a start and an end date.');
      return;
    }
    if (draft.from > draft.to) {
      setError('The start date must not be after the end date.');
      return;
    }

    // Status alone is a local filter; no need to ask the service again.
    const serverFiltersChanged =
      draft.doctorId !== applied.doctorId || draft.from !== applied.from || draft.to !== applied.to;
    setApplied(draft);
    setError(null);
    if (!serverFiltersChanged) return;

    setIsLoading(true);
    try {
      setAppointments(
        await bookedApi.list({
          doctorId: draft.doctorId || undefined,
          from: draft.from,
          to: draft.to,
        }),
      );
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to load appointments.'));
      setAppointments([]);
    } finally {
      setIsLoading(false);
    }
  };

  const change = (field: keyof Filters, value: string) =>
    setDraft((current) => ({ ...current, [field]: value }));

  const visible = applied.status
    ? appointments.filter((a) => a.status === applied.status)
    : appointments;

  // A doctor whose own profile is not (yet) in the bookable cache still gets an option for
  // themselves, rather than a select showing a value it has no option for.
  const ownDoctorMissing = ownDoctorId !== '' && !doctors.some((d) => d.doctorId === ownDoctorId);

  return (
    <div className="booked-page">
      <section className="booked-hero">
        <span className="booked-tile">
          <CalendarIcon />
        </span>
        <div className="booked-hero-text">
          <h1>Booked Appointments</h1>
          <p>View and manage all booked appointments across the clinic.</p>
        </div>
        <div className="booked-timezone">
          <PinIcon className="booked-timezone-icon" />
          <span>
            <span className="booked-timezone-label">Times shown in</span>
            <strong>Asia/Colombo</strong>
          </span>
        </div>
      </section>

      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}

      <BookedStats appointments={appointments} />

      <form className="booked-filters" onSubmit={(e) => void applyFilters(e)}>
        <div className="booked-field booked-field--doctor">
          <label htmlFor="booked-doctor">Doctor</label>
          <div className="booked-input">
            <UserIcon className="booked-input-icon" />
            <select
              id="booked-doctor"
              value={draft.doctorId}
              onChange={(e) => change('doctorId', e.target.value)}
            >
              <option value="">All doctors</option>
              {ownDoctorMissing && <option value={ownDoctorId}>You</option>}
              {doctors.map((d) => (
                <option key={d.doctorId} value={d.doctorId}>
                  {d.fullName}
                  {d.specialization ? ` — ${d.specialization}` : ''}
                </option>
              ))}
            </select>
            <ChevronDownIcon className="booked-input-chevron" />
          </div>
        </div>
        <div className="booked-field">
          <label htmlFor="booked-from">From Date</label>
          <div className="booked-input">
            <CalendarIcon className="booked-input-icon" />
            <input
              id="booked-from"
              type="date"
              value={draft.from}
              onChange={(e) => change('from', e.target.value)}
            />
          </div>
        </div>
        <div className="booked-field">
          <label htmlFor="booked-to">To Date</label>
          <div className="booked-input">
            <CalendarIcon className="booked-input-icon" />
            <input
              id="booked-to"
              type="date"
              value={draft.to}
              onChange={(e) => change('to', e.target.value)}
            />
          </div>
        </div>
        <div className="booked-field">
          <label htmlFor="booked-status">Status</label>
          <div className="booked-input">
            <LayersIcon className="booked-input-icon" />
            <select
              id="booked-status"
              value={draft.status}
              onChange={(e) => change('status', e.target.value)}
            >
              <option value="">Any status</option>
              {STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status === 'NoShow' ? 'No-show' : status}
                </option>
              ))}
            </select>
            <ChevronDownIcon className="booked-input-chevron" />
          </div>
        </div>
        <button type="submit" className="booked-apply" disabled={isLoading}>
          <SearchIcon className="booked-btn-icon" />
          Apply Filters
        </button>
      </form>

      <BookedTable rows={visible} isLoading={isLoading} />
    </div>
  );
};

export default ClinicAppointmentsPage;
