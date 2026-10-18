import type { Page, Request, Route } from '@playwright/test';
import { env } from '../support/env';
import {
  DOCTORS,
  RETURNING_PATIENT,
  USERS,
  appointmentFor,
  authResponse,
  bookingIdentity,
  slotsFor,
  type PublicDoctor,
  type PublicSlot,
} from './data';

/**
 * A fake API gateway for the UI layer — the test double that isolates the frontend from the four
 * microservices.
 *
 * In test-double terms it is three things at once:
 *  - a **fake**: it keeps a little state (free slots, the patient's bookings), so booking a slot
 *    really does take it out of the next listing, just as the appointment service would;
 *  - a **stub**: any test can replace one endpoint's answer (`gateway.on(...)`) to force an edge
 *    case the real stack can only produce by luck — a 409 race, an expired token, a 500;
 *  - a **spy**: every request is recorded with its method, path, headers and body, so a test can
 *    assert on what the UI *sent* (which token, which payload), not only on what it shows.
 *
 * One `page.route` handler dispatches everything; the most recently registered matching handler
 * wins, so per-test overrides beat the defaults. A request nothing handles is answered 501 and
 * recorded in `unhandled`, and the fixture fails the test if any remain — an endpoint the UI
 * started calling without the test knowing is a finding, not noise.
 */

export interface RecordedCall {
  method: string;
  path: string;
  query: URLSearchParams;
  headers: Record<string, string>;
  body: unknown;
}

export interface MockReply {
  status?: number;
  json?: unknown;
  /** Milliseconds to hold the response, to observe loading states. */
  delayMs?: number;
}

type Handler = (call: RecordedCall) => MockReply | Promise<MockReply>;

interface Registration {
  method: string;
  matcher: string | RegExp;
  handler: Handler;
}

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  'access-control-allow-headers': '*',
};

export class MockGateway {
  readonly calls: RecordedCall[] = [];
  readonly unhandled: RecordedCall[] = [];

  /** The fake's state. Tests may read or seed it. */
  readonly state = {
    doctors: [...DOCTORS] as PublicDoctor[],
    freeSlots: new Map<string, PublicSlot[]>(DOCTORS.map((d) => [d.doctorId, slotsFor(d.doctorId)])),
    patients: [RETURNING_PATIENT],
    appointments: [] as ReturnType<typeof appointmentFor>[],
    registeredNics: new Set<string>([RETURNING_PATIENT.nic]),
    nextPatientNumber: 500,
  };

  private readonly registrations: Registration[] = [];

  constructor(private readonly page: Page) {}

  /** Registers the default behaviour of every endpoint the tested pages use, then starts routing. */
  async install(): Promise<void> {
    this.installDefaults();
    await this.page.route(`${env.mockGatewayUrl}/**`, (route, request) => this.dispatch(route, request));
  }

  /** Overrides one endpoint. `matcher` is an exact path or a RegExp over the path (no query string). */
  on(method: string, matcher: string | RegExp, reply: MockReply | Handler): this {
    const handler: Handler = typeof reply === 'function' ? reply : () => reply;
    this.registrations.push({ method: method.toUpperCase(), matcher, handler });
    return this;
  }

  /** Every recorded call to one endpoint, oldest first. */
  callsTo(method: string, matcher: string | RegExp): RecordedCall[] {
    return this.calls.filter((call) => call.method === method.toUpperCase() && matches(matcher, call.path));
  }

  lastCallTo(method: string, matcher: string | RegExp): RecordedCall | undefined {
    return this.callsTo(method, matcher).at(-1);
  }

  // ── Dispatch ────────────────────────────────────────────────────────────────

