import type { Role } from '../../mocks/data';
import { expect, test } from '../../fixtures/ui-test';

/**
 * Role-based access in the UI. The sidebar must offer each role exactly the pages its routes admit
 * (navigation.ts mirrors App.tsx, which mirrors the backend policies), and typing a URL the role is
 * not allowed must bounce. The backend enforces the real permission; this proves the UI never
 * offers a page that would only answer 403.
 */

const EXPECTED_NAV: Record<Role, string[]> = {
  Admin: [
    'Dashboard', 'Patients', 'Appointments', 'Booked Appointments', 'Waitlist', 'Book Appointment',
    'Doctor Leave', 'Departments', 'Specializations', 'Staff', 'Service Tariffs', 'Email Notifications',
    'Audit Reports', 'Demographics Report', 'Utilisation Report', 'Revenue Report', 'Outstanding Invoices',
  ],
  Receptionist: [
    'Dashboard', 'Patients', 'Appointments', 'Booked Appointments', 'Waitlist', 'Book Appointment',
    'Departments', 'Specializations', 'Service Tariffs',
  ],
  Doctor: ['Dashboard', 'Patients', 'Appointments', 'Booked Appointments', 'Waitlist', 'Doctor Leave'],
  Nurse: ['Dashboard', 'Patients', 'Appointments'],
  Patient: ['Book Appointment'],
};

const HOME: Record<Role, string> = {
  Admin: '/dashboard',
  Receptionist: '/dashboard',
  Doctor: '/dashboard',
  Nurse: '/dashboard',
  Patient: '/appointments/book',
};

test.describe('Sidebar matches each role’s permissions', () => {
  for (const [role, expected] of Object.entries(EXPECTED_NAV) as Array<[Role, string[]]>) {
    test(`${role} sees exactly ${expected.length} page${expected.length === 1 ? '' : 's'}`, async ({
      page,
      signInAs,
      workspace,
    }) => {
      await signInAs(role);
      await page.goto(HOME[role]);

      await expect(workspace.sidebar).toBeVisible();
      expect(await workspace.navItemNames()).toEqual(expected);
    });
  }
});

test.describe('Forbidden URLs bounce instead of rendering', () => {
  const cases: Array<{ role: Role; path: string }> = [
    { role: 'Receptionist', path: '/staff' },
    { role: 'Receptionist', path: '/reports/audit' },
    { role: 'Nurse', path: '/appointments/booked' },
    { role: 'Nurse', path: '/patients/register' },
    { role: 'Doctor', path: '/billing/tariffs' },
    { role: 'Patient', path: '/dashboard' },
    { role: 'Patient', path: '/patients' },
  ];

  for (const { role, path } of cases) {
    test(`${role} typing ${path} is sent back to the public home page`, async ({ page, signInAs, workspace }) => {
      await signInAs(role);
      await page.goto(path);

      await expect(page).toHaveURL(/\/$/);
      await expect(workspace.sidebar).toHaveCount(0);
    });
  }
});

test('navigating from the sidebar updates the page and highlights the link', async ({ page, signInAs, workspace }) => {
  await signInAs('Receptionist');
  await page.goto('/dashboard');

  await workspace.link('Booked Appointments').click();

  await expect(page).toHaveURL(/\/appointments\/booked$/);
  await expect(page.getByRole('heading', { name: 'Booked Appointments', level: 1 })).toBeVisible();
  await expect(workspace.link('Booked Appointments')).toHaveClass(/active/);
  // `end` matching: the parent "Appointments" link must not light up on a child route.
  await expect(workspace.link('Appointments')).not.toHaveClass(/active/);
});
