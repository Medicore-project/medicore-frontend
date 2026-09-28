import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DoctorUtilisationRow, UtilisationReportResponse } from '../api/utilisationReports';
import UtilisationReportPage from './UtilisationReportPage';

const mocks = vi.hoisted(() => ({
  report: { get: vi.fn(), download: vi.fn() },
  doctors: { list: vi.fn() },
  departments: { list: vi.fn() },
  triggerBrowserDownload: vi.fn(),
}));

vi.mock('../api/utilisationReports', () => ({ utilisationReportsApi: mocks.report }));
vi.mock('../api/appointments', () => ({ doctorApi: mocks.doctors }));
vi.mock('../api/departments', () => ({ departmentsApi: mocks.departments }));
vi.mock('../utils/download', () => ({ triggerBrowserDownload: mocks.triggerBrowserDownload }));

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  BarChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Bar: () => null,
  CartesianGrid: () => null,
  Legend: () => null,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
}));

const CARDIOLOGY = 'dept-cardio';
const NEUROLOGY = 'dept-neuro';

const DOCTORS = [
  { doctorId: 'doc-perera', fullName: 'Dr. Perera', specialization: 'Cardiology', departmentId: CARDIOLOGY },
  { doctorId: 'doc-silva', fullName: 'Dr. Silva', specialization: 'Neurology', departmentId: NEUROLOGY },
];

const DEPARTMENTS = [
  { id: CARDIOLOGY, name: 'Cardiology', isActive: true },
  { id: NEUROLOGY, name: 'Neurology', isActive: true },
];

function row(overrides: Partial<DoctorUtilisationRow> = {}): DoctorUtilisationRow {
  return {
    doctorId: 'doc-perera',
    doctorName: 'Dr. Perera',
    specialization: 'Cardiology',
    departmentId: CARDIOLOGY,
    isActive: true,
    completed: 7,
    noShow: 3,
    cancelled: 4,
    booked: 5,
    total: 15,
    noShowRate: 0.3,
    bookableSlots: 20,
    usedSlots: 19,
    fillRate: 0.95,
    ...overrides,
  };
}

function report(doctors: DoctorUtilisationRow[] = [row()], overrides: Partial<UtilisationReportResponse['appliedFilters']> = {}): UtilisationReportResponse {
  return {
    generatedAtUtc: '2026-09-23T08:00:00Z',
    appliedFilters: {
      doctorId: null,
      departmentId: null,
      departmentName: null,
      from: '2026-09-01',
      to: '2026-09-30',
      isDefaultPeriod: true,
      ...overrides,
    },
    totals: {
      doctors: doctors.length,
      completed: 7,
      noShow: 3,
      cancelled: 4,
      booked: 5,
      total: 15,
      noShowRate: 0.3,
      bookableSlots: 20,
      usedSlots: 19,
      fillRate: 0.95,
    },
    doctors,
  };
}

async function renderLoaded() {
  render(<UtilisationReportPage />);
  await screen.findByTestId('utilisation-period');
  // The filter choices arrive separately from the report.
  await screen.findByRole('option', { name: 'Neurology' });
}

