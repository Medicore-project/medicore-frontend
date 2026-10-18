import { readFileSync } from 'node:fs';
import type { APIRequestContext, APIResponse } from '@playwright/test';
import { env } from './env';

/**
 * A thin client for the real API gateway, used by the E2E layer for the things a browser test
 * should not do through the UI: checking the stack is up, provisioning a precondition (a doctor
 * with a schedule), and reading back eventually-consistent state cheaply while waiting for Kafka.
 *
 * Every assertion about *behaviour* is still made through the UI; this only sets the stage and
 * keeps polling off the page, because each page reload costs several gateway requests and the
 * gateway allows 100 a minute per IP.
 */

export interface DoctorResponse {
  doctorId: string;
  fullName: string;
  specialization: string;
  departmentId: string;
}

export interface PublicSlot {
  slotId: string;
  startUtc: string;
  endUtc: string;
  slotDate: string;
  durationMinutes: number;
}

export interface InvoiceResponse {
  invoiceId: string;
  invoiceNumber: string;
  appointmentId: string;
  status: 'Draft' | 'Payable' | 'Paid' | 'Void';
  serviceCode: string;
  voidReason: string | null;
}

export class GatewayClient {
  constructor(
    private readonly request: APIRequestContext,
    private token?: string,
  ) {}

  private url(path: string): string {
    return `${env.gatewayUrl}${path}`;
  }

  private headers(token = this.token): Record<string, string> {
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  /** The gateway's aggregated health: each upstream service's /health/live. */
  async servicesHealth(): Promise<{ ok: boolean; status: number; body: string }> {
    try {
      const response = await this.request.get(this.url('/health/services'), { timeout: 10_000 });
      return { ok: response.ok(), status: response.status(), body: await response.text() };
    } catch (error) {
      return { ok: false, status: 0, body: String(error) };
    }
  }

  useToken(token: string): void {
    this.token = token;
  }

  async login(email: string, password: string): Promise<string> {
    const response = await this.request.post(this.url('/auth/login'), { data: { email, password } });
    await expectOk(response, `Signing in as ${email}`);
    const body = (await response.json()) as { accessToken: string };
    this.token = body.accessToken;
    return body.accessToken;
  }

  async doctors(): Promise<DoctorResponse[]> {
    const response = await this.request.get(this.url('/appointment/api/doctors'), { headers: this.headers() });
    await expectOk(response, 'Listing doctors');
    return response.json();
  }

  async republishDoctors(): Promise<void> {
    const response = await this.request.post(this.url('/identity/api/staff/doctors/republish'), {
      headers: this.headers(),
      data: {},
    });
    await expectOk(response, 'Republishing doctors to the appointment service');
  }

  /** Free slots as the public booking page sees them (anonymous). */
  async publicSlots(doctorId: string): Promise<PublicSlot[]> {
    const response = await this.request.get(this.url('/appointment/api/public/booking/slots'), {
      params: { doctorId },
    });
    await expectOk(response, `Listing free slots for ${doctorId}`);
    return response.json();
  }

  /** Creates a weekly schedule. Returns false when it overlaps one that already exists (409). */
  async createSchedule(body: {
    doctorId: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    slotDurationMinutes: number;
    effectiveFrom: string;
  }): Promise<boolean> {
    const response = await this.request.post(this.url('/appointment/api/schedules'), {
      headers: this.headers(),
      data: { ...body, effectiveTo: null },
    });
    if (response.status() === 409) return false;
    await expectOk(response, `Creating a schedule for ${body.doctorId}, day ${body.dayOfWeek}`);
    return true;
  }

  /** The invoice Billing created for an appointment, or null while Kafka has not delivered it yet. */
  async invoiceForAppointment(appointmentId: string): Promise<InvoiceResponse | null> {
    const response = await this.request.get(this.url(`/billing/api/invoices/by-appointment/${appointmentId}`), {
      headers: this.headers(),
    });
    if (response.status() === 404) return null;
    await expectOk(response, `Reading the invoice for appointment ${appointmentId}`);
    return response.json();
  }

  /** A raw call, for the security checks that expect a refusal. */
  async rawGet(path: string, token?: string): Promise<APIResponse> {
    return this.request.get(this.url(path), { headers: this.headers(token) });
  }
}

async function expectOk(response: APIResponse, what: string): Promise<void> {
  if (response.ok()) return;
  const body = await response.text().catch(() => '');
  const hint =
    response.status() === 429
      ? ' The gateway rate limit was hit (5 logins or 100 requests per minute per IP) — wait a minute and rerun.'
      : '';
  throw new Error(`${what} failed: HTTP ${response.status()} ${body.slice(0, 300)}${hint}`);
}

/** The admin's access token, from the browser state the setup project saved. */
export function savedAdminToken(): string {
  const state = JSON.parse(readFileSync(env.adminStorageState, 'utf8')) as {
    origins: Array<{ localStorage: Array<{ name: string; value: string }> }>;
  };
  const token = state.origins.flatMap((origin) => origin.localStorage).find((item) => item.name === 'access_token');
  if (!token) throw new Error('No access_token in the saved admin session — did the e2e-setup project run?');
  return token.value;
}
