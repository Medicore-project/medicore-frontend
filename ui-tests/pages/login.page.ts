import type { Locator, Page } from '@playwright/test';

/**
 * The staff sign-in page (`/login`).
 *
 * Page Object convention for the whole suite: locate by what a user perceives — role, accessible
 * name, label — and fall back to `data-testid` only where the markup offers nothing better. Never
 * by CSS class: this app is restyled routinely, and a test should only break when behaviour does.
 */
export class LoginPage {
  readonly email: Locator;
  readonly password: Locator;
  readonly submit: Locator;
  readonly error: Locator;
  readonly showPassword: Locator;
  readonly bookWithoutAccount: Locator;

  constructor(private readonly page: Page) {
    this.email = page.getByLabel('Work email');
    this.password = page.getByLabel('Password', { exact: true });
    this.submit = page.getByRole('button', { name: /sign in securely|signing in/i });
    this.error = page.getByRole('alert');
    this.showPassword = page.getByRole('button', { name: /show password|hide password/i });
    this.bookWithoutAccount = page.getByTestId('login-book-link');
  }

  async open(): Promise<void> {
    await this.page.goto('/login');
    await this.email.waitFor();
  }

  async signIn(email: string, password: string): Promise<void> {
    await this.email.fill(email);
    await this.password.fill(password);
    await this.submit.click();
  }
}
