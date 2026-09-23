import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DAY_NAMES,
  colomboTimeLabel,
  doctorApi,
  leaveApi,
  scheduleApi,
  slotApi,
  toDateOnly,
} from '../api/appointments';
import type {
  CreateScheduleBody,
  DayOfWeekNumber,
  DoctorLeaveResponse,
  DoctorResponse,
  DoctorScheduleResponse,
  SlotReconciliationSummary,
  SlotResponse,
} from '../api/appointments';
import { useAuth } from '../contexts/AuthContext';
import { extractErrorMessage } from '../utils/apiError';
import { canManageSchedules } from '../utils/permissions';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** The Monday on or before `date`, at local midnight. */
function startOfWeek(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const offset = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - offset);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/** "Sun 27 Sep", "Tue 22 – Thu 24 Sep", or "Wed 30 Sep – Thu 1 Oct" across a month end. */
function dayRangeLabel(start: Date, end: Date): string {
  const day = (d: Date) => `${DAY_NAMES[d.getDay()].slice(0, 3)} ${d.getDate()}`;
  const month = (d: Date) => d.toLocaleDateString(undefined, { month: 'short' });

  if (toDateOnly(start) === toDateOnly(end)) return `${day(start)} ${month(start)}`;
  if (start.getMonth() === end.getMonth()) return `${day(start)} – ${day(end)} ${month(end)}`;
  return `${day(start)} ${month(start)} – ${day(end)} ${month(end)}`;
}

function describeImpact(impact: SlotReconciliationSummary): string {
  const parts: string[] = [];
  if (impact.slotsCreated) parts.push(`${impact.slotsCreated} slot(s) created`);
  if (impact.slotsRemoved) parts.push(`${impact.slotsRemoved} removed`);
  if (impact.slotsFlagged) parts.push(`${impact.slotsFlagged} booking(s) flagged for rescheduling`);
  return parts.length ? parts.join(', ') + '.' : 'No slots changed.';
}

const EMPTY_FORM: {
  dayOfWeek: DayOfWeekNumber;
  startTime: string;
  endTime: string;
  slotDurationMinutes: number;
  effectiveFrom: string;
  effectiveTo: string;
} = {
  dayOfWeek: 1,
  startTime: '09:00',
  endTime: '17:00',
  slotDurationMinutes: 30,
  effectiveFrom: toDateOnly(new Date()),
  effectiveTo: '',
};

// ── Page ──────────────────────────────────────────────────────────────────────

