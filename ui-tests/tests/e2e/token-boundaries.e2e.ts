import { expect, test } from '@playwright/test';
import { BookingPage } from '../../pages/booking.page';
import { GatewayClient } from '../../support/gateway-client';
import { uniquePatient } from '../../support/test-data';

/**
 * Credentials crossing service boundaries, on the real stack.
 *
 * The Patient service mints a short-lived *booking token* when someone identifies or registers on
 * the public page; the Appointment service accepts it — for booking and for that patient's own
 * appointments only. These checks prove the token is honoured where it should be and refused
 * everywhere else, in a different service from the one that issued it.
 */

// An anonymous visitor: none of the admin session the other specs reuse.
test.use({ storageState: { cookies: [], origins: [] } });

test('a booking token from the Patient service works for booking and nothing else', async ({ page, request }) => {
  const patient = uniquePatient();
  const api = new GatewayClient(request);
  const booking = new BookingPage(page);

  // Register on the public page, as an anonymous visitor, and keep the token the service mints.
  const registered = page.waitForResponse(
    (r) => r.request().method() === 'POST' && r.url().endsWith('/patient/api/patients/public-register'),
  );
  await booking.open('/book');
  await booking.startAsNewPatient();
  await booking.register(patient);
  const response = await registered;
  expect(response.ok(), await response.text()).toBe(true);
  const { bookingToken, patientNumber } = (await response.json()) as { bookingToken: string; patientNumber: string };
  await expect(booking.patientCard).toContainText(patientNumber);

  await test.step('honoured by the Appointment service for the patient’s own bookings', async () => {
    const mine = await api.rawGet('/appointment/api/appointments/mine', bookingToken);
    expect(mine.status()).toBe(200);
    expect(await mine.json()).toEqual([]);
  });

  const refusedWith = async (path: string) => (await api.rawGet(path, bookingToken)).status();

  await test.step('refused on the staff appointment list (Appointment service)', async () => {
    expect([401, 403]).toContain(await refusedWith('/appointment/api/appointments?from=2026-01-01&to=2026-01-02'));
  });
  await test.step('refused on patient search (Patient service — the issuer itself)', async () => {
    expect([401, 403]).toContain(await refusedWith('/patient/api/patients/search?q=PAT'));
  });
  await test.step('refused on staff data (Identity service)', async () => {
    expect([401, 403]).toContain(await refusedWith('/api/staff?page=1&pageSize=1'));
  });

  await test.step('no credential at all is refused on staff endpoints', async () => {
    expect((await api.rawGet('/appointment/api/appointments?from=2026-01-01&to=2026-01-02')).status()).toBe(401);
  });

  // The token never touched browser storage — it lives in module memory and dies with the tab.
  expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toContain(bookingToken);
});
