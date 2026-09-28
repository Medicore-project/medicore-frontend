import { beforeEach, describe, expect, it, vi } from 'vitest';
import apiClient from './client';
import { utilisationReportsApi } from './utilisationReports';

vi.mock('./client', () => ({
  default: {
    get: vi.fn(),
  },
}));

const mockedGet = vi.mocked(apiClient.get);

describe('utilisationReportsApi (SCRUM-38)', () => {
  beforeEach(() => {
    mockedGet.mockReset();
  });

  it('asks the appointment service for the unfiltered report by default', async () => {
    mockedGet.mockResolvedValueOnce({ data: { doctors: [] } });

    const response = await utilisationReportsApi.get();

    expect(mockedGet).toHaveBeenCalledWith('/appointment/reports/utilisation');
    expect(response).toEqual({ doctors: [] });
  });

  it('sends every chosen filter in one query and leaves out the empty ones', async () => {
    mockedGet.mockResolvedValueOnce({ data: {} });

    await utilisationReportsApi.get({ doctorId: 'doc-1', departmentId: '', from: '2026-09-01', to: undefined });

    expect(mockedGet).toHaveBeenCalledWith('/appointment/reports/utilisation?doctorId=doc-1&from=2026-09-01');
  });

  it('downloads with the same filters, the department label and the server file name', async () => {
    const blob = new Blob(['report']);
    mockedGet.mockResolvedValueOnce({
      data: blob,
      headers: {
        'content-disposition':
          "attachment; filename=medicore-utilisation-20260901-20260930.pdf; filename*=UTF-8''medicore-utilisation-20260901-20260930.pdf",
      },
    });

    const result = await utilisationReportsApi.download(
      { departmentId: 'dept-1', from: '2026-09-01', to: '2026-09-30' },
      'Pdf',
      '  Ear, Nose & Throat ',
    );

    expect(mockedGet).toHaveBeenCalledWith(
      '/appointment/reports/utilisation?departmentId=dept-1&from=2026-09-01&to=2026-09-30&departmentName=Ear%2C+Nose+%26+Throat&format=Pdf',
      { responseType: 'blob' },
    );
    expect(result).toEqual({ blob, fileName: 'medicore-utilisation-20260901-20260930.pdf' });
  });

  it('sends no department label without a department filter', async () => {
    mockedGet.mockResolvedValueOnce({ data: new Blob([]), headers: {} });

    await utilisationReportsApi.download({}, 'Csv', 'Cardiology');

    expect(mockedGet).toHaveBeenCalledWith('/appointment/reports/utilisation?format=Csv', { responseType: 'blob' });
  });

  it('falls back to a generic file name when the header is missing', async () => {
    mockedGet.mockResolvedValueOnce({ data: new Blob([]), headers: {} });

    const result = await utilisationReportsApi.download({}, 'Csv');

    expect(result.fileName).toBe('medicore-utilisation.csv');
  });
});
