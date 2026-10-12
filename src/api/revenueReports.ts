import apiClient from './client';
import { readDownloadFileName, type FileDownload } from '../utils/download';

export interface RevenueReportFilters {
  departmentId?: string;
  paymentMethod?: string;
  currency?: string;
  from?: string;
  to?: string;
}

export interface RevenueBreakdownRow {
  departmentId: string | null;
  paymentMethod: string;
  currency: string;
  amount: number;
  paymentCount: number;
}

export interface RevenueReportResponse {
  generatedAtUtc: string;
  appliedFilters: RevenueReportFilters & {
    departmentId: string | null;
    departmentName: string | null;
    paymentMethod: string | null;
    currency: string | null;
    from: string;
    to: string;
    isDefaultPeriod: boolean;
  };
  totalsByCurrency: Array<{ currency: string; amount: number; paymentCount: number }>;
  breakdown: RevenueBreakdownRow[];
  dailyTotals: Array<{ date: string; currency: string; amount: number; paymentCount: number }>;
}

const endpoint = '/billing/reports/revenue';

function path(filters: RevenueReportFilters, format?: 'Csv' | 'Pdf', departmentName?: string): string {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => { if (value) params.set(key, value); });
  if (format) params.set('format', format);
  if (filters.departmentId && departmentName?.trim()) params.set('departmentName', departmentName.trim());
  return params.size ? `${endpoint}?${params}` : endpoint;
}

export const revenueReportsApi = {
  async get(filters: RevenueReportFilters = {}): Promise<RevenueReportResponse> {
    const response = await apiClient.get<RevenueReportResponse>(path(filters));
    return response.data;
  },
  async download(filters: RevenueReportFilters, format: 'Csv' | 'Pdf', departmentName?: string): Promise<FileDownload> {
    const response = await apiClient.get<Blob>(path(filters, format, departmentName), { responseType: 'blob' });
    return {
      blob: response.data,
      fileName: readDownloadFileName(response, `medicore-revenue.${format.toLowerCase()}`),
    };
  },
};
