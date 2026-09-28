import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppointmentSummary, DoctorLeaveResponse, SlotResponse } from '../api/appointments';
import AppointmentsPage from './AppointmentsPage';

const api = vi.hoisted(() => ({
  slot: { available: vi.fn(), flagged: vi.fn(), block: vi.fn(), unblock: vi.fn() },
  schedule: { listForDoctor: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn(), regenerate: vi.fn() },
  leave: { approved: vi.fn() },
  doctor: { list: vi.fn() },
  booked: { list: vi.fn() },
  waitlist: { list: vi.fn() },
}));

vi.mock('../api/appointments', async (importOriginal) => ({
  // Keep the real Colombo date/time helpers — the grid's shape depends on them.
  ...(await importOriginal<typeof import('../api/appointments')>()),
  slotApi: api.slot,
  scheduleApi: api.schedule,
  leaveApi: api.leave,
  doctorApi: api.doctor,
  bookedApi: api.booked,
}));

vi.mock('../api/waitlist', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/waitlist')>()),
  staffWaitlistApi: api.waitlist,
}));

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
  api.doctor.list.mockResolvedValue([
    { doctorId: DOCTOR_ID, fullName: 'Tathira Samarakoon', specialization: 'Neurology', departmentId: 'dept-1' },
  ]);
  api.slot.flagged.mockResolvedValue([]);
  api.schedule.listForDoctor.mockResolvedValue([]);
  api.slot.available.mockResolvedValue([]);
  api.leave.approved.mockResolvedValue([]);
  api.booked.list.mockResolvedValue([]);
  api.waitlist.list.mockResolvedValue([]);
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

    expect(await screen.findByText('No free slots this week')).toBeInTheDocument();
    expect(screen.getByText(/have no working hours, or fall on public holidays/i)).toBeInTheDocument();
    expect(screen.queryByText(/on approved leave for the whole of this week/i)).not.toBeInTheDocument();
  });

  it('names the leave days when a partly-on-leave week has no free slots left', async () => {
    // The reported bug: Monday's slots are past, Tuesday–Thursday and Sunday are leave, Friday and
    // Saturday are unscheduled. No free slots means no grid rows, so no cells to say "On leave" in.
    api.slot.available.mockResolvedValue([]);
    api.leave.approved.mockResolvedValue([
      leave(dayOfWeek(1), dayOfWeek(3)),
      leave(dayOfWeek(6), dayOfWeek(6)),
    ]);

    render(<AppointmentsPage />);

    // Wait for the chips, not the title: the generic empty state shares the title and shows
    // briefly before the week's leave has loaded.
    const chips = (await screen.findAllByText(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun) \d/)).map(
      (chip) => chip.textContent,
    );
    expect(screen.getByText('No free slots this week')).toBeInTheDocument();

    const tue = dayOfWeek(1);
    const thu = dayOfWeek(3);
    const sun = dayOfWeek(6);
    const month = (d: Date) => d.toLocaleDateString(undefined, { month: 'short' });
    expect(chips).toEqual([
      tue.getMonth() === thu.getMonth()
        ? `Tue ${tue.getDate()} – Thu ${thu.getDate()} ${month(thu)}`
        : `Tue ${tue.getDate()} ${month(tue)} – Thu ${thu.getDate()} ${month(thu)}`,
      `Sun ${sun.getDate()} ${month(sun)}`,
    ]);
    expect(screen.queryByText(/on approved leave for the whole of this week/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/fall on public holidays/i)).not.toBeInTheDocument();
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

describe('AppointmentsPage doctor picker (SCRUM-33)', () => {
  it('lists doctors from the appointment service cache and opens the first one', async () => {
    render(<AppointmentsPage />);

    expect(
      await screen.findByRole('option', { name: 'Tathira Samarakoon — Neurology' }),
    ).toBeInTheDocument();
    expect(api.doctor.list).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(api.slot.available).toHaveBeenCalled());
    expect(api.slot.available.mock.calls[0][0]).toBe(DOCTOR_ID);
  });

  it('says there are no bookable doctors when the cache is empty', async () => {
    api.doctor.list.mockResolvedValue([]);

    render(<AppointmentsPage />);

    expect(await screen.findByRole('option', { name: 'No bookable doctors' })).toBeInTheDocument();
    expect(api.slot.available).not.toHaveBeenCalled();
  });
});

