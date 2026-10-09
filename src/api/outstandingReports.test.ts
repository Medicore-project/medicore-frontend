import { beforeEach, describe, expect, it, vi } from 'vitest';
import apiClient from './client';
import { outstandingReportsApi } from './outstandingReports';

vi.mock('./client', () => ({ default: { get: vi.fn() } }));
const get = vi.mocked(apiClient.get);

describe('outstandingReportsApi (SCRUM-48)', () => {
  beforeEach(() => get.mockReset());

  it('requests all outstanding invoices by default', async () => {
    get.mockResolvedValueOnce({ data: { invoices: [] } });
    expect(await outstandingReportsApi.get()).toEqual({ invoices: [] });
    expect(get).toHaveBeenCalledWith('/billing/reports/outstanding');
  });

  it('exports the applied filters and display-only department name', async () => {
    const blob = new Blob(['report']);
    get.mockResolvedValueOnce({ data: blob, headers: { 'content-disposition': 'attachment; filename="outstanding.csv"' } });
    expect(await outstandingReportsApi.download({ departmentId: 'd1', currency: 'LKR', from: '2026-10-01' }, 'Csv', 'Cardiology'))
      .toEqual({ blob, fileName: 'outstanding.csv' });
    expect(get).toHaveBeenCalledWith(
      '/billing/reports/outstanding?departmentId=d1&currency=LKR&from=2026-10-01&format=Csv&departmentName=Cardiology',
      { responseType: 'blob' },
    );
  });
});
