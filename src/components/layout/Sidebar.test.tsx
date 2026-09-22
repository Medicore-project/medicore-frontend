import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import Sidebar from './Sidebar';

const auth = vi.hoisted(() => ({ role: 'Admin' as string | undefined }));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: auth.role ? { id: 'u1', email: 'u@medicore.lk', role: auth.role } : null }),
}));

function renderAs(role: string | undefined) {
  auth.role = role;
  render(
    <MemoryRouter>
      <Sidebar />
    </MemoryRouter>,
  );
}

describe('Sidebar doctor-leave tab', () => {
  it('is offered to a doctor, who requests their own leave', () => {
    renderAs('Doctor');

    expect(screen.getByRole('link', { name: 'Doctor Leave' })).toBeInTheDocument();
  });

  it('is offered to an admin, who approves leave', () => {
    renderAs('Admin');

    expect(screen.getByRole('link', { name: 'Doctor Leave' })).toBeInTheDocument();
  });

  it.each(['Receptionist', 'Nurse'])('is hidden from %s', (role) => {
    // They learn a doctor is away from the booking grid instead, which is why the tab
    // would only have bounced them back to the home page.
    renderAs(role);

    expect(screen.queryByRole('link', { name: 'Doctor Leave' })).not.toBeInTheDocument();
  });

  it('still offers the booking grid to every clinic role', () => {
    for (const role of ['Admin', 'Receptionist', 'Doctor', 'Nurse']) {
      renderAs(role);
      expect(screen.getAllByRole('link', { name: 'Appointments' }).length).toBeGreaterThan(0);
      screen.getByRole('link', { name: 'Dashboard' });
      document.body.innerHTML = '';
    }
  });

  it('offers nothing role-gated when there is no user', () => {
    renderAs(undefined);

    expect(screen.queryByRole('link', { name: 'Doctor Leave' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Dashboard' })).toBeInTheDocument();
  });
});
