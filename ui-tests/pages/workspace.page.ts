import type { Locator, Page } from '@playwright/test';

/** The signed-in staff shell: sidebar, header, account menu. */
export class WorkspacePage {
  readonly sidebar: Locator;
  readonly navLinks: Locator;
  readonly header: Locator;
  readonly accountMenuButton: Locator;
  readonly logout: Locator;

  constructor(page: Page) {
    this.sidebar = page.getByRole('complementary', { name: 'Workspace navigation' });
    this.navLinks = this.sidebar.getByRole('link');
    this.header = page.getByRole('banner');
    this.accountMenuButton = this.header.locator('[aria-controls="ws-user-menu"]');
    this.logout = page.getByRole('button', { name: 'Log out' });
  }

  /** The visible names of every sidebar link, in order. */
  async navItemNames(): Promise<string[]> {
    return (await this.navLinks.allTextContents()).map((name) => name.trim());
  }

  link(name: string): Locator {
    return this.sidebar.getByRole('link', { name, exact: true });
  }

  async signOut(): Promise<void> {
    await this.accountMenuButton.click();
    await this.logout.click();
  }
}
