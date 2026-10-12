import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StaffResponse } from '../api/staff';
import ChangePasswordModal from './ChangePasswordModal';

const api = vi.hoisted(() => ({
  changePassword: vi.fn(),
}));

vi.mock('../api/staff', () => ({
  staffApi: api,
}));

const STAFF: StaffResponse = {
  id: 'staff-1',
  email: 'amara.perera@medicore.local',
  role: 'Doctor',
  firstName: 'Amara',
  lastName: 'Perera',
  fullName: 'Amara Perera',
  isActive: true,
};

function renderModal() {
  const onSuccess = vi.fn();
  const onClose = vi.fn();
  render(<ChangePasswordModal staff={STAFF} onSuccess={onSuccess} onClose={onClose} />);
  return { onSuccess, onClose };
}

function fill(password: string, confirmation = password) {
  fireEvent.change(screen.getByLabelText('New Password *'), { target: { value: password } });
  fireEvent.change(screen.getByLabelText('Confirm New Password *'), { target: { value: confirmation } });
}

function submit() {
  fireEvent.click(screen.getByRole('button', { name: 'Change Password' }));
}

describe('ChangePasswordModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.changePassword.mockResolvedValue(undefined);
  });

  it('says whose password is being changed and asks for no current password', () => {
    renderModal();

    expect(screen.getByRole('heading', { name: 'Change Password for Amara Perera' })).toBeInTheDocument();
    expect(screen.queryByLabelText(/current password/i)).not.toBeInTheDocument();
  });

  it('sends the new password for that staff member and reports success', async () => {
    const { onSuccess } = renderModal();

    fill('N3w-Secret!');
    submit();

    await waitFor(() => expect(api.changePassword).toHaveBeenCalledWith('staff-1', 'N3w-Secret!'));
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
  });

  it.each([
    ['', 'Password is required.'],
    ['short12', 'Password must be at least 8 characters long.'],
    [' N3w-Secret! ', 'Password cannot start or end with a space.'],
    ['a'.repeat(101), 'Password must not exceed 100 characters.'],
  ])('refuses %j without calling the service', (password, message) => {
    renderModal();

    fill(password);
    submit();

    expect(screen.getByText(message)).toBeInTheDocument();
    expect(api.changePassword).not.toHaveBeenCalled();
  });

  it('refuses a confirmation that does not match', () => {
    renderModal();

    fill('N3w-Secret!', 'N3w-Secret?');
    submit();

    expect(screen.getByText('The two passwords do not match.')).toBeInTheDocument();
    expect(api.changePassword).not.toHaveBeenCalled();
  });

  it("shows the service's own reason when it refuses the password", async () => {
    api.changePassword.mockRejectedValue({
      response: { status: 400, data: ['Password must be at least 8 characters long.'] },
    });
    const { onSuccess } = renderModal();

    fill('N3w-Secret!');
    submit();

    expect(await screen.findByRole('alert')).toHaveTextContent('Password must be at least 8 characters long.');
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('explains a staff member who has gone since the list was loaded', async () => {
    api.changePassword.mockRejectedValue({
      response: { status: 404, data: { title: 'Not Found', status: 404 } },
    });
    renderModal();

    fill('N3w-Secret!');
    submit();

    expect(await screen.findByRole('alert')).toHaveTextContent('This staff member no longer exists.');
  });

  it('does not blame the staff member when the service has no such route at all', async () => {
    // What an Identity service built before this feature answers: 404 with an empty body.
    api.changePassword.mockRejectedValue({ response: { status: 404, data: '' } });
    renderModal();

    fill('N3w-Secret!');
    submit();

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('does not have the change-password feature yet');
    expect(alert).not.toHaveTextContent('no longer exists');
  });

  it('says so when the signed-in user is not allowed to change passwords', async () => {
    api.changePassword.mockRejectedValue({ response: { status: 403 } });
    renderModal();

    fill('N3w-Secret!');
    submit();

    expect(await screen.findByRole('alert')).toHaveTextContent('You do not have permission to do that.');
  });
});
