import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * These drive the real api client through a fake adapter, so what actually goes on the wire — the
 * path, the body and the Authorization header — is observed rather than assumed.
 */

interface SeenRequest {
  url?: string;
  method?: string;
  data?: unknown;
  params?: Record<string, unknown>;
  headers: Record<string, unknown>;
}

async function loadBooking(respondWith: unknown) {
  vi.resetModules();
  const seen: SeenRequest[] = [];

  const { apiClient } = await import('./client');
  apiClient.defaults.adapter = ((config: SeenRequest) => {
    seen.push(config);
    return Promise.resolve({
      data: respondWith,
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    });
  }) as never;

  const booking = await import('./booking');
  const bookingToken = await import('./bookingToken');
  return { booking, bookingToken, seen };
}

const IDENTITY = {
  patientId: 'p-1',
  patientNumber: 'PAT-000123',
  fullName: 'Nimal Perera',
  bookingToken: 'a-booking-token',
  expiresAtUtc: '2026-09-23T08:20:00Z',
};

describe('the public booking client (SCRUM-34)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-23T08:00:00Z'));
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it('identifying stores the booking token so no caller has to remember to', async () => {
    const { booking, bookingToken, seen } = await loadBooking(IDENTITY);

    const result = await booking.bookingIdentityApi.identify('PAT-000123', '1995-04-02');

    expect(seen[0].url).toBe('/patient/api/patients/identify');
    expect(seen[0].data).toContain('PAT-000123');
    expect(result.patientNumber).toBe('PAT-000123');
    expect(bookingToken.getBookingToken()).toBe('a-booking-token');
  });

  it('registering publicly stores the token too', async () => {
    const { booking, bookingToken, seen } = await loadBooking(IDENTITY);

    await booking.bookingIdentityApi.publicRegister({
      nic: '200012345678',
      firstName: 'Kamala',
      lastName: 'Silva',
      dateOfBirth: '1995-04-02',
      gender: 'Female',
      email: 'kamala@example.com',
      phone: '0771234567',
      addressLine1: '1 Galle Road',
      district: 'Colombo',
    });

    expect(seen[0].url).toBe('/patient/api/patients/public-register');
    expect(bookingToken.getBookingToken()).toBe('a-booking-token');
  });

  it('booking sends the booking token and no patientId', async () => {
    // The service reads the patient from the token claim and ignores the body, so sending one
    // would be misleading about where that decision is made.
    const { booking, bookingToken, seen } = await loadBooking({ appointmentId: 'a-1' });
    bookingToken.setBookingToken('a-booking-token', '2026-09-23T08:20:00Z');

    await booking.appointmentApi.book('slot-1', 'GEN-CONSULT');

    expect(seen[0].url).toBe('/appointment/api/appointments');
    expect(seen[0].headers.Authorization).toBe('Bearer a-booking-token');
    expect(seen[0].data).toContain('slot-1');
    expect(seen[0].data).not.toContain('patientId');
  });

  it('the public reads carry no credential at all', async () => {
    const { booking, seen } = await loadBooking([]);

    await booking.publicBookingApi.specializations();
    await booking.publicBookingApi.doctors('Neurology');
    await booking.publicBookingApi.slots('doctor-1');

    expect(seen).toHaveLength(3);
    seen.forEach((request) => expect(request.headers.Authorization).toBeUndefined());
    expect(seen[0].url).toBe('/appointment/api/public/booking/specializations');
    expect(seen[1].params).toEqual({ specialization: 'Neurology' });
    expect(seen[2].params).toMatchObject({ doctorId: 'doctor-1' });
  });

  it('omits the specialization filter entirely when none is chosen', async () => {
    const { booking, seen } = await loadBooking([]);

    await booking.publicBookingApi.doctors();

    expect(seen[0].params).toBeUndefined();
  });

  it('narrows the failures the flow has to tell apart', async () => {
    const { booking } = await loadBooking(null);
    const withStatus = (status: number) => ({ response: { status } });

    expect(booking.isIdentityNotFoundError(withStatus(404))).toBe(true);
    expect(booking.isAlreadyRegisteredError(withStatus(409))).toBe(true);
    expect(booking.isSlotUnavailableError(withStatus(409))).toBe(true);
    expect(booking.isPastSlotError(withStatus(400))).toBe(true);
    expect(booking.isBookingSessionExpiredError(withStatus(401))).toBe(true);

    expect(booking.isSlotUnavailableError(withStatus(404))).toBe(false);
    expect(booking.isPastSlotError(new Error('offline'))).toBe(false);
  });
});
