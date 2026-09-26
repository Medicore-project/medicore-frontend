import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BOOKING_TOKEN_ROUTES,
  bookingTokenExpiresAt,
  clearBookingToken,
  getBookingToken,
  isBookingTokenRequest,
  setBookingToken,
} from './bookingToken';

const NOW = new Date('2026-09-23T08:00:00Z');

/** Twenty minutes out, matching what the Patient service mints. */
const VALID_EXPIRY = '2026-09-23T08:20:00Z';

describe('the booking token store (SCRUM-34)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    clearBookingToken();
  });

  afterEach(() => {
    vi.useRealTimers();
    clearBookingToken();
  });

  it('hands back the token it was given', () => {
    setBookingToken('a-booking-token', VALID_EXPIRY);

    expect(getBookingToken()).toBe('a-booking-token');
    expect(bookingTokenExpiresAt()).toBe(VALID_EXPIRY);
  });

  it('starts empty, so a fresh tab has no credential', () => {
    expect(getBookingToken()).toBeNull();
    expect(bookingTokenExpiresAt()).toBeNull();
  });

  it('never keeps the token anywhere a later visitor could find it', () => {
    // In memory only, deliberately: the booking page runs on shared clinic browsers and this is a
    // bearer credential for someone's identity.
    setBookingToken('a-booking-token', VALID_EXPIRY);

    expect(localStorage.getItem('booking_token')).toBeNull();
    expect(Object.values({ ...localStorage })).not.toContain('a-booking-token');
  });

  it('refuses to hand back an expired token, so the page can explain rather than 401', () => {
    setBookingToken('a-booking-token', VALID_EXPIRY);

    vi.setSystemTime(new Date('2026-09-23T08:20:01Z'));

    expect(getBookingToken()).toBeNull();
    expect(bookingTokenExpiresAt()).toBeNull();
  });

  it('treats the exact moment of expiry as expired', () => {
    setBookingToken('a-booking-token', VALID_EXPIRY);

    vi.setSystemTime(new Date(VALID_EXPIRY));

    expect(getBookingToken()).toBeNull();
  });

  it('treats an unparseable expiry as expired rather than sending a token of unknown age', () => {
    setBookingToken('a-booking-token', 'not-a-date');

    expect(getBookingToken()).toBeNull();
  });

  it('forgets the token on demand, for signing out of the flow', () => {
    setBookingToken('a-booking-token', VALID_EXPIRY);

    clearBookingToken();

    expect(getBookingToken()).toBeNull();
  });

  it('claims only booking, reading your own bookings, and changing your own bookings', () => {
    expect(BOOKING_TOKEN_ROUTES).toEqual([
      { method: 'post', path: '/appointment/api/appointments' },
      { method: 'get', path: '/appointment/api/appointments/mine' },
      { method: 'put', pattern: /^\/appointment\/api\/appointments\/mine\/[^/]+\/(cancel|reschedule)$/ },
    ]);

    expect(isBookingTokenRequest('post', '/appointment/api/appointments')).toBe(true);
    expect(isBookingTokenRequest('get', '/appointment/api/appointments/mine')).toBe(true);
    expect(isBookingTokenRequest('GET', '/appointment/api/appointments/mine')).toBe(true);

    // The reads the public page makes before anyone has identified themselves need no credential.
    expect(isBookingTokenRequest('get', '/appointment/api/public/booking/doctors')).toBe(false);
    expect(isBookingTokenRequest('get', '/appointment/api/public/booking/slots')).toBe(false);
    // And a receptionist's own work must never carry it.
    expect(isBookingTokenRequest('get', '/patient/api/patients/search')).toBe(false);
    expect(isBookingTokenRequest('get', '/appointment/api/schedules')).toBe(false);
    expect(isBookingTokenRequest('get', undefined)).toBe(false);
  });

  it("sends it when a patient cancels or reschedules one of their own (SCRUM-36)", () => {
    expect(isBookingTokenRequest('put', '/appointment/api/appointments/mine/a-1/cancel')).toBe(true);
    expect(isBookingTokenRequest('PUT', '/appointment/api/appointments/mine/a-1/reschedule')).toBe(true);
  });

  it('keeps it off every staff change, even on the look-alike paths', () => {
    // A receptionist holding a patient's token must still cancel, reschedule and complete as
    // themselves; the service would refuse the booking token on these routes anyway.
    expect(isBookingTokenRequest('put', '/appointment/api/appointments/a-1/cancel')).toBe(false);
    expect(isBookingTokenRequest('put', '/appointment/api/appointments/a-1/reschedule')).toBe(false);
    expect(isBookingTokenRequest('put', '/appointment/api/appointments/a-1/complete')).toBe(false);
    expect(isBookingTokenRequest('get', '/appointment/api/appointments/a-1/history')).toBe(false);
    // Anchored at both ends and one segment wide: nothing else under mine/ is claimed.
    expect(isBookingTokenRequest('put', '/appointment/api/appointments/mine/a-1/complete')).toBe(false);
    expect(isBookingTokenRequest('put', '/appointment/api/appointments/mine/a-1/cancel/extra')).toBe(false);
    expect(isBookingTokenRequest('put', '/appointment/api/appointments/mine/a/b/cancel')).toBe(false);
    expect(isBookingTokenRequest('put', '/evil/appointment/api/appointments/mine/a-1/cancel')).toBe(false);
    expect(isBookingTokenRequest('post', '/appointment/api/appointments/mine/a-1/cancel')).toBe(false);
  });

  it('keeps the staff appointment list, on the same path as booking, on the staff token', () => {
    // GET and POST /appointments are different endpoints with different audiences. A receptionist
    // who just booked for a patient still holds that patient's token; the list must not carry it.
    expect(isBookingTokenRequest('get', '/appointment/api/appointments')).toBe(false);
    expect(isBookingTokenRequest('get', '/appointment/api/appointments?doctorId=x&from=2026-09-21')).toBe(false);
    expect(isBookingTokenRequest('get', '/appointment/api/appointments/abc-123')).toBe(false);
  });
});
