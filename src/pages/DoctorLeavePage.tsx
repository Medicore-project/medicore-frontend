import React, { useCallback, useEffect, useState } from 'react';
import { leaveApi, toDateOnly } from '../api/appointments';
import type { DoctorLeaveResponse, SlotReconciliationSummary } from '../api/appointments';
import { staffApi } from '../api/staff';
import type { StaffResponse } from '../api/staff';
import { useAuth } from '../contexts/AuthContext';
import { canApproveLeave, canRequestLeave } from '../utils/permissions';

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'response' in err) {
    const axiosErr = err as {
      response?: {
        status?: number;
        data?: { title?: string; detail?: string; errors?: Record<string, string[]> };
      };
    };
    const data = axiosErr.response?.data;
    if (data?.errors) {
      const first = Object.values(data.errors)[0];
      if (first?.length) return first[0];
    }
    if (data?.title) return data.title;
    if (data?.detail) return data.detail;
    if (axiosErr.response?.status === 403) return 'You do not have permission to do that.';
  }
  if (err instanceof Error) return err.message;
  return fallback;
}

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

function statusBadgeClass(status: string): string {
  switch (status) {
    case 'Approved':
      return 'badge badge-leave-approved';
    case 'Rejected':
      return 'badge badge-leave-rejected';
    default:
      return 'badge badge-leave-pending';
  }
}

