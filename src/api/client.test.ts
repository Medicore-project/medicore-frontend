import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * These exercise the real interceptors in `client.ts` by swapping in a fake axios adapter, so the
 * header the request actually leaves with and the handling of a real 401 are both observed rather
 * than assumed.
 *
 * `client.ts` holds module-level refresh state, so each test imports a fresh copy.
 */

const VALID_EXPIRY = '2026-09-23T08:20:00Z';

/** A rejection shaped the way axios hands one to a response interceptor. */
function rejectWith(status: number) {
  return (config: { url?: string; headers: Record<string, unknown> }) =>
    Promise.reject(
      Object.assign(new Error(`Request failed with status code ${status}`), {
        isAxiosError: true,
        config,
        response: { status, data: {}, config, headers: {}, statusText: '' },
      }),
    );
}

/** Loads a fresh client plus the booking-token store that goes with it. */
async function loadClient(adapter: (config: never) => Promise<unknown>) {
  vi.resetModules();
  const bookingToken = await import('./bookingToken');
  const { apiClient } = await import('./client');
  apiClient.defaults.adapter = adapter as never;
  return { apiClient, bookingToken };
}

/** Succeeds, and records the config it was called with. */
function captureAdapter() {
  const seen: Array<{ url?: string; headers: Record<string, unknown> }> = [];
  const adapter = (config: { url?: string; headers: Record<string, unknown> }) => {
    seen.push(config);
    return Promise.resolve({ data: {}, status: 200, statusText: 'OK', headers: {}, config });
  };
  return { seen, adapter };
}

