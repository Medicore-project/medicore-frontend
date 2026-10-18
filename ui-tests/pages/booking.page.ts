import { expect, type Locator, type Page } from '@playwright/test';

export interface PatientDetails {
  nic: string;
  dateOfBirth: string;
  firstName: string;
  lastName: string;
  gender: string;
  phone: string;
  email: string;
  addressLine1: string;
  district: string;
}

export interface PickedSlot {
  slotId: string;
  date: string;
  time: string;
}

/**
 * The patient booking flow — the public page (`/book`) and, inside the staff shell, the in-app
 * page (`/appointments/book`). Same component, same page object.
 *
 * Steps: identify (or register) → doctor → date → time → confirm.
 */
export class BookingPage {
  // Identify
  readonly identifyForm: Locator;
  readonly patientNumber: Locator;
  readonly identifyDob: Locator;
  readonly continueButton: Locator;
  readonly newPatientButton: Locator;

  // Register
  readonly registerForm: Locator;

  // Choose
  readonly picker: Locator;
  readonly specialization: Locator;
  readonly doctor: Locator;
  readonly dateOptions: Locator;
  readonly slotOptions: Locator;
  readonly noDoctorsMessage: Locator;

  // Summary and result
  readonly summary: Locator;
  readonly confirmButton: Locator;
  readonly billingNotice: Locator;
  readonly confirmation: Locator;
  readonly patientCard: Locator;
  readonly upcoming: Locator;

  constructor(readonly page: Page) {
    this.identifyForm = page.getByTestId('booking-identify-form');
    this.patientNumber = this.identifyForm.getByLabel('Patient number');
    this.identifyDob = this.identifyForm.getByLabel('Date of birth');
    this.continueButton = page.getByRole('button', { name: 'Continue', exact: true });
    this.newPatientButton = page.getByRole('button', { name: 'I am a new patient' });

    this.registerForm = page.getByTestId('booking-register-form');

    this.picker = page.getByTestId('booking-slot-picker');
    this.specialization = page.locator('#booking-specialization');
    this.doctor = page.locator('#booking-doctor');
    this.dateOptions = page.getByTestId('date-option');
    this.slotOptions = page.getByTestId('slot-option');
    this.noDoctorsMessage = page.getByText('No doctors are available to book right now');

    this.summary = page.getByTestId('booking-confirm');
    this.confirmButton = page.getByRole('button', { name: /confirm appointment|booking…/i });
    this.billingNotice = page.getByTestId('billing-notice');
    this.confirmation = page.getByTestId('booking-confirmation');
    this.patientCard = page.getByTestId('patient-number');
    this.upcoming = page.getByRole('heading', { name: /upcoming/i });
  }

  async open(path = '/book'): Promise<void> {
    await this.page.goto(path);
    await expect(this.identifyForm).toBeVisible();
  }

  /** The alert inside the step currently on screen. */
  stepAlert(): Locator {
    return this.page.getByRole('alert').first();
  }

  async identify(patientNumber: string, dateOfBirth: string): Promise<void> {
    await this.patientNumber.fill(patientNumber);
    await this.identifyDob.fill(dateOfBirth);
    await this.continueButton.click();
  }

  async startAsNewPatient(): Promise<void> {
    await this.newPatientButton.click();
    await expect(this.registerForm).toBeVisible();
  }

  /** Fills the demographics form. Fields left out stay empty, so validation can be exercised. */
  async fillRegistration(details: Partial<PatientDetails>): Promise<void> {
    const form = this.registerForm;
    const fields: Array<[keyof PatientDetails, string]> = [
      ['nic', 'NIC *'],
      ['dateOfBirth', 'Date of birth *'],
      ['firstName', 'First name *'],
      ['lastName', 'Last name *'],
      ['phone', 'Phone *'],
      ['email', 'Email *'],
      ['addressLine1', 'Address *'],
      ['district', 'District *'],
    ];
    for (const [key, label] of fields) {
      const value = details[key];
      if (value !== undefined) await form.getByLabel(label, { exact: true }).fill(value);
    }
    if (details.gender) await form.getByLabel('Gender *').selectOption(details.gender);
  }

  async register(details: PatientDetails): Promise<void> {
    await this.fillRegistration(details);
    await this.continueButton.click();
  }

  /** The error text shown under one registration field, located by that field's label. */
  fieldError(label: string): Locator {
    return this.registerForm
      .getByLabel(label, { exact: true })
      .locator('xpath=ancestor::div[contains(concat(" ", @class, " "), " form-group ")][1]')
      .locator('span')
      .last();
  }

  /**
   * Doctor option values offered, excluding the "Select a doctor" placeholder. Waits for the list
   * to load first (the select is disabled until doctors arrive), so it never reads a half-built page.
   */
  async offeredDoctorIds(): Promise<string[]> {
    await expect(this.doctor).toBeEnabled();
    const values = await this.doctor.locator('option').evaluateAll((options) =>
      options.map((option) => (option as HTMLOptionElement).value),
    );
    return values.filter(Boolean);
  }

  async chooseDoctor(doctorId: string): Promise<void> {
    await expect(this.doctor).toBeEnabled();
    await this.doctor.selectOption(doctorId);
  }

  async chooseDate(isoDate: string): Promise<void> {
    await this.page.locator(`[data-testid="date-option"][data-date="${isoDate}"]`).click();
  }

  /**
   * The first date on or after `earliest` that has free times. A chip's title says "N free times";
   * fully booked days are selectable too (to join the waitlist) but say "Fully booked", so the
   * title — not just `disabled` — is what tells them apart.
   */
  async firstOpenDateOnOrAfter(earliest: string): Promise<string> {
    await expect(this.dateOptions.first()).toBeVisible();
    const dates = await this.dateOptions.evaluateAll((chips) =>
      chips
        .filter((chip) => !(chip as HTMLButtonElement).disabled && /free time/.test(chip.getAttribute('title') ?? ''))
        .map((chip) => chip.getAttribute('data-date') ?? ''),
    );
    const found = dates.find((date) => date >= earliest);
    if (!found) throw new Error(`No date with free times on or after ${earliest}. Offered: ${dates.join(', ')}`);
    return found;
  }

  async offeredSlotIds(): Promise<string[]> {
    return this.slotOptions.evaluateAll((slots) => slots.map((slot) => slot.getAttribute('data-slot-id') ?? ''));
  }

  /** Picks the n-th time on the chosen day and returns what was picked. */
  async pickSlot(index = 0): Promise<PickedSlot> {
    const slot = this.slotOptions.nth(index);
    await expect(slot).toBeVisible();
    const picked = {
      slotId: (await slot.getAttribute('data-slot-id')) ?? '',
      date: (await this.page.locator('[data-testid="date-option"][aria-pressed="true"]').getAttribute('data-date')) ?? '',
      time: (await slot.getByTestId('slot-time').textContent())?.trim() ?? '',
    };
    await slot.click();
    await expect(slot).toHaveAttribute('aria-pressed', 'true');
    return picked;
  }

  async confirm(): Promise<void> {
    await expect(this.confirmButton).toBeEnabled();
    await this.confirmButton.click();
  }

  /** The patient number shown on the "Booking for" card. */
  async shownPatientNumber(): Promise<string> {
    const text = (await this.patientCard.textContent()) ?? '';
    return text.match(/PAT-\d+/)?.[0] ?? '';
  }
}
