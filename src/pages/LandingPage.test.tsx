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

  it('swaps the service details when another service is chosen', () => {
    renderAs(undefined);

    expect(screen.getByRole('tabpanel')).toHaveTextContent('General Medicine');

    const imaging = screen.getByRole('tab', { name: /Diagnostic Imaging/ });
    fireEvent.click(imaging);

    expect(imaging).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveTextContent('CT and MRI scanning');
  });

  it('moves between services with the arrow keys', () => {
    renderAs(undefined);

    fireEvent.keyDown(screen.getByRole('tab', { name: /General Medicine/ }), { key: 'ArrowRight' });

    expect(screen.getByRole('tab', { name: /Diagnostic Imaging/ })).toHaveAttribute('aria-selected', 'true');
  });

  it('opens one FAQ answer at a time', () => {
    renderAs(undefined);
    const first = screen.getByRole('button', { name: 'Do I need an account to book an appointment?' });
    const second = screen.getByRole('button', { name: 'What if the doctor I want is fully booked?' });

    expect(first).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(second);

    expect(second).toHaveAttribute('aria-expanded', 'true');
    expect(first).toHaveAttribute('aria-expanded', 'false');
  });

  it('offers the staff login from the mobile menu too', () => {
    renderAs(undefined);

    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    fireEvent.click(screen.getByRole('link', { name: 'Staff login' }));

    expect(screen.getByText('staff login')).toBeInTheDocument();
  });
});
