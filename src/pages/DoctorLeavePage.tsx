import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { doctorApi, leaveApi, toDateOnly } from '../api/appointments';
import type { DoctorLeaveResponse, DoctorResponse, SlotReconciliationSummary } from '../api/appointments';
import ActionDialog from '../components/common/ActionDialog';
import {
  AlertIcon,
  CheckIcon,
  ClockIcon,
  CloseIcon,
  CrossCircleIcon,
  PlaneIcon,
  UserIcon,
} from '../components/icons/LineIcons';
import { useAuth } from '../contexts/AuthContext';
import { extractErrorMessage } from '../utils/apiError';
import { datesBetween, fullDateLabel } from '../utils/bookingLabels';
import { initialsOf } from '../utils/initials';
import { canApproveLeave, canRequestLeave } from '../utils/permissions';

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Approving leave clears the doctor's free slots and flags any bookings on them, so the number of
 * flagged slots is the number of patients somebody now has to contact. It is surfaced rather than
 * left in the response body.
 */
function describeImpact(impact: SlotReconciliationSummary): string {
  const parts: string[] = [];
  if (impact.slotsRemoved) parts.push(`${impact.slotsRemoved} free slot(s) removed`);
  if (impact.slotsCreated) parts.push(`${impact.slotsCreated} slot(s) restored`);
  if (impact.slotsFlagged) {
    parts.push(`${impact.slotsFlagged} booking(s) flagged — these patients need rescheduling`);
  }
  return parts.length ? parts.join(', ') + '.' : 'No slots were affected.';
}

/**
 * Only bookable doctors are listed, so a request from a doctor deactivated since falls back to a
 * short id.
 */
function doctorName(doctors: DoctorResponse[], id: string): string {
  const match = doctors.find((d) => d.doctorId === id);
  return match ? match.fullName : id.slice(0, 8);
}

/** Days covered, inclusive; 0 when the range is backwards or incomplete. */
function dayCount(start: string, end: string): number {
  if (!start || !end || end < start) return 0;
  return datesBetween(start, end).length;
}

/** "Mon, 5 Oct 2026" for one day, or "Mon, 5 Oct 2026 → Wed, 7 Oct 2026" for a range. */
function rangeLabel(start: string, end: string): string {
  return start === end ? fullDateLabel(start) : `${fullDateLabel(start)} → ${fullDateLabel(end)}`;
}

const STATUS_TONE: Record<string, string> = { Pending: 'amber', Approved: 'green', Rejected: 'red' };
const FILTERS = ['All', 'Pending', 'Approved', 'Rejected'] as const;
type Filter = (typeof FILTERS)[number];

/** A decision the page is waiting on the user to confirm, shown in an ActionDialog. */
type PendingAction =
  | { kind: 'review'; leave: DoctorLeaveResponse; decision: 'Approved' | 'Rejected' }
  | { kind: 'withdraw'; leave: DoctorLeaveResponse };

// ── Page ──────────────────────────────────────────────────────────────────────

