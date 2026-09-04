import apiClient from './client';

export interface AuditReportRow {
  id: string | number;
  occurredAtUtc: string;
  userId: string | number;
  userEmail: string;
  actionType: string;
  entityType: string;
  entityId: string;
  ipAddress?: string;
}

export interface AuditReportParams {
  from?: string;
  to?: string;
  actionType?: string;
  userId?: string | number;
}

export const reportsApi = {
  getAuditReport: (params: AuditReportParams = {}): Promise<AuditReportRow[]> => {
    const query = new URLSearchParams();
    if (params.from) query.set('from', params.from);
    if (params.to) query.set('to', params.to);
    if (params.actionType) query.set('actionType', params.actionType);
    if (params.userId) query.set('userId', String(params.userId));
    return apiClient.get<AuditReportRow[]>(`/api/reports/audit?${query.toString()}`).then((r) => r.data);
  },
};
