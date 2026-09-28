import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DAY_NAMES,
  bookedApi,
  colomboTimeLabel,
  doctorApi,
  leaveApi,
  scheduleApi,
  slotApi,
  toDateOnly,
} from '../api/appointments';
import type {
  AppointmentSummary,
  CreateScheduleBody,
  DayOfWeekNumber,
  DoctorLeaveResponse,
  DoctorResponse,
  DoctorScheduleResponse,
  SlotReconciliationSummary,
  SlotResponse,
} from '../api/appointments';
import { staffWaitlistApi } from '../api/waitlist';
import type { WaitlistEntry } from '../api/waitlist';
import ActionDialog from '../components/common/ActionDialog';
import {
  AlertIcon,
  CalendarIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  CloseIcon,
  LockIcon,
  PencilIcon,
  PlaneIcon,
  PlusIcon,
  RefreshIcon,
  TrashIcon,
  UsersIcon,
} from '../components/icons/LineIcons';
import { useAuth } from '../contexts/AuthContext';
import { extractErrorMessage } from '../utils/apiError';
import { initialsOf } from '../utils/initials';
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

/** The hover text on a booked cell: who, and the booking's shape. */
function bookedChipTitle(appointment: AppointmentSummary, needsRescheduling: boolean): string {
  const who = appointment.patientName
    ? `${appointment.patientName}${appointment.patientNumber ? ` (${appointment.patientNumber})` : ''}`
    : 'A patient (booked without a name on record)';
  const rescheduling = needsRescheduling ? ' — needs rescheduling' : '';
  return `Booked: ${who} · ${appointment.durationMinutes} min · ${appointment.serviceCode}${rescheduling}`;
}

