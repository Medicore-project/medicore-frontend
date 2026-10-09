import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import RevenueReportPage from './RevenueReportPage';

const mocks = vi.hoisted(() => ({
  report: { get: vi.fn(), download: vi.fn() },
  departments: { list: vi.fn() },
  save: vi.fn(),
}));
vi.mock('../api/revenueReports', () => ({ revenueReportsApi: mocks.report }));
vi.mock('../api/departments', () => ({ departmentsApi: mocks.departments }));
vi.mock('../utils/download', () => ({ triggerBrowserDownload: mocks.save }));
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  BarChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  LineChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Bar: () => null, Line: () => null, CartesianGrid: () => null,
  Legend: () => null, Tooltip: () => null, XAxis: () => null, YAxis: () => null,
}));

const response = {
  generatedAtUtc: '2026-10-08T08:00:00Z',
  appliedFilters: { departmentId: null, departmentName: null, paymentMethod: null, currency: null,
    from: '2026-10-01', to: '2026-10-31', isDefaultPeriod: true },
  totalsByCurrency: [{ currency: 'LKR', amount: 200, paymentCount: 2 }],
  breakdown: [{ departmentId: 'd1', paymentMethod: 'Cash', currency: 'LKR', amount: 200, paymentCount: 2 }],
  dailyTotals: [{ date: '2026-10-02', currency: 'LKR', amount: 200, paymentCount: 2 }],
};

describe('RevenueReportPage (SCRUM-47)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.report.get.mockResolvedValue(response);
    mocks.departments.list.mockResolvedValue([{ id: 'd1', name: 'Cardiology', isActive: true }]);
    mocks.report.download.mockResolvedValue({ blob: new Blob(['x']), fileName: 'revenue.csv' });
  });

  it('shows cash received, charts and department names', async () => {
    render(<RevenueReportPage />);
    await screen.findByText('LKR received');
    expect(mocks.report.get).toHaveBeenCalledWith({});
    expect(screen.getByRole('img', { name: 'Stacked revenue by department and payment method' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Revenue received by Colombo date' })).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Revenue breakdown' })).getByText('Cardiology')).toBeInTheDocument();
  });

  it('applies filters and exports the same filtered report', async () => {
    render(<RevenueReportPage />);
    await screen.findByText('LKR received');
    fireEvent.change(screen.getByLabelText('Department'), { target: { value: 'd1' } });
    fireEvent.change(screen.getByLabelText('Payment method'), { target: { value: 'Cash' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
    await waitFor(() => expect(mocks.report.get).toHaveBeenCalledWith({ departmentId: 'd1', paymentMethod: 'Cash', currency: undefined, from: undefined, to: undefined }));
    fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }));
    await waitFor(() => expect(mocks.report.download).toHaveBeenCalledWith(
      { departmentId: 'd1', paymentMethod: 'Cash', currency: undefined, from: undefined, to: undefined }, 'Csv', 'Cardiology'));
    expect(mocks.save).toHaveBeenCalled();
  });

  it('still shows revenue when department names cannot be loaded', async () => {
    mocks.departments.list.mockRejectedValueOnce(new Error('Identity unavailable'));
    render(<RevenueReportPage />);

    await screen.findByText('LKR received');
    expect(screen.getByText('Department names are unavailable; IDs are shown instead.')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Revenue breakdown' })).getByText('d1')).toBeInTheDocument();
  });
});
