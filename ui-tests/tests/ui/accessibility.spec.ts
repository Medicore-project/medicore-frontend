import { RETURNING_PATIENT } from '../../mocks/data';
import { expect, test } from '../../fixtures/ui-test';

/**
 * Automated accessibility checks (axe-core, WCAG 2.0/2.1 A and AA rules) on the screens a patient
 * or a new member of staff meets first. The full violation list for each page is attached to the
 * HTML report; the gate is zero *critical* violations, so a page a screen-reader user cannot
 * operate at all fails the build, while lesser findings are reported for the team to triage.
 */

const pages = [
  { name: 'landing page', path: '/' },
  { name: 'staff login', path: '/login' },
  { name: 'public booking — identify step', path: '/book' },
];

for (const { name, path } of pages) {
  test(`${name} has no critical accessibility violations`, async ({ page, gateway, scanA11y }) => {
    void gateway;
    await page.goto(path);
    await page.waitForLoadState('networkidle');

    const violations = await scanA11y();
    test.info().annotations.push({
      type: 'axe',
      description: violations.length
        ? violations.map((v) => `${v.impact}: ${v.id} (${v.nodes})`).join('; ')
        : 'no violations',
    });
    expect(violations.filter((v) => v.impact === 'critical')).toEqual([]);
  });
}

test('public booking — slot picker has no critical accessibility violations', async ({ bookingPage, scanA11y }) => {
  await bookingPage.open();
  await bookingPage.identify(RETURNING_PATIENT.patientNumber, RETURNING_PATIENT.dateOfBirth);
  await bookingPage.chooseDoctor('doc-amara');
  await expect(bookingPage.slotOptions.first()).toBeVisible();

  const violations = await scanA11y();
  expect(violations.filter((v) => v.impact === 'critical')).toEqual([]);
});

test('the booking flow can be completed with the keyboard alone', async ({ page, bookingPage }) => {
  await bookingPage.open();
  await bookingPage.patientNumber.focus();
  await page.keyboard.type(RETURNING_PATIENT.patientNumber);
  await bookingPage.identifyDob.fill(RETURNING_PATIENT.dateOfBirth);
  await bookingPage.identifyDob.press('Enter');

  await expect(bookingPage.picker).toBeVisible();
  await bookingPage.doctor.focus();
  await bookingPage.doctor.selectOption('doc-amara');
  await bookingPage.slotOptions.first().focus();
  await page.keyboard.press('Enter');
  await expect(bookingPage.slotOptions.first()).toHaveAttribute('aria-pressed', 'true');

  await bookingPage.confirmButton.focus();
  await page.keyboard.press('Enter');
  await expect(bookingPage.confirmation).toBeVisible();
});
