import { beforeEach, describe, expect, it, vi } from 'vitest';
import apiClient from './client';
import { demographicsReportsApi } from './demographicsReports';

vi.mock('./client', () => ({
  default: {
    get: vi.fn(),
  },
}));

const mockedGet = vi.mocked(apiClient.get);

describe('demographicsReportsApi', () => {
  beforeEach(() => {
    mockedGet.mockReset();
  });

  it('requests the unfiltered patient-service report by default', async () => {
    mockedGet.mockResolvedValueOnce({ data: { totalPatients: 0 } });

    const response = await demographicsReportsApi.get();

    expect(mockedGet).toHaveBeenCalledWith('/patient/reports/demographics');
    expect(response).toEqual({ totalPatients: 0 });
  });

  it('passes every selected filter in one encoded query', async () => {
    mockedGet.mockResolvedValueOnce({ data: {} });

    await demographicsReportsApi.get({
      ageBand: '65+',
      gender: 'Female',
      district: '  Colombo West  ',
      from: '2026-01-01',
      to: '2026-06-30',
    });

    expect(mockedGet).toHaveBeenCalledWith(
      '/patient/reports/demographics?ageBand=65%2B&gender=Female&district=Colombo+West&from=2026-01-01&to=2026-06-30',
    );
  });

  it('downloads an export with the same filters and server file name', async () => {
    const blob = new Blob(['report']);
    mockedGet.mockResolvedValueOnce({
      data: blob,
      headers: {
        'content-disposition': 'attachment; filename="medicore-demographics-20260914.csv"',
      },
    });

    const result = await demographicsReportsApi.download({ gender: 'Other' }, 'Csv');

    expect(mockedGet).toHaveBeenCalledWith(
      '/patient/reports/demographics?gender=Other&format=Csv',
      { responseType: 'blob' },
    );
    expect(result).toEqual({
      blob,
      fileName: 'medicore-demographics-20260914.csv',
    });
  });
});
