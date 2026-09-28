import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LoginPage from './LoginPage';

const auth = vi.hoisted(() => ({ login: vi.fn() }));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ login: auth.login, isAuthenticated: false, user: null }),
}));

function renderLogin() {
  render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/book" element={<p>public booking</p>} />
        <Route path="/" element={<p>home</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('LoginPage', () => {
  beforeEach(() => {
    auth.login.mockReset();
  });

  it('shows and hides the typed password', () => {
    renderLogin();
    const password = screen.getByLabelText('Password');

    expect(password).toHaveAttribute('type', 'password');

    fireEvent.click(screen.getByRole('button', { name: 'Show password' }));
    expect(password).toHaveAttribute('type', 'text');

    fireEvent.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(password).toHaveAttribute('type', 'password');
  });

  it('signs in with the typed email and password', async () => {
    auth.login.mockResolvedValue(undefined);
    renderLogin();

    fireEvent.change(screen.getByLabelText('Work email'), { target: { value: 'dr@medicore.lk' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in securely/i }));

    await waitFor(() => expect(auth.login).toHaveBeenCalledWith('dr@medicore.lk', 'secret'));
  });

  it('shows the server message when sign in fails', async () => {
    auth.login.mockRejectedValue({ response: { data: { message: 'Account locked' } } });
    renderLogin();

    fireEvent.change(screen.getByLabelText('Work email'), { target: { value: 'dr@medicore.lk' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in securely/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Account locked');
  });

  it('warns when Caps Lock is on while typing the password', () => {
    renderLogin();
    const password = screen.getByLabelText('Password');

    fireEvent.keyDown(password, { key: 'A', modifierCapsLock: true });
    expect(screen.getByText('Caps Lock is on')).toBeInTheDocument();

    fireEvent.keyDown(password, { key: 'a', modifierCapsLock: false });
    expect(screen.queryByText('Caps Lock is on')).not.toBeInTheDocument();
  });

  it('explains that an administrator resets passwords', () => {
    renderLogin();
    const forgot = screen.getByRole('button', { name: 'Forgot password?' });

    expect(forgot).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(forgot);

    expect(forgot).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(/handled by your MediCore administrator/)).toBeInTheDocument();
  });

  it('offers patients booking without an account', () => {
    renderLogin();

    fireEvent.click(screen.getByTestId('login-book-link'));

    expect(screen.getByText('public booking')).toBeInTheDocument();
  });
});
