import { expect, type Locator, type Page } from '@playwright/test';

/** Staff patient search (`/patients`). */
export class PatientSearchPage {
  readonly form: Locator;
  readonly query: Locator;
  readonly searchButton: Locator;
  readonly summary: Locator;

  constructor(readonly page: Page) {
    // Scoped to the search form: the workspace header has its own "Search pages (Ctrl K)" button.
    this.form = page.getByRole('search');
    this.query = this.form.getByLabel('Search patients');
    this.searchButton = this.form.getByRole('button', { name: /^search(ing…)?$/i });
    this.summary = page.getByText(/\d+ patients? (found for|total)/);
  }

  async open(): Promise<void> {
    await this.page.goto('/patients');
    await expect(this.page.getByRole('heading', { name: 'Patient Search' })).toBeVisible();
  }

  /**
   * A live search: typing sends the query after a 400 ms pause and disables the button
   * ("Searching…") until the answer arrives. So wait for the answer instead of clicking.
   */
  async search(text: string): Promise<void> {
    await this.query.fill(text);
    await expect(this.summary).toContainText(text);
    await expect(this.searchButton).toHaveText('Search');
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
