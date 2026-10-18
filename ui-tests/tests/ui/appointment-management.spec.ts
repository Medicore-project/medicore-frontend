import { DOCTORS, RETURNING_PATIENT, appointmentFor, slotsFor } from '../../mocks/data';
import type { MockGateway } from '../../mocks/mock-gateway';
import { AppointmentDetailPage, BookedAppointmentsPage, InvoicePage } from '../../pages/clinic.pages';
import { expect, test } from '../../fixtures/ui-test';

/**
 * The staff side of a booking: the clinic list, one appointment, its invoice, cancelling it.
 * These are the same page objects the full-stack journey uses, proven here against doubles first,
 * so a failure in the E2E run points at the stack rather than at a locator.
 */

const doctor = DOCTORS[0];
const slot = slotsFor(doctor.doctorId)[0];

function seedAppointment(gateway: MockGateway) {
  const appointment = { ...appointmentFor(slot, doctor, RETURNING_PATIENT) };
  const history: Array<Record<string, string | null>> = [
    {
      action: 'Booked', fromStatus: null, toStatus: 'Booked', fromSlotId: null, toSlotId: slot.slotId,
      fromStartUtc: null, toStartUtc: slot.startUtc, reason: null, actor: RETURNING_PATIENT.patientNumber,
      occurredAtUtc: new Date().toISOString(),
    },
  ];
  const invoice = {
    invoiceId: 'inv-1', invoiceNumber: 'INV-2026-000042', appointmentId: appointment.appointmentId,
    patientId: RETURNING_PATIENT.patientId, serviceCode: appointment.serviceCode, status: 'Draft', currency: 'LKR',
    subtotal: 2500, total: 2500, amountPaid: 0, balanceDue: 2500, requiresManualPricing: false, pricingIssue: null,
    issuedAtUtc: new Date().toISOString(), finalizedAtUtc: null, voidedAtUtc: null, voidReason: null as string | null, paidAtUtc: null,
    lines: [{ invoiceLineId: 'l1', tariffId: 't1', serviceCode: appointment.serviceCode, description: 'General Practice consultation', quantity: 1, unitPrice: 2500, lineTotal: 2500 }],
    payments: [],
  };

  const record = () => {
    const { doctorName: _n, specialization: _s, ...rest } = appointment;
    void _n;
    void _s;
    return rest;
  };

  gateway
    .on('GET', '/appointment/api/appointments', { json: [appointment] })
    .on('GET', `/appointment/api/appointments/${appointment.appointmentId}`, () => ({ json: record() }))
    .on('GET', `/appointment/api/appointments/${appointment.appointmentId}/history`, () => ({ json: history }))
    .on('GET', `/billing/api/invoices/by-appointment/${appointment.appointmentId}`, () => ({ json: invoice }))
    .on('GET', '/billing/api/invoices/inv-1', () => ({ json: invoice }))
    .on('PUT', `/appointment/api/appointments/${appointment.appointmentId}/cancel`, (call) => {
      const reason = (call.body as { reason: string }).reason;
      appointment.status = 'Cancelled';
      history.push({ ...history[0], action: 'Cancelled', fromStatus: 'Booked', toStatus: 'Cancelled', reason, actor: 'admin@medicore.local' });
      return { json: record() };
    });

  return { appointment, invoice };
}

test.beforeEach(async ({ signInAs }) => {
  await signInAs('Admin');
});

test('the clinic list shows the booking and opens its details from the row menu', async ({ page, gateway }) => {
  const { appointment } = seedAppointment(gateway);
  const booked = new BookedAppointmentsPage(page);
  await booked.open();

  const row = booked.row(RETURNING_PATIENT.fullName);
  await expect(row).toContainText(RETURNING_PATIENT.patientNumber);
  await expect(row).toContainText(doctor.fullName);
  await expect(row).toContainText('Booked');

  await booked.openDetails(RETURNING_PATIENT.fullName);
  await expect(page).toHaveURL(new RegExp(`/appointments/${appointment.appointmentId}$`));
});

