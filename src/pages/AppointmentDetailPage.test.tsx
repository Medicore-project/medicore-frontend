import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppointmentHistoryEntry, AppointmentRecord } from '../api/appointments';
import AppointmentDetailPage from './AppointmentDetailPage';

const api = vi.hoisted(() => ({
  change: {
    get: vi.fn(),
    history: vi.fn(),
    reschedule: vi.fn(),
    cancel: vi.fn(),
    complete: vi.fn(),
    markNoShow: vi.fn(),
  },
  doctor: { list: vi.fn() },
  slot: { available: vi.fn() },
}));

const auth = vi.hoisted(() => ({
  user: { id: 'u1', email: 'desk@medicore.lk', role: 'Receptionist', staffId: null } as {
    id: string;
    email: string;
    role: string;
    staffId: string | null;
  },
}));

vi.mock('../api/appointments', async (importOriginal) => ({
  // Keep the real Colombo helpers — times are asserted as the clinic reads them.
  ...(await importOriginal<typeof import('../api/appointments')>()),
  appointmentChangeApi: api.change,
  doctorApi: api.doctor,
  slotApi: api.slot,
}));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: auth.user }),
}));

const DOCTOR = { doctorId: 'doctor-1', fullName: 'Tathira Samarakoon', specialization: 'Neurology', departmentId: 'd-1' };

function appointment(overrides: Partial<AppointmentRecord> = {}): AppointmentRecord {
  return {
    appointmentId: 'appt-1',
    patientId: 'patient-1',
    patientNumber: 'PAT-000123',
    patientName: 'Kamala Silva',
    doctorId: 'doctor-1',
    slotId: 'slot-1',
    // 03:30Z is 09:00 in Colombo.
    startUtc: '2026-10-05T03:30:00Z',
    endUtc: '2026-10-05T04:00:00Z',
    slotDate: '2026-10-05',
    durationMinutes: 30,
    serviceCode: 'GEN-CONSULT',
    status: 'Booked',
    createdAt: '2026-09-23T04:00:00Z',
    ...overrides,
  };
}

const BOOKED_ENTRY: AppointmentHistoryEntry = {
  action: 'Booked',
  fromStatus: null,
  toStatus: 'Booked',
  fromSlotId: null,
  toSlotId: 'slot-1',
  fromStartUtc: null,
  toStartUtc: '2026-10-05T03:30:00Z',
  reason: null,
  actor: 'desk@medicore.lk',
  occurredAtUtc: '2026-09-23T04:00:00Z',
};

const CANCELLED_ENTRY: AppointmentHistoryEntry = {
  ...BOOKED_ENTRY,
  action: 'Cancelled',
  fromStatus: 'Booked',
  toStatus: 'Cancelled',
  fromSlotId: 'slot-1',
  toSlotId: null,
  fromStartUtc: '2026-10-05T03:30:00Z',
  toStartUtc: null,
  reason: 'Travelling',
  occurredAtUtc: '2026-09-26T04:00:00Z',
};

/** A later free slot with the same doctor: 04:30Z on 6 Oct is 10:00 in Colombo. */
const FREE_SLOT = {
  slotId: 'slot-2',
  doctorId: 'doctor-1',
  startUtc: '2026-10-06T04:30:00Z',
  endUtc: '2026-10-06T05:00:00Z',
  slotDate: '2026-10-06',
  durationMinutes: 30,
  status: 'Available',
};

function problem(status: number, title: string) {
  return { response: { status, data: { title } } };
}

