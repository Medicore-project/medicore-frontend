import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import OutstandingReportPage from './OutstandingReportPage';

const mocks = vi.hoisted(() => ({
  report: { get: vi.fn(), download: vi.fn() },
  departments: { list: vi.fn() },
  save: vi.fn(),
}));
vi.mock('../api/outstandingReports', () => ({ outstandingReportsApi: mocks.report }));
vi.mock('../api/departments', () => ({ departmentsApi: mocks.departments }));
vi.mock('../utils/download', () => ({ triggerBrowserDownload: mocks.save }));
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  BarChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Bar: () => null, CartesianGrid: () => null, Tooltip: () => null, XAxis: () => null, YAxis: () => null,
}));

const response = {
  generatedAtUtc: '2026-10-09T06:00:00Z',
  appliedFilters: { departmentId: null, departmentName: null, currency: null,
    from: null, to: null, asOf: '2026-10-09' },
  totalsByCurrency: [{ currency: 'LKR', balanceDue: 70, invoiceCount: 1 }],
  buckets: [{ departmentId: 'd1', currency: 'LKR', bucket: '31-60', balanceDue: 70, invoiceCount: 1 }],
  invoices: [{ invoiceId: 'i1', invoiceNumber: 'INV-001', departmentId: 'd1', currency: 'LKR',
    issuedDate: '2026-09-07', finalizedDate: '2026-09-08', total: 100, amountPaid: 30,
    balanceDue: 70, ageDays: 31, bucket: '31-60' }],
};

describe('OutstandingReportPage (SCRUM-48)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.report.get.mockResolvedValue(response);
    mocks.departments.list.mockResolvedValue([{ id: 'd1', name: 'Cardiology', isActive: true }]);
    mocks.report.download.mockResolvedValue({ blob: new Blob(['x']), fileName: 'outstanding.csv' });
  });

  it('shows payable balances, ageing and a link to the invoice', async () => {
    render(<MemoryRouter><OutstandingReportPage /></MemoryRouter>);
    await screen.findByText('LKR outstanding');
    expect(mocks.report.get).toHaveBeenCalledWith({});
    expect(screen.getByRole('img', { name: 'Outstanding balance by ageing bucket' })).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Ageing by department' })).getByText('Cardiology')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'INV-001' })).toHaveAttribute('href', '/billing/invoices/i1');
    expect(screen.getByText(/Balances as of 2026-10-09/)).toBeInTheDocument();
  });

  it('applies issue-date filters and exports the same selection', async () => {
    render(<MemoryRouter><OutstandingReportPage /></MemoryRouter>);
    await screen.findByText('LKR outstanding');
    fireEvent.change(screen.getByLabelText('Department'), { target: { value: 'd1' } });
    fireEvent.change(screen.getByLabelText('Issued from'), { target: { value: '2026-09-01' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
    await waitFor(() => expect(mocks.report.get).toHaveBeenCalledWith({
      departmentId: 'd1', currency: undefined, from: '2026-09-01', to: undefined,
    }));
    fireEvent.click(screen.getByRole('button', { name: 'Export CSV' }));
    await waitFor(() => expect(mocks.report.download).toHaveBeenCalledWith(
      { departmentId: 'd1', currency: undefined, from: '2026-09-01', to: undefined },
      'Csv', 'Cardiology'));
    expect(mocks.save).toHaveBeenCalled();
  });

  it('keeps reporting when department names are unavailable', async () => {
    mocks.departments.list.mockRejectedValueOnce(new Error('Identity unavailable'));
    render(<MemoryRouter><OutstandingReportPage /></MemoryRouter>);
    await screen.findByText('LKR outstanding');
    expect(screen.getByText('Department names are unavailable; IDs are shown instead.')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Ageing by department' })).getByText('d1')).toBeInTheDocument();
  });
});
