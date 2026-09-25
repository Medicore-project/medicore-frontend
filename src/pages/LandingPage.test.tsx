import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import LandingPage from './LandingPage';

const auth = vi.hoisted(() => ({ role: undefined as string | undefined }));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: auth.role ? { id: 'u1', email: 'u@medicore.lk', role: auth.role } : null }),
}));

function renderAs(role: string | undefined) {
  auth.role = role;
  render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/book" element={<p>public booking</p>} />
        <Route path="/login" element={<p>staff login</p>} />
        <Route path="/dashboard" element={<p>dashboard</p>} />
        <Route path="/appointments/book" element={<p>in-app booking</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('LandingPage', () => {
  it('sends a visitor from the nav straight to public booking, not to a login', () => {
    renderAs(undefined);

    fireEvent.click(screen.getByTestId('landing-book'));

    expect(screen.getByText('public booking')).toBeInTheDocument();
  });

  it('sends a visitor from the hero straight to public booking', () => {
    renderAs(undefined);

    fireEvent.click(screen.getByTestId('hero-book'));

    expect(screen.getByText('public booking')).toBeInTheDocument();
  });

  it('labels the login as the staff way in', () => {
    renderAs(undefined);

    fireEvent.click(screen.getByRole('button', { name: 'Staff login' }));

    expect(screen.getByText('staff login')).toBeInTheDocument();
  });

  it('takes signed-in staff to the dashboard', () => {
    renderAs('Receptionist');

    fireEvent.click(screen.getByRole('button', { name: 'Dashboard' }));

    expect(screen.getByText('dashboard')).toBeInTheDocument();
  });

  it('takes a signed-in patient to booking rather than the staff-only dashboard', () => {
    renderAs('Patient');

    fireEvent.click(screen.getByRole('button', { name: 'My booking' }));

    expect(screen.getByText('in-app booking')).toBeInTheDocument();
  });
});
