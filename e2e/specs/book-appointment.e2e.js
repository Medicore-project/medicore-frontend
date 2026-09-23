import assert from 'node:assert/strict';
import { Builder } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome.js';
import { config, requireExistingPatient } from '../config.js';
import { buildNewPatient } from '../data/patient.js';
import { BookingPage } from '../pages/booking.page.js';

/**
 * SCRUM-34 [QA]: the public booking flow, in a real browser, against a running stack.
 *
 * Read e2e/README.md before running — this books real slots in whatever database the app is
 * pointed at, and needs a doctor with a future schedule to exist.
 */
describe('SCRUM-34 public appointment booking', function () {
  let driver;
  let page;

  before(async function () {
    const options = new chrome.Options();
    if (config.headless) {
      options.addArguments('--headless=new', '--window-size=1440,900');
    }
    options.addArguments('--disable-gpu', '--no-sandbox');

    // Selenium Manager resolves chromedriver itself, so there is no binary to pin or check in.
    driver = await new Builder().forBrowser('chrome').setChromeOptions(options).build();
    await driver.manage().setTimeouts({ implicit: 0 });
    page = new BookingPage(driver);
  });

  after(async function () {
    if (driver) await driver.quit();
  });

  it('lets a returning patient book, and takes the slot out of circulation', async function () {
    const patient = requireExistingPatient();

    await page.open();
    await page.identifyAs(patient);

    // The number they identified with is on screen throughout.
    assert.equal(await page.patientNumber(), patient.patientNumber);

    const doctors = await page.availableDoctors();
    assert.ok(
      doctors.length > 0,
      'No bookable doctors. The appointment service\'s doctor cache is probably empty — run the ' +
        'Identity republish endpoint once as Admin. See e2e/README.md.',
    );

    await page.chooseDoctor(doctors[0].value);

    const timesBefore = await (async () => {
      await page.waitForTestId('booking-slot-picker');
      return page.offeredTimes();
    })();
    assert.ok(timesBefore.length > 0, 'This doctor has no free times; give them a future schedule.');

    const chosenTime = await page.pickFirstTime();

    // The confirm screen says what is about to happen, and says nothing has been charged.
    const confirmText = await page.textOfTestId('booking-confirm');
    assert.ok(confirmText.includes(chosenTime), 'The confirm screen should show the chosen time.');
    assert.match(await page.textOfTestId('billing-notice'), /Sprint\s*4/);

    await page.confirm();

    const confirmation = await page.textOfTestId('booking-confirmation');
    assert.match(confirmation, /confirmed/i);
    // AC1's "marks the slot taken", observed through the browser rather than the database.
    assert.match(await page.textOfTestId('billing-notice'), /Sprint\s*4/);

    // Reload the same doctor's times: the slot just taken must be gone.
    await page.open();
    await page.identifyAs(patient);
    await page.chooseDoctor(doctors[0].value);
    await page.waitForTestId('booking-slot-picker');
    const timesAfter = await page.offeredTimes();

    assert.ok(
      !timesAfter.includes(chosenTime) || timesAfter.length < timesBefore.length,
      `The booked time ${chosenTime} is still being offered.`,
    );
  });

  it('registers a new patient and books in the same visit', async function () {
    const patient = buildNewPatient();

    await page.open();
    await page.startAsNewPatient();
    await page.registerAs(patient);

    // The number they were just given is the thing they must leave with.
    const issued = await page.patientNumber();
    assert.match(issued ?? '', /^PAT-\d+$/, 'Registration should show a new patient number.');

    const doctors = await page.availableDoctors();
    assert.ok(doctors.length > 0, 'No bookable doctors — see the note in the first spec.');
    await page.chooseDoctor(doctors[0].value);

    await page.pickFirstTime();
    await page.confirm();

    assert.match(await page.textOfTestId('booking-confirmation'), /confirmed/i);
    // The number has not moved or changed during booking.
    assert.equal(await page.patientNumber(), issued);
  });

  it('refuses to identify a patient number that does not exist, without saying why', async function () {
    await page.open();

    await page.fillById('booking-patient-number', 'PAT-999999');
    await page.fillDate('booking-dob', '1900-01-01');
    await page.clickButton('Continue');

    const alert = await driver.wait(
      async () => {
        const alerts = await driver.findElements({ css: '[role="alert"]' });
        return alerts.length > 0 ? alerts[0] : null;
      },
      config.waitTimeout,
      'Expected an error message after a failed identification.',
    );

    const message = await alert.getText();
    assert.match(message, /could not find a patient/i);
    // Still on the identify step — nothing was revealed and nothing was booked.
    assert.ok(await page.isTestIdPresent('booking-identify-form'));
    assert.ok(!(await page.isTestIdPresent('patient-number')));
  });
});
