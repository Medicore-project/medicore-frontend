import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppointmentSummary } from '../api/appointments';
import DashboardPage from './DashboardPage';

const api = vi.hoisted(() => ({
  booked: { list: vi.fn() },
  doctor: { list: vi.fn() },
  waitlist: { list: vi.fn() },
  staff: { list: vi.fn() },
  departments: { list: vi.fn() },
}));

const auth = vi.hoisted(() => ({
  user: { id: 'u1', email: 'desk@medicore.lk', name: 'Nimali Perera', role: 'Receptionist', staffId: null as string | null },
}));

vi.mock('../api/appointments', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/appointments')>()),
  bookedApi: api.booked,
  doctorApi: api.doctor,
}));
vi.mock('../api/waitlist', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/waitlist')>()),
  staffWaitlistApi: api.waitlist,
}));
vi.mock('../api/staff', () => ({ staffApi: api.staff }));
vi.mock('../api/departments', () => ({ departmentsApi: api.departments }));
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: auth.user }) }));
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  BarChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Bar: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
}));

function booking(overrides: Partial<AppointmentSummary>): AppointmentSummary {
  return {
    appointmentId: 'appt',
    patientId: 'patient-1',
    patientNumber: 'PAT-000123',
    patientName: 'Kamala Silva',
    doctorId: 'doctor-1',
    doctorName: 'Tathira Samarakoon',
    specialization: 'Neurology',
    slotId: 'slot-1',
    startUtc: '2026-10-05T04:30:00Z',
    endUtc: '2026-10-05T05:00:00Z',
    slotDate: '2026-10-05',
    durationMinutes: 30,
    serviceCode: 'GEN-CONSULT',
    status: 'Booked',
    createdAt: '2026-09-23T04:00:00Z',
    ...overrides,
  };
}

// 03:00Z on 5 Oct is 08:30 in Colombo.
const NOW = new Date('2026-10-05T03:00:00Z');

const TODAY = [
  booking({ appointmentId: 'appt-done', patientName: 'Ruwan Jayasuriya', startUtc: '2026-10-05T02:30:00Z', status: 'Completed' }),
  booking({ appointmentId: 'appt-next', patientName: 'Kamala Silva', startUtc: '2026-10-05T04:30:00Z' }),
  booking({ appointmentId: 'appt-cancelled', patientName: 'Dilani Fernando', startUtc: '2026-10-05T06:00:00Z', status: 'Cancelled' }),
];

function renderDashboard(role: string, staffId: string | null = null) {
  auth.user = { ...auth.user, role, staffId };
  render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <Routes>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/appointments/:appointmentId" element={<p>appointment page</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

/** A tile's figure, read from the screen-reader copy so the count-up animation does not matter. */
function tileValue(label: string): string | null {
  const tile = screen.getByText(label, { selector: '.db-kpi-label' }).closest('.db-kpi') as HTMLElement;
  return within(tile).queryByText(/^\d[\d,]*$/, { selector: '.sr-only' })?.textContent ?? null;
}

describe('DashboardPage', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
    Object.values(api).forEach((client) => Object.values(client).forEach((fn) => fn.mockReset()));
    api.booked.list.mockResolvedValue([
      ...TODAY,
      booking({ appointmentId: 'appt-tomorrow', slotDate: '2026-10-06', startUtc: '2026-10-06T04:00:00Z' }),
    ]);
    api.waitlist.list.mockResolvedValue([{ waitlistEntryId: 'w1', status: 'Offered' }, { waitlistEntryId: 'w2', status: 'Waiting' }]);
    api.departments.list.mockResolvedValue([{ id: 'd1' }, { id: 'd2' }, { id: 'd3' }]);
    api.doctor.list.mockResolvedValue([]);
    api.staff.list.mockResolvedValue({ totalCount: 42 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('greets the user and summarises the clinic day', async () => {
    renderDashboard('Receptionist');

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Good morning, Nimali');
    expect(await screen.findByText('The clinic has 2 appointments today. Next up at 10:00.')).toBeInTheDocument();
    expect(tileValue('Appointments today')).toBe('2');
    expect(tileValue('Coming up this week')).toBe('1');
    expect(tileValue('On the waitlist')).toBe('2');
    expect(tileValue('Departments')).toBe('3');
    expect(screen.getByText('1 offer waiting for a reply')).toBeInTheDocument();
  });

  it('loads the clinic fortnight around today', async () => {
    renderDashboard('Receptionist');

    await waitFor(() => expect(api.booked.list).toHaveBeenCalledWith({ doctorId: undefined, from: '2026-09-29', to: '2026-10-11' }));
  });

  it('lists today in time order and marks the next appointment', async () => {
    renderDashboard('Receptionist');

    const schedule = screen.getByRole('region', { name: 'Today’s schedule' });
    await within(schedule).findByText('Ruwan Jayasuriya');
    const rows = within(schedule).getAllByRole('button', { name: /^Open / });

    expect(rows.map((row) => row.getAttribute('aria-label'))).toEqual([
      'Open Ruwan Jayasuriya at 08:00',
      'Open Kamala Silva at 10:00',
      'Open Dilani Fernando at 11:30',
    ]);
    expect(within(rows[1]).getByText('Next up')).toBeInTheDocument();
  });

  it('filters the schedule by status', async () => {
    renderDashboard('Receptionist');
    const schedule = screen.getByRole('region', { name: 'Today’s schedule' });
    await within(schedule).findByText('Ruwan Jayasuriya');

    fireEvent.click(within(schedule).getByRole('button', { name: /^Cancelled/ }));

    expect(within(schedule).getByText('Dilani Fernando')).toBeInTheDocument();
    expect(within(schedule).queryByText('Ruwan Jayasuriya')).not.toBeInTheDocument();
  });

  it('opens an appointment from the schedule', async () => {
    renderDashboard('Receptionist');

    fireEvent.click(await screen.findByRole('button', { name: 'Open Kamala Silva at 10:00' }));

    expect(screen.getByText('appointment page')).toBeInTheDocument();
  });

  it('shows a doctor only their own bookings, and no clinic-wide figures', async () => {
    renderDashboard('Doctor', 'doctor-7');

    await waitFor(() => expect(api.booked.list).toHaveBeenCalledWith(expect.objectContaining({ doctorId: 'doctor-7' })));
    expect(screen.getByText('My appointments today')).toBeInTheDocument();
    expect(screen.queryByText('Departments', { selector: '.db-kpi-label' })).not.toBeInTheDocument();
    expect(api.departments.list).not.toHaveBeenCalled();
    expect(api.staff.list).not.toHaveBeenCalled();
  });

  it('shows an admin the active staff total', async () => {
    renderDashboard('Admin');

    await waitFor(() => expect(tileValue('Active staff')).toBe('42'));
  });

  it('keeps the page up when the appointment service fails', async () => {
    api.booked.list.mockRejectedValue(new Error('down'));
    renderDashboard('Receptionist');

    expect(await screen.findByText('Today’s schedule could not be loaded')).toBeInTheDocument();
    // The other figures still load.
    await waitFor(() => expect(tileValue('Departments')).toBe('3'));
  });

  it('offers the front desk its quick actions', () => {
    renderDashboard('Receptionist');

    const actions = screen.getByRole('navigation', { name: 'Quick actions' });
    expect(within(actions).getByRole('link', { name: /Register patient/ })).toHaveAttribute('href', '/patients/register');
    expect(within(actions).queryByRole('link', { name: /Manage staff/ })).not.toBeInTheDocument();
  });
});
