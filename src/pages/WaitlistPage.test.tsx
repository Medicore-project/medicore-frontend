import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WaitlistEntry } from '../api/waitlist';
import WaitlistPage from './WaitlistPage';

const api = vi.hoisted(() => ({
  doctor: { list: vi.fn() },
  waitlist: { list: vi.fn(), get: vi.fn(), accept: vi.fn(), decline: vi.fn(), remove: vi.fn() },
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
  doctorApi: api.doctor,
}));

vi.mock('../api/waitlist', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../api/waitlist')>()),
  staffWaitlistApi: api.waitlist,
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

function entry(overrides: Partial<WaitlistEntry> = {}): WaitlistEntry {
  return {
    waitlistEntryId: 'w-1',
    doctorId: 'doctor-1',
    doctorName: 'Tathira Samarakoon',
    specialization: 'Neurology',
    slotDate: '2026-10-05',
    placeInLine: 1,
    status: 'Waiting',
    joinedAtUtc: '2026-09-23T04:00:00Z',
    offeredStartUtc: null,
    offeredEndUtc: null,
    offerExpiresAtUtc: null,
    appointmentId: null,
    closedAtUtc: null,
    closedReason: null,
    patientId: 'patient-1',
    patientNumber: 'PAT-000123',
    patientName: 'Kamala Silva',
    serviceCode: 'GEN-CONSULT',
    position: 1,
    offeredSlotId: null,
    ...overrides,
  };
}

/** Nimal holds an offer of 09:00 (03:30Z) on 5 Oct, until 10:00 (04:30Z). */
function offer(overrides: Partial<WaitlistEntry> = {}): WaitlistEntry {
  return entry({
    waitlistEntryId: 'w-2',
    patientId: 'patient-2',
    patientNumber: 'PAT-000456',
    patientName: 'Nimal Perera',
    position: 2,
    placeInLine: null,
    status: 'Offered',
    offeredSlotId: 'slot-1',
    offeredStartUtc: '2026-10-05T03:30:00Z',
    offeredEndUtc: '2026-10-05T04:00:00Z',
    offerExpiresAtUtc: '2026-10-05T04:30:00Z',
    ...overrides,
  });
}

function renderPage() {
  render(
    <MemoryRouter>
      <WaitlistPage />
    </MemoryRouter>,
  );
}

function rows() {
  return within(screen.getByTestId('waitlist-table')).getAllByTestId('waitlist-row');
}

beforeEach(() => {
  vi.clearAllMocks();
  auth.user = { id: 'u1', email: 'desk@medicore.lk', role: 'Receptionist', staffId: null };
  api.doctor.list.mockResolvedValue([DOCTOR]);
  api.waitlist.list.mockResolvedValue([entry(), offer()]);
  api.waitlist.accept.mockResolvedValue(undefined);
  api.waitlist.decline.mockResolvedValue(entry({ status: 'Declined' }));
  api.waitlist.remove.mockResolvedValue(entry({ status: 'Withdrawn' }));
});

describe('WaitlistPage (SCRUM-37)', () => {
  it('opens on the next two weeks of waiting and offered entries, clinic-wide', async () => {
    renderPage();

    await waitFor(() => expect(api.waitlist.list).toHaveBeenCalled());
    const params = api.waitlist.list.mock.calls[0][0];
    expect(params.status).toBe('Active');
    expect(params.doctorId).toBeUndefined();
    const days = (Date.parse(params.to) - Date.parse(params.from)) / 86_400_000;
    expect(days).toBe(13);
  });

  it("opens a doctor's page on their own queues", async () => {
    auth.user = { id: 'u2', email: 'dr@medicore.lk', role: 'Doctor', staffId: 'doctor-1' };
    renderPage();

    await waitFor(() => expect(api.waitlist.list).toHaveBeenCalled());
    expect(api.waitlist.list.mock.calls[0][0].doctorId).toBe('doctor-1');
  });

  it('puts open offers first, with the time held and when it lapses', async () => {
    renderPage();

    await screen.findByTestId('waitlist-table');
    const [first, second] = rows();
    expect(first).toHaveTextContent('Nimal Perera');
    expect(first).toHaveTextContent('Offered');
    expect(first).toHaveTextContent('09:00');
    expect(first).toHaveTextContent('Held until 10:00');
    expect(second).toHaveTextContent('Kamala Silva');
    expect(second).toHaveTextContent('#1');
  });

  it('counts who is waiting and the open offers', async () => {
    renderPage();

    await screen.findByTestId('waitlist-table');
    expect(screen.getByTestId('stat-waiting')).toHaveTextContent('1');
    expect(screen.getByTestId('stat-offered')).toHaveTextContent('1');
  });

  it("accepts an offer on the patient's behalf and reloads", async () => {
    renderPage();
    await screen.findByTestId('waitlist-table');

    fireEvent.click(screen.getByRole('button', { name: 'Accept the offer for Nimal Perera' }));

    await waitFor(() => expect(api.waitlist.accept).toHaveBeenCalledWith('w-2'));
    expect(await screen.findByRole('status')).toHaveTextContent('Booked Nimal Perera');
    expect(api.waitlist.list).toHaveBeenCalledTimes(2);
  });

  it("declines an offer on the patient's behalf", async () => {
    renderPage();
    await screen.findByTestId('waitlist-table');

    fireEvent.click(screen.getByRole('button', { name: 'Decline the offer for Nimal Perera' }));

    await waitFor(() => expect(api.waitlist.decline).toHaveBeenCalledWith('w-2'));
    expect(await screen.findByRole('status')).toHaveTextContent('gone to the next patient');
  });

  it("shows the service's reason when an accept is refused", async () => {
    api.waitlist.accept.mockRejectedValueOnce({
      response: { status: 409, data: { title: 'This offer expired at 10:00 on 05 Oct 2026 and has passed to the next patient.' } },
    });
    renderPage();
    await screen.findByTestId('waitlist-table');

    fireEvent.click(screen.getByRole('button', { name: 'Accept the offer for Nimal Perera' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('has passed to the next patient');
  });

  it('removes an entry with a reason', async () => {
    renderPage();
    await screen.findByTestId('waitlist-table');

    fireEvent.click(screen.getByRole('button', { name: 'Remove Kamala Silva from the waitlist' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Reason'), { target: { value: 'Patient phoned.' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Remove' }));

    await waitFor(() => expect(api.waitlist.remove).toHaveBeenCalledWith('w-1', 'Patient phoned.'));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('status')).toHaveTextContent('Removed Kamala Silva from the waitlist.');
  });

  it('offers only Remove on a waiting entry, and nothing on a closed one', async () => {
    api.waitlist.list.mockResolvedValue([entry(), entry({ waitlistEntryId: 'w-3', status: 'Expired', placeInLine: null })]);
    renderPage();

    await screen.findByTestId('waitlist-table');
    const [waiting, closed] = rows();
    expect(within(waiting).getAllByRole('button').map((b) => b.textContent)).toEqual(['Remove']);
    expect(within(closed).queryByRole('button')).not.toBeInTheDocument();
  });

  it('lets a doctor read the queues but not act on them', async () => {
    auth.user = { id: 'u2', email: 'dr@medicore.lk', role: 'Doctor', staffId: 'doctor-1' };
    renderPage();

    await screen.findByTestId('waitlist-table');
    expect(screen.queryByRole('columnheader', { name: 'Actions' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Accept the offer/ })).not.toBeInTheDocument();
  });

  it('applies the chosen status and dates', async () => {
    renderPage();
    await screen.findByTestId('waitlist-table');

    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'Expired' } });
    fireEvent.change(screen.getByLabelText('From Date'), { target: { value: '2026-10-01' } });
    fireEvent.change(screen.getByLabelText('To Date'), { target: { value: '2026-10-31' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply Filters' }));

    await waitFor(() => expect(api.waitlist.list).toHaveBeenCalledTimes(2));
    expect(api.waitlist.list.mock.calls[1][0]).toEqual({
      doctorId: undefined,
      from: '2026-10-01',
      to: '2026-10-31',
      status: 'Expired',
    });
  });

  it('refuses a backwards date range without asking the service', async () => {
    renderPage();
    await screen.findByTestId('waitlist-table');

    fireEvent.change(screen.getByLabelText('From Date'), { target: { value: '2026-10-31' } });
    fireEvent.change(screen.getByLabelText('To Date'), { target: { value: '2026-10-01' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply Filters' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('must not be after');
    expect(api.waitlist.list).toHaveBeenCalledTimes(1);
  });

  it('says so when nobody is on the waitlist', async () => {
    api.waitlist.list.mockResolvedValue([]);
    renderPage();

    expect(await screen.findByText('Nobody is on the waitlist in this range')).toBeInTheDocument();
  });
});