function renderPage() {
  render(
    <MemoryRouter initialEntries={['/appointments/appt-1']}>
      <Routes>
        <Route path="/appointments/:appointmentId" element={<AppointmentDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

function signInAs(role: string, staffId: string | null = null) {
  auth.user = { id: 'u1', email: `${role.toLowerCase()}@medicore.lk`, role, staffId };
}

describe('AppointmentDetailPage (SCRUM-36)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    signInAs('Receptionist');
    api.change.get.mockResolvedValue(appointment());
    api.change.history.mockResolvedValue([BOOKED_ENTRY]);
    api.doctor.list.mockResolvedValue([DOCTOR]);
    api.slot.available.mockResolvedValue([FREE_SLOT]);
  });

  // ── What it shows ───────────────────────────────────────────────────────────

  it('shows the appointment in Colombo time, with its doctor, patient and history', async () => {
    renderPage();

    expect(await screen.findByTestId('appointment-status')).toHaveTextContent('Booked');
    expect(screen.getByTestId('appointment-when')).toHaveTextContent('Mon, 5 Oct 2026, 09:00–09:30 (30 min)');
    expect(screen.getByText('Tathira Samarakoon')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Kamala Silva' })).toHaveAttribute('href', '/patients/patient-1');
    expect(within(screen.getByTestId('appointment-history')).getByText('Booked for Mon, 5 Oct 2026, 09:00')).toBeInTheDocument();
    expect(api.change.get).toHaveBeenCalledWith('appt-1');
  });

  it('still works when the doctor is no longer listed', async () => {
    api.doctor.list.mockResolvedValue([]);
    renderPage();

    expect(await screen.findByText('Doctor no longer listed')).toBeInTheDocument();
  });

  it('shows the service error and a way back when the appointment cannot be loaded', async () => {
    api.change.get.mockRejectedValue(problem(404, 'Appointment not found.'));
    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent('Appointment not found.');
    expect(screen.getByRole('link', { name: /Back to booked appointments/ })).toHaveAttribute(
      'href',
      '/appointments/booked',
    );
  });

  // ── Who sees which action ───────────────────────────────────────────────────

  it('offers the front desk reschedule and cancel, but not complete', async () => {
    renderPage();
    await screen.findByTestId('appointment-status');

    expect(screen.getByRole('button', { name: 'Reschedule' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel appointment' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Complete visit' })).not.toBeInTheDocument();
  });

  it("offers the appointment's own doctor complete, and nothing else", async () => {
    signInAs('Doctor', 'doctor-1');
    renderPage();
    await screen.findByTestId('appointment-status');

    expect(screen.getByRole('button', { name: 'Complete visit' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reschedule' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel appointment' })).not.toBeInTheDocument();
  });

  it('offers another doctor nothing', async () => {
    signInAs('Doctor', 'doctor-2');
    renderPage();
    await screen.findByTestId('appointment-status');

    expect(screen.queryByRole('button', { name: 'Complete visit' })).not.toBeInTheDocument();
  });

  it.each([
    ['Cancelled', 'Cancelled'],
    ['Completed', 'Completed'],
    ['NoShow', 'No-show'],
  ])('offers nothing once the appointment is %s', async (status, label) => {
    api.change.get.mockResolvedValue(appointment({ status }));
    signInAs('Admin');
    renderPage();

    expect(await screen.findByTestId('appointment-status')).toHaveTextContent(label);
    expect(screen.queryByRole('button', { name: 'Reschedule' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel appointment' })).not.toBeInTheDocument();
  });

  // ── Cancel ──────────────────────────────────────────────────────────────────

  it('cancels with a reason, then shows the new status and the grown history', async () => {
    api.change.cancel.mockResolvedValue(appointment({ status: 'Cancelled' }));
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel appointment' }));

    const dialog = screen.getByRole('dialog');
    const confirm = within(dialog).getByRole('button', { name: 'Cancel appointment' });
    // Nothing to send yet: the service requires a reason.
    expect(confirm).toBeDisabled();

    api.change.history.mockResolvedValue([BOOKED_ENTRY, CANCELLED_ENTRY]);
    fireEvent.change(within(dialog).getByLabelText('Reason for cancelling'), {
      target: { value: '  Travelling ' },
    });
    fireEvent.click(confirm);

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(api.change.cancel).toHaveBeenCalledWith('appt-1', 'Travelling');
    expect(screen.getByTestId('appointment-status')).toHaveTextContent('Cancelled');
    expect(screen.getByRole('status')).toHaveTextContent('cancelled');
    expect(await screen.findByText('Reason: Travelling')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reschedule' })).not.toBeInTheDocument();
  });

  it("shows the cancellation policy in the dialog when it is too late, and changes nothing", async () => {
    const policy =
      'Appointments can only be cancelled or rescheduled up to 24 hours before they start. This one starts at 09:00 on 05 Oct 2026.';
    api.change.cancel.mockRejectedValue(problem(400, policy));
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel appointment' }));

    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Reason for cancelling'), { target: { value: 'Travelling' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel appointment' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(policy);
    // What was typed survives, so they can try something else without retyping.
    expect(within(dialog).getByLabelText('Reason for cancelling')).toHaveValue('Travelling');
    expect(screen.getByTestId('appointment-status')).toHaveTextContent('Booked');
  });

  // ── Reschedule ──────────────────────────────────────────────────────────────

  it("reschedules to one of the doctor's free times", async () => {
    api.change.reschedule.mockResolvedValue(
      appointment({ slotId: 'slot-2', startUtc: FREE_SLOT.startUtc, endUtc: FREE_SLOT.endUtc, slotDate: '2026-10-06' }),
    );
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Reschedule' }));

    const dialog = screen.getByRole('dialog');
    fireEvent.click(await within(dialog).findByTestId('slot-option'));
    expect(within(dialog).getByTestId('reschedule-choice')).toHaveTextContent('Move to Tue, 6 Oct 2026 at 10:00');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm new time' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(api.slot.available).toHaveBeenCalledWith('doctor-1');
    expect(api.change.reschedule).toHaveBeenCalledWith('appt-1', 'slot-2');
    expect(screen.getByRole('status')).toHaveTextContent('Moved to Tue, 6 Oct 2026 at 10:00.');
    expect(screen.getByTestId('appointment-when')).toHaveTextContent('Tue, 6 Oct 2026, 10:00');
  });

  it('keeps the dialog open and reloads the times when the new time was taken meanwhile', async () => {
    api.change.reschedule.mockRejectedValue(
      problem(409, 'Someone booked this slot a moment ago, so the appointment was not moved. Please choose another.'),
    );
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Reschedule' }));

    const dialog = screen.getByRole('dialog');
    fireEvent.click(await within(dialog).findByTestId('slot-option'));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm new time' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('the appointment was not moved');
    await waitFor(() => expect(api.slot.available).toHaveBeenCalledTimes(2));
    expect(screen.getByTestId('appointment-when')).toHaveTextContent('Mon, 5 Oct 2026, 09:00');
  });

  it('loads the free times once, however often the page renders', async () => {
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Reschedule' }));
    await within(screen.getByRole('dialog')).findByTestId('slot-option');

    expect(api.slot.available).toHaveBeenCalledTimes(1);
  });

  // ── Complete ────────────────────────────────────────────────────────────────

  it('completes with clinical notes, which the doctor must write', async () => {
    signInAs('Doctor', 'doctor-1');
    api.change.complete.mockResolvedValue(appointment({ status: 'Completed' }));
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Complete visit' }));

    const dialog = screen.getByRole('dialog');
    const confirm = within(dialog).getByRole('button', { name: 'Complete visit' });
    expect(confirm).toBeDisabled();

    fireEvent.change(within(dialog).getByLabelText('Clinical notes'), { target: { value: 'Reviewed BP.' } });
    expect(within(dialog).getByText(/12\/8000/)).toBeInTheDocument();
    fireEvent.click(confirm);

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(api.change.complete).toHaveBeenCalledWith('appt-1', 'Reviewed BP.');
    expect(screen.getByTestId('appointment-status')).toHaveTextContent('Completed');
  });

  it('shows why a visit cannot be completed yet', async () => {
    signInAs('Doctor', 'doctor-1');
    api.change.complete.mockRejectedValue(
      problem(400, 'This appointment starts at 09:00 on 05 Oct 2026 and cannot be completed before then.'),
    );
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Complete visit' }));

    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Clinical notes'), { target: { value: 'Seen.' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Complete visit' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent('cannot be completed before then');
  });
});

describe('AppointmentDetailPage: no-show (SCRUM-38)', () => {
  /** The appointment ran 09:00-09:30 Colombo on 5 Oct (03:30-04:00Z); the clock says 04:00Z. */
  const AT_END = new Date('2026-10-05T04:00:00Z');

  const NO_SHOW_ENTRY: AppointmentHistoryEntry = {
    ...BOOKED_ENTRY,
    action: 'NoShow',
    fromStatus: 'Booked',
    toStatus: 'NoShow',
    fromSlotId: 'slot-1',
    toSlotId: null,
    fromStartUtc: '2026-10-05T03:30:00Z',
    toStartUtc: null,
    occurredAtUtc: '2026-10-05T04:00:00Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Only Date: the page reads the clock once, while findBy/waitFor still need real timers.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(AT_END);
    signInAs('Receptionist');
    api.change.get.mockResolvedValue(appointment());
    api.change.history.mockResolvedValue([BOOKED_ENTRY]);
    api.doctor.list.mockResolvedValue([DOCTOR]);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it.each([
    ['Receptionist', null],
    ['Admin', null],
    ['Doctor', 'doctor-1'],
  ])('offers %s a no-show once the appointment has ended', async (role, staffId) => {
    signInAs(role, staffId);
    renderPage();

    expect(await screen.findByRole('button', { name: 'Mark no-show' })).toBeInTheDocument();
  });

  it('does not offer it a minute before the end, when the patient may still arrive', async () => {
    vi.setSystemTime(new Date('2026-10-05T03:59:00Z'));
    renderPage();
    await screen.findByTestId('appointment-status');

    expect(screen.queryByRole('button', { name: 'Mark no-show' })).not.toBeInTheDocument();
  });

  it.each([
    ['Doctor', 'doctor-2'],
    ['Doctor', null],
    ['Nurse', null],
  ])('does not offer it to %s (staff id %s)', async (role, staffId) => {
    signInAs(role, staffId);
    renderPage();
    await screen.findByTestId('appointment-status');

    expect(screen.queryByRole('button', { name: 'Mark no-show' })).not.toBeInTheDocument();
  });

  it('does not offer it once the appointment is no longer booked', async () => {
    api.change.get.mockResolvedValue(appointment({ status: 'Completed' }));
    renderPage();
    await screen.findByTestId('appointment-status');

    expect(screen.queryByRole('button', { name: 'Mark no-show' })).not.toBeInTheDocument();
  });

  it('marks a no-show after confirming, then shows the new status and history', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    api.change.markNoShow.mockResolvedValue(appointment({ status: 'NoShow' }));
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Mark no-show' }));

    api.change.history.mockResolvedValue([BOOKED_ENTRY, NO_SHOW_ENTRY]);
    expect(await screen.findByRole('status')).toHaveTextContent('Recorded as a no-show.');
    expect(confirm).toHaveBeenCalledWith(
      "Mark Kamala Silva's appointment on Mon, 5 Oct 2026, 09:00 as a no-show? This cannot be undone.",
    );
    expect(api.change.markNoShow).toHaveBeenCalledWith('appt-1');
    expect(screen.getByTestId('appointment-status')).toHaveTextContent('No-show');
    expect(await screen.findByText('Marked a no-show')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Mark no-show' })).not.toBeInTheDocument();
  });

  it('does nothing when the confirmation is declined', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Mark no-show' }));

    expect(api.change.markNoShow).not.toHaveBeenCalled();
    expect(screen.getByTestId('appointment-status')).toHaveTextContent('Booked');
  });

  it("shows the service's refusal and leaves the appointment as it was", async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    api.change.markNoShow.mockRejectedValue(
      problem(409, 'This appointment is Completed and can no longer be marked a no-show.'),
    );
    renderPage();
    fireEvent.click(await screen.findByRole('button', { name: 'Mark no-show' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('can no longer be marked a no-show');
    expect(screen.getByTestId('appointment-status')).toHaveTextContent('Booked');
    expect(screen.getByRole('button', { name: 'Mark no-show' })).toBeEnabled();
  });
});
