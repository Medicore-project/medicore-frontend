import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Drives the real api client through a fake adapter, as the booking client's tests do, so the
 * path, body and — above all — which token goes out are observed rather than assumed.
 */

interface SeenRequest {
  url?: string;
  method?: string;
  data?: unknown;
  headers: Record<string, unknown>;
}

async function loadWaitlist(respondWith: unknown) {
  vi.resetModules();
  const seen: SeenRequest[] = [];

  const { apiClient } = await import('./client');
  apiClient.defaults.adapter = ((config: SeenRequest) => {
    seen.push(config);
    return Promise.resolve({ data: respondWith, status: 200, statusText: 'OK', headers: {}, config });
  }) as never;

  const waitlist = await import('./waitlist');
  const bookingToken = await import('./bookingToken');
  bookingToken.setBookingToken('a-booking-token', '2026-09-23T08:20:00Z');
  localStorage.setItem('access_token', 'a-staff-token');
  return { waitlist, seen };
}

describe('the waitlist clients (SCRUM-37)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-23T08:00:00Z'));
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it('a patient joins with the booking token and no patientId', async () => {
    // The service takes the patient from the token and ignores the body.
    const { waitlist, seen } = await loadWaitlist({ waitlistEntryId: 'w-1', placeInLine: 2 });

    const entry = await waitlist.waitlistApi.join({ doctorId: 'doctor-1', date: '2026-09-25' });

    expect(seen[0].method).toBe('post');
    expect(seen[0].url).toBe('/appointment/api/waitlist');
    expect(seen[0].headers.Authorization).toBe('Bearer a-booking-token');
    expect(JSON.parse(seen[0].data as string)).toEqual({ doctorId: 'doctor-1', date: '2026-09-25' });
    expect(entry.placeInLine).toBe(2);
  });

  it("a patient's own entries and answers all carry the booking token", async () => {
    const { waitlist, seen } = await loadWaitlist([]);

    await waitlist.waitlistApi.mine();
    await waitlist.waitlistApi.accept('w-1');
    await waitlist.waitlistApi.decline('w-1');
    await waitlist.waitlistApi.leave('w-1');

    expect(seen.map((request) => `${request.method} ${request.url}`)).toEqual([
      'get /appointment/api/waitlist/mine',
      'put /appointment/api/waitlist/mine/w-1/accept',
      'put /appointment/api/waitlist/mine/w-1/decline',
      'delete /appointment/api/waitlist/mine/w-1',
    ]);
    seen.forEach((request) => expect(request.headers.Authorization).toBe('Bearer a-booking-token'));
  });

  it('the front desk list carries the staff token even while a booking token is held', async () => {
    const { waitlist, seen } = await loadWaitlist([]);

    await waitlist.staffWaitlistApi.list({
      doctorId: 'doctor-1',
      from: '2026-09-23',
      to: '2026-10-06',
      status: waitlist.ACTIVE_WAITLIST_FILTER,
    });

    expect(seen[0].url).toBe(
      '/appointment/api/waitlist?from=2026-09-23&to=2026-10-06&doctorId=doctor-1&status=Active',
    );
    expect(seen[0].headers.Authorization).toBe('Bearer a-staff-token');
  });

  it('leaves the doctor and status out of the list query when none is chosen', async () => {
    const { waitlist, seen } = await loadWaitlist([]);

    await waitlist.staffWaitlistApi.list({ from: '2026-09-23', to: '2026-10-06' });

    expect(seen[0].url).toBe('/appointment/api/waitlist?from=2026-09-23&to=2026-10-06');
  });

  it('answering for a patient goes to the {id} routes with the staff token', async () => {
    const { waitlist, seen } = await loadWaitlist(null);

    await waitlist.staffWaitlistApi.get('w-1');
    await waitlist.staffWaitlistApi.accept('w-1');
    await waitlist.staffWaitlistApi.decline('w-1');

    expect(seen.map((request) => `${request.method} ${request.url}`)).toEqual([
      'get /appointment/api/waitlist/w-1',
      'put /appointment/api/waitlist/w-1/accept',
      'put /appointment/api/waitlist/w-1/decline',
    ]);
    seen.forEach((request) => expect(request.headers.Authorization).toBe('Bearer a-staff-token'));
  });

  it('removing sends the reason when there is one and no body when there is not', async () => {
    const { waitlist, seen } = await loadWaitlist(null);

    await waitlist.staffWaitlistApi.remove('w-1', 'Patient phoned.');
    await waitlist.staffWaitlistApi.remove('w-2');

    expect(seen[0].method).toBe('delete');
    expect(seen[0].url).toBe('/appointment/api/waitlist/w-1');
    expect(seen[0].headers.Authorization).toBe('Bearer a-staff-token');
    expect(JSON.parse(seen[0].data as string)).toEqual({ reason: 'Patient phoned.' });
    expect(seen[1].data).toBeUndefined();
  });

  it('knows which statuses are still in the queue', async () => {
    const { waitlist } = await loadWaitlist(null);
    const { WaitlistStatus, isActiveWaitlistStatus } = waitlist;

    expect(isActiveWaitlistStatus(WaitlistStatus.Waiting)).toBe(true);
    expect(isActiveWaitlistStatus(WaitlistStatus.Offered)).toBe(true);
    [WaitlistStatus.Accepted, WaitlistStatus.Declined, WaitlistStatus.Expired, WaitlistStatus.Withdrawn]
      .forEach((status) => expect(isActiveWaitlistStatus(status)).toBe(false));
  });
});
