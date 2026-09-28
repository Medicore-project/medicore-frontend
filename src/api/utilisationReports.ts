import apiClient from './client';
import { readDownloadFileName, type FileDownload } from '../utils/download';

/**
 * The doctor utilisation report (SCRUM-38), from the appointment service. Admin only.
 *
 * Every filter is optional and they combine freely. Dates are Colombo calendar dates, inclusive;
 * with none, the service reports the current month.
 */
export interface UtilisationReportFilters {
  doctorId?: string;
  departmentId?: string;
  from?: string;
  to?: string;
}

/** The filters the service actually used — the period always resolved to real dates. */
export interface AppliedUtilisationFilters {
  doctorId: string | null;
  departmentId: string | null;
  departmentName: string | null;
  from: string;
  to: string;
  /** True when no dates were sent and the service chose the current month. */
  isDefaultPeriod: boolean;
}

export interface DoctorUtilisationRow {
  doctorId: string;
  doctorName: string;
  specialization: string;
  departmentId: string;
  /** False for a doctor who has since left but had activity in the period. */
  isActive: boolean;
  completed: number;
  noShow: number;
  cancelled: number;
  /** Still `Booked`: upcoming, or past and never marked. */
  booked: number;
  /** Every appointment that was not cancelled. */
  total: number;
  /** No-shows over completed + no-shows, 0–1; null when there were no outcomes. */
  noShowRate: number | null;
  bookableSlots: number;
  usedSlots: number;
  /** Used slots over bookable slots, 0–1; null when there were no bookable slots. */
  fillRate: number | null;
}

export interface UtilisationTotals {
  doctors: number;
  completed: number;
  noShow: number;
  cancelled: number;
  booked: number;
  total: number;
  noShowRate: number | null;
  bookableSlots: number;
  usedSlots: number;
  fillRate: number | null;
}

export interface UtilisationReportResponse {
  generatedAtUtc: string;
  appliedFilters: AppliedUtilisationFilters;
  totals: UtilisationTotals;
  doctors: DoctorUtilisationRow[];
}

export type UtilisationExportFormat = 'Csv' | 'Pdf';

const endpoint = '/appointment/reports/utilisation';

function buildQuery(
  filters: UtilisationReportFilters,
  extra: Array<[string, string | undefined]> = [],
): string {
  const query = new URLSearchParams();
  const values: Array<[string, string | undefined]> = [
    ['doctorId', filters.doctorId],
    ['departmentId', filters.departmentId],
    ['from', filters.from],
    ['to', filters.to],
    ...extra,
  ];

  for (const [key, value] of values) {
    if (value) query.set(key, value);
  }

  const queryString = query.toString();
  return queryString ? `${endpoint}?${queryString}` : endpoint;
}

export const utilisationReportsApi = {
  get: (filters: UtilisationReportFilters = {}): Promise<UtilisationReportResponse> =>
    apiClient.get<UtilisationReportResponse>(buildQuery(filters)).then((response) => response.data),

  /**
   * The same report as a file. `departmentName` only labels the export: the appointment service
   * knows departments by id alone, so the page, which has the names from Identity, supplies it.
   * It is sent only with a department filter, since the service ignores it otherwise.
   */
  download: async (
    filters: UtilisationReportFilters,
    format: UtilisationExportFormat,
    departmentName?: string,
  ): Promise<FileDownload> => {
    const response = await apiClient.get<Blob>(
      buildQuery(filters, [
        ['departmentName', filters.departmentId ? departmentName?.trim() : undefined],
        ['format', format],
      ]),
      { responseType: 'blob' },
    );

    return {
      blob: response.data,
      fileName: readDownloadFileName(response, `medicore-utilisation.${format === 'Csv' ? 'csv' : 'pdf'}`),
    };
  },
};
