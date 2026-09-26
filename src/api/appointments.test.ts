import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The staff appointment-change client (SCRUM-36), driven through the real api client and a fake
 * adapter, so the path, verb, body and Authorization header are observed rather than assumed.
 */

interface SeenRequest {
  url?: string;
  method?: string;
  data?: unknown;
  headers: Record<string, unknown>;
}

async function loadAppointments(respondWith: unknown) {
  vi.resetModules();
  const seen: SeenRequest[] = [];

  const { apiClient } = await import('./client');
  apiClient.defaults.adapter = ((config: SeenRequest) => {
    seen.push(config);
    return Promise.resolve({ data: respondWith, status: 200, statusText: 'OK', headers: {}, config });
  }) as never;

  const appointments = await import('./appointments');
  const bookingToken = await import('./bookingToken');
  return { appointments, bookingToken, seen };
}

const body = (request: SeenRequest) => JSON.parse(request.data as string) as unknown;

describe('the staff appointment-change client (SCRUM-36)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-23T08:00:00Z'));
    localStorage.clear();
    localStorage.setItem('access_token', 'staff-token');
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it('reads one appointment and its history by id', async () => {
    const { appointments, seen } = await loadAppointments([]);

    await appointments.appointmentChangeApi.get('a-1');
    await appointments.appointmentChangeApi.history('a-1');

    expect(seen.map((r) => [r.method, r.url])).toEqual([
      ['get', '/appointment/api/appointments/a-1'],
      ['get', '/appointment/api/appointments/a-1/history'],
    ]);
  });

  it('cancels, reschedules and completes with PUTs carrying exactly their one field', async () => {
    const { appointments, seen } = await loadAppointments({ appointmentId: 'a-1' });

    await appointments.appointmentChangeApi.cancel('a-1', 'Doctor unwell');
    await appointments.appointmentChangeApi.reschedule('a-1', 'slot-9');
    await appointments.appointmentChangeApi.complete('a-1', 'Reviewed BP.');

    expect(seen.map((r) => [r.method, r.url])).toEqual([
      ['put', '/appointment/api/appointments/a-1/cancel'],
      ['put', '/appointment/api/appointments/a-1/reschedule'],
      ['put', '/appointment/api/appointments/a-1/complete'],
    ]);
    expect(body(seen[0])).toEqual({ reason: 'Doctor unwell' });
    expect(body(seen[1])).toEqual({ newSlotId: 'slot-9' });
    expect(body(seen[2])).toEqual({ notes: 'Reviewed BP.' });
  });

  it('sends the staff token even while a patient booking token is held', async () => {
    // A receptionist who just booked for a patient still holds that patient's token. Every
    // change here must go out as the receptionist, or the service refuses it.
    const { appointments, bookingToken, seen } = await loadAppointments({});
    bookingToken.setBookingToken('a-booking-token', '2026-09-23T08:20:00Z');

    await appointments.appointmentChangeApi.get('a-1');
    await appointments.appointmentChangeApi.history('a-1');
    await appointments.appointmentChangeApi.cancel('a-1', 'Doctor unwell');
    await appointments.appointmentChangeApi.reschedule('a-1', 'slot-9');
    await appointments.appointmentChangeApi.complete('a-1', 'Reviewed BP.');

    expect(seen).toHaveLength(5);
    seen.forEach((request) => expect(request.headers.Authorization).toBe('Bearer staff-token'));
  });

  it('mirrors the service status names', async () => {
    const { appointments } = await loadAppointments(null);

    expect(Object.values(appointments.AppointmentStatus)).toEqual(['Booked', 'Cancelled', 'Completed', 'NoShow']);
  });
});