function doctorName(doctors: StaffResponse[], id: string): string {
  const match = doctors.find((d) => String(d.id) === id);
  if (!match) return id.slice(0, 8);
  return match.fullName || `${match.firstName} ${match.lastName}`;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export const DoctorLeavePage: React.FC = () => {
  const { user } = useAuth();
  const isDoctorRole = user?.role === 'Doctor';
  const canRequest = canRequestLeave(user?.role) && !!user?.staffId;
  const canApprove = canApproveLeave(user?.role);

  const [doctors, setDoctors] = useState<StaffResponse[]>([]);
  const [doctorId, setDoctorId] = useState('');
  const [requests, setRequests] = useState<DoctorLeaveResponse[]>([]);
  const [pending, setPending] = useState<DoctorLeaveResponse[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState({
    startDate: toDateOnly(new Date()),
    endDate: toDateOnly(new Date()),
    reason: '',
  });

  // ── Loading ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await staffApi.list({ role: 'Doctor', isActive: true, pageSize: 100 });
        if (cancelled) return;
        setDoctors(result.items ?? []);
        // A doctor can only ever see and act on their own leave — lock the selection to their own
        // staffId rather than letting them browse (and, before the ownership check existed, act on
        // behalf of) another doctor. Everyone else keeps free choice, to review any doctor's leave.
        if (isDoctorRole) {
          setDoctorId(user?.staffId ?? '');
        } else if (result.items?.length) {
          setDoctorId(String(result.items[0].id));
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

  const review = async (leave: DoctorLeaveResponse, decision: 'Approved' | 'Rejected') => {
    const notes = window.prompt(
      decision === 'Rejected'
        ? 'Why is this request being rejected? (optional)'
        : 'Any note to attach to the approval? (optional)',
    );
    // prompt() returns null when dismissed — treat that as cancelling the decision.
    if (notes === null) return;

    try {
      const result = await leaveApi.review(leave.leaveId, decision, notes || null);
      announce(`Request ${decision.toLowerCase()}. ${describeImpact(result.impact)}`);
      await load();
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to record the decision.'));
    }
  };

  const withdraw = async (leave: DoctorLeaveResponse) => {
    const wasApproved = leave.status === 'Approved';
    const confirmed = window.confirm(
      wasApproved
        ? 'Withdraw this approved leave? The doctor’s slots for those dates will be regenerated.'
        : 'Withdraw this leave request?',
    );
    if (!confirmed) return;

    try {
      const impact = await leaveApi.withdraw(leave.leaveId);
      announce(`Request withdrawn. ${describeImpact(impact)}`);
      await load();
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to withdraw the request.'));
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="management-page leave-page">
      <div className="page-header">
        <div>
          <h1>Doctor Leave</h1>
          <p className="page-subtitle">
            Leave is requested, not taken. A request changes nothing until an administrator approves
            it — only then are the doctor&rsquo;s slots cleared.
          </p>
        </div>
        {canRequest && doctorId && (
          <button type="button" className="btn btn-primary" onClick={() => setShowForm(true)}>
            Request leave
          </button>
        )}
      </div>

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

      <div className="schedule-toolbar card">
        <div className="form-group">
          <label htmlFor="leave-doctor">Doctor</label>
          <select
            id="leave-doctor"
            className="filter-select"
            value={doctorId}
            onChange={(e) => setDoctorId(e.target.value)}
            disabled={isDoctorRole || doctors.length === 0}
          >
            {doctors.length === 0 && <option value="">No doctors found</option>}
            {doctors.map((d) => (
              <option key={String(d.id)} value={String(d.id)}>
                {d.fullName || `${d.firstName} ${d.lastName}`}
                {d.specialization ? ` — ${d.specialization}` : ''}
              </option>
            ))}
          </select>
          {isDoctorRole && (
            <span className="field-help">
              {user?.staffId
                ? 'You can only view and request your own leave.'
                : 'Your account has no linked staff profile, so you cannot request leave. Contact an administrator.'}
            </span>
          )}
        </div>
      </div>

      {/* ── Approval queue (Admin only) ── */}
      {canApprove && (
        <div className="card">
          <h2 className="detail-section-title">Pending approvals — all doctors</h2>
          {pending.length === 0 ? (
            <p className="schedule-empty">Nothing awaiting a decision.</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Doctor</th>
                  <th>Dates</th>
                  <th>Reason</th>
                  <th>Requested by</th>
                  <th>Decision</th>
                </tr>
              </thead>
              <tbody>
                {pending.map((l) => (
                  <tr key={l.leaveId}>
                    <td>{doctorName(doctors, l.doctorId)}</td>
                    <td>
                      {l.startDate}
                      {l.endDate !== l.startDate ? ` → ${l.endDate}` : ''}
                    </td>
                    <td>{l.reason || <span className="text-muted">—</span>}</td>
                    <td>{l.createdBy}</td>
                    <td className="action-buttons">
                      <button
                        type="button"
                        className="btn btn-sm btn-success"
                        onClick={() => void review(l, 'Approved')}
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-danger-outline"
                        onClick={() => void review(l, 'Rejected')}
                      >
                        Reject
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── This doctor's requests ── */}
      <div className="card">
        <h2 className="detail-section-title">
          Requests for {doctorId ? doctorName(doctors, doctorId) : 'this doctor'}
        </h2>
        {isLoading ? (
          <p className="schedule-empty">Loading…</p>
        ) : requests.length === 0 ? (
          <p className="schedule-empty">No leave requests on record.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Dates</th>
                <th>Reason</th>
                <th>Status</th>
                <th>Reviewed by</th>
                <th>Decision note</th>
                {canRequest && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {requests.map((l) => (
                <tr key={l.leaveId}>
                  <td>
                    {l.startDate}
                    {l.endDate !== l.startDate ? ` → ${l.endDate}` : ''}
                  </td>
                  <td>{l.reason || <span className="text-muted">—</span>}</td>
                  <td>
                    <span className={statusBadgeClass(l.status)}>{l.status}</span>
                  </td>
                  <td>{l.reviewedBy || <span className="text-muted">—</span>}</td>
                  <td>{l.reviewNotes || <span className="text-muted">—</span>}</td>
                  {canRequest && (
                    <td className="action-buttons">
                      <button
                        type="button"
                        className="btn btn-sm btn-danger-outline"
                        onClick={() => void withdraw(l)}
                      >
                        Withdraw
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Request form ── */}
      {showForm && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-panel">
            <div className="modal-header">
              <h2>Request leave</h2>
              <button
                type="button"
                className="modal-close"
                onClick={() => setShowForm(false)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <form className="modal-form" onSubmit={submitRequest}>
              <p className="field-help">
                For {doctorId ? doctorName(doctors, doctorId) : 'the selected doctor'}. The request
                is recorded as <strong>Pending</strong> and has no effect on their calendar until it
                is approved.
              </p>

              <div className="form-grid">
                <div className="form-group">
                  <label htmlFor="startDate">First day</label>
                  <input
                    id="startDate"
                    type="date"
                    required
                    value={form.startDate}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="endDate">Last day</label>
                  <input
                    id="endDate"
                    type="date"
                    required
                    value={form.endDate}
                    onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                  />
                  <span className="field-help">Inclusive. Same as the first day for a single day.</span>
                </div>
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
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSaving}>
                  {isSaving ? 'Submitting…' : 'Submit request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DoctorLeavePage;
