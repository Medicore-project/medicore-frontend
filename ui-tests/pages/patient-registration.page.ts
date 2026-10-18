import type { Locator, Page } from '@playwright/test';
import type { PatientDetails } from './booking.page';

/** Front-desk patient registration (`/patients/register`) — Receptionist and Admin only. */
export class PatientRegistrationPage {
  readonly heading: Locator;
  readonly submit: Locator;
  readonly success: Locator;
  readonly duplicate: Locator;
  readonly requestError: Locator;

  private static readonly LABELS: Record<keyof PatientDetails, string> = {
    nic: 'NIC *',
    dateOfBirth: 'Date of birth *',
    firstName: 'First name *',
    lastName: 'Last name *',
    gender: 'Gender *',
    email: 'Email *',
    phone: 'Phone *',
    addressLine1: 'Address line 1 *',
    district: 'District *',
  };

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { name: 'Register Patient' });
    this.submit = page.getByRole('button', { name: /register patient|registering/i });
    this.success = page.getByRole('status').filter({ hasText: 'Patient successfully registered' });
    this.duplicate = page.getByRole('alert').filter({ hasText: 'Patient already registered' });
    this.requestError = page.getByRole('alert').filter({ hasNotText: 'Patient already registered' });
  }

  async open(): Promise<void> {
    await this.page.goto('/patients/register');
    await this.heading.waitFor();
  }

  field(key: keyof PatientDetails): Locator {
    return this.page.getByLabel(PatientRegistrationPage.LABELS[key], { exact: true });
  }

  async fill(details: Partial<PatientDetails>): Promise<void> {
    // Walk the form's own fields, not the object's keys: callers may pass extra properties
    // (the E2E patient carries a `tag`), and those have no label to fill.
    for (const key of Object.keys(PatientRegistrationPage.LABELS) as Array<keyof PatientDetails>) {
      const value = details[key];
      if (value === undefined) continue;
      if (key === 'gender') await this.field(key).selectOption(value);
      else await this.field(key).fill(value);
    }
  }

  async register(details: PatientDetails): Promise<void> {
    await this.fill(details);
    await this.submit.click();
  }

  /** The validation message rendered beside one field. */
  errorFor(key: keyof PatientDetails): Locator {
    return this.field(key)
      .locator('xpath=ancestor::div[contains(concat(" ", @class, " "), " form-group ")][1]')
      .locator('span')
      .last();
  }

  async issuedPatientNumber(): Promise<string> {
    const text = (await this.success.textContent()) ?? '';
    return text.match(/PAT-\d+/)?.[0] ?? '';
  }
}
