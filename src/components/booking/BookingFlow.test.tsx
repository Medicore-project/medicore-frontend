import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import BookingFlow from './BookingFlow';

const api = vi.hoisted(() => ({
  publicBooking: {
    specializations: vi.fn(),
    doctors: vi.fn(),
    slots: vi.fn(),
  },
  identity: {
    identify: vi.fn(),
    publicRegister: vi.fn(),
  },
  appointment: {
    book: vi.fn(),
    mine: vi.fn(),
    cancel: vi.fn(),
    reschedule: vi.fn(),
  },
  clearBookingToken: vi.fn(),
}));

vi.mock('../../api/booking', async (importOriginal) => ({
  // Keep the real error narrowers — the flow's branching depends on them, and they are pure.
  ...(await importOriginal<typeof import('../../api/booking')>()),
  publicBookingApi: api.publicBooking,
  bookingIdentityApi: api.identity,
  appointmentApi: api.appointment,
}));

vi.mock('../../api/bookingToken', () => ({
  clearBookingToken: api.clearBookingToken,
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const DOCTOR = { doctorId: 'doctor-1', fullName: 'Nimal Perera', specialization: 'Neurology' };

/** Tomorrow, so no fixture is ever accidentally in the past. */
function tomorrow(): string {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
}

function slot(slotId: string, hourUtc: number) {
  const date = tomorrow();
  // Colombo is UTC+05:30, so 03:30Z reads as 09:00.
  return {
    slotId,
    startUtc: `${date}T0${hourUtc}:30:00Z`,
    endUtc: `${date}T0${hourUtc + 1}:00:00Z`,
    slotDate: date,
    durationMinutes: 30,
  };
}

const IDENTITY = {
  patientId: 'p-1',
  patientNumber: 'PAT-000123',
  fullName: 'Nimal Perera',
  bookingToken: 'token',
  expiresAtUtc: '2099-01-01T00:00:00Z',
};

const APPOINTMENT = {
  appointmentId: 'a-1',
  patientId: 'p-1',
  patientNumber: 'PAT-000123',
  patientName: 'Nimal Perera',
  doctorId: 'doctor-1',
  slotId: 'slot-1',
  startUtc: `${tomorrow()}T03:30:00Z`,
  endUtc: `${tomorrow()}T04:00:00Z`,
  slotDate: tomorrow(),
  durationMinutes: 30,
  serviceCode: 'GEN-CONSULT',
  status: 'Booked',
  createdAt: `${tomorrow()}T00:00:00Z`,
};

const UPCOMING = {
  appointmentId: 'a-0',
  doctorId: 'doctor-1',
  doctorName: 'Nimal Perera',
  specialization: 'Neurology',
  startUtc: `${tomorrow()}T03:30:00Z`,
  endUtc: `${tomorrow()}T04:00:00Z`,
  slotDate: tomorrow(),
  durationMinutes: 30,
  serviceCode: 'GEN-CONSULT',
  status: 'Booked',
};

function rejectWith(status: number, title?: string) {
  return Promise.reject({ response: { status, data: title ? { title } : {} } });
}

function type(label: string, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

function click(name: string) {
  fireEvent.click(screen.getByRole('button', { name }));
}

/** Fills in every required field of the registration step. */
function fillRegistration() {
  type('NIC *', '200012345678');
  type('Date of birth *', '1995-04-02');
  type('First name *', 'Kamala');
  type('Last name *', 'Silva');
  type('Gender *', 'Female');
  type('Phone *', '0771234567');
  type('Email *', 'kamala@example.com');
  type('Address *', '1 Galle Road');
  type('District *', 'Colombo');
}

/** Identifies, then picks the first offered time, leaving it chosen in the summary. */
async function identifyAndPickASlot() {
  type('Patient number', 'PAT-000123');
  type('Date of birth', '1995-04-02');
  click('Continue');

  const times = await screen.findAllByTestId('slot-option');
  fireEvent.click(times[0]);
}

describe('BookingFlow (SCRUM-34)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.publicBooking.specializations.mockResolvedValue(['Neurology']);
    api.publicBooking.doctors.mockResolvedValue([DOCTOR]);
    api.publicBooking.slots.mockResolvedValue([slot('slot-1', 3), slot('slot-2', 4)]);
    api.identity.identify.mockResolvedValue(IDENTITY);
    api.identity.publicRegister.mockResolvedValue({ ...IDENTITY, patientNumber: 'PAT-000456' });
    api.appointment.book.mockResolvedValue(APPOINTMENT);
    api.appointment.mine.mockResolvedValue([]);
  });

  // ── Identifying ─────────────────────────────────────────────────────────────

  it('shows the patient number and the doctor picker once someone is identified', async () => {
    render(<BookingFlow />);

    type('Patient number', 'PAT-000123');
    type('Date of birth', '1995-04-02');
    click('Continue');

    expect(await screen.findByTestId('patient-number')).toHaveTextContent('PAT-000123');
    expect(await screen.findByLabelText(/Select Doctor/)).toBeInTheDocument();
    expect(api.identity.identify).toHaveBeenCalledWith('PAT-000123', '1995-04-02');
  });

  // ── Seeing your own bookings ────────────────────────────────────────────────

  it('shows a returning patient their upcoming appointments once identified', async () => {
    api.appointment.mine.mockResolvedValue([UPCOMING]);
    render(<BookingFlow />);

    type('Patient number', 'PAT-000123');
    type('Date of birth', '1995-04-02');
    click('Continue');

    const list = await screen.findByTestId('upcoming-appointments');
    // 03:30Z is 09:00 in Colombo.
    expect(list).toHaveTextContent('09:00');
    expect(list).toHaveTextContent('Nimal Perera — Neurology');
  });

  it('says so when an identified patient has nothing booked', async () => {
    render(<BookingFlow />);

    type('Patient number', 'PAT-000123');
    type('Date of birth', '1995-04-02');
    click('Continue');

    expect(await screen.findByTestId('upcoming-appointments')).toHaveTextContent(
      'You have no upcoming appointments.',
    );
  });

  it('refreshes the list after booking, so the new appointment is in it', async () => {
    render(<BookingFlow />);
    await identifyAndPickASlot();
    api.appointment.mine.mockResolvedValue([UPCOMING]);

    click('Confirm Appointment');

    await screen.findByTestId('booking-confirmation');
    await waitFor(() => expect(api.appointment.mine).toHaveBeenCalledTimes(2));
    expect(await screen.findByTestId('upcoming-appointments')).toHaveTextContent('Nimal Perera');
  });

  it('still lets a patient book when their bookings cannot be read', async () => {
    // A convenience, not a gate: a failure here shows nothing rather than blocking the flow.
    api.appointment.mine.mockImplementation(() => rejectWith(500));
    render(<BookingFlow />);

    type('Patient number', 'PAT-000123');
    type('Date of birth', '1995-04-02');
    click('Continue');

    expect(await screen.findAllByTestId('slot-option')).not.toHaveLength(0);
    expect(screen.queryByTestId('upcoming-appointments')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  // ── The redesigned picker (date strip, time grid, summary) ─────────────────

  it('lands on the first date with free times and greys out days with none', async () => {
    render(<BookingFlow />);
    type('Patient number', 'PAT-000123');
    type('Date of birth', '1995-04-02');
    click('Continue');

    await screen.findAllByTestId('slot-option');
    const chips = screen.getAllByTestId('date-option');
    const selected = chips.filter((chip) => chip.getAttribute('aria-pressed') === 'true');
    expect(selected).toHaveLength(1);
    expect(selected[0]).toBeEnabled();
    // At least two weeks are drawn, and the days with nothing free cannot be picked.
    expect(chips.length).toBeGreaterThanOrEqual(14);
    expect(chips.filter((chip) => chip.hasAttribute('disabled')).length).toBeGreaterThan(0);
  });

  it('shows only the times of the chosen day, and switches when another day is picked', async () => {
    const dayAfter = new Date();
    dayAfter.setDate(dayAfter.getDate() + 2);
    const later = dayAfter.toISOString().slice(0, 10);
    api.publicBooking.slots.mockResolvedValue([
      slot('slot-1', 3),
      { ...slot('slot-9', 5), slotDate: later, startUtc: `${later}T05:30:00Z`, endUtc: `${later}T06:00:00Z` },
    ]);
    render(<BookingFlow />);
    type('Patient number', 'PAT-000123');
    type('Date of birth', '1995-04-02');
    click('Continue');

    expect(await screen.findAllByTestId('slot-option')).toHaveLength(1);
    expect(screen.getByTestId('slot-option')).toHaveAttribute('data-slot-id', 'slot-1');

    const laterChip = screen
      .getAllByTestId('date-option')
      .find((chip) => !chip.hasAttribute('disabled') && chip.getAttribute('aria-pressed') === 'false');
    fireEvent.click(laterChip!);

    expect(screen.getByTestId('slot-option')).toHaveAttribute('data-slot-id', 'slot-9');
  });

  it('keeps Confirm Appointment disabled until a time is chosen, then fills the summary', async () => {
    render(<BookingFlow />);
    type('Patient number', 'PAT-000123');
    type('Date of birth', '1995-04-02');
    click('Continue');
    await screen.findAllByTestId('slot-option');

    const confirm = screen.getByRole('button', { name: 'Confirm Appointment' });
    expect(confirm).toBeDisabled();
    expect(screen.getByTestId('booking-confirm')).toHaveTextContent('Not selected yet');

    fireEvent.click(screen.getAllByTestId('slot-option')[0]);

    expect(confirm).toBeEnabled();
    expect(screen.getAllByTestId('slot-option')[0]).toHaveAttribute('aria-pressed', 'true');
    const summary = screen.getByTestId('booking-confirm');
    expect(summary).toHaveTextContent('PAT-000123');
    expect(summary).toHaveTextContent('Neurology');
    expect(summary).toHaveTextContent('09:00 (30 minutes)');
    expect(screen.getByRole('list', { name: 'Booking progress' }).querySelector('[aria-current="step"]'))
      .toHaveTextContent('Confirm');
  });

  it('lets someone start over as a different patient, dropping the token', async () => {
    render(<BookingFlow />);
    type('Patient number', 'PAT-000123');
    type('Date of birth', '1995-04-02');
    click('Continue');
    await screen.findByTestId('patient-number');

    click('Change Patient');

    expect(screen.getByTestId('booking-identify-form')).toBeInTheDocument();
    expect(screen.queryByTestId('patient-number')).not.toBeInTheDocument();
    expect(api.clearBookingToken).toHaveBeenCalled();
  });

  it('says the same thing for a wrong number and a wrong date of birth', async () => {
    // Patient numbers are sequential, so a message that distinguished the two would confirm which
    // numbers exist.
    api.identity.identify.mockImplementation(() => rejectWith(404));
    render(<BookingFlow />);

    type('Patient number', 'PAT-999999');
    type('Date of birth', '1995-04-02');
    click('Continue');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'We could not find a patient with that number and date of birth',
    );
    // Still on the identify step, with what they typed intact.
    expect(screen.getByLabelText('Patient number')).toHaveValue('PAT-999999');
    expect(screen.queryByTestId('patient-number')).not.toBeInTheDocument();
  });

  // ── The recovery path: register, then lose the slot ──────────────────────────

  it('keeps a newly registered patient number on screen when the slot is taken first', async () => {
    // The whole point of the register-then-book design. The patient record already exists, so the
    // patient must not be sent back through the form.
    api.appointment.book.mockImplementationOnce(() =>
      rejectWith(409, 'This slot is no longer available; it is Booked.'),
    );
    render(<BookingFlow />);

    click('I am a new patient');
    fillRegistration();
    click('Continue');

    expect(await screen.findByTestId('patient-number')).toHaveTextContent('PAT-000456');

    const times = await screen.findAllByTestId('slot-option');
    fireEvent.click(times[0]);
    click('Confirm Appointment');

    // The service's own wording reaches the patient.
    expect(await screen.findByRole('alert')).toHaveTextContent('no longer available');
    // The number is still there, the form is gone, and nobody registered twice.
    expect(screen.getByTestId('patient-number')).toHaveTextContent('PAT-000456');
    expect(screen.queryByTestId('booking-register-form')).not.toBeInTheDocument();
    expect(screen.getByTestId('booking-slot-picker')).toBeInTheDocument();
    expect(api.identity.publicRegister).toHaveBeenCalledTimes(1);
    // And the times were refetched, since the list is now known to be stale.
    await waitFor(() => expect(api.publicBooking.slots.mock.calls.length).toBeGreaterThan(1));
  });

  it('surfaces the overlap explanation the service worded', async () => {
    api.appointment.book.mockImplementationOnce(() =>
      rejectWith(409, 'This patient already has an appointment on 24 Sep 2026 from 09:00 to 09:30.'),
    );
    render(<BookingFlow />);

    await identifyAndPickASlot();
    click('Confirm Appointment');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'already has an appointment on 24 Sep 2026 from 09:00 to 09:30',
    );
  });

  it('returns to the times and refetches when the chosen slot has passed', async () => {
    api.appointment.book.mockImplementationOnce(() =>
      rejectWith(400, 'That appointment time has already passed. Please choose a later slot.'),
    );
    render(<BookingFlow />);

    await identifyAndPickASlot();
    click('Confirm Appointment');

    expect(await screen.findByRole('alert')).toHaveTextContent('already passed');
    expect(screen.getByTestId('booking-slot-picker')).toBeInTheDocument();
    await waitFor(() => expect(api.publicBooking.slots.mock.calls.length).toBeGreaterThan(1));
  });

  // ── Session expiry ──────────────────────────────────────────────────────────

  it('sends the patient back to identify when the booking session expires', async () => {
    api.appointment.book.mockImplementationOnce(() => rejectWith(401));
    render(<BookingFlow />);

    await identifyAndPickASlot();
    click('Confirm Appointment');

    expect(await screen.findByRole('alert')).toHaveTextContent('session expired');
    expect(screen.getByTestId('booking-identify-form')).toBeInTheDocument();
    expect(api.clearBookingToken).toHaveBeenCalled();
    expect(screen.queryByTestId('patient-number')).not.toBeInTheDocument();
  });

  // ── Changing your own appointments (SCRUM-36) ───────────────────────────────

  /** Identifies a patient who has UPCOMING booked, and waits for the list. */
  async function identifyWithAnUpcomingAppointment() {
    api.appointment.mine.mockResolvedValue([UPCOMING]);
    render(<BookingFlow />);
    type('Patient number', 'PAT-000123');
    type('Date of birth', '1995-04-02');
    click('Continue');
    return screen.findByTestId('upcoming-appointments');
  }

  it('offers reschedule and cancel on each upcoming appointment', async () => {
    const list = await identifyWithAnUpcomingAppointment();

    expect(within(list).getByRole('button', { name: /^Reschedule the appointment on/ })).toBeInTheDocument();
    expect(within(list).getByRole('button', { name: /^Cancel the appointment on/ })).toBeInTheDocument();
  });

  it('cancels with a reason on the patient route, then refreshes the list and says so', async () => {
    const list = await identifyWithAnUpcomingAppointment();
    api.appointment.cancel.mockResolvedValue(undefined);
    fireEvent.click(within(list).getByRole('button', { name: /^Cancel the appointment on/ }));

    const dialog = screen.getByRole('dialog');
    api.appointment.mine.mockResolvedValue([]);
    fireEvent.change(within(dialog).getByLabelText('Reason for cancelling'), { target: { value: 'Travelling' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel appointment' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(api.appointment.cancel).toHaveBeenCalledWith('a-0', 'Travelling');
    const refreshed = screen.getByTestId('upcoming-appointments');
    expect(within(refreshed).getByRole('status')).toHaveTextContent('Your appointment was cancelled.');
    expect(refreshed).toHaveTextContent('You have no upcoming appointments.');
  });

  it("shows the clinic's cancellation policy in the dialog when it is too late", async () => {
    const policy =
      'Appointments can only be cancelled or rescheduled up to 24 hours before they start. This one starts at 09:00 on 27 Sep 2026.';
    const list = await identifyWithAnUpcomingAppointment();
    api.appointment.cancel.mockImplementationOnce(() => rejectWith(400, policy));
    fireEvent.click(within(list).getByRole('button', { name: /^Cancel the appointment on/ }));

    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Reason for cancelling'), { target: { value: 'Travelling' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel appointment' }));

    expect(await within(dialog).findByRole('alert')).toHaveTextContent(policy);
    expect(api.clearBookingToken).not.toHaveBeenCalled();
  });

  it("reschedules to one of the same doctor's free times", async () => {
    const list = await identifyWithAnUpcomingAppointment();
    api.appointment.reschedule.mockResolvedValue(undefined);
    fireEvent.click(within(list).getByRole('button', { name: /^Reschedule the appointment on/ }));

    const dialog = screen.getByRole('dialog');
    const times = await within(dialog).findAllByTestId('slot-option');
    fireEvent.click(times[1]);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm new time' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(api.publicBooking.slots).toHaveBeenCalledWith('doctor-1');
    expect(api.appointment.reschedule).toHaveBeenCalledWith('a-0', 'slot-2');
    // 04:30Z is 10:00 in Colombo.
    expect(within(screen.getByTestId('upcoming-appointments')).getByRole('status')).toHaveTextContent(
      /Your appointment was moved to .* at 10:00\./,
    );
  });

  it('sends the patient back to identify when the session expires mid-change', async () => {
    const list = await identifyWithAnUpcomingAppointment();
    api.appointment.cancel.mockImplementationOnce(() => rejectWith(401));
    fireEvent.click(within(list).getByRole('button', { name: /^Cancel the appointment on/ }));

    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Reason for cancelling'), { target: { value: 'Travelling' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel appointment' }));

    expect(await screen.findByTestId('booking-identify-form')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('session expired');
    expect(api.clearBookingToken).toHaveBeenCalled();
  });

  // ── The happy path ──────────────────────────────────────────────────────────

  it('confirms the booking and never registers an identified patient', async () => {
    render(<BookingFlow />);

    await identifyAndPickASlot();

    // The summary names the doctor and the Colombo time, not UTC.
    const confirm = await screen.findByTestId('booking-confirm');
    expect(confirm).toHaveTextContent('Nimal Perera');
    expect(confirm).toHaveTextContent('09:00');

    click('Confirm Appointment');

    expect(await screen.findByTestId('booking-confirmation')).toHaveTextContent(
      'Your appointment is confirmed',
    );
    expect(api.appointment.book).toHaveBeenCalledWith('slot-1', 'GEN-CONSULT');
    expect(api.identity.publicRegister).not.toHaveBeenCalled();
  });

  it('warns that billing has not happened, in the summary and on the confirmation', async () => {
    render(<BookingFlow />);

    await identifyAndPickASlot();

    expect(await screen.findByTestId('billing-notice')).toHaveTextContent('Sprint 4');

    click('Confirm Appointment');

    await screen.findByTestId('booking-confirmation');
    expect(screen.getByTestId('billing-notice')).toHaveTextContent('Sprint 4');
    expect(screen.getByTestId('billing-notice')).toHaveTextContent('GEN-CONSULT');
  });

  // ── Registration problems ───────────────────────────────────────────────────

  it('refuses to submit an incomplete registration', async () => {
    render(<BookingFlow />);

    click('I am a new patient');
    click('Continue');

    expect(await screen.findByRole('alert')).toHaveTextContent('correct the highlighted fields');
    expect(api.identity.publicRegister).not.toHaveBeenCalled();
  });

  it('tells a returning patient to identify instead, without naming whoever holds the NIC', async () => {
    api.identity.publicRegister.mockImplementation(() => rejectWith(409));
    render(<BookingFlow />);

    click('I am a new patient');
    fillRegistration();
    click('Continue');

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('already registered');
    expect(alert).toHaveTextContent('patient number and date of birth');
    expect(alert.textContent).not.toMatch(/PAT-\d/);
  });

  // ── Empty states ────────────────────────────────────────────────────────────

  it('explains an empty doctor list rather than showing a bare dropdown', async () => {
    // What an un-backfilled doctor cache looks like to a patient.
    api.publicBooking.doctors.mockResolvedValue([]);
    render(<BookingFlow />);

    type('Patient number', 'PAT-000123');
    type('Date of birth', '1995-04-02');
    click('Continue');

    expect(
      await screen.findByText('No doctors are available to book right now'),
    ).toBeInTheDocument();
  });

  it('explains a doctor with no free times', async () => {
    api.publicBooking.slots.mockResolvedValue([]);
    render(<BookingFlow />);

    type('Patient number', 'PAT-000123');
    type('Date of birth', '1995-04-02');
    click('Continue');

    expect(await screen.findByText('No free times for this doctor')).toBeInTheDocument();
  });
});
