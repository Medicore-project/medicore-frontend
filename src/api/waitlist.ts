import apiClient from './client';

/**
 * The waitlist for a doctor's full day (SCRUM-37).
 *
 * Two clients, split by who is asking, exactly as booking and appointment changes are:
 *
 * - `waitlistApi` is the patient's, on the public booking page. Joining and every `mine/…` route go
 *   out with the **booking token** (see `BOOKING_TOKEN_ROUTES`), so they can only ever touch the
 *   patient who identified.
 * - `staffWaitlistApi` is the front desk's, on `{id}/…` routes, always with the **staff** token —
 *   even while a receptionist holds a patient's booking token.
 *
 * Patients are not notified of an offer. They see it here after identifying again on `/book`; the
 * staff page lists live offers so the front desk can phone them.
 */

const waitlistPath = '/appointment/api/waitlist';

// ── Types ─────────────────────────────────────────────────────────────────────

/** An entry's status. Waiting and Offered are active; the rest are how it ended. */
export const WaitlistStatus = {
  Waiting: 'Waiting',
  Offered: 'Offered',
  Accepted: 'Accepted',
  Declined: 'Declined',
  Expired: 'Expired',
  Withdrawn: 'Withdrawn',
} as const;

export type WaitlistStatusValue = (typeof WaitlistStatus)[keyof typeof WaitlistStatus];

/** The list filter for "waiting or offered". */
export const ACTIVE_WAITLIST_FILTER = 'Active';

export type WaitlistStatusFilter = WaitlistStatusValue | typeof ACTIVE_WAITLIST_FILTER;

/** Whether an entry is still in the queue — waiting, or holding an offer. */
export function isActiveWaitlistStatus(status: string): boolean {
  return status === WaitlistStatus.Waiting || status === WaitlistStatus.Offered;
}

/** An entry as the patient sees it: no patient or slot ids. */
export interface PatientWaitlistEntry {
  waitlistEntryId: string;
  doctorId: string;
  doctorName: string | null;
  specialization: string | null;
  /** The Asia/Colombo day waited for, as `YYYY-MM-DD`. */
  slotDate: string;
  /** Where a waiting entry stands: 1 is next. Null for any other status. */
  placeInLine: number | null;
  status: WaitlistStatusValue;
  joinedAtUtc: string;
  /** The offered time, while or since an offer was made. */
  offeredStartUtc: string | null;
  offeredEndUtc: string | null;
  /** When the offer lapses; accepting at or after it is refused. */
  offerExpiresAtUtc: string | null;
  /** The appointment an accepted offer created. */
  appointmentId: string | null;
  closedAtUtc: string | null;
  closedReason: string | null;
}

/** An entry as the clinic sees it. */
export interface WaitlistEntry extends PatientWaitlistEntry {
  patientId: string;
  patientNumber: string | null;
  patientName: string | null;
  serviceCode: string;
  /** The entry's fixed order in its queue; gaps are normal. Use `placeInLine` for display. */
  position: number;
  offeredSlotId: string | null;
}

export interface JoinWaitlistBody {
  doctorId: string;
  /** The Asia/Colombo day, as `YYYY-MM-DD`. */
  date: string;
  serviceCode?: string;
}

export interface WaitlistListParams {
  doctorId?: string;
  from: string;
  to: string;
  status?: WaitlistStatusFilter;
}

// ── The patient ───────────────────────────────────────────────────────────────

export const waitlistApi = {
  /**
   * Joins the doctor's waitlist for a full day, for whoever the held booking token names. Rejects
   * with 409 while the day still has a free time (book it instead), and when already waiting.
   */
  async join(body: JoinWaitlistBody): Promise<PatientWaitlistEntry> {
    const { data } = await apiClient.post<PatientWaitlistEntry>(waitlistPath, body);
    return data;
  },

  /** The token holder's active entries and those closed in the last 30 days. */
  async mine(): Promise<PatientWaitlistEntry[]> {
    const { data } = await apiClient.get<PatientWaitlistEntry[]>(`${waitlistPath}/mine`);
    return data;
  },

  /**
   * Takes the offered time: the appointment is booked and the entry cleared. Resolves with nothing
   * (204); reload `appointmentApi.mine()` to see the appointment. Rejects with 409 once the offer
   * has expired, or when the time clashes with another of the patient's appointments.
   */
  async accept(waitlistEntryId: string): Promise<void> {
    await apiClient.put(`${waitlistPath}/mine/${waitlistEntryId}/accept`);
  },

  /** Turns the offer down; it passes to the next in line. */
  async decline(waitlistEntryId: string): Promise<void> {
    await apiClient.put(`${waitlistPath}/mine/${waitlistEntryId}/decline`);
  },

  /** Leaves the waitlist. An open offer passes to the next in line first. */
  async leave(waitlistEntryId: string): Promise<void> {
    await apiClient.delete(`${waitlistPath}/mine/${waitlistEntryId}`);
  },
};

// ── The front desk ────────────────────────────────────────────────────────────

export const staffWaitlistApi = {
  /**
   * Entries for Colombo dates `from`..`to` inclusive (at most 92 days), optionally for one doctor
   * and in one status, or `Active` for waiting and offered together.
   */
  async list(params: WaitlistListParams): Promise<WaitlistEntry[]> {
    const query = new URLSearchParams({ from: params.from, to: params.to });
    if (params.doctorId) query.set('doctorId', params.doctorId);
    if (params.status) query.set('status', params.status);
    const { data } = await apiClient.get<WaitlistEntry[]>(`${waitlistPath}?${query.toString()}`);
    return data;
  },

  async get(waitlistEntryId: string): Promise<WaitlistEntry> {
    const { data } = await apiClient.get<WaitlistEntry>(`${waitlistPath}/${waitlistEntryId}`);
    return data;
  },

  /** Accepts an open offer on the patient's behalf — a patient on the phone. Books the appointment. */
  async accept(waitlistEntryId: string): Promise<void> {
    await apiClient.put(`${waitlistPath}/${waitlistEntryId}/accept`);
  },

  /** Declines an open offer on the patient's behalf; it passes to the next in line. */
  async decline(waitlistEntryId: string): Promise<WaitlistEntry> {
    const { data } = await apiClient.put<WaitlistEntry>(`${waitlistPath}/${waitlistEntryId}/decline`);
    return data;
  },

  /** Removes an entry, with an optional reason kept on it. An open offer passes on first. */
  async remove(waitlistEntryId: string, reason?: string): Promise<WaitlistEntry> {
    const { data } = await apiClient.delete<WaitlistEntry>(`${waitlistPath}/${waitlistEntryId}`, {
      data: reason ? { reason } : undefined,
    });
    return data;
  },
};
