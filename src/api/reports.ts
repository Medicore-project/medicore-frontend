import apiClient from './client';

export interface AuditReportRow {
  id: string;
  userId: string;
  userEmail: string;
  role: string;
  actionType: string;
  entityType: string;
  entityId: string;
  occurredAtUtc: string;
}

export interface AuditReportParams {
  startDate?: string;
  endDate?: string;
  actionType?: string;
  userId?: string;
}

export const reportsApi = {
  getAuditReport: (params: AuditReportParams = {}): Promise<AuditReportRow[]> => {
    const query = new URLSearchParams();
    if (params.startDate) query.set('startDate', params.startDate);
    if (params.endDate) query.set('endDate', params.endDate);
    if (params.actionType) query.set('actionType', params.actionType);
    if (params.userId) query.set('userId', params.userId);
    return apiClient.get<AuditReportRow[]>(`/api/reports/audit?${query.toString()}`).then((r) => r.data);
  },
};
