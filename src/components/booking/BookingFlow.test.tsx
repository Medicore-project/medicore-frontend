import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

/** Identifies, then picks the first offered time, leaving the flow on the confirm screen. */
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
    expect(await screen.findByLabelText('Doctor')).toBeInTheDocument();
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

    click('Confirm booking');

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
    click('Confirm booking');

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
    click('Confirm booking');

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
    click('Confirm booking');

    expect(await screen.findByRole('alert')).toHaveTextContent('already passed');
    expect(screen.getByTestId('booking-slot-picker')).toBeInTheDocument();
    await waitFor(() => expect(api.publicBooking.slots.mock.calls.length).toBeGreaterThan(1));
  });

  // ── Session expiry ──────────────────────────────────────────────────────────

  it('sends the patient back to identify when the booking session expires', async () => {
    api.appointment.book.mockImplementationOnce(() => rejectWith(401));
    render(<BookingFlow />);

    await identifyAndPickASlot();
    click('Confirm booking');

    expect(await screen.findByRole('alert')).toHaveTextContent('session expired');
    expect(screen.getByTestId('booking-identify-form')).toBeInTheDocument();
    expect(api.clearBookingToken).toHaveBeenCalled();
    expect(screen.queryByTestId('patient-number')).not.toBeInTheDocument();
  });

  // ── The happy path ──────────────────────────────────────────────────────────

  it('confirms the booking and never registers an identified patient', async () => {
    render(<BookingFlow />);

    await identifyAndPickASlot();

    // The confirm screen names the doctor and the Colombo time, not UTC.
    const confirm = await screen.findByTestId('booking-confirm');
    expect(confirm).toHaveTextContent('Nimal Perera');
    expect(confirm).toHaveTextContent('09:00');

    click('Confirm booking');

    expect(await screen.findByTestId('booking-confirmation')).toHaveTextContent(
      'Your appointment is confirmed',
    );
    expect(api.appointment.book).toHaveBeenCalledWith('slot-1', 'GEN-CONSULT');
    expect(api.identity.publicRegister).not.toHaveBeenCalled();
  });

  it('warns that billing has not happened, on the confirm screen and the confirmation', async () => {
    render(<BookingFlow />);

    await identifyAndPickASlot();

    expect(await screen.findByTestId('billing-notice')).toHaveTextContent('Sprint 4');

    click('Confirm booking');

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
