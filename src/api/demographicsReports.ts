import type { AxiosResponse } from 'axios';
import apiClient from './client';

export const DEMOGRAPHICS_AGE_BANDS = ['0-17', '18-34', '35-49', '50-64', '65+'] as const;
export const DEMOGRAPHICS_GENDERS = ['Male', 'Female', 'Other', 'PreferNotToSay'] as const;

export interface DemographicsReportFilters {
  ageBand?: string;
  gender?: string;
  district?: string;
  from?: string;
  to?: string;
}

export interface AppliedDemographicsFilters {
  ageBand: string | null;
  gender: string | null;
  district: string | null;
  from: string | null;
  to: string | null;
}

export interface DemographicsBreakdownRow {
  label: string;
  patientCount: number;
  visitCount: number;
}

export interface VisitHistoryBucket {
  period: string;
  periodStart: string;
  visitCount: number;
}

export interface DemographicsPatientSummary {
  patientId: string;
  patientNumber: string;
  age: number;
  ageBand: string;
  gender: string;
  district: string;
  visitCount: number;
  firstVisitAtUtc: string | null;
  latestVisitAtUtc: string | null;
}

export interface DemographicsReportResponse {
  generatedAtUtc: string;
  appliedFilters: AppliedDemographicsFilters;
  totalPatients: number;
  totalVisits: number;
  patientsWithVisits: number;
  patientsWithoutVisits: number;
  ageBands: DemographicsBreakdownRow[];
  genders: DemographicsBreakdownRow[];
  districts: DemographicsBreakdownRow[];
  visitHistory: VisitHistoryBucket[];
  patients: DemographicsPatientSummary[];
}

export type DemographicsExportFormat = 'Csv' | 'Pdf';

export interface ReportDownload {
  blob: Blob;
  fileName: string;
}

const endpoint = '/patient/reports/demographics';

function buildQuery(filters: DemographicsReportFilters, format?: DemographicsExportFormat): string {
  const query = new URLSearchParams();
  const values: Array<[string, string | undefined]> = [
    ['ageBand', filters.ageBand],
    ['gender', filters.gender],
    ['district', filters.district?.trim()],
    ['from', filters.from],
    ['to', filters.to],
  ];

  for (const [key, value] of values) {
    if (value) query.set(key, value);
  }
  if (format) query.set('format', format);

  const queryString = query.toString();
  return queryString ? `${endpoint}?${queryString}` : endpoint;
}

function readFileName(response: AxiosResponse<Blob>, format: DemographicsExportFormat): string {
  const disposition = response.headers['content-disposition'];
  if (typeof disposition === 'string') {
    const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
    if (utf8Match?.[1]) return decodeURIComponent(utf8Match[1]);

    const fileNameMatch = disposition.match(/filename="?([^";]+)"?/i);
    if (fileNameMatch?.[1]) return fileNameMatch[1];
  }

  const extension = format === 'Csv' ? 'csv' : 'pdf';
  return `medicore-demographics.${extension}`;
}

export const demographicsReportsApi = {
  get: (filters: DemographicsReportFilters = {}): Promise<DemographicsReportResponse> =>
    apiClient
      .get<DemographicsReportResponse>(buildQuery(filters))
      .then((response) => response.data),

  download: async (
    filters: DemographicsReportFilters,
    format: DemographicsExportFormat,
  ): Promise<ReportDownload> => {
    const response = await apiClient.get<Blob>(buildQuery(filters, format), {
      responseType: 'blob',
    });

    return {
      blob: response.data,
      fileName: readFileName(response, format),
    };
  },
};
