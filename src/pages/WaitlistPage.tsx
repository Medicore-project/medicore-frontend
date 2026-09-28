import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { colomboTimeLabel, doctorApi, toDateOnly } from '../api/appointments';
import type { DoctorResponse } from '../api/appointments';
import {
  ACTIVE_WAITLIST_FILTER,
  WaitlistStatus,
  staffWaitlistApi,
} from '../api/waitlist';
import type { WaitlistEntry, WaitlistStatusFilter } from '../api/waitlist';
import AppointmentTextDialog from '../components/appointments/AppointmentTextDialog';
import {
  CalendarIcon,
  CheckIcon,
  ChevronDownIcon,
  ClockIcon,
  LayersIcon,
  ListIcon,
  PinIcon,
  SearchIcon,
  UserIcon,
} from '../components/icons/LineIcons';
import { useAuth } from '../contexts/AuthContext';
import { extractErrorMessage } from '../utils/apiError';
import { dayLabel } from '../utils/bookedAppointments';
import { colomboDateTimeLabel } from '../utils/bookingLabels';
import { canChangeAppointments } from '../utils/permissions';

/** The service's limit on a removal reason. */
const MAX_REASON_LENGTH = 500;

/** An offer lapsing within this many minutes is called out, so the desk phones those first. */
const EXPIRING_SOON_MINUTES = 15;

const STATUS_OPTIONS: Array<{ value: WaitlistStatusFilter | ''; label: string }> = [
  { value: ACTIVE_WAITLIST_FILTER, label: 'Waiting or offered' },
  { value: WaitlistStatus.Waiting, label: 'Waiting' },
  { value: WaitlistStatus.Offered, label: 'Offered' },
  { value: WaitlistStatus.Accepted, label: 'Accepted' },
  { value: WaitlistStatus.Declined, label: 'Declined' },
  { value: WaitlistStatus.Expired, label: 'Expired' },
  { value: WaitlistStatus.Withdrawn, label: 'Withdrawn' },
  { value: '', label: 'Any status' },
];

interface Filters {
  doctorId: string;
  from: string;
  to: string;
  status: WaitlistStatusFilter | '';
}

/** The next two weeks, waiting and offered — or, for a doctor, their own queues. */
function defaultFilters(ownDoctorId: string): Filters {
  const today = new Date();
  const twoWeeksOut = new Date(today);
  twoWeeksOut.setDate(today.getDate() + 13);
  return {
    doctorId: ownDoctorId,
    from: toDateOnly(today),
    to: toDateOnly(twoWeeksOut),
    status: ACTIVE_WAITLIST_FILTER,
  };
}

/**
 * The clock, read only from handlers and effects. A module-level function rather than
 * `Date.now()` inline, which the React lint rules cannot tell apart from a read during render.
 */
function clockNow(): number {
  return Date.now();
}

/** Minutes until an offer lapses, never negative. */
function minutesLeft(entry: WaitlistEntry, now: number): number | null {
  if (!entry.offerExpiresAtUtc) return null;
  return Math.max(0, Math.round((Date.parse(entry.offerExpiresAtUtc) - now) / 60_000));
}

/**
 * The waitlist for full clinic days (SCRUM-37), as the clinic sees it.
 *
 * Patients are not notified when a time frees up, so this page is where an open offer gets
 * noticed: offers come first, the ones about to lapse are counted at the top, and the front desk can
 * phone the patient and accept on their behalf, or record that they declined. Removing someone
 * asks for a reason, kept on the entry.
 *
 * Doctors see it too, read-only, on their own queues by default — the same audience as Booked
 * Appointments, and for the same reason: it names patients.
 */
