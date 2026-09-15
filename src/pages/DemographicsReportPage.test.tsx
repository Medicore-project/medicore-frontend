import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DemographicsReportResponse } from '../api/demographicsReports';
import DemographicsReportPage from './DemographicsReportPage';

const apiMocks = vi.hoisted(() => ({
  get: vi.fn(),
  download: vi.fn(),
}));

vi.mock('../api/demographicsReports', () => ({
  DEMOGRAPHICS_AGE_BANDS: ['0-17', '18-34', '35-49', '50-64', '65+'],
  DEMOGRAPHICS_GENDERS: ['Male', 'Female', 'Other', 'PreferNotToSay'],
  demographicsReportsApi: apiMocks,
}));

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  BarChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  LineChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Bar: () => null,
  CartesianGrid: () => null,
  Legend: () => null,
  Line: () => null,
  Tooltip: () => null,
  XAxis: () => null,
  YAxis: () => null,
}));

const report: DemographicsReportResponse = {
  generatedAtUtc: '2026-09-14T10:30:00Z',
  appliedFilters: {
    ageBand: null,
    gender: null,
    district: null,
    from: null,
    to: null,
  },
  totalPatients: 1,
  totalVisits: 2,
  patientsWithVisits: 1,
  patientsWithoutVisits: 0,
  ageBands: [
    { label: '0-17', patientCount: 0, visitCount: 0 },
    { label: '18-34', patientCount: 1, visitCount: 2 },
  ],
  genders: [{ label: 'Female', patientCount: 1, visitCount: 2 }],
  districts: [{ label: 'Colombo', patientCount: 1, visitCount: 2 }],
  visitHistory: [{ period: '2026-01', periodStart: '2026-01-01', visitCount: 2 }],
  patients: [{
    patientId: 'patient-30',
    patientNumber: 'PAT-000030',
    age: 31,
    ageBand: '18-34',
    gender: 'Female',
    district: 'Colombo',
    visitCount: 2,
    firstVisitAtUtc: '2026-01-03T09:00:00Z',
    latestVisitAtUtc: '2026-01-18T11:00:00Z',
  }],
};

describe('DemographicsReportPage', () => {
  beforeEach(() => {
    apiMocks.get.mockReset().mockResolvedValue(report);
    apiMocks.download.mockReset();
  });

  it('loads the unfiltered report and renders summaries, charts and patients', async () => {
    render(<DemographicsReportPage />);

    expect(await screen.findByText('PAT-000030')).toBeInTheDocument();
    expect(apiMocks.get).toHaveBeenCalledWith({});
    expect(screen.getByRole('region', { name: 'Report summary' })).toHaveTextContent('Total patients1');
    expect(screen.getByRole('img', { name: 'Age breakdown chart' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Visit history chart' })).toBeInTheDocument();
  });

  it('applies age, gender, district and date filters together', async () => {
    render(<DemographicsReportPage />);
    await screen.findByText('PAT-000030');

    fireEvent.change(screen.getByLabelText('Age band'), { target: { value: '18-34' } });
    fireEvent.change(screen.getByLabelText('Gender'), { target: { value: 'Female' } });
    fireEvent.change(screen.getByLabelText('District'), { target: { value: ' Colombo ' } });
    fireEvent.change(screen.getByLabelText('Visit date from'), { target: { value: '2026-01-01' } });
    fireEvent.change(screen.getByLabelText('Visit date to'), { target: { value: '2026-06-30' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));

    await waitFor(() => expect(apiMocks.get).toHaveBeenLastCalledWith({
      ageBand: '18-34',
      gender: 'Female',
      district: 'Colombo',
      from: '2026-01-01',
      to: '2026-06-30',
    }));
  });

  it('rejects a reversed date range before calling the API', async () => {
    render(<DemographicsReportPage />);
    await screen.findByText('PAT-000030');

    fireEvent.change(screen.getByLabelText('Visit date from'), { target: { value: '2026-07-01' } });
    fireEvent.change(screen.getByLabelText('Visit date to'), { target: { value: '2026-06-30' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('End date must be on or after start date.');
    expect(apiMocks.get).toHaveBeenCalledTimes(1);
  });

  it('exports using the last applied filters rather than unapplied edits', async () => {
    const blob = new Blob(['csv']);
    apiMocks.download.mockResolvedValue({ blob, fileName: 'report.csv' });
    const createObjectUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:report');
    const revokeObjectUrl = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
    render(<DemographicsReportPage />);
    await screen.findByText('PAT-000030');

    fireEvent.change(screen.getByLabelText('District'), { target: { value: 'Colombo' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
    await waitFor(() => expect(apiMocks.get).toHaveBeenLastCalledWith({ district: 'Colombo' }));
    fireEvent.change(screen.getByLabelText('District'), { target: { value: 'Galle' } });
    fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }));

    await waitFor(() => expect(apiMocks.download).toHaveBeenCalledWith({ district: 'Colombo' }, 'Csv'));
    expect(createObjectUrl).toHaveBeenCalledWith(blob);
    expect(click).toHaveBeenCalled();
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:report');
  });
});
