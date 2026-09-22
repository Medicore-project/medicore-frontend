import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DoctorLeavePage from './DoctorLeavePage';

const OWN_ID = '3f5b9c1e-1f0a-4a7c-9b3d-7c9a2e4f6b18';
const OTHER_ID = 'a1c4e8d2-55b6-4f39-8e71-2d6c0b9a4371';

const api = vi.hoisted(() => ({
  doctor: { list: vi.fn() },
  leave: {
    listForDoctor: vi.fn(),
    pending: vi.fn(),
    create: vi.fn(),
    review: vi.fn(),
    withdraw: vi.fn(),
  },
  user: { current: null as null | { id: string; email: string; role: string; staffId?: string } },
}));

vi.mock('../api/appointments', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/appointments')>()),
  doctorApi: api.doctor,
  leaveApi: api.leave,
}));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: api.user.current }),
}));

function signInAs(role: string, staffId?: string) {
  api.user.current = { id: 'u1', email: `${role.toLowerCase()}@medicore.lk`, role, staffId };
}

beforeEach(() => {
  vi.clearAllMocks();
  api.doctor.list.mockResolvedValue([
    { doctorId: OWN_ID, fullName: 'Tathira Samarakoon', specialization: 'Neurology', departmentId: 'd1' },
    { doctorId: OTHER_ID, fullName: 'Kamala Silva', specialization: '', departmentId: 'd1' },
  ]);
  api.leave.listForDoctor.mockResolvedValue([]);
  api.leave.pending.mockResolvedValue([]);
});

describe('DoctorLeavePage doctor picker (SCRUM-33)', () => {
  it('lists doctors from the appointment service cache', async () => {
    signInAs('Admin');

    render(<DoctorLeavePage />);

    expect(await screen.findByRole('option', { name: 'Tathira Samarakoon — Neurology' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Kamala Silva' })).toBeInTheDocument();
    expect(api.doctor.list).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(api.leave.listForDoctor).toHaveBeenCalledWith(OWN_ID));
  });

  it('locks a doctor to their own cached profile and lets them request leave', async () => {
    signInAs('Doctor', OWN_ID);

    render(<DoctorLeavePage />);

    expect(await screen.findByText('You can only view and request your own leave.')).toBeInTheDocument();
    expect(screen.getByLabelText('Doctor')).toHaveValue(OWN_ID);
    expect(screen.getByLabelText('Doctor')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Request leave' })).toBeInTheDocument();
  });

  it('tells a doctor missing from the cache why they cannot request leave, but still shows their requests', async () => {
    signInAs('Doctor', 'not-in-cache-0000');

    render(<DoctorLeavePage />);

    expect(await screen.findByText(/not bookable in the appointment service yet/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Request leave' })).not.toBeInTheDocument();
    await waitFor(() => expect(api.leave.listForDoctor).toHaveBeenCalledWith('not-in-cache-0000'));
  });
});