/** Minutes past midnight for an `HH:mm` value, or null when it is not one. */
function minutesOf(time: string): number | null {
  const match = /^(\d{2}):(\d{2})/.exec(time);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

/** Monday first, the way the clinic reads a week. */
const WEEK_ORDER: DayOfWeekNumber[] = [1, 2, 3, 4, 5, 6, 0];

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

/** A question the page is waiting on the user to answer, shown in an ActionDialog. */
type PendingAction =
  | { kind: 'block'; slot: SlotResponse }
  | { kind: 'delete'; schedule: DoctorScheduleResponse };

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
  // Slots held for a waitlisted patient this week (SCRUM-37).
  const [offered, setOffered] = useState<WaitlistEntry[]>([]);
  const [approvedLeave, setApprovedLeave] = useState<DoctorLeaveResponse[]>([]);
  const [booked, setBooked] = useState<AppointmentSummary[]>([]);

  const [isLoadingDoctors, setIsLoadingDoctors] = useState(true);
  const [isLoadingWeek, setIsLoadingWeek] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [busySlotId, setBusySlotId] = useState<string | null>(null);

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );
  const todayIso = toDateOnly(new Date());
  const isCurrentWeek = toDateOnly(weekStart) === toDateOnly(startOfWeek(new Date()));

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
      const [available, flaggedSlots, doctorSchedules, leave, appointments, offers] = await Promise.all([
        slotApi.available(doctorId, from, to),
        slotApi.flagged(doctorId),
        scheduleApi.listForDoctor(doctorId),
        leaveApi.approved(doctorId, from, to),
        bookedApi.list({ doctorId, from, to }),
        // SCRUM-37: slots held for the waitlist. Missing them only leaves those cells blank, so a
        // failure here must not take the whole week down with it.
        staffWaitlistApi.list({ doctorId, from, to, status: 'Offered' }).catch(() => []),
      ]);
      setSlots(available);
      setFlagged(flaggedSlots);
      setSchedules(doctorSchedules);
      setApprovedLeave(leave);
      // A cancelled appointment released its slot, which the availability listing already shows
      // as free again; drawing it as well would put two things in one cell.
      setBooked(appointments.filter((a) => a.status === 'Booked'));
      setOffered(offers);
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to load the schedule.'));
      setSlots([]);
      setFlagged([]);
      setSchedules([]);
      setApprovedLeave([]);
      setBooked([]);
      setOffered([]);
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
    const times = new Set([
      ...slots.map((s) => colomboTimeLabel(s.startUtc)),
      // Booked times too: the availability listing returns free slots only, so a booked slot
      // would otherwise have no row to be drawn in and simply vanish from the grid.
      ...booked.map((a) => colomboTimeLabel(a.startUtc)),
      // And times held for the waitlist, which the availability listing leaves out too.
      ...offered.flatMap((entry) => (entry.offeredStartUtc ? [colomboTimeLabel(entry.offeredStartUtc)] : [])),
    ]);
    return [...times].sort();
  }, [slots, booked, offered]);

  /** `${slotDate}|${HH:mm}` → the waitlist entry a slot there is held for (SCRUM-37). */
  const offeredIndex = useMemo(() => {
    const map = new Map<string, WaitlistEntry>();
    offered.forEach((entry) => {
      if (entry.offeredStartUtc) map.set(`${entry.slotDate}|${colomboTimeLabel(entry.offeredStartUtc)}`, entry);
    });
    return map;
  }, [offered]);

  /** `${slotDate}|${HH:mm}` → the appointment booked there. */
  const bookedIndex = useMemo(() => {
    const map = new Map<string, AppointmentSummary>();
    booked.forEach((a) => map.set(`${a.slotDate}|${colomboTimeLabel(a.startUtc)}`, a));
    return map;
  }, [booked]);

  const flaggedSlotIds = useMemo(() => new Set(flagged.map((s) => s.slotId)), [flagged]);

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

  /** The week at a glance, over the same data the grid draws. */
  const weekStats = useMemo(
    () => ({
      free: slots.filter((s) => s.status === 'Available').length,
      blocked: slots.filter((s) => s.status === 'Blocked').length,
      booked: booked.length,
      held: offered.length,
      rescheduling: flaggedThisWeek.length,
    }),
    [slots, booked, offered, flaggedThisWeek],
  );

  const schedulesByDay = useMemo(() => {
    const map = new Map<number, DoctorScheduleResponse[]>();
    schedules.forEach((s) => map.set(s.dayOfWeek, [...(map.get(s.dayOfWeek) ?? []), s]));
    map.forEach((list) => list.sort((a, b) => a.startTime.localeCompare(b.startTime)));
    return map;
  }, [schedules]);

  // ── Actions ─────────────────────────────────────────────────────────────────

  const announce = (message: string) => {
    setNotice(message);
    setError(null);
  };

  const openCreate = (dayOfWeek?: DayOfWeekNumber) => {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, dayOfWeek: dayOfWeek ?? EMPTY_FORM.dayOfWeek, effectiveFrom: toDateOnly(new Date()) });
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

  const regenerate = async (schedule: DoctorScheduleResponse) => {
    try {
      const impact = await scheduleApi.regenerate(schedule.scheduleId);
      announce(`Regenerated. ${describeImpact(impact)}`);
      await loadWeek();
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to regenerate slots.'));
    }
  };

  /** A blocked slot unblocks at once; blocking asks for an optional reason first. */
  const onSlotClick = async (slot: SlotResponse) => {
    if (!canManage) return;
    if (slot.status !== 'Blocked') {
      setPendingAction({ kind: 'block', slot });
      return;
    }
    setBusySlotId(slot.slotId);
    try {
      await slotApi.unblock(slot.slotId);
      announce('Slot is bookable again.');
      await loadWeek();
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to change the slot.'));
    } finally {
      setBusySlotId(null);
    }
  };

  /** Runs the confirmed dialog action. Rejections propagate so the dialog shows them in place. */
  const confirmPending = async (text: string | null) => {
    if (!pendingAction) return;
    if (pendingAction.kind === 'block') {
      await slotApi.block(pendingAction.slot.slotId, text);
      announce('Slot blocked.');
    } else {
      const impact = await scheduleApi.remove(pendingAction.schedule.scheduleId);
      announce(`Schedule deleted. ${describeImpact(impact)}`);
    }
    setPendingAction(null);
    await loadWeek();
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  const selectedDoctor = doctors.find((d) => d.doctorId === doctorId);
  const weekLabel = `${weekStart.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} – ${addDays(
    weekStart,
    6,
  ).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}`;

  const formStart = minutesOf(form.startTime);
  const formEnd = minutesOf(form.endTime);
  const formSpan = formStart !== null && formEnd !== null ? formEnd - formStart : 0;
  const formSlots = formSpan > 0 ? Math.floor(formSpan / Number(form.slotDurationMinutes)) : 0;
  const formInvalid = formSpan <= 0 || (form.effectiveTo !== '' && form.effectiveTo < form.effectiveFrom);

  return (
    <div className="management-page sc-page schedule-page">
      {/* ── Header ── */}
      <header className="sc-hero">
        <div className="sc-hero-copy">
          <span className="sc-eyebrow">
            <CalendarIcon className="ws-icon-sm" /> Scheduling
          </span>
          <h1>Appointments &amp; Scheduling</h1>
          <p className="page-subtitle">
            Doctor working hours and the slots they generate. Times shown in Asia/Colombo.
          </p>
        </div>
        {canManage && doctorId && (
          <button type="button" className="btn btn-primary sc-hero-action" onClick={() => openCreate()}>
            <PlusIcon className="ws-icon-sm" /> Add working day
          </button>
        )}
      </header>

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

      {/* ── Controls ── */}
      <section className="sc-toolbar" aria-label="Doctor and week">
        <div className="sc-doctor">
          <span className="sc-doctor-avatar" aria-hidden="true">
            {selectedDoctor ? initialsOf(selectedDoctor.fullName) : '—'}
          </span>
          <div className="sc-doctor-field">
            <label htmlFor="doctor">Doctor</label>
            <select
              id="doctor"
              className="sc-select"
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
        </div>

        <div className="sc-week-nav">
          <div className="sc-segmented" role="group" aria-label="Change week">
            <button type="button" onClick={() => setWeekStart(addDays(weekStart, -7))} aria-label="Previous week">
              <ChevronLeftIcon className="ws-icon-sm" />
            </button>
            <button
              type="button"
              className={isCurrentWeek ? 'is-current' : ''}
              onClick={() => setWeekStart(startOfWeek(new Date()))}
            >
              This week
            </button>
            <button type="button" onClick={() => setWeekStart(addDays(weekStart, 7))} aria-label="Next week">
              <ChevronRightIcon className="ws-icon-sm" />
            </button>
          </div>
          <span key={weekLabel} className="sc-week-label">
            {weekLabel}
          </span>
          <button
            type="button"
            className="sc-icon-btn"
            onClick={() => void loadWeek()}
            disabled={isLoadingWeek || !doctorId}
            aria-label="Reload this week"
            title="Reload this week"
          >
            <RefreshIcon className={`ws-icon-sm ${isLoadingWeek ? 'is-spinning' : ''}`} />
          </button>
        </div>
      </section>

      {/* ── The week at a glance ── */}
      {doctorId && (
        <div className="sc-stats" role="group" aria-label="This week at a glance">
          {[
            { key: 'free', label: 'Free slots', value: weekStats.free, icon: CalendarIcon },
            { key: 'booked', label: 'Booked', value: weekStats.booked, icon: CheckIcon },
            { key: 'held', label: 'Held for waitlist', value: weekStats.held, icon: UsersIcon },
            { key: 'blocked', label: 'Blocked', value: weekStats.blocked, icon: LockIcon },
            { key: 'rescheduling', label: 'Need rescheduling', value: weekStats.rescheduling, icon: AlertIcon },
          ].map(({ key, label, value, icon: Icon }, index) => (
            <div key={key} className={`sc-stat sc-stat--${key}`} style={{ '--i': index } as React.CSSProperties}>
              <span className="sc-stat-icon" aria-hidden="true">
                <Icon className="ws-icon-sm" />
              </span>
              <span className="sc-stat-text">
                <strong>{isLoadingWeek ? '–' : value}</strong>
                <span>{label}</span>
              </span>
            </div>
          ))}
        </div>
      )}

      {flaggedThisWeek.length > 0 && (
        <div className="alert alert-danger sc-flagged" role="alert">
          <AlertIcon className="ws-icon" />
          <div>
            <strong>{flaggedThisWeek.length} booking(s) need rescheduling this week.</strong>
            <ul>
              {flaggedThisWeek.slice(0, 5).map((s) => (
                <li key={s.slotId}>
                  {s.slotDate} at {colomboTimeLabel(s.startUtc)} — {s.flaggedReason ?? 'no longer fits the schedule'}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* ── Weekly grid ── */}
      <section className="sc-card sc-grid-card">
        <div className="sc-card-head">
          <div>
            <h2>{selectedDoctor ? selectedDoctor.fullName : 'Week'}</h2>
            <p>
              {selectedDoctor?.specialization ? `${selectedDoctor.specialization} · ` : ''}
              {canManage ? 'Select a free slot to block it, or a blocked one to free it.' : 'The doctor’s slots for the week.'}
            </p>
          </div>
          <ul className="sc-legend" aria-label="Legend">
            <li><span className="sc-swatch sc-swatch--free" /> Free slot</li>
            <li><span className="sc-swatch sc-swatch--booked" /> Patient booked</li>
            <li><span className="sc-swatch sc-swatch--offered" /> Held</li>
            <li><span className="sc-swatch sc-swatch--blocked" /> Blocked slot</li>
            <li><span className="sc-swatch sc-swatch--flagged" /> Reschedule</li>
            <li><span className="sc-swatch sc-swatch--leave" /> Leave</li>
          </ul>
        </div>

        {/* The skeleton covers the doctor list loading too, so the empty-week message does not flash
            up before there is a doctor to have an empty week. */}
        {isLoadingWeek || isLoadingDoctors ? (
          <div className="sc-grid-skeleton" aria-label="Loading the week">
            {Array.from({ length: 5 }, (_, row) => (
              <div key={row} className="sc-skeleton-row">
                {Array.from({ length: 8 }, (__, col) => (
                  <span key={col} className="sc-skeleton" style={{ '--i': row * 8 + col } as React.CSSProperties} />
                ))}
              </div>
            ))}
          </div>
        ) : timeRows.length === 0 && weekFullyOnLeave ? (
          <div className="sc-empty sc-empty--leave">
            <PlaneIcon className="sc-empty-icon" />
            <p className="schedule-empty">
              {selectedDoctor
                ? `${selectedDoctor.fullName} is on approved leave`
                : 'On approved leave'}{' '}
              for the whole of this week.
            </p>
          </div>
        ) : timeRows.length === 0 && leaveRunsThisWeek.length > 0 ? (
          <div className="sc-empty">
            <PlaneIcon className="sc-empty-icon" />
            <p className="sc-empty-title">No free slots this week</p>
            <div className="sc-leave-days">
              <span className="sc-leave-days-label">On leave</span>
              {leaveRunsThisWeek.map((run) => (
                <span
                  key={`${run.leave.leaveId}-${toDateOnly(run.start)}`}
                  className="sc-leave-chip"
                  title={run.leave.reason ?? undefined}
                >
                  {dayRangeLabel(run.start, run.end)}
                </span>
              ))}
            </div>
            <p className="sc-empty-hint">The other days are in the past or have no working hours.</p>
          </div>
        ) : timeRows.length === 0 ? (
          <div className="sc-empty">
            <CalendarIcon className="sc-empty-icon" />
            <p className="sc-empty-title">No free slots this week</p>
            <p className="sc-empty-hint">
              These dates are in the past, have no working hours, or fall on public holidays.
            </p>
          </div>
        ) : (
          <div className="sc-grid-scroll">
            <table className="sc-grid">
              <thead>
                <tr>
                  <th className="sc-time-col">Time</th>
                  {weekDays.map((day) => {
                    const iso = toDateOnly(day);
                    return (
                      <th
                        key={day.toISOString()}
                        className={`${iso === todayIso ? 'is-today' : ''} ${iso < todayIso ? 'is-past' : ''}`}
                      >
                        <span className="sc-day-name">{DAY_NAMES[day.getDay()].slice(0, 3)}</span>
                        <span className="sc-day-date">
                          {day.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                        </span>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {timeRows.map((time, rowIndex) => (
                  <tr key={time} style={{ '--row': rowIndex } as React.CSSProperties}>
                    <th scope="row" className="sc-time-col">
                      {time}
                    </th>
                    {weekDays.map((day) => {
                      const iso = toDateOnly(day);
                      const dayClass = `sc-cell ${iso === todayIso ? 'is-today' : ''} ${iso < todayIso ? 'is-past' : ''}`;
                      const appointment = bookedIndex.get(`${iso}|${time}`);
                      if (appointment) {
                        const needsRescheduling = flaggedSlotIds.has(appointment.slotId);
                        return (
                          <td key={day.toISOString()} className={dayClass}>
                            <div
                              className={`slot-chip slot-chip--patient ${
                                needsRescheduling ? 'slot-chip--flagged' : 'slot-chip--booked'
                              }`}
                              data-testid="booked-slot"
                              title={bookedChipTitle(appointment, needsRescheduling)}
                            >
                              <span className="slot-chip-patient">{appointment.patientName ?? 'Booked'}</span>
                              {appointment.patientNumber && (
                                <span className="slot-chip-number">{appointment.patientNumber}</span>
                              )}
                            </div>
                          </td>
                        );
                      }
                      const offer = offeredIndex.get(`${iso}|${time}`);
                      if (offer) {
                        return (
                          <td key={day.toISOString()} className={dayClass}>
                            <div
                              className="slot-chip slot-chip--patient slot-chip--offered"
                              data-testid="offered-slot"
                              title={`Held for ${offer.patientName ?? 'a waitlisted patient'}${
                                offer.offerExpiresAtUtc ? ` until ${colomboTimeLabel(offer.offerExpiresAtUtc)}` : ''
                              } — see the Waitlist page`}
                            >
                              <span className="slot-chip-patient">Offered</span>
                              <span className="slot-chip-number">{offer.patientName ?? 'Waitlist'}</span>
                            </div>
                          </td>
                        );
                      }
                      const slot = slotIndex.get(`${iso}|${time}`);
                      if (!slot) {
                        const leave = leaveByDate.get(iso);
                        if (leave) {
                          return (
                            <td
                              key={day.toISOString()}
                              className={`${dayClass} sc-cell--leave`}
                              title={`On approved leave${leave.reason ? `: ${leave.reason}` : ''} (${leave.startDate} to ${leave.endDate})`}
                            >
                              On leave
                            </td>
                          );
                        }
                        return <td key={day.toISOString()} className={`${dayClass} sc-cell--none`} />;
                      }
                      return (
                        <td key={day.toISOString()} className={dayClass}>
                          <button
                            type="button"
                            className={`slot-chip slot-chip--${slot.status.toLowerCase()} ${busySlotId === slot.slotId ? 'is-busy' : ''}`}
                            onClick={() => void onSlotClick(slot)}
                            disabled={!canManage || busySlotId === slot.slotId}
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
      </section>

      {/* ── Weekly pattern ── */}
      <section className="sc-card">
        <div className="sc-card-head">
          <div>
            <h2>Weekly pattern</h2>
            <p>The working hours that generate the grid above, day by day.</p>
          </div>
        </div>
        {schedules.length === 0 && !canManage ? (
          <div className="sc-empty sc-empty--compact">
            <ClockIcon className="sc-empty-icon" />
            <p className="sc-empty-title">This doctor has no working days configured.</p>
          </div>
        ) : (
          <>
            {schedules.length === 0 && (
              <p className="sc-pattern-hint">This doctor has no working days configured. Add one to open bookings.</p>
            )}
            <div className="sc-pattern">
              {WEEK_ORDER.map((dayNumber, index) => {
                const list = schedulesByDay.get(dayNumber) ?? [];
                return (
                  <div
                    key={dayNumber}
                    className={`sc-pattern-day ${list.length ? 'has-hours' : ''}`}
                    style={{ '--i': index } as React.CSSProperties}
                  >
                    <span className="sc-pattern-dayname">{DAY_NAMES[dayNumber]}</span>
                    {list.map((s) => (
                      <article key={s.scheduleId} className={`sc-shift ${s.isActive ? '' : 'is-paused'}`}>
                        <strong className="sc-shift-hours">
                          {s.startTime.slice(0, 5)} – {s.endTime.slice(0, 5)}
                        </strong>
                        <span className="sc-shift-meta">
                          {s.slotDurationMinutes} min slots · {s.isActive ? 'Active' : 'Paused'}
                        </span>
                        <span className="sc-shift-range">
                          {s.effectiveFrom} → {s.effectiveTo ?? 'open-ended'}
                        </span>
                        {canManage && (
                          <span className="sc-shift-actions">
                            <button type="button" onClick={() => openEdit(s)} aria-label={`Edit ${DAY_NAMES[dayNumber]} schedule`} title="Edit">
                              <PencilIcon className="ws-icon-sm" />
                            </button>
                            <button type="button" onClick={() => void regenerate(s)} aria-label={`Regenerate ${DAY_NAMES[dayNumber]} slots`} title="Regenerate slots">
                              <RefreshIcon className="ws-icon-sm" />
                            </button>
                            <button
                              type="button"
                              className="is-danger"
                              onClick={() => setPendingAction({ kind: 'delete', schedule: s })}
                              aria-label={`Delete ${DAY_NAMES[dayNumber]} schedule`}
                              title="Delete"
                            >
                              <TrashIcon className="ws-icon-sm" />
                            </button>
                          </span>
                        )}
                      </article>
                    ))}
                    {list.length === 0 && <span className="sc-pattern-off">Day off</span>}
                    {canManage && doctorId && (
                      <button
                        type="button"
                        className="sc-pattern-add"
                        onClick={() => openCreate(dayNumber)}
                        aria-label={`Add hours on ${DAY_NAMES[dayNumber]}`}
                      >
                        <PlusIcon className="ws-icon-sm" /> Add hours
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </section>

      {/* ── Schedule form ── */}
      {showForm && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="sc-form-title">
          <div className="modal-panel sc-form-panel">
            <div className="modal-header">
              <div>
                <h2 id="sc-form-title">{editingId ? 'Edit working day' : 'Add working day'}</h2>
                <p className="page-subtitle">{selectedDoctor?.fullName}</p>
              </div>
              <button type="button" className="modal-close" onClick={() => setShowForm(false)} aria-label="Close">
                ×
              </button>
            </div>
            <form className="modal-form" onSubmit={submitForm}>
              <div className="form-group">
                <span className="sc-form-label" id="sc-day-label">Day</span>
                <div className="sc-day-picker" role="radiogroup" aria-labelledby="sc-day-label">
                  {WEEK_ORDER.map((dayNumber) => (
                    <button
                      key={dayNumber}
                      type="button"
                      role="radio"
                      aria-checked={form.dayOfWeek === dayNumber}
                      disabled={editingId !== null}
                      className={form.dayOfWeek === dayNumber ? 'is-selected' : ''}
                      onClick={() => setForm({ ...form, dayOfWeek: dayNumber })}
                    >
                      {DAY_NAMES[dayNumber].slice(0, 3)}
                    </button>
                  ))}
                </div>
                {editingId !== null && (
                  <span className="field-help">
                    The day cannot be changed. Delete this schedule and add another instead.
                  </span>
                )}
              </div>

              <div className="form-grid">
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

              <div className={`sc-preview ${formInvalid ? 'is-invalid' : ''}`} aria-live="polite">
                <ClockIcon className="ws-icon-sm" />
                {formSpan <= 0
                  ? 'The end time must be after the start time.'
                  : form.effectiveTo !== '' && form.effectiveTo < form.effectiveFrom
                    ? 'The last effective date is before the first.'
                    : `Every ${DAY_NAMES[form.dayOfWeek]}: ${formSlots} slot${formSlots === 1 ? '' : 's'} of ${form.slotDurationMinutes} minutes, ${form.startTime}–${form.endTime}.`}
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={isSaving || formInvalid}>
                  {isSaving ? 'Saving…' : editingId ? 'Save changes' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {pendingAction?.kind === 'block' && (
        <ActionDialog
          title="Block this slot?"
          subtitle={`${pendingAction.slot.slotDate} at ${colomboTimeLabel(pendingAction.slot.startUtc)} · ${selectedDoctor?.fullName ?? ''}`}
          body="Patients will not be able to book it until it is unblocked."
          field={{ label: 'Reason', placeholder: 'For example, a ward round or a meeting.', maxLength: 200 }}
          confirmLabel="Block slot"
          busyLabel="Blocking…"
          onConfirm={confirmPending}
          onClose={() => setPendingAction(null)}
        />
      )}
      {pendingAction?.kind === 'delete' && (
        <ActionDialog
          title={`Delete the ${DAY_NAMES[pendingAction.schedule.dayOfWeek]} schedule?`}
          subtitle={`${pendingAction.schedule.startTime.slice(0, 5)} – ${pendingAction.schedule.endTime.slice(0, 5)} · ${selectedDoctor?.fullName ?? ''}`}
          body="Its free slots are removed, and any bookings on them are flagged for rescheduling."
          confirmLabel="Delete schedule"
          busyLabel="Deleting…"
          tone="danger"
          onConfirm={confirmPending}
          onClose={() => setPendingAction(null)}
        />
      )}
    </div>
  );
};

export default AppointmentsPage;
