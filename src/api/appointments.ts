import apiClient from './client';

// ── Colombo time ──────────────────────────────────────────────────────────────

/**
 * Asia/Colombo's fixed offset from UTC, in minutes (+05:30).
 *
 * Mirrors `ColomboTime.Offset` in the backend. Slots are stored as UTC instants but a clinic
 * thinks in local wall-clock time, and the browser's own timezone is irrelevant to that — a
 * receptionist in any timezone must see the same grid. Sri Lanka has had no daylight saving
 * since 2006, so a constant is correct.
 */
const COLOMBO_OFFSET_MINUTES = 330;

/**
 * Shifts a UTC instant so that its `getUTC*` accessors read as Colombo wall-clock time.
 * Read the result with `getUTCHours()` / `getUTCDay()`, never the local accessors.
 */
export function toColombo(utcIso: string): Date {
  return new Date(new Date(utcIso).getTime() + COLOMBO_OFFSET_MINUTES * 60_000);
}

/** Colombo time-of-day for a slot, as `HH:mm`. */
export function colomboTimeLabel(utcIso: string): string {
  const d = toColombo(utcIso);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

/** `YYYY-MM-DD` for a Date, matching the `DateOnly` format the API expects. */
export function toDateOnly(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;
}

// ── Types ─────────────────────────────────────────────────────────────────────

/** `System.DayOfWeek` serialises as an integer: Sunday = 0. */
export type DayOfWeekNumber = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

export type SlotStatus = 'Available' | 'Booked' | 'Blocked' | 'Flagged';
export type LeaveStatus = 'Pending' | 'Approved' | 'Rejected';

export interface DoctorScheduleResponse {
  scheduleId: string;
  doctorId: string;
  dayOfWeek: DayOfWeekNumber;
  /** `HH:mm:ss`, Colombo wall clock. */
  startTime: string;
  endTime: string;
  slotDurationMinutes: number;
  effectiveFrom: string;
  effectiveTo?: string | null;
  isActive: boolean;
  createdAt: string;
  createdBy: string;
}

/** What a reconciliation changed. `slotsFlagged` counts patients who need rescheduling. */
export interface SlotReconciliationSummary {
  doctorsProcessed: number;
  slotsCreated: number;
  slotsRemoved: number;
  slotsFlagged: number;
}

export interface DoctorScheduleMutationResponse {
  schedule: DoctorScheduleResponse;
  impact: SlotReconciliationSummary;
}

export interface SlotResponse {
  slotId: string;
  doctorId: string;
  scheduleId?: string | null;
  startUtc: string;
  endUtc: string;
  /** Colombo calendar date, `YYYY-MM-DD`. */
  slotDate: string;
  durationMinutes: number;
  status: SlotStatus;
  flaggedReason?: string | null;
  flaggedAtUtc?: string | null;
}

export interface PublicHolidayResponse {
  holidayId: string;
  date: string;
  name: string;
  createdAt: string;
  createdBy: string;
}

export interface PublicHolidayMutationResponse {
  holiday: PublicHolidayResponse;
  impact: SlotReconciliationSummary;
}

export interface DoctorLeaveResponse {
  leaveId: string;
  doctorId: string;
  startDate: string;
  endDate: string;
  reason?: string | null;
  status: LeaveStatus;
  reviewedBy?: string | null;
  reviewedAtUtc?: string | null;
  reviewNotes?: string | null;
  createdAt: string;
  createdBy: string;
}

export interface DoctorLeaveReviewResponse {
  leave: DoctorLeaveResponse;
  impact: SlotReconciliationSummary;
}

export interface CreateScheduleBody {
  doctorId: string;
  dayOfWeek: DayOfWeekNumber;
  startTime: string;
  endTime: string;
  slotDurationMinutes: number;
  effectiveFrom: string;
  effectiveTo?: string | null;
}

export interface UpdateScheduleBody {
  startTime: string;
  endTime: string;
  slotDurationMinutes: number;
  effectiveFrom: string;
  effectiveTo?: string | null;
  isActive: boolean;
}

// ── API clients ───────────────────────────────────────────────────────────────
// Paths are gateway-prefixed: the gateway routes /appointment/** to the
// appointment service and strips the prefix, so `api/schedules` on the
// controller is reached as `/appointment/api/schedules`.

const schedulesPath = '/appointment/api/schedules';
const slotsPath = '/appointment/api/slots';
const holidaysPath = '/appointment/api/holidays';
const leavesPath = '/appointment/api/doctor-leaves';

export const scheduleApi = {
  /** Every schedule for a doctor, paused ones included. */
  async listForDoctor(doctorId: string): Promise<DoctorScheduleResponse[]> {
    const response = await apiClient.get<DoctorScheduleResponse[]>(
      `${schedulesPath}/doctor/${doctorId}`,
    );
    return response.data;
  },

  /** Creates a schedule and generates its slots. Rejects with 409 on overlap. */
  async create(body: CreateScheduleBody): Promise<DoctorScheduleMutationResponse> {
    const response = await apiClient.post<DoctorScheduleMutationResponse>(schedulesPath, body);
    return response.data;
  },

  /** Updates a schedule and reconciles. Rejects with 409 on overlap. */
  async update(
    scheduleId: string,
    body: UpdateScheduleBody,
  ): Promise<DoctorScheduleMutationResponse> {
    const response = await apiClient.put<DoctorScheduleMutationResponse>(
      `${schedulesPath}/${scheduleId}`,
      body,
    );
    return response.data;
  },

  /** Soft-deletes a schedule and clears the slots it produced. */
  async remove(scheduleId: string): Promise<SlotReconciliationSummary> {
    const response = await apiClient.delete<SlotReconciliationSummary>(
      `${schedulesPath}/${scheduleId}`,
    );
    return response.data;
  },

  /** Re-runs slot generation without changing the schedule. */
  async regenerate(scheduleId: string): Promise<SlotReconciliationSummary> {
    const response = await apiClient.post<SlotReconciliationSummary>(
      `${schedulesPath}/${scheduleId}/regenerate`,
    );
    return response.data;
  },
};

export const slotApi = {
  /** Bookable slots for a doctor. Dates are Colombo calendar dates. */
  async available(doctorId: string, from?: string, to?: string): Promise<SlotResponse[]> {
    const query = new URLSearchParams({ doctorId });
    if (from) query.set('from', from);
    if (to) query.set('to', to);
    const response = await apiClient.get<SlotResponse[]>(
      `${slotsPath}/available?${query.toString()}`,
    );
    return response.data;
  },

  /** Bookings stranded by a schedule, holiday or leave change. */
  async flagged(doctorId?: string): Promise<SlotResponse[]> {
    const query = doctorId ? `?doctorId=${doctorId}` : '';
    const response = await apiClient.get<SlotResponse[]>(`${slotsPath}/flagged${query}`);
    return response.data;
  },

  /** Suppresses a single free slot. Rejects with 409 when it is not available. */
  async block(slotId: string, reason?: string | null): Promise<SlotResponse> {
    const response = await apiClient.patch<SlotResponse>(`${slotsPath}/${slotId}/block`, {
      reason: reason ?? null,
    });
    return response.data;
  },

  /** Returns a blocked slot to bookable. */
  async unblock(slotId: string): Promise<SlotResponse> {
    const response = await apiClient.patch<SlotResponse>(`${slotsPath}/${slotId}/unblock`);
    return response.data;
  },
};

export const holidayApi = {
  async list(): Promise<PublicHolidayResponse[]> {
    const response = await apiClient.get<PublicHolidayResponse[]>(holidaysPath);
    return response.data;
  },

  /** Declares a clinic-wide closure. Rejects with 409 when the date is already declared. */
  async create(date: string, name: string): Promise<PublicHolidayMutationResponse> {
    const response = await apiClient.post<PublicHolidayMutationResponse>(holidaysPath, {
      date,
      name,
    });
    return response.data;
  },

  async remove(holidayId: string): Promise<SlotReconciliationSummary> {
    const response = await apiClient.delete<SlotReconciliationSummary>(
      `${holidaysPath}/${holidayId}`,
    );
    return response.data;
  },
};

export const leaveApi = {
  async listForDoctor(doctorId: string): Promise<DoctorLeaveResponse[]> {
    const response = await apiClient.get<DoctorLeaveResponse[]>(`${leavesPath}/doctor/${doctorId}`);
    return response.data;
  },

  /** The approval queue. Requires the LeaveApprover policy (Admin). */
  async pending(): Promise<DoctorLeaveResponse[]> {
    const response = await apiClient.get<DoctorLeaveResponse[]>(`${leavesPath}/pending`);
    return response.data;
  },

  /** Submits a request. It lands as Pending and changes no slots until approved. */
  async create(body: {
    doctorId: string;
    startDate: string;
    endDate: string;
    reason?: string | null;
  }): Promise<DoctorLeaveResponse> {
    const response = await apiClient.post<DoctorLeaveResponse>(leavesPath, body);
    return response.data;
  },

  /** Approves or rejects. Requires the LeaveApprover policy (Admin). */
  async review(
    leaveId: string,
    decision: 'Approved' | 'Rejected',
    notes?: string | null,
  ): Promise<DoctorLeaveReviewResponse> {
    const response = await apiClient.patch<DoctorLeaveReviewResponse>(
      `${leavesPath}/${leaveId}/review`,
      { decision, notes: notes ?? null },
    );
    return response.data;
  },

  async withdraw(leaveId: string): Promise<SlotReconciliationSummary> {
    const response = await apiClient.delete<SlotReconciliationSummary>(`${leavesPath}/${leaveId}`);
    return response.data;
  },
};
