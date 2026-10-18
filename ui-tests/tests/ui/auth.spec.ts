import { USERS, type Role } from '../../mocks/data';
import { expect, test } from '../../fixtures/ui-test';

/**
 * Signing in, signing out, and what an unauthenticated visitor can reach.
 * Identity service doubled by the fake gateway.
 */
test.describe('Staff authentication', () => {
  // Data-driven: every role lands where homePathFor() says it belongs.
  const landings: Array<{ role: Role; path: RegExp }> = [
    { role: 'Admin', path: /\/dashboard$/ },
    { role: 'Receptionist', path: /\/dashboard$/ },
    { role: 'Doctor', path: /\/dashboard$/ },
    { role: 'Patient', path: /\/appointments\/book$/ },
  ];

  for (const { role, path } of landings) {
    test(`a ${role} who signs in lands on their home page`, async ({ page, loginPage, gateway }) => {
      const user = USERS[role];
      await loginPage.open();
      await loginPage.signIn(user.email, user.password);

      await expect(page).toHaveURL(path);

      // What the UI sent, and what it kept.
      const login = gateway.lastCallTo('POST', '/auth/login');
      expect(login?.body).toEqual({ email: user.email, password: user.password });
      const stored = await page.evaluate(() => ({
        token: localStorage.getItem('access_token'),
        user: JSON.parse(localStorage.getItem('user') ?? 'null'),
      }));
      expect(stored.token).toBe(`staff-token-${role.toLowerCase()}`);
      expect(stored.user.role).toBe(role);
    });
  }

  test('wrong credentials show the service message and keep the visitor on the login page', async ({
    page,
    loginPage,
  }) => {
    await loginPage.open();
    await loginPage.signIn(USERS.Admin.email, 'not-the-password');

    await expect(loginPage.error).toHaveText(/invalid email or password/i);
    await expect(page).toHaveURL(/\/login$/);
    expect(await page.evaluate(() => localStorage.getItem('access_token'))).toBeNull();

    // A second failure re-renders the banner (it re-mounts so it shakes again) — still one alert.
    await loginPage.submit.click();
    await expect(loginPage.error).toHaveCount(1);
  });

  test('the submit button is disabled while the request is in flight', async ({ loginPage, gateway }) => {
    gateway.on('POST', '/auth/login', { delayMs: 800, status: 401, json: { message: 'Invalid email or password' } });
    await loginPage.open();
    await loginPage.signIn(USERS.Admin.email, 'x');

    await expect(loginPage.submit).toBeDisabled();
    await expect(loginPage.submit).toHaveText(/signing in/i);
    await expect(loginPage.error).toBeVisible();
    await expect(loginPage.submit).toBeEnabled();
  });

  test('the password can be revealed and hidden again', async ({ loginPage }) => {
    await loginPage.open();
    await loginPage.password.fill('secret');

    await expect(loginPage.password).toHaveAttribute('type', 'password');
    await loginPage.showPassword.click();
    await expect(loginPage.password).toHaveAttribute('type', 'text');
    await expect(loginPage.showPassword).toHaveAttribute('aria-pressed', 'true');
    await loginPage.showPassword.click();
    await expect(loginPage.password).toHaveAttribute('type', 'password');
  });

  test('signing out clears the session and returns to the login page', async ({
    page,
    signInAs,
    workspace,
    gateway,
  }) => {
    await signInAs('Admin');
    await page.goto('/dashboard');
    await expect(workspace.sidebar).toBeVisible();

    await workspace.signOut();

    await expect(page).toHaveURL(/\/login$/);
    expect(gateway.callsTo('POST', '/auth/logout')).toHaveLength(1);
    expect(await page.evaluate(() => localStorage.length)).toBe(0);
  });
});

test.describe('Route protection', () => {
  const protectedPaths = ['/dashboard', '/patients', '/patients/register', '/appointments/booked', '/staff', '/reports/revenue'];

  for (const path of protectedPaths) {
    test(`an anonymous visitor opening ${path} is sent to the login page`, async ({ page, gateway }) => {
      void gateway;
      await page.goto(path);
      await expect(page).toHaveURL(/\/login$/);
    });
  }

  test('the public booking page needs no account', async ({ page, bookingPage }) => {
    await bookingPage.open('/book');
    await expect(page).toHaveURL(/\/book$/);
    await expect(page.getByRole('link', { name: 'Staff login' })).toBeVisible();
  });
});
