import { By, until } from 'selenium-webdriver';
import { config } from '../config.js';

/**
 * The booking page, as the suite talks to it.
 *
 * Every element is found by `data-testid` or by the stable `id` the form controls already carry —
 * never by CSS class. The team restyles this app routinely (the schedule empty states were
 * rewritten last week), and a suite coupled to the stylesheet would break on work that changed no
 * behaviour at all.
 */
export class BookingPage {
  constructor(driver) {
    this.driver = driver;
  }

  // ── Navigation ──────────────────────────────────────────────────────────────

  async open() {
    await this.driver.get(`${config.baseUrl}/book`);
    await this.waitForTestId('booking-identify-form');
  }

  // ── Finding things ──────────────────────────────────────────────────────────

  testId(value) {
    return By.css(`[data-testid="${value}"]`);
  }

  waitForTestId(value) {
    return this.driver.wait(until.elementLocated(this.testId(value)), config.waitTimeout);
  }

  async waitForAllTestIds(value) {
    await this.driver.wait(
      async () => (await this.driver.findElements(this.testId(value))).length > 0,
      config.waitTimeout,
      `No elements with data-testid="${value}" appeared.`,
    );
    return this.driver.findElements(this.testId(value));
  }

  async textOfTestId(value) {
    const element = await this.waitForTestId(value);
    return element.getText();
  }

  async isTestIdPresent(value) {
    return (await this.driver.findElements(this.testId(value))).length > 0;
  }

  async fillById(id, value) {
    const field = await this.driver.wait(until.elementLocated(By.id(id)), config.waitTimeout);
    await field.clear();
    await field.sendKeys(value);
  }

  async selectById(id, value) {
    const select = await this.driver.wait(until.elementLocated(By.id(id)), config.waitTimeout);
    await select.findElement(By.css(`option[value="${value}"]`)).click();
  }

  async clickButton(text) {
    const button = await this.driver.wait(
      until.elementLocated(By.xpath(`//button[normalize-space()="${text}"]`)),
      config.waitTimeout,
    );
    await this.driver.wait(until.elementIsEnabled(button), config.waitTimeout);
    await button.click();
  }

  // ── Steps ───────────────────────────────────────────────────────────────────

  async identifyAs({ patientNumber, dateOfBirth }) {
    await this.fillById('booking-patient-number', patientNumber);
    await this.fillDate('booking-dob', dateOfBirth);
    await this.clickButton('Continue');
    await this.waitForTestId('booking-slot-picker');
  }

  async startAsNewPatient() {
    await this.clickButton('I am a new patient');
    await this.waitForTestId('booking-register-form');
  }

  async registerAs(patient) {
    await this.fillById('booking-nic', patient.nic);
    await this.fillDate('booking-register-dob', patient.dateOfBirth);
    await this.fillById('booking-first-name', patient.firstName);
    await this.fillById('booking-last-name', patient.lastName);
    await this.selectById('booking-gender', patient.gender);
    await this.fillById('booking-phone', patient.phone);
    await this.fillById('booking-email', patient.email);
    await this.fillById('booking-address', patient.addressLine1);
    await this.fillById('booking-district', patient.district);
    await this.clickButton('Continue');
    await this.waitForTestId('booking-slot-picker');
  }

  /** The doctors the picker is offering, as `{ value, label }`. */
  async availableDoctors() {
    const select = await this.driver.wait(
      until.elementLocated(By.id('booking-doctor')),
      config.waitTimeout,
    );
    const options = await select.findElements(By.css('option'));

    const doctors = [];
    for (const option of options) {
      const value = await option.getAttribute('value');
      if (value) doctors.push({ value, label: await option.getText() });
    }
    return doctors;
  }

  async chooseDoctor(doctorId) {
    await this.selectById('booking-doctor', doctorId);
  }

  /** The times currently on offer, as their visible labels. */
  async offeredTimes() {
    const slots = await this.driver.findElements(this.testId('slot-option'));
    return Promise.all(slots.map((slot) => slot.getText()));
  }

  /** Picks the first offered time and returns its label, so the test can assert on it later. */
  async pickFirstTime() {
    const slots = await this.waitForAllTestIds('slot-option');
    const label = await slots[0].getText();
    await slots[0].click();
    await this.waitForTestId('booking-confirm');
    return label;
  }

  async confirm() {
    await this.clickButton('Confirm booking');
    await this.waitForTestId('booking-confirmation');
  }

  async patientNumber() {
    const text = await this.textOfTestId('patient-number');
    const match = text.match(/PAT-\d+/);
    return match ? match[0] : null;
  }

  /**
   * A `<input type="date">` takes the locale's display order through sendKeys, not the ISO value,
   * so it is set directly and told React about it. Everything else the suite does goes through a
   * real click or keystroke.
   */
  async fillDate(id, isoDate) {
    const field = await this.driver.wait(until.elementLocated(By.id(id)), config.waitTimeout);
    await this.driver.executeScript(
      `const field = arguments[0];
       const setter = Object.getOwnPropertyDescriptor(
         window.HTMLInputElement.prototype, 'value').set;
       setter.call(field, arguments[1]);
       field.dispatchEvent(new Event('input', { bubbles: true }));
       field.dispatchEvent(new Event('change', { bubbles: true }));`,
      field,
      isoDate,
    );
  }
}
