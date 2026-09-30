import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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

function leaveRequest(overrides: Record<string, unknown> = {}) {
  return {
    leaveId: 'leave-1',
    doctorId: OWN_ID,
    startDate: '2026-10-06',
    endDate: '2026-10-08',
    reason: 'Conference',
    status: 'Pending',
    reviewedBy: null,
    reviewedAtUtc: null,
    reviewNotes: null,
    createdAt: '2026-09-28T04:00:00Z',
    createdBy: 'doctor@medicore.lk',
    ...overrides,
  };
}

const NO_IMPACT = { doctorsProcessed: 0, slotsCreated: 0, slotsRemoved: 0, slotsFlagged: 0 };

describe('DoctorLeavePage redesign interactions', () => {
  it('approves a pending request through a dialog, with a note', async () => {
    signInAs('Admin');
    api.leave.pending.mockResolvedValue([leaveRequest()]);
    api.leave.review.mockResolvedValue({
      leave: leaveRequest({ status: 'Approved' }),
      impact: { ...NO_IMPACT, slotsRemoved: 12, slotsFlagged: 2 },
    });

    render(<DoctorLeavePage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Approve' }));

    const dialog = screen.getByRole('dialog', { name: 'Approve this leave?' });
    expect(dialog).toHaveTextContent('Tue, 6 Oct 2026 → Thu, 8 Oct 2026');
    fireEvent.change(within(dialog).getByLabelText(/Note to attach/), { target: { value: 'Enjoy' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Approve leave' }));

    await waitFor(() => expect(api.leave.review).toHaveBeenCalledWith('leave-1', 'Approved', 'Enjoy'));
    expect(
      await screen.findByText(/Request approved\. 12 free slot\(s\) removed, 2 booking\(s\) flagged/),
    ).toBeInTheDocument();
  });

  it('sends no note when the reviewer leaves it blank', async () => {
    signInAs('Admin');
    api.leave.pending.mockResolvedValue([leaveRequest()]);
    api.leave.review.mockResolvedValue({ leave: leaveRequest({ status: 'Rejected' }), impact: NO_IMPACT });

    render(<DoctorLeavePage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Reject' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Reject leave' }));

    await waitFor(() => expect(api.leave.review).toHaveBeenCalledWith('leave-1', 'Rejected', null));
  });

  it('filters the requests by status', async () => {
    signInAs('Admin');
    api.leave.listForDoctor.mockResolvedValue([
      leaveRequest({ leaveId: 'a', status: 'Approved', reason: 'Wedding' }),
      leaveRequest({ leaveId: 'b', status: 'Rejected', reason: 'Holiday' }),
    ]);

    render(<DoctorLeavePage />);
    expect(await screen.findByText('Wedding')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Rejected/ }));

    expect(screen.getByText('Holiday')).toBeInTheDocument();
    expect(screen.queryByText('Wedding')).not.toBeInTheDocument();
  });

  it('counts the days of a request as it is typed, and refuses a backwards range', async () => {
    signInAs('Doctor', OWN_ID);

    render(<DoctorLeavePage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Request leave' }));
    fireEvent.change(screen.getByLabelText('First day'), { target: { value: '2026-10-06' } });
    fireEvent.change(screen.getByLabelText('Last day'), { target: { value: '2026-10-08' } });

    expect(screen.getByText(/^3 days off/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Last day'), { target: { value: '2026-10-01' } });

    expect(screen.getByText('The last day cannot be before the first.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Submit request' })).toBeDisabled();
  });
});