describe('UtilisationReportPage (SCRUM-38)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.report.get.mockResolvedValue(report());
    mocks.doctors.list.mockResolvedValue(DOCTORS);
    mocks.departments.list.mockResolvedValue(DEPARTMENTS);
  });

  // ── AC1: no filters, the current month ────────────────────────────────────

  it('opens on every doctor for the current month, with the totals and a row per doctor', async () => {
    await renderLoaded();

    expect(mocks.report.get).toHaveBeenCalledWith({});
    // "Sep" or "Sept", depending on the ICU data the runtime ships.
    expect(screen.getByTestId('utilisation-period')).toHaveTextContent(
      /^Showing 1 Sept? 2026 – 30 Sept? 2026 \(current month\)$/,
    );

    const summary = within(screen.getByRole('region', { name: 'Report summary' }));
    expect(summary.getByText('Appointments').nextSibling).toHaveTextContent('15');
    expect(summary.getByText('No-shows').nextSibling).toHaveTextContent('3');
    expect(summary.getByText('No-show rate').nextSibling).toHaveTextContent('30.0%');
    expect(summary.getByText('Slot fill').nextSibling).toHaveTextContent('95.0%');

    expect(screen.getByRole('img', { name: 'Appointments by doctor chart' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'No-show rate and slot fill chart' })).toBeInTheDocument();
  });

  it('shows every AC3 figure per doctor, the department by name, and flags high demand', async () => {
    await renderLoaded();

    const cells = within(screen.getByTestId('utilisation-row')).getAllByRole('cell').map((cell) => cell.textContent);
    // The specialization sits under the name; the department has its own column.
    expect(cells).toEqual([
      'Dr. PereraCardiology',
      'Cardiology',
      '7',
      '3',
      '5',
      '4',
      '15',
      '30.0%',
      '95.0% (19/20)High demand',
    ]);
  });

  it('shows a dash for a rate with nothing to divide by, and marks a doctor who has left', async () => {
    mocks.report.get.mockResolvedValue(report([
      row({
        doctorId: 'doc-gone',
        doctorName: 'Dr. Gone',
        isActive: false,
        completed: 0,
        noShow: 0,
        booked: 2,
        total: 2,
        noShowRate: null,
        bookableSlots: 0,
        usedSlots: 0,
        fillRate: null,
      }),
    ]));
    await renderLoaded();

    const cells = within(screen.getByTestId('utilisation-row')).getAllByRole('cell');
    expect(cells[0]).toHaveTextContent(/^Dr\. Gone.*\(inactive\)$/);
    expect(cells[7]).toHaveTextContent('–');
    expect(cells[8]).toHaveTextContent('– (0/0)');
    expect(screen.queryByText('High demand')).not.toBeInTheDocument();
  });

  it('says so when no doctor matches', async () => {
    mocks.report.get.mockResolvedValue(report([]));
    await renderLoaded();

    expect(screen.getByText('No doctors match the selected filters.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  // ── AC2: filters in any combination ───────────────────────────────────────

  it('applies department, doctor and dates together', async () => {
    await renderLoaded();

    fireEvent.change(screen.getByLabelText('Department'), { target: { value: CARDIOLOGY } });
    fireEvent.change(screen.getByLabelText('Doctor'), { target: { value: 'doc-perera' } });
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-08-01' } });
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-08-31' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));

    await waitFor(() => expect(mocks.report.get).toHaveBeenLastCalledWith({
      doctorId: 'doc-perera',
      departmentId: CARDIOLOGY,
      from: '2026-08-01',
      to: '2026-08-31',
    }));
  });

  it('applies a single filter on its own', async () => {
    await renderLoaded();

    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-07-10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));

    await waitFor(() => expect(mocks.report.get).toHaveBeenLastCalledWith({
      doctorId: undefined,
      departmentId: undefined,
      from: '2026-07-10',
      to: undefined,
    }));
  });

  it("offers only the chosen department's doctors, and drops a doctor from another", async () => {
    await renderLoaded();

    fireEvent.change(screen.getByLabelText('Doctor'), { target: { value: 'doc-silva' } });
    fireEvent.change(screen.getByLabelText('Department'), { target: { value: CARDIOLOGY } });

    const doctorSelect = screen.getByLabelText('Doctor');
    expect(doctorSelect).toHaveValue('');
    expect(within(doctorSelect).queryByRole('option', { name: 'Dr. Silva' })).not.toBeInTheDocument();
    expect(within(doctorSelect).getByRole('option', { name: 'Dr. Perera' })).toBeInTheDocument();
  });

  it('refuses an end date before the start date without asking the service', async () => {
    await renderLoaded();

    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-09-10' } });
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-09-01' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));

    expect(screen.getByRole('alert')).toHaveTextContent('End date must be on or after start date.');
    expect(mocks.report.get).toHaveBeenCalledTimes(1);
  });

  it('resets to the current month', async () => {
    await renderLoaded();
    fireEvent.change(screen.getByLabelText('From'), { target: { value: '2026-07-10' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
    await waitFor(() => expect(mocks.report.get).toHaveBeenCalledTimes(2));
    await screen.findByTestId('utilisation-period');

    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));

    await waitFor(() => expect(mocks.report.get).toHaveBeenLastCalledWith({}));
    expect(screen.getByLabelText('From')).toHaveValue('');
  });

  // ── AC4: exports ──────────────────────────────────────────────────────────

  it('exports the applied filters with the department name, and saves the file', async () => {
    const blob = new Blob(['pdf']);
    mocks.report.download.mockResolvedValue({ blob, fileName: 'medicore-utilisation-20260801-20260831.pdf' });
    await renderLoaded();

    fireEvent.change(screen.getByLabelText('Department'), { target: { value: CARDIOLOGY } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
    await waitFor(() => expect(mocks.report.get).toHaveBeenCalledTimes(2));
    // Changed after applying: the export must still use what was applied.
    fireEvent.change(screen.getByLabelText('Department'), { target: { value: NEUROLOGY } });
    fireEvent.click(await screen.findByRole('button', { name: 'Export PDF' }));

    await waitFor(() => expect(mocks.triggerBrowserDownload).toHaveBeenCalledWith(
      blob,
      'medicore-utilisation-20260801-20260831.pdf',
    ));
    expect(mocks.report.download).toHaveBeenCalledWith(
      { doctorId: undefined, departmentId: CARDIOLOGY, from: undefined, to: undefined },
      'Pdf',
      'Cardiology',
    );
  });

  it('exports CSV with no department name when no department is chosen', async () => {
    mocks.report.download.mockResolvedValue({ blob: new Blob([]), fileName: 'u.csv' });
    await renderLoaded();

    fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }));

    await waitFor(() => expect(mocks.report.download).toHaveBeenCalledWith({}, 'Csv', undefined));
  });

  it('shows why an export failed', async () => {
    mocks.report.download.mockRejectedValue({ response: { status: 500, data: { title: 'Server error.' } } });
    await renderLoaded();

    fireEvent.click(screen.getByRole('button', { name: 'Export PDF' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Server error.');
    expect(mocks.triggerBrowserDownload).not.toHaveBeenCalled();
  });

  // ── Failures ──────────────────────────────────────────────────────────────

  it('tells a non-administrator the report is not theirs', async () => {
    mocks.report.get.mockRejectedValue({ response: { status: 403 } });
    render(<UtilisationReportPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Only administrators can view this report.');
    expect(screen.getByRole('button', { name: 'Export PDF' })).toBeDisabled();
  });

  it("shows the service's validation message", async () => {
    mocks.report.get.mockRejectedValue({
      response: { status: 400, data: { errors: { to: ['The period can cover at most 366 days.'] } } },
    });
    render(<UtilisationReportPage />);

    expect(await screen.findByRole('alert')).toHaveTextContent('The period can cover at most 366 days.');
  });

  it('still shows the report when the filter choices cannot be loaded', async () => {
    mocks.doctors.list.mockRejectedValue(new Error('down'));
    mocks.departments.list.mockRejectedValue(new Error('down'));
    render(<UtilisationReportPage />);

    expect(await screen.findByTestId('utilisation-row')).toBeInTheDocument();
    expect(within(screen.getByLabelText('Doctor')).getAllByRole('option')).toHaveLength(1);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
