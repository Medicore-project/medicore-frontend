import apiClient from './client';
import { readDownloadFileName, type FileDownload } from '../utils/download';

export interface OutstandingReportFilters {
  departmentId?: string;
  currency?: string;
  from?: string;
  to?: string;
}

export interface OutstandingReportResponse {
  generatedAtUtc: string;
  appliedFilters: {
    departmentId: string | null;
    departmentName: string | null;
    currency: string | null;
    from: string | null;
    to: string | null;
    asOf: string;
  };
  totalsByCurrency: Array<{ currency: string; balanceDue: number; invoiceCount: number }>;
  buckets: Array<{
    departmentId: string | null;
    currency: string;
    bucket: string;
    balanceDue: number;
    invoiceCount: number;
  }>;
  invoices: Array<{
    invoiceId: string;
    invoiceNumber: string;
    departmentId: string | null;
    currency: string;
    issuedDate: string;
    finalizedDate: string;
    total: number;
    amountPaid: number;
    balanceDue: number;
    ageDays: number;
    bucket: string;
  }>;
}

const endpoint = '/billing/reports/outstanding';

function path(filters: OutstandingReportFilters, format?: 'Csv' | 'Pdf', departmentName?: string): string {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => { if (value) params.set(key, value); });
  if (format) params.set('format', format);
  if (filters.departmentId && departmentName?.trim()) params.set('departmentName', departmentName.trim());
  return params.size ? `${endpoint}?${params}` : endpoint;
}

export const outstandingReportsApi = {
  async get(filters: OutstandingReportFilters = {}): Promise<OutstandingReportResponse> {
    const response = await apiClient.get<OutstandingReportResponse>(path(filters));
    return response.data;
  },
  async download(filters: OutstandingReportFilters, format: 'Csv' | 'Pdf', departmentName?: string): Promise<FileDownload> {
    const response = await apiClient.get<Blob>(path(filters, format, departmentName), { responseType: 'blob' });
    return {
      blob: response.data,
      fileName: readDownloadFileName(response, `medicore-outstanding.${format.toLowerCase()}`),
    };
  },
};
