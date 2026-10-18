import { expect, type Locator, type Page } from '@playwright/test';

/** Staff patient search (`/patients`). */
export class PatientSearchPage {
  readonly query: Locator;
  readonly searchButton: Locator;

  constructor(readonly page: Page) {
    this.query = page.getByLabel('Search patients');
    this.searchButton = page.getByRole('button', { name: /^search/i });
  }

  async open(): Promise<void> {
    await this.page.goto('/patients');
    await expect(this.page.getByRole('heading', { name: 'Patient Search' })).toBeVisible();
  }

  async search(text: string): Promise<void> {
    await this.query.fill(text);
    await this.searchButton.click();
  }

  row(text: string): Locator {
    return this.page.getByRole('row').filter({ hasText: text });
  }
}

/** The clinic-wide booked list (`/appointments/booked`). */
export class BookedAppointmentsPage {
  readonly table: Locator;

  constructor(readonly page: Page) {
    this.table = page.getByTestId('clinic-appointments');
  }

  async open(): Promise<void> {
    await this.page.goto('/appointments/booked');
    await expect(this.page.getByRole('heading', { name: 'Booked Appointments', level: 1 })).toBeVisible();
  }

  async filterDates(from: string, to: string): Promise<void> {
    await this.page.getByLabel('From Date').fill(from);
    await this.page.getByLabel('To Date').fill(to);
    await this.page.getByRole('button', { name: 'Apply Filters' }).click();
  }

  row(text: string): Locator {
    return this.table.getByRole('row').filter({ hasText: text });
  }

  async openDetails(rowText: string): Promise<void> {
    const row = this.row(rowText);
    await row.getByRole('button', { name: /^actions for/i }).click();
    await row.getByRole('menuitem', { name: 'View details' }).click();
  }
}

/** One appointment (`/appointments/:id`). */
export class AppointmentDetailPage {
  readonly status: Locator;
  readonly when: Locator;
  readonly invoiceLink: Locator;
  readonly cancelButton: Locator;
  readonly success: Locator;
  readonly history: Locator;

  constructor(readonly page: Page) {
    this.status = page.getByTestId('appointment-status');
    this.when = page.getByTestId('appointment-when');
    this.invoiceLink = page.getByRole('link', { name: 'View invoice and payments' });
    this.cancelButton = page.getByRole('button', { name: 'Cancel appointment' });
    this.success = page.getByRole('status').filter({ hasText: /cancelled|moved|completed|no-show/i });
    this.history = page.getByRole('region', { name: 'History' });
  }

  async open(appointmentId: string): Promise<void> {
    await this.page.goto(`/appointments/${appointmentId}`);
    await expect(this.page.getByRole('heading', { name: 'Appointment', level: 1 })).toBeVisible();
  }

  async cancel(reason: string): Promise<void> {
    await this.cancelButton.click();
    const dialog = this.page.getByRole('dialog', { name: 'Cancel appointment' });
    await dialog.getByLabel('Reason for cancelling').fill(reason);
    await dialog.getByRole('button', { name: 'Cancel appointment' }).click();
    await expect(dialog).toHaveCount(0);
  }
}

/** One invoice (`/billing/invoices/:id`). */
export class InvoicePage {
  readonly number: Locator;
  readonly totals: Locator;
  readonly lines: Locator;
  readonly paymentPanel: Locator;

  constructor(readonly page: Page) {
    this.number = page.getByRole('heading', { level: 1 });
    this.totals = page.getByLabel('Invoice totals');
    this.lines = page.getByRole('region', { name: 'Invoice lines' });
    this.paymentPanel = page.getByRole('complementary', { name: 'Record payment' });
  }

  /** The status badge sits beside the heading; read it by its known values. */
  status(value: string): Locator {
    return this.page.getByText(value, { exact: true }).first();
  }
}
