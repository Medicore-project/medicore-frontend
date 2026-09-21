import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DoctorLeaveResponse, SlotResponse } from '../api/appointments';
import AppointmentsPage from './AppointmentsPage';

const api = vi.hoisted(() => ({
  slot: { available: vi.fn(), flagged: vi.fn(), block: vi.fn(), unblock: vi.fn() },
  schedule: { listForDoctor: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn(), regenerate: vi.fn() },
  leave: { approved: vi.fn() },
  staff: { list: vi.fn() },
}));

vi.mock('../api/appointments', async (importOriginal) => ({
  // Keep the real Colombo date/time helpers — the grid's shape depends on them.
  ...(await importOriginal<typeof import('../api/appointments')>()),
  slotApi: api.slot,
  scheduleApi: api.schedule,
  leaveApi: api.leave,
}));

vi.mock('../api/staff', () => ({ staffApi: api.staff }));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1', email: 'front@medicore.lk', role: 'Receptionist' } }),
}));

const DOCTOR_ID = '3f5b9c1e-1f0a-4a7c-9b3d-7c9a2e4f6b18';

/** The Monday of the week the page opens on, mirroring the page's own startOfWeek. */
function currentMonday(): Date {
  const today = new Date();
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

function dayOfWeek(offset: number): Date {
  const d = currentMonday();
  d.setDate(d.getDate() + offset);
  return d;
}

function dateOnly(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;
}

/** A 09:00 Colombo slot on the given day — Colombo is UTC+05:30, so 03:30Z. */
function slotAt(date: Date): SlotResponse {
  return {
    slotId: `slot-${dateOnly(date)}`,
    doctorId: DOCTOR_ID,
    scheduleId: 'schedule-1',
    startUtc: `${dateOnly(date)}T03:30:00Z`,
    endUtc: `${dateOnly(date)}T04:00:00Z`,
    slotDate: dateOnly(date),
    durationMinutes: 30,
    status: 'Available',
  };
}

function leave(start: Date, end: Date, reason: string | null = 'Conference'): DoctorLeaveResponse {
  return {
    leaveId: 'leave-1',
    doctorId: DOCTOR_ID,
    startDate: dateOnly(start),
    endDate: dateOnly(end),
    reason,
    status: 'Approved',
    reviewedBy: 'admin@medicore.lk',
    reviewedAtUtc: '2026-09-20T04:00:00Z',
    reviewNotes: null,
    createdAt: '2026-09-19T04:00:00Z',
    createdBy: 'doctor@medicore.lk',
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  api.staff.list.mockResolvedValue({
    items: [{ id: DOCTOR_ID, fullName: 'Tathira Samarakoon', firstName: 'Tathira', lastName: 'Samarakoon', email: 'doc@medicore.lk', role: 'Doctor', isActive: true, specialization: 'Neurology' }],
    totalCount: 1,
    page: 1,
    pageSize: 100,
    totalPages: 1,
    hasPreviousPage: false,
    hasNextPage: false,
  });
  api.slot.flagged.mockResolvedValue([]);
  api.schedule.listForDoctor.mockResolvedValue([]);
  api.slot.available.mockResolvedValue([]);
  api.leave.approved.mockResolvedValue([]);
});

describe('AppointmentsPage doctor-leave labelling', () => {
  it('asks the service which dates the doctor is on approved leave for', async () => {
    render(<AppointmentsPage />);

    await waitFor(() => expect(api.leave.approved).toHaveBeenCalled());

    const [doctorId, from, to] = api.leave.approved.mock.calls[0];
    expect(doctorId).toBe(DOCTOR_ID);
    expect(from).toBe(dateOnly(dayOfWeek(0)));
    expect(to).toBe(dateOnly(dayOfWeek(6)));
  });

  it('labels a leave day instead of leaving the cell blank', async () => {
    // Monday is bookable, Tuesday is leave — the Tuesday cell must say why it is empty.
    const tuesday = dayOfWeek(1);
    api.slot.available.mockResolvedValue([slotAt(dayOfWeek(0))]);
    api.leave.approved.mockResolvedValue([leave(tuesday, tuesday)]);

    render(<AppointmentsPage />);

    const cell = await screen.findByText('On leave');
    expect(cell).toBeInTheDocument();
    expect(cell).toHaveAttribute(
      'title',
      `On approved leave: Conference (${dateOnly(tuesday)} to ${dateOnly(tuesday)})`,
    );
  });

  it('leaves a merely non-working day unlabelled', async () => {
    // No leave at all: the other empty cells must stay blank rather than claiming leave.
    api.slot.available.mockResolvedValue([slotAt(dayOfWeek(0))]);
    api.leave.approved.mockResolvedValue([]);

    render(<AppointmentsPage />);

    await waitFor(() => expect(api.leave.approved).toHaveBeenCalled());
    expect(screen.queryByText('On leave')).not.toBeInTheDocument();
  });

  it('labels every day of a multi-day leave range', async () => {
    api.slot.available.mockResolvedValue([slotAt(dayOfWeek(0))]);
    api.leave.approved.mockResolvedValue([leave(dayOfWeek(1), dayOfWeek(3))]);

    render(<AppointmentsPage />);

    await waitFor(() => expect(screen.getAllByText('On leave')).toHaveLength(3));
  });

  it('explains a fully empty week rather than blaming a missing schedule', async () => {
    api.slot.available.mockResolvedValue([]);
    api.leave.approved.mockResolvedValue([leave(dayOfWeek(0), dayOfWeek(6))]);

    render(<AppointmentsPage />);

    expect(
      await screen.findByText(/on approved leave for the whole of this week/i),
    ).toBeInTheDocument();
  });

  it('falls back to the generic message when an empty week is not leave', async () => {
    api.slot.available.mockResolvedValue([]);
    api.leave.approved.mockResolvedValue([]);

    render(<AppointmentsPage />);

    expect(await screen.findByText(/no bookable slots this week/i)).toBeInTheDocument();
    expect(screen.queryByText(/on approved leave for the whole of this week/i)).not.toBeInTheDocument();
  });

  it('omits the reason from the tooltip when none was given', async () => {
    const tuesday = dayOfWeek(1);
    api.slot.available.mockResolvedValue([slotAt(dayOfWeek(0))]);
    api.leave.approved.mockResolvedValue([leave(tuesday, tuesday, null)]);

    render(<AppointmentsPage />);

    const cell = await screen.findByText('On leave');
    expect(cell).toHaveAttribute(
      'title',
      `On approved leave (${dateOnly(tuesday)} to ${dateOnly(tuesday)})`,
    );
  });
});
