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

  it('offers nothing at all when there is no user', () => {
    // Every tab is role-gated now that Dashboard is clinic-only, so an unauthenticated shell
    // renders an empty nav rather than a link that would bounce straight back.
    renderAs(undefined);

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});

describe('Sidebar booking tab (SCRUM-34)', () => {
  it('is the only thing a signed-in patient is offered', () => {
    // The whole of the "gate only" decision as a patient experiences it: one tab, nothing else.
    renderAs('Patient');

    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveTextContent('Book Appointment');
  });

  it.each(['Dashboard', 'Patients', 'Appointments', 'Doctor Leave', 'Staff'])(
    'keeps %s away from a patient',
    (tab) => {
      renderAs('Patient');

      expect(screen.queryByRole('link', { name: tab })).not.toBeInTheDocument();
    },
  );

  it('is offered to the front desk, who book on a patient behalf', () => {
    for (const role of ['Admin', 'Receptionist']) {
      renderAs(role);
      expect(screen.getByRole('link', { name: 'Book Appointment' })).toBeInTheDocument();
      document.body.innerHTML = '';
    }
  });

  it.each(['Doctor', 'Nurse'])('is hidden from %s, who do not take bookings', (role) => {
    renderAs(role);

    expect(screen.queryByRole('link', { name: 'Book Appointment' })).not.toBeInTheDocument();
  });

  it('does not steal the active state from the schedule grid', () => {
    // /appointments is marked `end`, so opening /appointments/book must not light both tabs.
    renderAs('Receptionist');

    expect(screen.getByRole('link', { name: 'Appointments' })).toHaveAttribute(
      'href',
      '/appointments',
    );
    expect(screen.getByRole('link', { name: 'Book Appointment' })).toHaveAttribute(
      'href',
      '/appointments/book',
    );
  });
});

describe('Sidebar booked-appointments tab', () => {
  it('is offered to the front desk and to doctors, who need to see who booked', () => {
    for (const role of ['Admin', 'Receptionist', 'Doctor']) {
      renderAs(role);
      expect(screen.getByRole('link', { name: 'Booked Appointments' })).toHaveAttribute(
        'href',
        '/appointments/booked',
      );
      document.body.innerHTML = '';
    }
  });

  it.each(['Nurse', 'Patient'])('is hidden from %s', (role) => {
    // A nurse reads bookings on the weekly grid; a patient sees only their own, on /book.
    renderAs(role);

    expect(screen.queryByRole('link', { name: 'Booked Appointments' })).not.toBeInTheDocument();
  });
});