  private async dispatch(route: Route, request: Request): Promise<void> {
    // Cross-origin preflight: the app (localhost) calls the gateway (another origin).
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS_HEADERS });
      return;
    }

    const url = new URL(request.url());
    const call: RecordedCall = {
      method: request.method(),
      path: url.pathname,
      query: url.searchParams,
      headers: await request.allHeaders(),
      body: parseBody(request.postData()),
    };
    this.calls.push(call);

    const registration = [...this.registrations]
      .reverse()
      .find((candidate) => candidate.method === call.method && matches(candidate.matcher, call.path));

    if (!registration) {
      this.unhandled.push(call);
      await route.fulfill({
        status: 501,
        headers: CORS_HEADERS,
        contentType: 'application/json',
        body: JSON.stringify({ message: `MockGateway: no handler for ${call.method} ${call.path}` }),
      });
      return;
    }

    const reply = await registration.handler(call);
    if (reply.delayMs) await new Promise((resolve) => setTimeout(resolve, reply.delayMs));

    const status = reply.status ?? 200;
    await route.fulfill({
      status,
      headers: CORS_HEADERS,
      contentType: 'application/json',
      body: status === 204 || reply.json === undefined ? '' : JSON.stringify(reply.json),
    });
  }

  // ── Defaults: a small, consistent clinic ────────────────────────────────────

  private installDefaults(): void {
    const s = this.state;

    // Identity: login / logout.
    this.on('POST', '/auth/login', (call) => {
      const { email, password } = (call.body ?? {}) as { email?: string; password?: string };
      const user = Object.values(USERS).find((candidate) => candidate.email === email);
      return user && user.password === password
        ? { json: authResponse(user) }
        : { status: 401, json: { message: 'Invalid email or password' } };
    });
    this.on('POST', '/auth/logout', { status: 204 });

    // Public booking reads (Appointment service, anonymous).
    this.on('GET', '/appointment/api/public/booking/specializations', () => ({
      json: [...new Set(s.doctors.map((d) => d.specialization))].sort(),
    }));
    this.on('GET', '/appointment/api/public/booking/doctors', (call) => {
      const wanted = call.query.get('specialization');
      return { json: s.doctors.filter((d) => !wanted || d.specialization === wanted) };
    });
    this.on('GET', '/appointment/api/public/booking/slots', (call) => ({
      json: s.freeSlots.get(call.query.get('doctorId') ?? '') ?? [],
    }));
    this.on('GET', '/appointment/api/public/booking/days', { json: [] });

    // Identifying (Patient service) — one message for a wrong number and a wrong date alike.
    this.on('POST', '/patient/api/patients/identify', (call) => {
      const { patientNumber, dateOfBirth } = (call.body ?? {}) as Record<string, string>;
      const found = s.patients.find((p) => p.patientNumber === patientNumber && p.dateOfBirth === dateOfBirth);
      return found
        ? { json: bookingIdentity(found) }
        : { status: 404, json: { title: 'Not Found', status: 404, detail: 'No patient matched.' } };
    });
    this.on('POST', '/patient/api/patients/public-register', (call) => {
      const body = call.body as Record<string, string>;
      if (s.registeredNics.has(body.nic)) {
        return { status: 409, json: { title: 'Conflict', status: 409 } };
      }
      s.registeredNics.add(body.nic);
      const patient = {
        patientId: `pat-${body.nic}`,
        patientNumber: `PAT-${String(s.nextPatientNumber++).padStart(6, '0')}`,
        dateOfBirth: body.dateOfBirth,
        fullName: `${body.firstName} ${body.lastName}`,
        nic: body.nic,
      };
      s.patients.push(patient);
      return { status: 201, json: bookingIdentity(patient) };
    });

    // Booking (Appointment service, booking token). Takes the slot, like the real service.
    this.on('POST', '/appointment/api/appointments', (call) => {
      const token = call.headers.authorization?.replace(/^Bearer /, '') ?? '';
      const patient = s.patients.find((p) => token === `booking-token-${p.patientNumber}`);
      if (!patient) return { status: 401, json: { title: 'Unauthorized', status: 401 } };

      const { slotId } = call.body as { slotId: string };
      for (const doctor of s.doctors) {
        const free = s.freeSlots.get(doctor.doctorId) ?? [];
        const slot = free.find((candidate) => candidate.slotId === slotId);
        if (slot) {
          s.freeSlots.set(doctor.doctorId, free.filter((candidate) => candidate !== slot));
          const appointment = appointmentFor(slot, doctor, patient);
          s.appointments.push(appointment);
          return { status: 201, json: appointment };
        }
      }
      return { status: 409, json: { title: 'Someone booked this slot a moment ago. Please choose another time.', status: 409 } };
    });
    this.on('GET', '/appointment/api/appointments/mine', (call) => {
      const token = call.headers.authorization?.replace(/^Bearer /, '') ?? '';
      const patient = s.patients.find((p) => token === `booking-token-${p.patientNumber}`);
      return {
        json: s.appointments
          .filter((a) => a.patientId === patient?.patientId)
          .map((a) => ({
            appointmentId: a.appointmentId,
            doctorId: a.doctorId,
            doctorName: a.doctorName,
            specialization: a.specialization,
            startUtc: a.startUtc,
            endUtc: a.endUtc,
            slotDate: a.slotDate,
            durationMinutes: a.durationMinutes,
            serviceCode: a.serviceCode,
            status: a.status,
          })),
      };
    });
    this.on('GET', '/appointment/api/waitlist/mine', { json: [] });

    // Staff workspace reads (dashboard, booked list).
    this.on('GET', '/appointment/api/appointments', { json: [] });
    this.on('GET', '/appointment/api/waitlist', { json: [] });
    this.on('GET', '/appointment/api/doctors', () => ({
      json: s.doctors.map((d) => ({ ...d, departmentId: 'dept-1' })),
    }));
    this.on('GET', '/api/staff', { json: { items: [], totalCount: 12, page: 1, pageSize: 1, totalPages: 12 } });
    this.on('GET', '/api/departments', {
      json: [
        { id: 'dept-1', name: 'General Medicine', description: '', staffCount: 4 },
        { id: 'dept-2', name: 'Cardiology', description: '', staffCount: 2 },
      ],
    });

    // Front-desk registration (Patient service).
    this.on('POST', '/patient/api/patients', (call) => {
      const body = call.body as Record<string, string>;
      if (s.registeredNics.has(body.nic)) {
        const existing = s.patients.find((p) => p.nic === body.nic) ?? RETURNING_PATIENT;
        return {
          status: 409,
          json: {
            message: 'A patient with this NIC is already registered.',
            existingPatient: {
              patientId: existing.patientId,
              patientNumber: existing.patientNumber,
              fullName: existing.fullName,
              email: 'dinesh.bandara@example.test',
              isArchived: false,
            },
          },
        };
      }
      s.registeredNics.add(body.nic);
      return {
        status: 201,
        json: {
          ...body,
          patientId: `pat-${body.nic}`,
          patientNumber: `PAT-${String(s.nextPatientNumber++).padStart(6, '0')}`,
          fullName: `${body.firstName} ${body.lastName}`,
          createdAt: new Date().toISOString(),
        },
      };
    });
  }
}

function matches(matcher: string | RegExp, path: string): boolean {
  return typeof matcher === 'string' ? matcher === path : matcher.test(path);
}

function parseBody(raw: string | null): unknown {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}