/** A 09:00 Colombo booking on the given day. */
function bookingAt(date: Date, overrides: Partial<AppointmentSummary> = {}): AppointmentSummary {
  return {
    appointmentId: `appt-${dateOnly(date)}`,
    patientId: 'patient-1',
    patientNumber: 'PAT-000123',
    patientName: 'Kamala Silva',
    doctorId: DOCTOR_ID,
    doctorName: 'Tathira Samarakoon',
    specialization: 'Neurology',
    slotId: `slot-${dateOnly(date)}`,
    startUtc: `${dateOnly(date)}T03:30:00Z`,
    endUtc: `${dateOnly(date)}T04:00:00Z`,
    slotDate: dateOnly(date),
    durationMinutes: 30,
    serviceCode: 'GEN-CONSULT',
    status: 'Booked',
    createdAt: '2026-09-20T04:00:00Z',
    ...overrides,
  };
}

describe('AppointmentsPage booked slots', () => {
  it('asks for the bookings of the selected doctor for the visible week', async () => {
    render(<AppointmentsPage />);

    await waitFor(() => expect(api.booked.list).toHaveBeenCalled());

    expect(api.booked.list.mock.calls[0][0]).toEqual({
      doctorId: DOCTOR_ID,
      from: dateOnly(dayOfWeek(0)),
      to: dateOnly(dayOfWeek(6)),
    });
  });

  it('shows who booked a slot instead of letting it vanish', async () => {
    // The availability listing returns free slots only, so before this a booked slot had no row.
    // Here the whole week is booked or empty: the booking alone must still produce a row.
    api.booked.list.mockResolvedValue([bookingAt(dayOfWeek(2))]);

    render(<AppointmentsPage />);

    const cell = await screen.findByTestId('booked-slot');
    expect(cell).toHaveTextContent('Kamala Silva');
    expect(cell).toHaveTextContent('PAT-000123');
    expect(cell).toHaveAttribute('title', 'Booked: Kamala Silva (PAT-000123) · 30 min · GEN-CONSULT');
    expect(screen.getByText('09:00')).toBeInTheDocument();
  });

  it('still marks a booking made without a name on record', async () => {
    api.booked.list.mockResolvedValue([
      bookingAt(dayOfWeek(2), { patientName: null, patientNumber: null }),
    ]);

    render(<AppointmentsPage />);

    expect(await screen.findByTestId('booked-slot')).toHaveTextContent('Booked');
  });

  it('does not draw a cancelled booking, whose slot is free again', async () => {
    api.slot.available.mockResolvedValue([slotAt(dayOfWeek(2))]);
    api.booked.list.mockResolvedValue([bookingAt(dayOfWeek(2), { status: 'Cancelled' })]);

    render(<AppointmentsPage />);

    expect(await screen.findByText('Free')).toBeInTheDocument();
    expect(screen.queryByTestId('booked-slot')).not.toBeInTheDocument();
  });

  it('marks a booking that a schedule change stranded', async () => {
    const wednesday = dayOfWeek(2);
    api.booked.list.mockResolvedValue([bookingAt(wednesday)]);
    api.slot.flagged.mockResolvedValue([
      { ...slotAt(wednesday), status: 'Flagged', flaggedReason: 'Schedule removed' },
    ]);

    render(<AppointmentsPage />);

    const cell = await screen.findByTestId('booked-slot');
    expect(cell).toHaveClass('slot-chip--flagged');
    expect(cell.getAttribute('title')).toContain('needs rescheduling');
  });
});