export const WaitlistPage: React.FC = () => {
  const { user } = useAuth();
  const ownDoctorId = user?.role === 'Doctor' && user.staffId ? user.staffId : '';
  const canAct = canChangeAppointments(user?.role);

  const [draft, setDraft] = useState<Filters>(() => defaultFilters(ownDoctorId));
  const [applied, setApplied] = useState<Filters>(() => defaultFilters(ownDoctorId));
  const [doctors, setDoctors] = useState<DoctorResponse[]>([]);
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [removing, setRemoving] = useState<WaitlistEntry | null>(null);
  // Read once per load rather than during render, so the "expiring soon" count is stable.
  const [loadedAt, setLoadedAt] = useState(clockNow);

  const fetchEntries = useCallback(
    (filters: Filters) =>
      staffWaitlistApi.list({
        doctorId: filters.doctorId || undefined,
        from: filters.from,
        to: filters.to,
        status: filters.status || undefined,
      }),
    [],
  );

  // First load only. Every later load comes from Apply Filters or an action, in their handlers.
  useEffect(() => {
    let cancelled = false;
    const initial = defaultFilters(ownDoctorId);

    (async () => {
      try {
        const [doctorList, list] = await Promise.all([doctorApi.list(), fetchEntries(initial)]);
        if (cancelled) return;
        setDoctors(doctorList);
        setEntries(list);
        setLoadedAt(clockNow());
      } catch (err) {
        if (!cancelled) setError(extractErrorMessage(err, 'Failed to load the waitlist.'));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ownDoctorId, fetchEntries]);

  const reload = async (filters: Filters) => {
    setIsLoading(true);
    try {
      setEntries(await fetchEntries(filters));
      setLoadedAt(clockNow());
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to load the waitlist.'));
      setEntries([]);
    } finally {
      setIsLoading(false);
    }
  };

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

    setApplied(draft);
    setError(null);
    setNotice(null);
    await reload(draft);
  };

  /**
   * Runs one action for a patient. A refusal — an offer that lapsed a moment ago, a clash with
   * another booking — is shown in the service's words; either way the list is reloaded to show
   * what is true now.
   */
  const act = async (entry: WaitlistEntry, action: () => Promise<unknown>, done: string) => {
    setBusyId(entry.waitlistEntryId);
    setError(null);
    setNotice(null);
    try {
      await action();
      setNotice(done);
    } catch (err) {
      setError(extractErrorMessage(err, 'That did not work. Please try again.'));
    } finally {
      setBusyId(null);
    }
    await reload(applied);
  };

  const change = (field: keyof Filters, value: string) =>
    setDraft((current) => ({ ...current, [field]: value }) as Filters);

  const patientLabel = (entry: WaitlistEntry) => entry.patientName ?? entry.patientNumber ?? 'the patient';

  const offers = entries.filter((entry) => entry.status === WaitlistStatus.Offered);
  const stats = [
    {
      key: 'waiting',
      label: 'Waiting',
      value: entries.filter((entry) => entry.status === WaitlistStatus.Waiting).length,
      Icon: ListIcon,
    },
    { key: 'offered', label: 'Open offers', value: offers.length, Icon: ClockIcon },
    {
      key: 'expiring',
      label: `Lapsing within ${EXPIRING_SOON_MINUTES} min`,
      value: offers.filter((entry) => (minutesLeft(entry, loadedAt) ?? Infinity) <= EXPIRING_SOON_MINUTES).length,
      Icon: ClockIcon,
    },
    {
      key: 'accepted',
      label: 'Accepted',
      value: entries.filter((entry) => entry.status === WaitlistStatus.Accepted).length,
      Icon: CheckIcon,
    },
  ];

  // Open offers first — they are the ones waiting on someone — then by day and place in the queue.
  const rows = [...entries].sort(
    (a, b) =>
      Number(b.status === WaitlistStatus.Offered) - Number(a.status === WaitlistStatus.Offered)
      || a.slotDate.localeCompare(b.slotDate)
      || a.position - b.position,
  );

  const ownDoctorMissing = ownDoctorId !== '' && !doctors.some((d) => d.doctorId === ownDoctorId);

  return (
    <div className="booked-page waitlist-page">
      <section className="booked-hero">
        <span className="booked-tile">
          <ListIcon />
        </span>
        <div className="booked-hero-text">
          <h1>Waitlist</h1>
          <p>Patients waiting for a place on a fully booked day, and the times held for them.</p>
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
      {notice && (
        <div className="alert alert-success" role="status">
          {notice}
        </div>
      )}

      <div className="booked-stats">
        {stats.map(({ key, label, value, Icon }) => (
          <div key={key} className={`booked-stat waitlist-stat--${key}`} data-testid={`stat-${key}`}>
            <span className="booked-stat-icon">
              <Icon />
            </span>
            <div className="booked-stat-text">
              <strong className="booked-stat-value">{value}</strong>
              <span className="booked-stat-label">{label}</span>
            </div>
            <Icon className="booked-stat-watermark" />
          </div>
        ))}
      </div>

      <form className="booked-filters" onSubmit={(e) => void applyFilters(e)}>
        <div className="booked-field booked-field--doctor">
          <label htmlFor="waitlist-doctor">Doctor</label>
          <div className="booked-input">
            <UserIcon className="booked-input-icon" />
            <select id="waitlist-doctor" value={draft.doctorId} onChange={(e) => change('doctorId', e.target.value)}>
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
          <label htmlFor="waitlist-from">From Date</label>
          <div className="booked-input">
            <CalendarIcon className="booked-input-icon" />
            <input id="waitlist-from" type="date" value={draft.from} onChange={(e) => change('from', e.target.value)} />
          </div>
        </div>
        <div className="booked-field">
          <label htmlFor="waitlist-to">To Date</label>
          <div className="booked-input">
            <CalendarIcon className="booked-input-icon" />
            <input id="waitlist-to" type="date" value={draft.to} onChange={(e) => change('to', e.target.value)} />
          </div>
        </div>
        <div className="booked-field">
          <label htmlFor="waitlist-status">Status</label>
          <div className="booked-input">
            <LayersIcon className="booked-input-icon" />
            <select id="waitlist-status" value={draft.status} onChange={(e) => change('status', e.target.value)}>
              {STATUS_OPTIONS.map((option) => (
                <option key={option.label} value={option.value}>
                  {option.label}
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

      <section className="booked-table-card">
        <header className="booked-table-header">
          <span className="booked-tile booked-tile--sm">
            <ListIcon />
          </span>
          <div className="booked-table-heading">
            <h2>Entries ({entries.length})</h2>
            <p>Open offers first, then each day's queue in order.</p>
          </div>
        </header>

        {isLoading ? (
          <p className="booked-table-empty">Loading…</p>
        ) : rows.length === 0 ? (
          <div className="booked-table-empty">
            <p className="booked-table-empty-title">Nobody is on the waitlist in this range</p>
            <p>Try a wider date range, another doctor or another status.</p>
          </div>
        ) : (
          <div className="booked-table-scroll">
            <table className="booked-table" data-testid="waitlist-table">
              <thead>
                <tr>
                  <th>Day</th>
                  <th>Place</th>
                  <th>Patient</th>
                  <th>Doctor</th>
                  <th>Status</th>
                  <th>Offer</th>
                  <th>Joined</th>
                  {canAct && <th className="booked-actions-col">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((entry) => {
                  const isOffer = entry.status === WaitlistStatus.Offered;
                  const isActive = isOffer || entry.status === WaitlistStatus.Waiting;
                  const left = isOffer ? minutesLeft(entry, loadedAt) : null;
                  const busy = busyId === entry.waitlistEntryId;
                  return (
                    <tr
                      key={entry.waitlistEntryId}
                      className={isOffer ? 'waitlist-row--offer' : undefined}
                      data-testid="waitlist-row"
                    >
                      <td>
                        <span className="booked-cell-with-icon">
                          <CalendarIcon className="booked-cell-icon" />
                          {dayLabel(entry.slotDate)}
                        </span>
                      </td>
                      <td>{entry.placeInLine ? `#${entry.placeInLine}` : '—'}</td>
                      <td>
                        <Link to={`/patients/${entry.patientId}`} className="booked-patient-link">
                          {entry.patientName ?? 'Unnamed patient'}
                        </Link>
                        {entry.patientNumber && <span className="booked-cell-sub">{entry.patientNumber}</span>}
                      </td>
                      <td>
                        <span className="booked-cell-main">{entry.doctorName ?? 'Unknown doctor'}</span>
                        {entry.specialization && <span className="booked-cell-sub">{entry.specialization}</span>}
                      </td>
                      <td>
                        <span className={`booked-status waitlist-status--${entry.status.toLowerCase()}`}>
                          {entry.status}
                        </span>
                        {entry.closedReason && <span className="booked-cell-sub">{entry.closedReason}</span>}
                      </td>
                      <td>
                        {entry.offeredStartUtc ? (
                          <>
                            <span className="booked-cell-main">{colomboTimeLabel(entry.offeredStartUtc)}</span>
                            {isOffer && entry.offerExpiresAtUtc && (
                              <span className="booked-cell-sub waitlist-expiry">
                                Held until {colomboTimeLabel(entry.offerExpiresAtUtc)}
                                {left !== null ? ` (${left} min left)` : ''}
                              </span>
                            )}
                          </>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>
                        <span className="booked-cell-sub">{colomboDateTimeLabel(entry.joinedAtUtc)}</span>
                      </td>
                      {canAct && (
                        <td className="booked-actions-col">
                          {isActive && (
                            <span className="waitlist-actions">
                              {isOffer && (
                                <>
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-primary"
                                    disabled={busy}
                                    aria-label={`Accept the offer for ${patientLabel(entry)}`}
                                    onClick={() =>
                                      void act(
                                        entry,
                                        () => staffWaitlistApi.accept(entry.waitlistEntryId),
                                        `Booked ${patientLabel(entry)} for ${dayLabel(entry.slotDate)} at ${
                                          entry.offeredStartUtc ? colomboTimeLabel(entry.offeredStartUtc) : ''
                                        }.`,
                                      )
                                    }
                                  >
                                    Accept
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-outline"
                                    disabled={busy}
                                    aria-label={`Decline the offer for ${patientLabel(entry)}`}
                                    onClick={() =>
                                      void act(
                                        entry,
                                        () => staffWaitlistApi.decline(entry.waitlistEntryId),
                                        `Declined for ${patientLabel(entry)}. The time has gone to the next patient.`,
                                      )
                                    }
                                  >
                                    Decline
                                  </button>
                                </>
                              )}
                              <button
                                type="button"
                                className="btn btn-sm btn-danger-outline"
                                disabled={busy}
                                aria-label={`Remove ${patientLabel(entry)} from the waitlist`}
                                onClick={() => {
                                  setNotice(null);
                                  setRemoving(entry);
                                }}
                              >
                                Remove
                              </button>
                            </span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {removing && (
        <AppointmentTextDialog
          title="Remove from the waitlist"
          subtitle={`${patientLabel(removing)} · ${dayLabel(removing.slotDate)}`}
          label="Reason"
          placeholder="e.g. Patient phoned to say they no longer need it"
          help={
            removing.status === WaitlistStatus.Offered
              ? 'Kept on the entry. The time held for them goes to the next patient.'
              : 'Kept on the entry.'
          }
          maxLength={MAX_REASON_LENGTH}
          rows={3}
          confirmLabel="Remove"
          busyLabel="Removing…"
          dismissLabel="Keep"
          danger
          onConfirm={async (reason) => {
            await staffWaitlistApi.remove(removing.waitlistEntryId, reason);
            setRemoving(null);
            setNotice(`Removed ${patientLabel(removing)} from the waitlist.`);
            await reload(applied);
          }}
          onClose={() => setRemoving(null)}
        />
      )}
    </div>
  );
};

export default WaitlistPage;