describe('the api client and the booking token (SCRUM-34)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-23T08:00:00Z'));
    localStorage.clear();

    // jsdom will not navigate, so location is replaced with something observable.
    Object.defineProperty(window, 'location', {
      value: { href: '' },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  // ── Which token goes where ──────────────────────────────────────────────────

  it('sends the booking token to the booking endpoint', async () => {
    const { seen, adapter } = captureAdapter();
    const { apiClient, bookingToken } = await loadClient(adapter);
    bookingToken.setBookingToken('a-booking-token', VALID_EXPIRY);

    await apiClient.post('/appointment/api/appointments', { slotId: 'abc' });

    expect(seen[0].headers.Authorization).toBe('Bearer a-booking-token');
  });

  it('never sends the booking token anywhere else, even while one is held', async () => {
    // The case that would break a receptionist: booking on a patient's behalf while signed in.
    const { seen, adapter } = captureAdapter();
    const { apiClient, bookingToken } = await loadClient(adapter);
    localStorage.setItem('access_token', 'staff-token');
    bookingToken.setBookingToken('a-booking-token', VALID_EXPIRY);

    await apiClient.get('/patient/api/patients/search?q=');

    expect(seen[0].headers.Authorization).toBe('Bearer staff-token');
  });

  it('keeps the staff appointment list on the staff token while a booking token is held', async () => {
    // Same path as booking, different endpoint: a receptionist who has just booked for a patient
    // still holds that patient's token, and the list refuses it.
    const { seen, adapter } = captureAdapter();
    const { apiClient, bookingToken } = await loadClient(adapter);
    localStorage.setItem('access_token', 'staff-token');
    bookingToken.setBookingToken('a-booking-token', VALID_EXPIRY);

    await apiClient.get('/appointment/api/appointments', { params: { from: '2026-09-21' } });

    expect(seen[0].headers.Authorization).toBe('Bearer staff-token');
  });

  it('sends the booking token to read your own bookings', async () => {
    const { seen, adapter } = captureAdapter();
    const { apiClient, bookingToken } = await loadClient(adapter);
    localStorage.setItem('access_token', 'staff-token');
    bookingToken.setBookingToken('a-booking-token', VALID_EXPIRY);

    await apiClient.get('/appointment/api/appointments/mine');

    expect(seen[0].headers.Authorization).toBe('Bearer a-booking-token');
  });

  it('sends no credential at all to the public reads', async () => {
    const { seen, adapter } = captureAdapter();
    const { apiClient } = await loadClient(adapter);

    await apiClient.get('/appointment/api/public/booking/doctors');

    expect(seen[0].headers.Authorization).toBeUndefined();
  });

  it('falls back to the staff token for booking when no booking token is held', async () => {
    // How a receptionist books through the same endpoint.
    const { seen, adapter } = captureAdapter();
    const { apiClient } = await loadClient(adapter);
    localStorage.setItem('access_token', 'staff-token');

    await apiClient.post('/appointment/api/appointments', { slotId: 'abc' });

    expect(seen[0].headers.Authorization).toBe('Bearer staff-token');
  });

  it('does not send an expired booking token', async () => {
    const { seen, adapter } = captureAdapter();
    const { apiClient, bookingToken } = await loadClient(adapter);
    bookingToken.setBookingToken('a-booking-token', VALID_EXPIRY);
    vi.setSystemTime(new Date('2026-09-23T08:20:01Z'));

    await apiClient.post('/appointment/api/appointments', { slotId: 'abc' });

    expect(seen[0].headers.Authorization).toBeUndefined();
  });

  it('always stamps a correlation id', async () => {
    const { seen, adapter } = captureAdapter();
    const { apiClient } = await loadClient(adapter);

    await apiClient.get('/appointment/api/public/booking/specializations');

    expect(seen[0].headers['X-Correlation-Id']).toEqual(expect.any(String));
  });

  // ── The 401 that must not log a receptionist out ────────────────────────────

  it('a 401 on booking never clears the session or redirects to login', async () => {
    // The sharp edge of the whole ticket. Without the guard in the response interceptor, a booking
    // token expiring would run localStorage.clear() and hard-redirect — throwing an anonymous
    // patient at a login screen they cannot use, and destroying a signed-in receptionist's session.
    const { apiClient, bookingToken } = await loadClient(rejectWith(401) as never);
    localStorage.setItem('access_token', 'staff-token');
    localStorage.setItem('refresh_token', 'staff-refresh');
    bookingToken.setBookingToken('a-booking-token', VALID_EXPIRY);

    await expect(
      apiClient.post('/appointment/api/appointments', { slotId: 'abc' }),
    ).rejects.toMatchObject({ response: { status: 401 } });

    expect(localStorage.getItem('access_token')).toBe('staff-token');
    expect(localStorage.getItem('refresh_token')).toBe('staff-refresh');
    expect(window.location.href).toBe('');
  });

  it('a 401 on booking is rejected without attempting a refresh', async () => {
    // An anonymous visitor has no refresh token, so there is nothing to refresh with.
    const { apiClient, bookingToken } = await loadClient(rejectWith(401) as never);
    bookingToken.setBookingToken('a-booking-token', VALID_EXPIRY);

    await expect(
      apiClient.post('/appointment/api/appointments', { slotId: 'abc' }),
    ).rejects.toMatchObject({ response: { status: 401 } });

    expect(window.location.href).toBe('');
  });

  it('a 401 anywhere else still follows the existing refresh path', async () => {
    // The pre-existing behaviour, unchanged: no refresh token means clear and bounce to login.
    const { apiClient } = await loadClient(rejectWith(401) as never);
    localStorage.setItem('access_token', 'staff-token');

    await expect(apiClient.get('/patient/api/patients/search?q=')).rejects.toBeDefined();

    expect(localStorage.getItem('access_token')).toBeNull();
    expect(window.location.href).toBe('/login');
  });

  it('a non-401 failure on booking is passed through untouched', async () => {
    const { apiClient, bookingToken } = await loadClient(rejectWith(409) as never);
    bookingToken.setBookingToken('a-booking-token', VALID_EXPIRY);

    await expect(
      apiClient.post('/appointment/api/appointments', { slotId: 'abc' }),
    ).rejects.toMatchObject({ response: { status: 409 } });

    expect(window.location.href).toBe('');
  });
});