describe('AppointmentsPage slots held for the waitlist (SCRUM-37)', () => {
  /** An open offer of Wednesday's 09:00 (03:30Z), held until 14:30 (09:00Z). */
  function offerOn(date: Date) {
    return {
      waitlistEntryId: 'w-1',
      doctorId: DOCTOR_ID,
      doctorName: 'Tathira Samarakoon',
      specialization: 'Neurology',
      slotDate: dateOnly(date),
      placeInLine: null,
      status: 'Offered',
      joinedAtUtc: '2026-09-20T00:00:00Z',
      offeredStartUtc: `${dateOnly(date)}T03:30:00Z`,
      offeredEndUtc: `${dateOnly(date)}T04:00:00Z`,
      offerExpiresAtUtc: `${dateOnly(date)}T09:00:00Z`,
      appointmentId: null,
      closedAtUtc: null,
      closedReason: null,
      patientId: 'patient-1',
      patientNumber: 'PAT-000123',
      patientName: 'Kamala Silva',
      serviceCode: 'GEN-CONSULT',
      position: 1,
      offeredSlotId: 'slot-held',
    };
  }

  it("asks for the open offers on the selected doctor's week", async () => {
    render(<AppointmentsPage />);

    await waitFor(() => expect(api.waitlist.list).toHaveBeenCalled());
    expect(api.waitlist.list).toHaveBeenCalledWith({
      doctorId: DOCTOR_ID,
      from: dateOnly(dayOfWeek(0)),
      to: dateOnly(dayOfWeek(6)),
      status: 'Offered',
    });
  });

  it('draws a held slot as Offered, naming the patient, instead of a blank cell', async () => {
    // The availability listing leaves a held slot out, so without this the time would vanish.
    api.waitlist.list.mockResolvedValue([offerOn(dayOfWeek(2))]);

    render(<AppointmentsPage />);

    const chip = await screen.findByTestId('offered-slot');
    expect(chip).toHaveTextContent('Offered');
    expect(chip).toHaveTextContent('Kamala Silva');
    expect(chip).toHaveAttribute('title', expect.stringContaining('until 14:30'));
    expect(screen.getByRole('rowheader', { name: '09:00' })).toBeInTheDocument();
  });

  it('still draws the week when the waitlist cannot be read', async () => {
    api.slot.available.mockResolvedValue([slotAt(dayOfWeek(0))]);
    api.waitlist.list.mockRejectedValue(new Error('offline'));

    render(<AppointmentsPage />);

    expect(await screen.findByRole('button', { name: 'Free' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('AppointmentsPage redesign interactions', () => {
  it('asks for a reason before blocking a free slot, then blocks it', async () => {
    const slot = slotAt(dayOfWeek(0));
    api.slot.available.mockResolvedValue([slot]);
    api.slot.block.mockResolvedValue({ ...slot, status: 'Blocked' });

    render(<AppointmentsPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Free' }));

    const dialog = screen.getByRole('dialog', { name: 'Block this slot?' });
    fireEvent.change(within(dialog).getByLabelText(/Reason/), { target: { value: 'Ward round' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Block slot' }));

    await waitFor(() => expect(api.slot.block).toHaveBeenCalledWith(slot.slotId, 'Ward round'));
    expect(await screen.findByText('Slot blocked.')).toBeInTheDocument();
  });

  it('frees a blocked slot straight away', async () => {
    const slot = { ...slotAt(dayOfWeek(0)), status: 'Blocked' as const };
    api.slot.available.mockResolvedValue([slot]);
    api.slot.unblock.mockResolvedValue({ ...slot, status: 'Available' });

    render(<AppointmentsPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Blocked' }));

    await waitFor(() => expect(api.slot.unblock).toHaveBeenCalledWith(slot.slotId));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('confirms in a dialog before deleting a working day', async () => {
    api.schedule.listForDoctor.mockResolvedValue([
      {
        scheduleId: 'schedule-1',
        doctorId: DOCTOR_ID,
        dayOfWeek: 1,
        startTime: '09:00:00',
        endTime: '12:00:00',
        slotDurationMinutes: 30,
        effectiveFrom: '2026-09-01',
        effectiveTo: null,
        isActive: true,
        createdAt: '2026-09-01T00:00:00Z',
        createdBy: 'admin',
      },
    ]);
    api.schedule.remove.mockResolvedValue({ doctorsProcessed: 1, slotsCreated: 0, slotsRemoved: 6, slotsFlagged: 0 });

    render(<AppointmentsPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Delete Monday schedule' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete schedule' }));

    await waitFor(() => expect(api.schedule.remove).toHaveBeenCalledWith('schedule-1'));
    expect(await screen.findByText('Schedule deleted. 6 removed.')).toBeInTheDocument();
  });

  it('counts the week at a glance', async () => {
    api.slot.available.mockResolvedValue([slotAt(dayOfWeek(0)), slotAt(dayOfWeek(1))]);
    api.booked.list.mockResolvedValue([bookingAt(dayOfWeek(2))]);

    render(<AppointmentsPage />);

    const stats = await screen.findByRole('group', { name: 'This week at a glance' });
    await waitFor(() => expect(within(stats).getByText('Free slots').previousSibling).toHaveTextContent('2'));
    expect(within(stats).getByText('Booked').previousSibling).toHaveTextContent('1');
  });

  it('previews the slots a working day will generate, and refuses an end before the start', async () => {
    render(<AppointmentsPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Add working day' }));

    expect(screen.getByText('Every Monday: 16 slots of 30 minutes, 09:00–17:00.')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('End'), { target: { value: '08:00' } });

    expect(screen.getByText('The end time must be after the start time.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create' })).toBeDisabled();
  });
});
