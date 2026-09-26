import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppointmentSummary } from '../api/appointments';
import { toCsv } from '../utils/bookedAppointments';
import ClinicAppointmentsPage from './ClinicAppointmentsPage';

const api = vi.hoisted(() => ({
  booked: { list: vi.fn() },
  doctor: { list: vi.fn() },
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
  bookedApi: api.booked,
  doctorApi: api.doctor,
}));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: auth.user }),
}));

const DOCTOR = {
  doctorId: 'doctor-1',
  fullName: 'Tathira Samarakoon',
  specialization: 'Neurology',
  departmentId: 'dept-1',
};

function booking(overrides: Partial<AppointmentSummary> = {}): AppointmentSummary {
  return {
    appointmentId: 'appt-1',
    patientId: 'patient-1',
    patientNumber: 'PAT-000123',
    patientName: 'Kamala Silva',
    doctorId: 'doctor-1',
    doctorName: 'Tathira Samarakoon',
    specialization: 'Neurology',
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

function renderPage() {
  render(
    <MemoryRouter>
      <ClinicAppointmentsPage />
    </MemoryRouter>,
  );
}

function apply() {
  fireEvent.click(screen.getByRole('button', { name: 'Apply Filters' }));
}

/** The patient names in the table, top to bottom. */
function patientColumn(): string[] {
  const rows = within(screen.getByTestId('clinic-appointments')).getAllByRole('row').slice(1);
  return rows.map((row) => within(row).getAllByRole('cell')[2].textContent ?? '');
}

beforeEach(() => {
  vi.clearAllMocks();
  auth.user = { id: 'u1', email: 'desk@medicore.lk', role: 'Receptionist', staffId: null };
  api.doctor.list.mockResolvedValue([DOCTOR]);
  api.booked.list.mockResolvedValue([booking()]);
});

describe('ClinicAppointmentsPage', () => {
  it('lists who is booked with whom, and when', async () => {
    renderPage();

    const table = await screen.findByTestId('clinic-appointments');
    const row = within(table).getAllByRole('row')[1];
    expect(row).toHaveTextContent('Mon 5 Oct 2026');
    expect(row).toHaveTextContent('09:00');
    expect(row).toHaveTextContent('30 min');
    expect(row).toHaveTextContent('Kamala Silva');
    expect(row).toHaveTextContent('PAT-000123');
    expect(row).toHaveTextContent('Tathira Samarakoon');
    expect(row).toHaveTextContent('Booked');
    expect(screen.getByRole('heading', { name: 'Appointments (1)' })).toBeInTheDocument();
  });

  it('links the patient to their profile', async () => {
    renderPage();

    const link = await screen.findByRole('link', { name: 'Kamala Silva' });
    expect(link).toHaveAttribute('href', '/patients/patient-1');
  });

  it('opens on the whole clinic for the coming week, for the front desk', async () => {
    renderPage();

    await waitFor(() => expect(api.booked.list).toHaveBeenCalled());
    const { doctorId, from, to } = api.booked.list.mock.calls[0][0];
    expect(doctorId).toBeUndefined();
    expect((Date.parse(to) - Date.parse(from)) / 86_400_000).toBe(6);
  });

  it('opens a doctor on their own bookings, with All doctors still one click away', async () => {
    auth.user = { id: 'u2', email: 'dr@medicore.lk', role: 'Doctor', staffId: 'doctor-1' };
    renderPage();

    await waitFor(() => expect(api.booked.list).toHaveBeenCalled());
    expect(api.booked.list.mock.calls[0][0].doctorId).toBe('doctor-1');
    expect(await screen.findByLabelText('Doctor')).toHaveValue('doctor-1');
    expect(screen.getByRole('option', { name: 'All doctors' })).toBeInTheDocument();
  });

  it('gives a doctor missing from the bookable list an option for themselves', async () => {
    auth.user = { id: 'u2', email: 'dr@medicore.lk', role: 'Doctor', staffId: 'doctor-9' };
    renderPage();

    expect(await screen.findByRole('option', { name: 'You' })).toBeInTheDocument();
    expect(screen.getByLabelText('Doctor')).toHaveValue('doctor-9');
  });

  // ── Filters apply on the button ─────────────────────────────────────────────

  it('does not refetch while filters are only being edited', async () => {
    renderPage();
    await screen.findByTestId('clinic-appointments');

    fireEvent.change(screen.getByLabelText('Doctor'), { target: { value: 'doctor-1' } });

    expect(api.booked.list).toHaveBeenCalledTimes(1);
  });

  it('narrows to one doctor on Apply Filters', async () => {
    renderPage();
    await screen.findByTestId('clinic-appointments');

    fireEvent.change(screen.getByLabelText('Doctor'), { target: { value: 'doctor-1' } });
    apply();

    await waitFor(() => expect(api.booked.list).toHaveBeenCalledTimes(2));
    expect(api.booked.list.mock.calls[1][0].doctorId).toBe('doctor-1');
  });

  it('filters by status without asking the service again', async () => {
    api.booked.list.mockResolvedValue([
      booking(),
      booking({ appointmentId: 'appt-2', patientName: 'Sunil Fernando', status: 'Cancelled' }),
    ]);
    renderPage();
    await screen.findByText('Sunil Fernando');

    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'Booked' } });
    apply();

    expect(screen.queryByText('Sunil Fernando')).not.toBeInTheDocument();
    expect(screen.getByText('Kamala Silva')).toBeInTheDocument();
    expect(api.booked.list).toHaveBeenCalledTimes(1);
  });

  it('refuses a backwards date range before calling the service', async () => {
    renderPage();
    await screen.findByTestId('clinic-appointments');

    fireEvent.change(screen.getByLabelText('From Date'), { target: { value: '2099-01-10' } });
    apply();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The start date must not be after the end date.',
    );
    expect(api.booked.list).toHaveBeenCalledTimes(1);
  });

  // ── The counts ──────────────────────────────────────────────────────────────

  it('counts the whole range by status, whatever the status filter shows', async () => {
    api.booked.list.mockResolvedValue([
      booking(),
      booking({ appointmentId: 'appt-2', status: 'Booked' }),
      booking({ appointmentId: 'appt-3', status: 'Completed' }),
      booking({ appointmentId: 'appt-4', status: 'Cancelled' }),
    ]);
    renderPage();
    await screen.findByTestId('clinic-appointments');

    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'Cancelled' } });
    apply();

    expect(screen.getByTestId('stat-total')).toHaveTextContent('4');
    expect(screen.getByTestId('stat-booked')).toHaveTextContent('2');
    expect(screen.getByTestId('stat-completed')).toHaveTextContent('1');
    expect(screen.getByTestId('stat-cancelled')).toHaveTextContent('1');
    expect(screen.getByRole('heading', { name: 'Appointments (1)' })).toBeInTheDocument();
  });

  // ── Sorting ─────────────────────────────────────────────────────────────────

  it('sorts chronologically by default, and by a column when its header is clicked', async () => {
    api.booked.list.mockResolvedValue([
      booking({ appointmentId: 'b', patientName: 'Amal', startUtc: '2026-10-05T05:00:00Z' }),
      booking({ appointmentId: 'a', patientName: 'Zara', startUtc: '2026-10-05T03:30:00Z' }),
    ]);
    renderPage();
    await screen.findByTestId('clinic-appointments');

    expect(patientColumn()).toEqual([
      expect.stringContaining('Zara'),
      expect.stringContaining('Amal'),
    ]);

    fireEvent.click(screen.getByRole('button', { name: 'Patient' }));
    expect(patientColumn()).toEqual([
      expect.stringContaining('Amal'),
      expect.stringContaining('Zara'),
    ]);

    fireEvent.click(screen.getByRole('button', { name: 'Patient' }));
    expect(patientColumn()).toEqual([
      expect.stringContaining('Zara'),
      expect.stringContaining('Amal'),
    ]);
  });

  // ── Row actions ─────────────────────────────────────────────────────────────

  it('offers the details page, the patient and the id in the row menu', async () => {
    renderPage();
    await screen.findByTestId('clinic-appointments');

    fireEvent.click(screen.getByRole('button', { name: 'Actions for Kamala Silva' }));

    const menu = screen.getByRole('menu');
    expect(within(menu).getByRole('menuitem', { name: 'View details' })).toHaveAttribute(
      'href',
      '/appointments/appt-1',
    );
    expect(within(menu).getByRole('menuitem', { name: 'View patient profile' })).toHaveAttribute(
      'href',
      '/patients/patient-1',
    );
    expect(within(menu).getByRole('menuitem', { name: 'Copy appointment ID' })).toBeInTheDocument();
    // Cancel and reschedule (SCRUM-36) live on the details page, which has room to ask why.
    expect(within(menu).queryByText(/cancel/i)).not.toBeInTheDocument();
  });

  // ── Edge cases ──────────────────────────────────────────────────────────────

  it('still lists a booking made without a name on record', async () => {
    api.booked.list.mockResolvedValue([booking({ patientName: null, patientNumber: null })]);
    renderPage();

    expect(await screen.findByText('Unnamed patient')).toBeInTheDocument();
  });

  it('explains an empty range', async () => {
    api.booked.list.mockResolvedValue([]);
    renderPage();

    expect(await screen.findByText('No appointments in this range')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export' })).toBeDisabled();
  });
});

describe('toCsv', () => {
  it('writes the visible rows with a header, quoting what needs it', () => {
    const csv = toCsv([booking({ patientName: 'Silva, Kamala "Kam"' })]);

    const [header, row] = csv.split('\n');
    expect(header).toBe(
      'Date,Time,Duration (min),Patient,Patient number,Doctor,Specialization,Service,Status',
    );
    expect(row).toBe(
      '2026-10-05,09:00,30,"Silva, Kamala ""Kam""",PAT-000123,Tathira Samarakoon,Neurology,GEN-CONSULT,Booked',
    );
  });
});
