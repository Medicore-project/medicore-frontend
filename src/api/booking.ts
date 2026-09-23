import apiClient from './client';
import { setBookingToken } from './bookingToken';
import type { CreatePatientBody } from './patients';

/**
 * The public booking flow's client.
 *
 * A separate module from `appointments.ts`, which is the *staff* scheduling client and is already
 * 336 lines. The Colombo helpers are imported from there rather than redefined, because the backend
 * stores every time as a UTC instant and both screens must agree on how that reads as a wall clock.
 *
 * The gateway strips the `/appointment` and `/patient` prefixes, so `api/public/booking/doctors`
 * here is `api/public/booking/doctors` on the service.
 */

const publicBookingPath = '/appointment/api/public/booking';
const appointmentsPath = '/appointment/api/appointments';
const patientsPath = '/patient/api/patients';

// ── Types ─────────────────────────────────────────────────────────────────────

/** A doctor, as the public page is allowed to see them. No department id. */
export interface PublicDoctor {
  doctorId: string;
  fullName: string;
  /** Free text from Identity; an empty string when none is set. */
  specialization: string;
}

/** A bookable time. Deliberately carries no status and no flag reason. */
export interface PublicSlot {
  slotId: string;
  startUtc: string;
  endUtc: string;
  /** The Asia/Colombo calendar date, as `YYYY-MM-DD`. */
  slotDate: string;
  durationMinutes: number;
}

/** Who the patient is, plus the token that lets them book. */
export interface BookingIdentityResponse {
  patientId: string;
  patientNumber: string;
  fullName: string;
  bookingToken: string;
  expiresAtUtc: string;
}

export interface AppointmentResponse {
  appointmentId: string;
  patientId: string;
  doctorId: string;
  slotId: string;
  startUtc: string;
  endUtc: string;
  slotDate: string;
  durationMinutes: number;
  serviceCode: string;
  status: string;
  createdAt: string;
}

// ── Public reads (no credential) ──────────────────────────────────────────────

export const publicBookingApi = {
  async specializations(): Promise<string[]> {
    const { data } = await apiClient.get<string[]>(`${publicBookingPath}/specializations`);
    return data;
  },

  async doctors(specialization?: string): Promise<PublicDoctor[]> {
    const { data } = await apiClient.get<PublicDoctor[]>(`${publicBookingPath}/doctors`, {
      params: specialization ? { specialization } : undefined,
    });
    return data;
  },

  /** Free slots for one doctor. Omitting the range means the service's configured horizon. */
  async slots(doctorId: string, from?: string, to?: string): Promise<PublicSlot[]> {
    const { data } = await apiClient.get<PublicSlot[]>(`${publicBookingPath}/slots`, {
      params: { doctorId, from, to },
    });
    return data;
  },
};

// ── Identifying yourself ──────────────────────────────────────────────────────

/**
 * Both calls store the booking token here, in one place, so no caller can forget to — and so the
 * api client picks it up automatically on the booking request.
 */
export const bookingIdentityApi = {
  /** A returning patient. Rejects with 404 when the pair does not match; the message never says why. */
  async identify(patientNumber: string, dateOfBirth: string): Promise<BookingIdentityResponse> {
    const { data } = await apiClient.post<BookingIdentityResponse>(`${patientsPath}/identify`, {
      patientNumber,
      dateOfBirth,
    });
    setBookingToken(data.bookingToken, data.expiresAtUtc);
    return data;
  },

  /** A first-time patient. Rejects with 409 when the NIC is already registered. */
  async publicRegister(body: CreatePatientBody): Promise<BookingIdentityResponse> {
    const { data } = await apiClient.post<BookingIdentityResponse>(
      `${patientsPath}/public-register`,
      body,
    );
    setBookingToken(data.bookingToken, data.expiresAtUtc);
    return data;
  },
};

// ── Booking ───────────────────────────────────────────────────────────────────

export const appointmentApi = {
  /**
   * Books a slot for whoever the held booking token names.
   *
   * No `patientId` is sent: the service reads it from the token's claim and ignores anything in the
   * body, so sending one would be misleading about where the decision is made.
   */
  async book(slotId: string, serviceCode?: string): Promise<AppointmentResponse> {
    const { data } = await apiClient.post<AppointmentResponse>(appointmentsPath, {
      slotId,
      serviceCode,
    });
    return data;
  },
};

// ── Error narrowing ───────────────────────────────────────────────────────────

function statusOf(error: unknown): number | undefined {
  if (error && typeof error === 'object' && 'response' in error) {
    return (error as { response?: { status?: number } }).response?.status;
  }
  return undefined;
}

/** The slot went to someone else, or the patient already has something at that time. */
export function isSlotUnavailableError(error: unknown): boolean {
  return statusOf(error) === 409;
}

/** The chosen time has passed — the list was stale. */
export function isPastSlotError(error: unknown): boolean {
  return statusOf(error) === 400;
}

/** No match for the patient number and date of birth given. */
export function isIdentityNotFoundError(error: unknown): boolean {
  return statusOf(error) === 404;
}

/** The NIC is already registered, so this person should identify instead. */
export function isAlreadyRegisteredError(error: unknown): boolean {
  return statusOf(error) === 409;
}

/** The booking token expired or was never held. */
export function isBookingSessionExpiredError(error: unknown): boolean {
  return statusOf(error) === 401;
}
