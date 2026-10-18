import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { BookingPage } from '../../pages/booking.page';
import { AppointmentDetailPage, BookedAppointmentsPage, InvoicePage, PatientSearchPage } from '../../pages/clinic.pages';
import { PatientRegistrationPage } from '../../pages/patient-registration.page';
import { env } from '../../support/env';
import { GatewayClient, savedAdminToken } from '../../support/gateway-client';
import { uniquePatient } from '../../support/test-data';

/**
 * The full patient journey, through the real UI, across every microservice:
 *
 *   Identity      admin session (signed in by the setup project)
 *   Patient       front desk registers a new patient → searchable → identifies on the public page
 *   Appointment   the patient books a free slot with the booking token the Patient service minted
 *   Kafka         appointment.booked  → Billing creates a draft invoice
 *   Appointment   staff cancel → the slot is released
 *   Kafka         appointment.cancelled → Billing voids the invoice
 *
 * One test with named steps rather than seven tests: each step needs what the one before it
 * created, and a step that fails should stop the journey there, not cascade into six more red
 * results. The steps show up individually in the HTML report and the trace.
 *
 * Eventual consistency is waited for with `expect.poll` against the gateway (one request per
 * poll) and then verified once on the page — polling by reloading the page would cost ~4 gateway
 * requests a time and trip the 100-a-minute rate limit.
 */

const stack = () =>
  JSON.parse(readFileSync(env.stackContextFile, 'utf8')) as { doctorId: string; doctorName: string; earliestDate: string };

test('a new patient is registered, books, is invoiced, and is cancelled — across all four services', async ({
  page,
  browser,
  request,
}) => {
  const patient = uniquePatient();
  const fullName = `${patient.firstName} ${patient.lastName}`;
  const { doctorId, doctorName, earliestDate } = stack();
  const api = new GatewayClient(request, savedAdminToken());

  let patientNumber = '';
  let appointmentId = '';
  let slotId = '';
  let slotDate = '';
  const cancelReason = `E2E run ${patient.tag}: cancelled by the automated journey`;

  await test.step('Identity — the saved admin session opens the staff workspace', async () => {
    await page.goto('/dashboard');
    await expect(page.getByRole('complementary', { name: 'Workspace navigation' })).toBeVisible();
    await expect(page.getByRole('banner')).toContainText('Admin');
  });

  await test.step('Patient — the front desk registers a new patient', async () => {
    const registration = new PatientRegistrationPage(page);
    await registration.open();
    await registration.register(patient);

    await expect(registration.success).toBeVisible();
    patientNumber = await registration.issuedPatientNumber();
    expect(patientNumber).toMatch(/^PAT-\d+$/);
    await expect(registration.success).toContainText(fullName);
  });

  await test.step('Patient — the new record is found by NIC in patient search', async () => {
    const search = new PatientSearchPage(page);
    await search.open();
    await search.search(patient.nic);

    const row = search.row(patientNumber);
    await expect(row).toContainText(fullName);
    await expect(row).toContainText(patient.nic);
  });

  await test.step('Patient + Appointment — the patient books on the public page, with no staff session', async () => {
    // A separate, anonymous browser context: the patient's own device, not the receptionist's.
    const patientContext = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const patientPage = await patientContext.newPage();
    const booking = new BookingPage(patientPage);

    await booking.open('/book');
    await booking.identify(patientNumber, patient.dateOfBirth);
    await expect(booking.patientCard).toContainText(patientNumber);

    expect(
      await booking.offeredDoctorIds(),
      `${doctorName} is not on the public booking page — the appointment service's doctor cache is stale.`,
    ).toContain(doctorId);
    await booking.chooseDoctor(doctorId);
    await booking.chooseDate(await booking.firstOpenDateOnOrAfter(earliestDate));
    const picked = await booking.pickSlot(0);
    slotId = picked.slotId;
    slotDate = picked.date;

    // The appointment id is not shown to patients; read it off the booking response itself.
    const booked = patientPage.waitForResponse(
      (response) => response.request().method() === 'POST' && response.url().endsWith('/appointment/api/appointments'),
    );
    await booking.confirm();
    const response = await booked;
    expect(response.ok(), `Booking failed: HTTP ${response.status()} ${await response.text()}`).toBe(true);
    appointmentId = ((await response.json()) as { appointmentId: string }).appointmentId;

    await expect(booking.confirmation).toContainText('Your appointment is confirmed');
    await expect(booking.confirmation).toContainText(picked.time);
    expect(await booking.shownPatientNumber()).toBe(patientNumber);

    // And the slot is gone for the next patient.
    await expect.poll(async () => (await api.publicSlots(doctorId)).some((s) => s.slotId === slotId)).toBe(false);
    await patientContext.close();
  });

  await test.step('Appointment — the booking appears in the clinic-wide list', async () => {
    const list = new BookedAppointmentsPage(page);
    await list.open();
    await list.filterDates(slotDate, slotDate);

    // By patient number: unique, and carried on the appointment from the booking token.
    const row = list.row(patientNumber);
    await expect(row).toContainText(fullName);
    await expect(row).toContainText('Booked');

    await list.openDetails(patientNumber);
    await expect(page).toHaveURL(new RegExp(`/appointments/${appointmentId}$`));
  });

  await test.step('Kafka → Billing — a draft invoice is created for the booking', async () => {
    await expect
      .poll(async () => (await api.invoiceForAppointment(appointmentId))?.status ?? 'not yet', {
        message: 'Billing never created an invoice — is billing-api consuming appointment-events?',
        timeout: env.eventualTimeoutMs,
        intervals: [1_000, 2_000, 3_000, 5_000],
      })
      .toBe('Draft');

    const detail = new AppointmentDetailPage(page);
    await detail.open(appointmentId);
    await expect(detail.status).toHaveText('Booked');
    await detail.invoiceLink.click();

    const invoice = new InvoicePage(page);
    await expect(invoice.number).toHaveText(/\S+/);
    await expect(invoice.status('Draft')).toBeVisible();
    await expect(invoice.paymentPanel).toContainText('Payments are unavailable while this invoice is Draft.');
  });

  await test.step('Appointment — staff cancel the appointment; its slot is released', async () => {
    const detail = new AppointmentDetailPage(page);
    await detail.open(appointmentId);
    await detail.cancel(cancelReason);

    await expect(detail.status).toHaveText('Cancelled');
    await expect(detail.success).toContainText('cancelled and its time released');
    await expect(detail.history).toContainText(cancelReason);
    await expect.poll(async () => (await api.publicSlots(doctorId)).some((s) => s.slotId === slotId)).toBe(true);
  });

  await test.step('Kafka → Billing — the invoice is voided with the cancellation reason', async () => {
    await expect
      .poll(async () => (await api.invoiceForAppointment(appointmentId))?.status, {
        message: 'Billing never voided the invoice — is billing-api consuming appointment.cancelled?',
        timeout: env.eventualTimeoutMs,
        intervals: [1_000, 2_000, 3_000, 5_000],
      })
      .toBe('Void');

    const detail = new AppointmentDetailPage(page);
    await detail.open(appointmentId);
    await detail.invoiceLink.click();
    const invoice = new InvoicePage(page);
    await expect(invoice.status('Void')).toBeVisible();
    await expect(page.getByText(cancelReason)).toBeVisible();
  });
});
