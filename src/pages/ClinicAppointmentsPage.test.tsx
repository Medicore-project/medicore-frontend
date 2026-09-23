import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppointmentSummary } from '../api/appointments';
import ClinicAppointmentsPage from './ClinicAppointmentsPage';

const api = vi.hoisted(() => ({
  booked: { list: vi.fn() },
  doctor: { list: vi.fn() },
}));

vi.mock('../api/appointments', async (importOriginal) => ({
  // Keep the real Colombo helpers — times are asserted as the clinic reads them.
  ...(await importOriginal<typeof import('../api/appointments')>()),
  bookedApi: api.booked,
  doctorApi: api.doctor,
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
    startUtc: '2026-09-24T03:30:00Z',
    endUtc: '2026-09-24T04:00:00Z',
    slotDate: '2026-09-24',
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

beforeEach(() => {
  vi.clearAllMocks();
  api.doctor.list.mockResolvedValue([DOCTOR]);
  api.booked.list.mockResolvedValue([booking()]);
});

describe('ClinicAppointmentsPage', () => {
  it('lists who is booked with whom, and when', async () => {
    renderPage();

    const table = await screen.findByTestId('clinic-appointments');
    const row = within(table).getAllByRole('row')[1];
    expect(row).toHaveTextContent('09:00');
    expect(row).toHaveTextContent('Kamala Silva');
    expect(row).toHaveTextContent('PAT-000123');
    expect(row).toHaveTextContent('Tathira Samarakoon');
    expect(row).toHaveTextContent('Booked');
  });

  it('links the patient to their profile', async () => {
    renderPage();

    const link = await screen.findByRole('link', { name: 'Kamala Silva' });
    expect(link).toHaveAttribute('href', '/patients/patient-1');
  });

  it('opens on the whole clinic for the coming week', async () => {
    renderPage();

    await waitFor(() => expect(api.booked.list).toHaveBeenCalled());
    const { doctorId, from, to } = api.booked.list.mock.calls[0][0];
    expect(doctorId).toBeUndefined();
    const days = (Date.parse(to) - Date.parse(from)) / 86_400_000;
    expect(days).toBe(6);
  });

  it('narrows to one doctor when one is chosen', async () => {
    renderPage();
    await screen.findByTestId('clinic-appointments');

    fireEvent.change(screen.getByLabelText('Doctor'), { target: { value: 'doctor-1' } });

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

    expect(screen.queryByText('Sunil Fernando')).not.toBeInTheDocument();
    expect(screen.getByText('Kamala Silva')).toBeInTheDocument();
    expect(api.booked.list).toHaveBeenCalledTimes(1);
  });

  it('refuses a backwards date range before calling the service', async () => {
    renderPage();
    await screen.findByTestId('clinic-appointments');

    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2099-01-10' } });

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The start date must not be after the end date.',
    );
    expect(api.booked.list).toHaveBeenCalledTimes(1);
  });

  it('still lists a booking made without a name on record', async () => {
    api.booked.list.mockResolvedValue([booking({ patientName: null, patientNumber: null })]);
    renderPage();

    expect(await screen.findByText('Unnamed patient')).toBeInTheDocument();
  });

  it('explains an empty range', async () => {
    api.booked.list.mockResolvedValue([]);
    renderPage();

    expect(await screen.findByText('No appointments in this range')).toBeInTheDocument();
  });
});