export const DoctorLeavePage: React.FC = () => {
  const { user } = useAuth();
  const isDoctorRole = user?.role === 'Doctor';
  const canRequest = canRequestLeave(user?.role) && !!user?.staffId;
  const canApprove = canApproveLeave(user?.role);

  const [doctors, setDoctors] = useState<DoctorResponse[]>([]);
  const [hasLoadedDoctors, setHasLoadedDoctors] = useState(false);
  const [doctorId, setDoctorId] = useState('');
  const [requests, setRequests] = useState<DoctorLeaveResponse[]>([]);
  const [pending, setPending] = useState<DoctorLeaveResponse[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('All');

  const [showForm, setShowForm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState({
    startDate: toDateOnly(new Date()),
    endDate: toDateOnly(new Date()),
    reason: '',
  });
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);

  // The doctor list comes from the appointment service's cache. A doctor missing from it —
  // deactivated, or not yet synced from Identity — would have a request refused with 404, so say
  // so up front instead.
  const ownProfileNotBookable =
    isDoctorRole &&
    !!user?.staffId &&
    hasLoadedDoctors &&
    !doctors.some((d) => d.doctorId === user.staffId);

  // ── Loading ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // From the appointment service's doctor cache, not Identity (SCRUM-33).
        const result = await doctorApi.list();
        if (cancelled) return;
        setDoctors(result);
        setHasLoadedDoctors(true);
        // A doctor can only ever see and act on their own leave — lock the selection to their own
        // staffId rather than letting them browse (and, before the ownership check existed, act on
        // behalf of) another doctor. Everyone else keeps free choice, to review any doctor's leave.
        if (isDoctorRole) {
          setDoctorId(user?.staffId ?? '');
        } else if (result.length) {
          setDoctorId(result[0].doctorId);
        }
      } catch (err) {
        if (!cancelled) setError(extractErrorMessage(err, 'Failed to load doctors.'));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isDoctorRole, user?.staffId]);

  const load = useCallback(async () => {
    if (!doctorId) return;
    setIsLoading(true);
    setError(null);
    try {
      const mine = await leaveApi.listForDoctor(doctorId);
      setRequests(mine);
      if (canApprove) {
        setPending(await leaveApi.pending());
      }
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to load leave requests.'));
      setRequests([]);
    } finally {
      setIsLoading(false);
    }
  }, [doctorId, canApprove]);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = useMemo(() => {
    const today = toDateOnly(new Date());
    return {
      Pending: requests.filter((l) => l.status === 'Pending').length,
      Approved: requests.filter((l) => l.status === 'Approved').length,
      Rejected: requests.filter((l) => l.status === 'Rejected').length,
      // Approved days still ahead: what the doctor's calendar is actually missing.
      upcomingDays: requests
        .filter((l) => l.status === 'Approved' && l.endDate >= today)
        .reduce((sum, l) => sum + dayCount(l.startDate > today ? l.startDate : today, l.endDate), 0),
    };
  }, [requests]);

  const visibleRequests = useMemo(
    () =>
      [...requests]
        .filter((l) => filter === 'All' || l.status === filter)
        .sort((a, b) => b.startDate.localeCompare(a.startDate)),
    [requests, filter],
  );

  // ── Actions ─────────────────────────────────────────────────────────────────

  const announce = (message: string) => {
    setNotice(message);
    setError(null);
  };

  const submitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!doctorId) return;
    setIsSaving(true);
    setError(null);
    try {
      await leaveApi.create({
        doctorId,
        startDate: form.startDate,
        endDate: form.endDate,
        reason: form.reason.trim() || null,
      });
      announce('Leave requested. It stays pending — and changes no slots — until an administrator approves it.');
      setShowForm(false);
      setForm({ startDate: toDateOnly(new Date()), endDate: toDateOnly(new Date()), reason: '' });
      await load();
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to submit the leave request.'));
    } finally {
      setIsSaving(false);
    }
  };

  /** Runs the confirmed decision. Rejections propagate so the dialog shows them in place. */
  const confirmPending = async (text: string | null) => {
    if (!pendingAction) return;
    if (pendingAction.kind === 'review') {
      const result = await leaveApi.review(pendingAction.leave.leaveId, pendingAction.decision, text);
      announce(`Request ${pendingAction.decision.toLowerCase()}. ${describeImpact(result.impact)}`);
    } else {
      const impact = await leaveApi.withdraw(pendingAction.leave.leaveId);
      announce(`Request withdrawn. ${describeImpact(impact)}`);
    }
    setPendingAction(null);
    await load();
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  const selectedName = doctorId ? doctorName(doctors, doctorId) : '';
  const selectedDoctor = doctors.find((d) => d.doctorId === doctorId);
  const formDays = dayCount(form.startDate, form.endDate);

  return (
    <div className="management-page sc-page leave-page">
      {/* ── Header ── */}
      <header className="sc-hero">
        <div className="sc-hero-copy">
          <span className="sc-eyebrow">
            <PlaneIcon className="ws-icon-sm" /> Scheduling
          </span>
          <h1>Doctor Leave</h1>
          <p className="page-subtitle">
            Leave is requested, not taken. A request changes nothing until an administrator approves
            it — only then are the doctor&rsquo;s slots cleared.
          </p>
        </div>
        {canRequest && doctorId && !ownProfileNotBookable && (
          <button type="button" className="btn btn-primary sc-hero-action" onClick={() => setShowForm(true)}>
            Request leave
          </button>
        )}
      </header>

      {/* How a request moves: the rule above, drawn. */}
      <ol className="lv-flow" aria-label="How leave works">
        <li>
          <span className="lv-flow-icon lv-tone-amber"><ClockIcon className="ws-icon-sm" /></span>
          <span><strong>Requested</strong>Pending — the calendar is untouched</span>
        </li>
        <li>
          <span className="lv-flow-icon lv-tone-blue"><UserIcon className="ws-icon-sm" /></span>
          <span><strong>Reviewed</strong>An administrator approves or rejects</span>
        </li>
        <li>
          <span className="lv-flow-icon lv-tone-green"><CheckIcon className="ws-icon-sm" /></span>
          <span><strong>Approved</strong>Free slots cleared, bookings flagged</span>
        </li>
      </ol>

      {error && (
        <div className="alert alert-danger sc-alert" role="alert">
          <AlertIcon className="ws-icon-sm" />
          <span>{error}</span>
        </div>
      )}
      {notice && (
        <div className="alert alert-success sc-alert" role="status">
          <CheckIcon className="ws-icon-sm" />
          <span>{notice}</span>
          <button type="button" className="sc-alert-close" onClick={() => setNotice(null)} aria-label="Dismiss message">
            <CloseIcon className="ws-icon-sm" />
          </button>
        </div>
      )}

      {/* ── Doctor ── */}
      <section className="sc-toolbar lv-toolbar" aria-label="Choose a doctor">
        <div className="sc-doctor">
          <span className="sc-doctor-avatar" aria-hidden="true">
            {selectedName ? initialsOf(selectedName) : '—'}
          </span>
          <div className="sc-doctor-field">
            <label htmlFor="leave-doctor">Doctor</label>
            <select
              id="leave-doctor"
              className="sc-select"
              value={doctorId}
              onChange={(e) => setDoctorId(e.target.value)}
              disabled={isDoctorRole || doctors.length === 0}
            >
              {doctors.length === 0 && <option value="">No bookable doctors</option>}
              {ownProfileNotBookable && <option value={doctorId}>You</option>}
              {doctors.map((d) => (
                <option key={d.doctorId} value={d.doctorId}>
                  {d.fullName}
                  {d.specialization ? ` — ${d.specialization}` : ''}
                </option>
              ))}
            </select>
            {isDoctorRole && (
              <span className={`field-help ${ownProfileNotBookable || !user?.staffId ? 'lv-help-warn' : ''}`}>
                {!user?.staffId
                  ? 'Your account has no linked staff profile, so you cannot request leave. Contact an administrator.'
                  : ownProfileNotBookable
                    ? 'Your profile is not bookable in the appointment service yet, so you cannot request new leave. Ask an administrator to sync doctors. Existing requests are shown below.'
                    : 'You can only view and request your own leave.'}
              </span>
            )}
          </div>
        </div>

        {doctorId && (
          <div className="lv-counts" role="group" aria-label={`Leave for ${selectedName}`}>
            <span className="lv-count lv-tone-amber"><strong>{counts.Pending}</strong> pending</span>
            <span className="lv-count lv-tone-green"><strong>{counts.Approved}</strong> approved</span>
            <span className="lv-count lv-tone-red"><strong>{counts.Rejected}</strong> rejected</span>
            <span className="lv-count lv-tone-blue"><strong>{counts.upcomingDays}</strong> day{counts.upcomingDays === 1 ? '' : 's'} off ahead</span>
          </div>
        )}
      </section>

      {/* ── Approval queue (Admin only) ── */}
      {canApprove && (
        <section className="sc-card">
          <div className="sc-card-head">
            <div>
              <h2>
                Pending approvals — all doctors
                {pending.length > 0 && <span className="lv-queue-count">{pending.length}</span>}
              </h2>
              <p>Approving clears the doctor’s free slots for those days and flags any bookings on them.</p>
            </div>
          </div>
          {pending.length === 0 ? (
            <div className="sc-empty sc-empty--compact">
              <CheckIcon className="sc-empty-icon" />
              <p className="sc-empty-title">No pending requests</p>
              <p className="sc-empty-hint">New leave requests will show up here for approval.</p>
            </div>
          ) : (
            <ul className="lv-queue">
              {pending.map((l, index) => {
                const name = doctorName(doctors, l.doctorId);
                const days = dayCount(l.startDate, l.endDate);
                return (
                  <li key={l.leaveId} className="lv-request lv-request--queue" style={{ '--i': index } as React.CSSProperties}>
                    <span className="lv-avatar" aria-hidden="true">{initialsOf(name)}</span>
                    <div className="lv-request-main">
                      <strong>{name}</strong>
                      <span className="lv-dates">
                        {rangeLabel(l.startDate, l.endDate)} <span className="lv-days">{days} day{days === 1 ? '' : 's'}</span>
                      </span>
                      <span className="lv-reason">{l.reason || 'No reason given'}</span>
                      <span className="lv-by">Requested by {l.createdBy}</span>
                    </div>
                    <div className="lv-request-actions">
                      <button
                        type="button"
                        className="btn btn-sm btn-success"
                        onClick={() => setPendingAction({ kind: 'review', leave: l, decision: 'Approved' })}
                      >
                        <CheckIcon className="ws-icon-sm" /> Approve
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-danger-outline"
                        onClick={() => setPendingAction({ kind: 'review', leave: l, decision: 'Rejected' })}
                      >
                        <CrossCircleIcon className="ws-icon-sm" /> Reject
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {/* ── This doctor's requests ── */}
      <section className="sc-card">
        <div className="sc-card-head">
          <div>
            <h2>Requests for {doctorId ? selectedName : 'this doctor'}</h2>
            <p>{selectedDoctor?.specialization || 'Every request, newest dates first.'}</p>
          </div>
          <div className="db-filter-chips lv-filters" role="group" aria-label="Filter by status">
            {FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                className={`db-chip ${filter === f ? 'is-active' : ''}`}
                aria-pressed={filter === f}
                onClick={() => setFilter(f)}
              >
                {f}
                <span className="db-chip-count">{f === 'All' ? requests.length : counts[f]}</span>
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <ul className="lv-list" aria-label="Loading leave requests">
            {[0, 1, 2].map((i) => (
              <li key={i} className="lv-request lv-request--skeleton">
                <span className="sc-skeleton lv-skel-date" />
                <span className="sc-skeleton lv-skel-line" />
              </li>
            ))}
          </ul>
        ) : requests.length === 0 ? (
          <div className="sc-empty sc-empty--compact">
            <PlaneIcon className="sc-empty-icon" />
            <p className="sc-empty-title">No leave requests yet</p>
            <p className="sc-empty-hint">Submitted requests will show up here.</p>
          </div>
        ) : visibleRequests.length === 0 ? (
          <div className="sc-empty sc-empty--compact">
            <PlaneIcon className="sc-empty-icon" />
            <p className="sc-empty-title">No {filter.toLowerCase()} requests</p>
            <p className="sc-empty-hint">Pick another status to see the rest.</p>
          </div>
        ) : (
          <ul className="lv-list">
            {visibleRequests.map((l, index) => {
              const [year, month, day] = l.startDate.split('-');
              const days = dayCount(l.startDate, l.endDate);
              const tone = STATUS_TONE[l.status] ?? 'amber';
              return (
                <li key={l.leaveId} className={`lv-request lv-tone-${tone}`} style={{ '--i': index } as React.CSSProperties}>
                  <span className="lv-cal" aria-hidden="true">
                    <span className="lv-cal-month">
                      {new Date(Number(year), Number(month) - 1, 1).toLocaleDateString('en-GB', { month: 'short' })}
                    </span>
                    <span className="lv-cal-day">{Number(day)}</span>
                  </span>
                  <div className="lv-request-main">
                    <span className="lv-dates">
                      <strong>{rangeLabel(l.startDate, l.endDate)}</strong>
                      <span className="lv-days">{days} day{days === 1 ? '' : 's'}</span>
                    </span>
                    <span className="lv-reason">{l.reason || 'No reason given'}</span>
                    {(l.reviewedBy || l.reviewNotes) && (
                      <span className="lv-by">
                        {l.reviewedBy ? `Reviewed by ${l.reviewedBy}` : 'Reviewed'}
                        {l.reviewNotes ? ` — “${l.reviewNotes}”` : ''}
                      </span>
                    )}
                  </div>
                  <span className={`lv-status lv-tone-${tone}`}>{l.status}</span>
                  {canRequest && (
                    <button
                      type="button"
                      className="btn btn-sm btn-danger-outline lv-withdraw"
                      onClick={() => setPendingAction({ kind: 'withdraw', leave: l })}
                    >
                      Withdraw
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ── Request form ── */}
      {showForm && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="lv-form-title">
          <div className="modal-panel sc-form-panel">
            <div className="modal-header">
              <div>
                <h2 id="lv-form-title">Request leave</h2>
                <p className="page-subtitle">For {selectedName || 'the selected doctor'}</p>
              </div>
              <button type="button" className="modal-close" onClick={() => setShowForm(false)} aria-label="Close">
                ×
              </button>
            </div>
            <form className="modal-form" onSubmit={submitRequest}>
              <p className="field-help lv-form-note">
                The request is recorded as <strong>Pending</strong> and has no effect on the calendar until it is
                approved.
              </p>

              <div className="form-grid">
                <div className="form-group">
                  <label htmlFor="startDate">First day</label>
                  <input
                    id="startDate"
                    type="date"
                    required
                    value={form.startDate}
                    onChange={(e) =>
                      // Keep the range valid: moving the first day past the last drags the last with it.
                      setForm({
                        ...form,
                        startDate: e.target.value,
                        endDate: form.endDate < e.target.value ? e.target.value : form.endDate,
                      })
                    }
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="endDate">Last day</label>
                  <input
                    id="endDate"
                    type="date"
                    required
                    min={form.startDate}
                    value={form.endDate}
                    onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                  />
                  <span className="field-help">Inclusive. Same as the first day for a single day.</span>
                </div>
              </div>

              <div className={`sc-preview ${formDays === 0 ? 'is-invalid' : ''}`} aria-live="polite">
                <PlaneIcon className="ws-icon-sm" />
                {formDays === 0
                  ? 'The last day cannot be before the first.'
                  : `${formDays} day${formDays === 1 ? '' : 's'} off · ${rangeLabel(form.startDate, form.endDate)}`}
              </div>

              <div className="form-group">
                <label htmlFor="reason">Reason</label>
                <textarea
                  id="reason"
                  rows={3}
                  maxLength={500}
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  placeholder="Optional — for example, a conference or personal leave."
                />
                <span className="field-help lv-counter">{form.reason.length}/500</span>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSaving || formDays === 0}>
                  {isSaving ? 'Submitting…' : 'Submit request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {pendingAction?.kind === 'review' && (
        <ActionDialog
          title={pendingAction.decision === 'Approved' ? 'Approve this leave?' : 'Reject this leave?'}
          subtitle={`${doctorName(doctors, pendingAction.leave.doctorId)} · ${rangeLabel(pendingAction.leave.startDate, pendingAction.leave.endDate)}`}
          body={
            pendingAction.decision === 'Approved'
              ? 'The doctor’s free slots on these days are removed, and any bookings on them are flagged for rescheduling.'
              : 'The request is closed and the doctor’s calendar stays as it is.'
          }
          field={{
            label: pendingAction.decision === 'Approved' ? 'Note to attach' : 'Why is it being rejected?',
            maxLength: 500,
          }}
          confirmLabel={pendingAction.decision === 'Approved' ? 'Approve leave' : 'Reject leave'}
          busyLabel="Saving…"
          tone={pendingAction.decision === 'Approved' ? 'success' : 'danger'}
          onConfirm={confirmPending}
          onClose={() => setPendingAction(null)}
        />
      )}
      {pendingAction?.kind === 'withdraw' && (
        <ActionDialog
          title="Withdraw this request?"
          subtitle={rangeLabel(pendingAction.leave.startDate, pendingAction.leave.endDate)}
          body={
            pendingAction.leave.status === 'Approved'
              ? 'This leave is approved: the doctor’s slots for those dates will be regenerated.'
              : 'The request is removed before anyone reviews it.'
          }
          confirmLabel="Withdraw"
          busyLabel="Withdrawing…"
          tone="danger"
          onConfirm={confirmPending}
          onClose={() => setPendingAction(null)}
        />
      )}
    </div>
  );
};

export default DoctorLeavePage;
