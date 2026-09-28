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

  it('claims only booking, the waitlist, and reading and changing your own of either', () => {
    expect(BOOKING_TOKEN_ROUTES).toEqual([
      { method: 'post', path: '/appointment/api/appointments' },
      { method: 'get', path: '/appointment/api/appointments/mine' },
      { method: 'put', pattern: /^\/appointment\/api\/appointments\/mine\/[^/]+\/(cancel|reschedule)$/ },
      { method: 'post', path: '/appointment/api/waitlist' },
      { method: 'get', path: '/appointment/api/waitlist/mine' },
      { method: 'put', pattern: /^\/appointment\/api\/waitlist\/mine\/[^/]+\/(accept|decline)$/ },
      { method: 'delete', pattern: /^\/appointment\/api\/waitlist\/mine\/[^/]+$/ },
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

  it('sends it when a patient joins, reads or answers their own waitlist (SCRUM-37)', () => {
    expect(isBookingTokenRequest('post', '/appointment/api/waitlist')).toBe(true);
    expect(isBookingTokenRequest('get', '/appointment/api/waitlist/mine')).toBe(true);
    expect(isBookingTokenRequest('put', '/appointment/api/waitlist/mine/w-1/accept')).toBe(true);
    expect(isBookingTokenRequest('PUT', '/appointment/api/waitlist/mine/w-1/decline')).toBe(true);
    expect(isBookingTokenRequest('delete', '/appointment/api/waitlist/mine/w-1')).toBe(true);
  });

  it('keeps it off the front desk waitlist, even on the look-alike paths', () => {
    // GET on the join path is the staff list; {id}/… are the front desk answering for a patient.
    expect(isBookingTokenRequest('get', '/appointment/api/waitlist')).toBe(false);
    expect(isBookingTokenRequest('get', '/appointment/api/waitlist?from=2026-09-23&to=2026-10-06')).toBe(false);
    expect(isBookingTokenRequest('get', '/appointment/api/waitlist/w-1')).toBe(false);
    expect(isBookingTokenRequest('put', '/appointment/api/waitlist/w-1/accept')).toBe(false);
    expect(isBookingTokenRequest('put', '/appointment/api/waitlist/w-1/decline')).toBe(false);
    expect(isBookingTokenRequest('delete', '/appointment/api/waitlist/w-1')).toBe(false);
    // Anchored at both ends and one segment wide.
    expect(isBookingTokenRequest('put', '/appointment/api/waitlist/mine/w-1/remove')).toBe(false);
    expect(isBookingTokenRequest('put', '/appointment/api/waitlist/mine/w-1/accept/extra')).toBe(false);
    expect(isBookingTokenRequest('delete', '/appointment/api/waitlist/mine/w-1/extra')).toBe(false);
    expect(isBookingTokenRequest('delete', '/appointment/api/waitlist/mine')).toBe(false);
    expect(isBookingTokenRequest('delete', '/evil/appointment/api/waitlist/mine/w-1')).toBe(false);
    expect(isBookingTokenRequest('post', '/appointment/api/waitlist/mine/w-1/accept')).toBe(false);
    // The public days read needs no credential.
    expect(isBookingTokenRequest('get', '/appointment/api/public/booking/days')).toBe(false);
  });

  it('keeps the staff appointment list, on the same path as booking, on the staff token', () => {
    // GET and POST /appointments are different endpoints with different audiences. A receptionist
    // who just booked for a patient still holds that patient's token; the list must not carry it.
    expect(isBookingTokenRequest('get', '/appointment/api/appointments')).toBe(false);
    expect(isBookingTokenRequest('get', '/appointment/api/appointments?doctorId=x&from=2026-09-21')).toBe(false);
    expect(isBookingTokenRequest('get', '/appointment/api/appointments/abc-123')).toBe(false);
  });
});
