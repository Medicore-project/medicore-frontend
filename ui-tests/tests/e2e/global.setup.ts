import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test as setup } from '@playwright/test';
import { LoginPage } from '../../pages/login.page';
import { addDays, colomboToday } from '../../support/dates';
import { env } from '../../support/env';
import { GatewayClient, savedAdminToken, type DoctorResponse } from '../../support/gateway-client';

/**
 * E2E setup — runs once before every full-stack spec (it is the `e2e-setup` project the
 * `e2e-stack` project depends on).
 *
 *  1. The stack is up: the gateway reports every upstream service live.
 *  2. An admin session exists: signed in **through the real login page**, once, and saved as
 *     browser state that every spec reuses. Its token also authorises the provisioning below.
 *     Exactly one login per run, because the gateway allows five a minute per IP.
 *  3. A doctor can be booked: the appointment service's doctor cache is filled (Identity → Kafka)
 *     and some doctor has free times at least two days out (outside the 24-hour cancel window,
 *     so the journey can cancel what it books). Provisioned through the API if missing.
 *
 * Each step fails with a message that says what to do, because a red E2E run is most often a
 * stack that is not ready rather than a bug in the app.
 */

const SCHEDULE = { startTime: '08:00:00', endTime: '18:00:00', slotDurationMinutes: 30 };
const EARLIEST_OFFSET_DAYS = 2;

setup('the stack is up and the journey’s preconditions hold', async ({ page, request }) => {
  setup.setTimeout(120_000);

  expect(
    env.adminPassword,
    'Set E2E_ADMIN_PASSWORD (and E2E_ADMIN_EMAIL if not admin@medicore.local) to an Admin account on the stack. See ui-tests/README.md.',
  ).not.toBe('');

  const api = new GatewayClient(request);

  await setup.step('gateway and all four services are healthy', async () => {
    const health = await api.servicesHealth();
    expect(
      health.ok,
      `The gateway at ${env.gatewayUrl} is not healthy (HTTP ${health.status}). Start the stack: ` +
        `docker compose up -d --build (in medicore-backend).\n${health.body.slice(0, 600)}`,
    ).toBe(true);
  });

  await setup.step('admin signs in through the login page; the session is saved for the specs', async () => {
    const login = new LoginPage(page);
    await login.open();
    await login.signIn(env.adminEmail, env.adminPassword);
    // Either the workspace opens or the page says why not (wrong password, 429 rate limit…).
    await Promise.race([page.waitForURL(/\/dashboard$/), login.error.waitFor()]);
    if (await login.error.isVisible()) {
      throw new Error(`The login page refused ${env.adminEmail}: "${(await login.error.textContent())?.trim()}"`);
    }
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole('complementary', { name: 'Workspace navigation' })).toBeVisible();

    mkdirSync(path.dirname(env.adminStorageState), { recursive: true });
    await page.context().storageState({ path: env.adminStorageState });
    // The one login of the run also authorises the provisioning calls below.
    api.useToken(savedAdminToken());
  });

  const today = colomboToday();
  const earliest = addDays(today, EARLIEST_OFFSET_DAYS);
  let doctor: DoctorResponse | undefined;

  await setup.step('a doctor with free times from two days out', async () => {
    let doctors = await api.doctors();
    if (doctors.length === 0) {
      // The doctor cache is fed by Kafka, whose retention is seven days: doctors created earlier
      // are not in it on a fresh appointment service. Republishing is idempotent.
      await api.republishDoctors();
      await expect
        .poll(async () => (doctors = await api.doctors()).length, {
          message: 'No doctors reached the appointment service. Create one (Staff page) or run scripts/seed-local-demo.ps1.',
          timeout: env.eventualTimeoutMs,
        })
        .toBeGreaterThan(0);
    }

    for (const candidate of doctors) {
      const slots = await api.publicSlots(candidate.doctorId);
      if (slots.some((slot) => slot.slotDate >= earliest)) {
        doctor = candidate;
        break;
      }
    }

    if (!doctor) {
      // Against a deployed (shared) environment, changing a doctor's working week is not the
      // suite's call: stop and say what is needed, unless explicitly allowed.
      expect(
        !env.externalAppUrl || env.allowProvisioning,
        `No doctor on ${env.gatewayUrl} has free times from ${earliest}. Give a doctor a schedule on the ` +
          'Appointments page, or set E2E_ALLOW_PROVISIONING=1 to let the suite create one.',
      ).toBe(true);
      // Nobody is bookable: give the first doctor a schedule on every day of the week. A day that
      // already has an overlapping schedule answers 409 and is simply skipped.
      doctor = doctors[0];
      for (let dayOfWeek = 0; dayOfWeek <= 6; dayOfWeek++) {
        await api.createSchedule({ doctorId: doctor.doctorId, dayOfWeek, effectiveFrom: today, ...SCHEDULE });
      }
      await expect
        .poll(async () => (await api.publicSlots(doctor!.doctorId)).filter((s) => s.slotDate >= earliest).length, {
          message: `Created schedules for ${doctor.fullName}, but no free slots appeared.`,
          timeout: env.eventualTimeoutMs,
        })
        .toBeGreaterThan(0);
    }
  });

  writeFileSync(
    env.stackContextFile,
    JSON.stringify({ doctorId: doctor!.doctorId, doctorName: doctor!.fullName, earliestDate: earliest }, null, 2),
  );
});
