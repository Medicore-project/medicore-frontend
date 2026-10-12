import apiClient from './client';

export interface NotificationTemplate {
  notificationTemplateId: string;
  code: string;
  name: string;
  subjectTemplate: string;
  bodyTemplate: string;
  isActive: boolean;
  createdAtUtc: string;
  updatedAtUtc: string | null;
}

export interface NotificationLog {
  notificationLogId: string;
  sourceMessageId: string;
  eventType: string;
  templateCode: string;
  recipient: string;
  subject: string;
  status: 'Pending' | 'Sent' | 'Failed';
  attemptCount: number;
  error: string | null;
  createdAtUtc: string;
  lastAttemptAtUtc: string | null;
  sentAtUtc: string | null;
}

export interface CreateNotificationTemplateRequest {
  code: string;
  name: string;
  subjectTemplate: string;
  bodyTemplate: string;
}

export interface UpdateNotificationTemplateRequest {
  name: string;
  subjectTemplate: string;
  bodyTemplate: string;
  isActive: boolean;
}

const templatesPath = '/billing/api/notification-templates';
const logsPath = '/billing/api/notifications';

export const notificationsApi = {
  async listTemplates(includeInactive = true): Promise<NotificationTemplate[]> {
    const response = await apiClient.get<NotificationTemplate[]>(templatesPath, { params: { includeInactive } });
    return Array.isArray(response.data) ? response.data : [];
  },

  async createTemplate(request: CreateNotificationTemplateRequest): Promise<NotificationTemplate> {
    const response = await apiClient.post<NotificationTemplate>(templatesPath, request);
    return response.data;
  },

  async updateTemplate(templateId: string, request: UpdateNotificationTemplateRequest): Promise<NotificationTemplate> {
    const response = await apiClient.put<NotificationTemplate>(`${templatesPath}/${templateId}`, request);
    return response.data;
  },

  async deactivateTemplate(templateId: string): Promise<void> {
    await apiClient.delete(`${templatesPath}/${templateId}`);
  },

  async listLogs(limit = 100): Promise<NotificationLog[]> {
    const response = await apiClient.get<NotificationLog[]>(logsPath, { params: { limit } });
    return Array.isArray(response.data) ? response.data : [];
  },
};
