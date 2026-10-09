import { beforeEach, describe, expect, it, vi } from 'vitest';
import apiClient from './client';
import { revenueReportsApi } from './revenueReports';

vi.mock('./client', () => ({ default: { get: vi.fn() } }));
const get = vi.mocked(apiClient.get);

describe('revenueReportsApi (SCRUM-47)', () => {
  beforeEach(() => get.mockReset());

  it('requests the default report without filters', async () => {
    get.mockResolvedValueOnce({ data: { totalsByCurrency: [] } });
    expect(await revenueReportsApi.get()).toEqual({ totalsByCurrency: [] });
    expect(get).toHaveBeenCalledWith('/billing/reports/revenue');
  });

  it('combines department, method, currency and dates', async () => {
    get.mockResolvedValueOnce({ data: {} });
    await revenueReportsApi.get({ departmentId: 'd1', paymentMethod: 'Cash', currency: 'LKR', from: '2026-10-01', to: '2026-10-31' });
    expect(get).toHaveBeenCalledWith('/billing/reports/revenue?departmentId=d1&paymentMethod=Cash&currency=LKR&from=2026-10-01&to=2026-10-31');
  });

  it('downloads the chosen format with the same filters and a display-only department label', async () => {
    const blob = new Blob(['report']);
    get.mockResolvedValueOnce({ data: blob, headers: { 'content-disposition': 'attachment; filename="revenue.csv"' } });
    expect(await revenueReportsApi.download({ departmentId: 'd1' }, 'Csv', 'Cardiology'))
      .toEqual({ blob, fileName: 'revenue.csv' });
    expect(get).toHaveBeenCalledWith(
      '/billing/reports/revenue?departmentId=d1&format=Csv&departmentName=Cardiology',
      { responseType: 'blob' },
    );
  });
});