export const AppointmentsPage: React.FC = () => {
  const { user } = useAuth();
  const canManage = canManageSchedules(user?.role);

  const [doctors, setDoctors] = useState<DoctorResponse[]>([]);
  const [doctorId, setDoctorId] = useState<string>('');
  const [weekStart, setWeekStart] = useState<Date>(() => startOfWeek(new Date()));

  const [slots, setSlots] = useState<SlotResponse[]>([]);
  const [flagged, setFlagged] = useState<SlotResponse[]>([]);
  const [schedules, setSchedules] = useState<DoctorScheduleResponse[]>([]);
  const [approvedLeave, setApprovedLeave] = useState<DoctorLeaveResponse[]>([]);

  const [isLoadingDoctors, setIsLoadingDoctors] = useState(true);
  const [isLoadingWeek, setIsLoadingWeek] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  // ── Data loading ────────────────────────────────────────────────────────────

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // From the appointment service's doctor cache, not Identity, so the booking grid still
        // loads while Identity is down (SCRUM-33). Only bookable doctors are returned.
        const result = await doctorApi.list();
        if (cancelled) return;
        setDoctors(result);
        if (result.length) setDoctorId(result[0].doctorId);
      } catch (err) {
        if (!cancelled) setError(extractErrorMessage(err, 'Failed to load doctors.'));
      } finally {
        if (!cancelled) setIsLoadingDoctors(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadWeek = useCallback(async () => {
    if (!doctorId) return;
    setIsLoadingWeek(true);
    setError(null);
    try {
      const from = toDateOnly(weekStart);
      const to = toDateOnly(addDays(weekStart, 6));
      const [available, flaggedSlots, doctorSchedules, leave] = await Promise.all([
        slotApi.available(doctorId, from, to),
        slotApi.flagged(doctorId),
        scheduleApi.listForDoctor(doctorId),
        leaveApi.approved(doctorId, from, to),
      ]);
      setSlots(available);
      setFlagged(flaggedSlots);
      setSchedules(doctorSchedules);
      setApprovedLeave(leave);
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to load the schedule.'));
      setSlots([]);
      setFlagged([]);
      setSchedules([]);
      setApprovedLeave([]);
    } finally {
      setIsLoadingWeek(false);
    }
  }, [doctorId, weekStart]);

  useEffect(() => {
    void loadWeek();
  }, [loadWeek]);

  // ── Grid shape ──────────────────────────────────────────────────────────────

  /**
   * Rows are the distinct Colombo start times present in the week, sorted. Deriving them from the
   * data rather than assuming a fixed ladder means 15- and 30-minute schedules, split shifts and
   * unusual hours all render without special cases.
   */
  const timeRows = useMemo(() => {
    const times = new Set(slots.map((s) => colomboTimeLabel(s.startUtc)));
    return [...times].sort();
  }, [slots]);

  /** `${slotDate}|${HH:mm}` → slot, for O(1) cell lookup. */
  const slotIndex = useMemo(() => {
    const map = new Map<string, SlotResponse>();
    slots.forEach((s) => map.set(`${s.slotDate}|${colomboTimeLabel(s.startUtc)}`, s));
    return map;
  }, [slots]);

  const flaggedThisWeek = useMemo(() => {
    const from = toDateOnly(weekStart);
    const to = toDateOnly(addDays(weekStart, 6));
    return flagged.filter((s) => s.slotDate >= from && s.slotDate <= to);
  }, [flagged, weekStart]);

  /** `YYYY-MM-DD` → the approved leave request covering that date, for the empty cells it produced. */
  const leaveByDate = useMemo(() => {
    const map = new Map<string, DoctorLeaveResponse>();
    for (const leave of approvedLeave) {
      for (let d = leave.startDate; d <= leave.endDate; ) {
        map.set(d, leave);
        if (d === leave.endDate) break;
        d = toDateOnly(addDays(new Date(`${d}T00:00:00`), 1));
      }
    }
    return map;
  }, [approvedLeave]);

  /** Whether every day in the visible week is covered by approved leave — the whole grid is empty because of it. */
  const weekFullyOnLeave = useMemo(
    () => weekDays.length > 0 && weekDays.every((day) => leaveByDate.has(toDateOnly(day))),
    [weekDays, leaveByDate],
  );

  /**
   * The visible week's leave days as runs of consecutive dates.
   *
   * Leave cells can only be drawn inside time rows, and rows come from the week's free slots. A
   * week partly on leave whose other days have no free slots — past, unscheduled or holidays —
   * therefore has no rows to put them in, so the empty-week message names these runs instead.
   */
  const leaveRunsThisWeek = useMemo(() => {
    const runs: { start: Date; end: Date; leave: DoctorLeaveResponse }[] = [];
    for (const day of weekDays) {
      const leave = leaveByDate.get(toDateOnly(day));
      if (!leave) continue;
      const last = runs[runs.length - 1];
      if (last && last.leave.leaveId === leave.leaveId && toDateOnly(addDays(last.end, 1)) === toDateOnly(day)) {
        last.end = day;
      } else {
        runs.push({ start: day, end: day, leave });
      }
    }
    return runs;
  }, [weekDays, leaveByDate]);

  // ── Actions ─────────────────────────────────────────────────────────────────

  const announce = (message: string) => {
    setNotice(message);
    setError(null);
  };

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, effectiveFrom: toDateOnly(new Date()) });
    setShowForm(true);
  };

  const openEdit = (schedule: DoctorScheduleResponse) => {
    setEditingId(schedule.scheduleId);
    setForm({
      dayOfWeek: schedule.dayOfWeek,
      startTime: schedule.startTime.slice(0, 5),
      endTime: schedule.endTime.slice(0, 5),
      slotDurationMinutes: schedule.slotDurationMinutes,
      effectiveFrom: schedule.effectiveFrom,
      effectiveTo: schedule.effectiveTo ?? '',
    });
    setShowForm(true);
  };

  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!doctorId) return;
    setIsSaving(true);
    setError(null);
    try {
      const shared = {
        startTime: `${form.startTime}:00`,
        endTime: `${form.endTime}:00`,
        slotDurationMinutes: Number(form.slotDurationMinutes),
        effectiveFrom: form.effectiveFrom,
        effectiveTo: form.effectiveTo || null,
      };
      if (editingId) {
        const result = await scheduleApi.update(editingId, { ...shared, isActive: true });
        announce(`Schedule updated. ${describeImpact(result.impact)}`);
      } else {
        const body: CreateScheduleBody = { doctorId, dayOfWeek: form.dayOfWeek, ...shared };
        const result = await scheduleApi.create(body);
        announce(`Schedule created. ${describeImpact(result.impact)}`);
      }
      setShowForm(false);
      await loadWeek();
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to save the schedule.'));
    } finally {
      setIsSaving(false);
    }
  };

  const removeSchedule = async (schedule: DoctorScheduleResponse) => {
    if (
      !window.confirm(
        `Delete the ${DAY_NAMES[schedule.dayOfWeek]} schedule? Free slots will be removed and any bookings flagged.`,
      )
    ) {
      return;
    }
    try {
      const impact = await scheduleApi.remove(schedule.scheduleId);
      announce(`Schedule deleted. ${describeImpact(impact)}`);
      await loadWeek();
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to delete the schedule.'));
    }
  };

  const regenerate = async (schedule: DoctorScheduleResponse) => {
    try {
      const impact = await scheduleApi.regenerate(schedule.scheduleId);
      announce(`Regenerated. ${describeImpact(impact)}`);
      await loadWeek();
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to regenerate slots.'));
    }
  };

  const toggleBlock = async (slot: SlotResponse) => {
    try {
      if (slot.status === 'Blocked') {
        await slotApi.unblock(slot.slotId);
        announce('Slot is bookable again.');
      } else {
        const reason = window.prompt('Why is this slot unavailable? (optional)') ?? null;
        await slotApi.block(slot.slotId, reason);
        announce('Slot blocked.');
      }
      await loadWeek();
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to change the slot.'));
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  const selectedDoctor = doctors.find((d) => d.doctorId === doctorId);
  const weekLabel = `${weekStart.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} – ${addDays(
    weekStart,
    6,
  ).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}`;

  return (
    <div className="management-page schedule-page">
      <div className="page-header">
        <div>
          <h1>Appointments &amp; Scheduling</h1>
          <p className="page-subtitle">
            Doctor working hours and the slots they generate. Times shown in Asia/Colombo.
          </p>
        </div>
        {canManage && doctorId && (
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            Add working day
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

      {/* ── Controls ── */}
      <div className="schedule-toolbar card">
        <div className="form-group">
          <label htmlFor="doctor">Doctor</label>
          <select
            id="doctor"
            className="filter-select"
            value={doctorId}
            onChange={(e) => setDoctorId(e.target.value)}
            disabled={isLoadingDoctors || doctors.length === 0}
          >
            {doctors.length === 0 && <option value="">No bookable doctors</option>}
            {doctors.map((d) => (
              <option key={d.doctorId} value={d.doctorId}>
                {d.fullName}
                {d.specialization ? ` — ${d.specialization}` : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="schedule-week-nav">
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setWeekStart(addDays(weekStart, -7))}>
            ‹ Previous
          </button>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setWeekStart(startOfWeek(new Date()))}>
            This week
          </button>
          <button type="button" className="btn btn-outline btn-sm" onClick={() => setWeekStart(addDays(weekStart, 7))}>
            Next ›
          </button>
          <span className="schedule-week-label">{weekLabel}</span>
        </div>
      </div>

      {flaggedThisWeek.length > 0 && (
        <div className="alert alert-danger schedule-flagged-banner" role="alert">
          <strong>{flaggedThisWeek.length} booking(s) need rescheduling this week.</strong>
          <ul>
            {flaggedThisWeek.slice(0, 5).map((s) => (
              <li key={s.slotId}>
                {s.slotDate} at {colomboTimeLabel(s.startUtc)} — {s.flaggedReason ?? 'no longer fits the schedule'}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Weekly grid ── */}
      <div className="card schedule-grid-card">
        <h2 className="detail-section-title">
          {selectedDoctor ? selectedDoctor.fullName : 'Week'}
        </h2>

        {isLoadingWeek ? (
          <p className="schedule-empty">Loading…</p>
        ) : timeRows.length === 0 && weekFullyOnLeave ? (
          <p className="schedule-empty schedule-empty--leave">
            {selectedDoctor
              ? `${selectedDoctor.fullName} is on approved leave`
              : 'On approved leave'}{' '}
            for the whole of this week.
          </p>
        ) : timeRows.length === 0 && leaveRunsThisWeek.length > 0 ? (
          <div className="schedule-empty schedule-empty--notice">
            <p className="schedule-empty-title">No free slots this week</p>
            <div className="leave-days">
              <span className="leave-days-label">On leave</span>
              {leaveRunsThisWeek.map((run) => (
                <span
                  key={`${run.leave.leaveId}-${toDateOnly(run.start)}`}
                  className="leave-day-chip"
                  title={run.leave.reason ?? undefined}
                >
                  {dayRangeLabel(run.start, run.end)}
                </span>
              ))}
            </div>
            <p className="schedule-empty-hint">The other days are in the past or have no working hours.</p>
          </div>
        ) : timeRows.length === 0 ? (
          <div className="schedule-empty schedule-empty--notice">
            <p className="schedule-empty-title">No free slots this week</p>
            <p className="schedule-empty-hint">
              These dates are in the past, have no working hours, or fall on public holidays.
            </p>
          </div>
        ) : (
          <div className="schedule-grid-scroll">
            <table className="schedule-grid">
              <thead>
                <tr>
                  <th className="schedule-time-col">Time</th>
                  {weekDays.map((day) => (
                    <th key={day.toISOString()}>
                      <span className="schedule-day-name">
                        {DAY_NAMES[day.getDay()].slice(0, 3)}
                      </span>
                      <span className="schedule-day-date">
                        {day.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {timeRows.map((time) => (
                  <tr key={time}>
                    <th scope="row" className="schedule-time-col">
                      {time}
                    </th>
                    {weekDays.map((day) => {
                      const slot = slotIndex.get(`${toDateOnly(day)}|${time}`);
                      if (!slot) {
                        const leave = leaveByDate.get(toDateOnly(day));
                        if (leave) {
                          return (
                            <td
                              key={day.toISOString()}
                              className="schedule-cell schedule-cell--leave"
                              title={`On approved leave${leave.reason ? `: ${leave.reason}` : ''} (${leave.startDate} to ${leave.endDate})`}
                            >
                              On leave
                            </td>
                          );
                        }
                        return <td key={day.toISOString()} className="schedule-cell schedule-cell--none" />;
                      }
                      return (
                        <td key={day.toISOString()} className="schedule-cell">
                          <button
                            type="button"
                            className={`slot-chip slot-chip--${slot.status.toLowerCase()}`}
                            onClick={() => canManage && void toggleBlock(slot)}
                            disabled={!canManage}
                            title={
                              slot.status === 'Blocked'
                                ? `Blocked: ${slot.flaggedReason ?? 'no reason given'}`
                                : `${slot.status} · ${slot.durationMinutes} min`
                            }
                          >
                            {slot.status === 'Available' ? 'Free' : slot.status}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Weekly pattern ── */}
      <div className="card">
        <h2 className="detail-section-title">Weekly pattern</h2>
        {schedules.length === 0 ? (
          <p className="schedule-empty">This doctor has no working days configured.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Day</th>
                <th>Hours</th>
                <th>Slot length</th>
                <th>Effective</th>
                <th>Status</th>
                {canManage && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {schedules.map((s) => (
                <tr key={s.scheduleId}>
                  <td>{DAY_NAMES[s.dayOfWeek]}</td>
                  <td>
                    {s.startTime.slice(0, 5)} – {s.endTime.slice(0, 5)}
                  </td>
                  <td>{s.slotDurationMinutes} min</td>
                  <td>
                    {s.effectiveFrom} → {s.effectiveTo ?? 'open-ended'}
                  </td>
                  <td>
                    <span className={s.isActive ? 'badge badge-success' : 'badge badge-inactive'}>
                      {s.isActive ? 'Active' : 'Paused'}
                    </span>
                  </td>
                  {canManage && (
                    <td className="action-buttons">
                      <button type="button" className="btn btn-sm btn-outline" onClick={() => openEdit(s)}>
                        Edit
                      </button>
                      <button type="button" className="btn btn-sm btn-outline" onClick={() => void regenerate(s)}>
                        Regenerate
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-danger-outline"
                        onClick={() => void removeSchedule(s)}
                      >
                        Delete
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Schedule form ── */}
      {showForm && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-panel">
            <div className="modal-header">
              <h2>{editingId ? 'Edit working day' : 'Add working day'}</h2>
              <button type="button" className="modal-close" onClick={() => setShowForm(false)} aria-label="Close">
                ×
              </button>
            </div>
            <form className="modal-form" onSubmit={submitForm}>
              <div className="form-grid">
                <div className="form-group">
                  <label htmlFor="dayOfWeek">Day</label>
                  <select
                    id="dayOfWeek"
                    value={form.dayOfWeek}
                    disabled={editingId !== null}
                    onChange={(e) =>
                      setForm({ ...form, dayOfWeek: Number(e.target.value) as DayOfWeekNumber })
                    }
                  >
                    {DAY_NAMES.map((name, index) => (
                      <option key={name} value={index}>
                        {name}
                      </option>
                    ))}
                  </select>
                  {editingId !== null && (
                    <span className="field-help">
                      The day cannot be changed. Delete this schedule and add another instead.
                    </span>
                  )}
                </div>

                <div className="form-group">
                  <label htmlFor="slotDuration">Slot length</label>
                  <select
                    id="slotDuration"
                    value={form.slotDurationMinutes}
                    onChange={(e) => setForm({ ...form, slotDurationMinutes: Number(e.target.value) })}
                  >
                    <option value={15}>15 minutes</option>
                    <option value={30}>30 minutes</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="startTime">Start</label>
                  <input
                    id="startTime"
                    type="time"
                    required
                    value={form.startTime}
                    onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="endTime">End</label>
                  <input
                    id="endTime"
                    type="time"
                    required
                    value={form.endTime}
                    onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="effectiveFrom">Effective from</label>
                  <input
                    id="effectiveFrom"
                    type="date"
                    required
                    value={form.effectiveFrom}
                    onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="effectiveTo">Effective to</label>
                  <input
                    id="effectiveTo"
                    type="date"
                    value={form.effectiveTo}
                    onChange={(e) => setForm({ ...form, effectiveTo: e.target.value })}
                  />
                  <span className="field-help">Leave blank for open-ended.</span>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSaving}>
                  {isSaving ? 'Saving…' : editingId ? 'Save changes' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AppointmentsPage;