test('an appointment links to its draft invoice, which cannot take payment yet', async ({ page, gateway }) => {
  const { appointment, invoice } = seedAppointment(gateway);
  const detail = new AppointmentDetailPage(page);
  await detail.open(appointment.appointmentId);

  await expect(detail.status).toHaveText('Booked');
  await detail.invoiceLink.click();

  const invoicePage = new InvoicePage(page);
  await expect(invoicePage.number).toHaveText(invoice.invoiceNumber);
  await expect(invoicePage.status('Draft')).toBeVisible();
  await expect(invoicePage.lines).toContainText(appointment.serviceCode);
  await expect(invoicePage.paymentPanel).toContainText('Payments are unavailable while this invoice is Draft.');
});

test('before Billing has caught up, the appointment page still works — just without the invoice link', async ({
  page,
  gateway,
}) => {
  const { appointment } = seedAppointment(gateway);
  // Eventual consistency: the booked event is still on its way through the outbox and Kafka.
  gateway.on('GET', `/billing/api/invoices/by-appointment/${appointment.appointmentId}`, { status: 404, json: {} });

  const detail = new AppointmentDetailPage(page);
  await detail.open(appointment.appointmentId);

  await expect(detail.status).toHaveText('Booked');
  await expect(detail.invoiceLink).toHaveCount(0);
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('staff cancel an appointment with a reason, and the history records it', async ({ page, gateway }) => {
  const { appointment } = seedAppointment(gateway);
  const detail = new AppointmentDetailPage(page);
  await detail.open(appointment.appointmentId);

  await detail.cancel('Patient called to say they are travelling');

  await expect(detail.status).toHaveText('Cancelled');
  await expect(detail.success).toHaveText(/cancelled and its time released/);
  await expect(detail.history).toContainText('Patient called to say they are travelling');
  await expect(detail.cancelButton).toHaveCount(0);
  expect(gateway.lastCallTo('PUT', /\/cancel$/)?.body).toEqual({ reason: 'Patient called to say they are travelling' });
});

test('a cancellation inside the 24-hour window is refused in the service’s words, and nothing changes', async ({
  page,
  gateway,
}) => {
  const { appointment } = seedAppointment(gateway);
  gateway.on('PUT', `/appointment/api/appointments/${appointment.appointmentId}/cancel`, {
    status: 400,
    json: { title: 'Appointments cannot be cancelled within 24 hours of their start.' },
  });

  const detail = new AppointmentDetailPage(page);
  await detail.open(appointment.appointmentId);
  await detail.cancelButton.click();
  const dialog = page.getByRole('dialog', { name: 'Cancel appointment' });
  await dialog.getByLabel('Reason for cancelling').fill('Too late');
  await dialog.getByRole('button', { name: 'Cancel appointment' }).click();

  await expect(dialog.getByRole('alert')).toHaveText('Appointments cannot be cancelled within 24 hours of their start.');
  await dialog.getByRole('button', { name: 'Keep appointment' }).click();
  await expect(detail.status).toHaveText('Booked');
});

test('the cancel button stays disabled until a reason is typed', async ({ page, gateway }) => {
  const { appointment } = seedAppointment(gateway);
  const detail = new AppointmentDetailPage(page);
  await detail.open(appointment.appointmentId);
  await detail.cancelButton.click();

  const dialog = page.getByRole('dialog', { name: 'Cancel appointment' });
  const confirm = dialog.getByRole('button', { name: 'Cancel appointment' });
  await expect(confirm).toBeDisabled();
  await dialog.getByLabel('Reason for cancelling').fill('   ');
  await expect(confirm).toBeDisabled();
  await dialog.getByLabel('Reason for cancelling').fill('Clinic closed');
  await expect(confirm).toBeEnabled();
});
