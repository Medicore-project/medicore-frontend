import AxeBuilder from '@axe-core/playwright';
import { test as base, expect } from '@playwright/test';
import { USERS, authResponse, type Role } from '../mocks/data';
import { MockGateway } from '../mocks/mock-gateway';
import { BookingPage } from '../pages/booking.page';
import { LoginPage } from '../pages/login.page';
import { PatientRegistrationPage } from '../pages/patient-registration.page';
import { WorkspacePage } from '../pages/workspace.page';

/**
 * The UI layer's `test`: Playwright's, plus
 *  - `gateway`   the fake API gateway, installed before the page loads anything, and checked after
 *                every test for calls nobody expected;
 *  - `signInAs`  puts a signed-in session in place before the app boots, so a test about the
 *                patients page does not also have to be a test about the login page;
 *  - page objects, and an accessibility scanner.
 */

type UiFixtures = {
  gateway: MockGateway;
  signInAs: (role: Role) => Promise<void>;
  loginPage: LoginPage;
  bookingPage: BookingPage;
  workspace: WorkspacePage;
  registrationPage: PatientRegistrationPage;
  scanA11y: () => Promise<AxeViolationSummary[]>;
};

export interface AxeViolationSummary {
  id: string;
  impact: string | null | undefined;
  help: string;
  nodes: number;
}

export const test = base.extend<UiFixtures>({
  gateway: async ({ page }, use, testInfo) => {
    const gateway = new MockGateway(page);
    await gateway.install();
    await use(gateway);

    // Every request the UI made, attached to the report: the "spy" half of the double.
    await testInfo.attach('gateway-calls.json', {
      contentType: 'application/json',
      body: JSON.stringify(
        gateway.calls.map(({ method, path, query, body }) => ({ method, path, query: query.toString(), body })),
        null,
        2,
      ),
    });
    expect(
      gateway.unhandled.map((call) => `${call.method} ${call.path}`),
      'The UI called endpoints this test does not know about',
    ).toEqual([]);
  },

  signInAs: async ({ page, gateway }, use) => {
    // `gateway` is a dependency so routing is in place before the first page load.
    void gateway;
    await use(async (role: Role) => {
      const session = authResponse(USERS[role]);
      await page.addInitScript((value) => {
        // Init scripts run on every document, including the one logout redirects to; seed once per
        // tab so signing out really does leave the user signed out.
        if (window.sessionStorage.getItem('__e2e_seeded')) return;
        window.sessionStorage.setItem('__e2e_seeded', '1');
        window.localStorage.setItem('access_token', value.accessToken);
        window.localStorage.setItem('refresh_token', value.refreshToken);
        window.localStorage.setItem('user', JSON.stringify(value.user));
      }, session);
    });
  },

  loginPage: async ({ page, gateway }, use) => {
    void gateway;
    await use(new LoginPage(page));
  },
  bookingPage: async ({ page, gateway }, use) => {
    void gateway;
    await use(new BookingPage(page));
  },
  workspace: async ({ page }, use) => use(new WorkspacePage(page)),
  registrationPage: async ({ page }, use) => use(new PatientRegistrationPage(page)),

  scanA11y: async ({ page }, use, testInfo) => {
    await use(async () => {
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
      await testInfo.attach('axe-results.json', {
        contentType: 'application/json',
        body: JSON.stringify(results.violations, null, 2),
      });
      return results.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length }));
    });
  },
});

export { expect };
